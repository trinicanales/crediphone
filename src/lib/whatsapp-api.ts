/**
 * FASE 55: WhatsApp Business API Oficial (Meta Cloud API)
 *
 * Modo dual:
 *  - Si la tienda tiene `wa_enabled = true` + credenciales → envía via API automáticamente
 *  - Si no → retorna link wa.me para envío manual (comportamiento anterior)
 *
 * Documentación Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CanalEnvio = "api" | "link" | "manual";
export type EstadoMensaje = "pendiente" | "enviado" | "entregado" | "leido" | "fallido";

export interface WAConfig {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  logMensajes: boolean;
  distribuidorId?: string;
}

export interface SendResult {
  success: boolean;
  canal: CanalEnvio;
  /** ID de mensaje de Meta (solo cuando canal = 'api') */
  waMessageId?: string;
  /** Link wa.me para apertura manual (cuando canal = 'link') */
  waLink?: string;
  error?: string;
  /** ID del registro en whatsapp_mensajes (si log habilitado) */
  logId?: string;
}

export interface SendOptions {
  /** Telefono destino — solo dígitos o con código de país */
  telefono: string;
  mensaje: string;
  distribuidorId?: string;
  /** Contexto para el log */
  entidadTipo?: "credito" | "reparacion" | "pago" | "recordatorio" | "otro";
  entidadId?: string;
  enviadoPorId?: string;
  enviadoPorNombre?: string;
  /** Si true, fuerza canal 'link' aunque haya API configurada */
  forceLinkMode?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizarTelefono(telefono: string): string {
  const limpio = telefono.replace(/\D/g, "");
  if (limpio.startsWith("52") && limpio.length >= 12) return limpio;
  if (limpio.length === 10) return `52${limpio}`;
  return `52${limpio}`;
}

export function generarLinkWa(telefono: string, mensaje: string): string {
  const num = normalizarTelefono(telefono);
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}

// ─── Obtener config WA del distribuidor ──────────────────────────────────────

export async function getWAConfig(distribuidorId?: string): Promise<WAConfig | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from("configuracion")
    .select(
      "wa_enabled, wa_phone_number_id, wa_access_token, wa_api_version, wa_log_mensajes, distribuidor_id"
    );

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  } else {
    query = query.is("distribuidor_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    enabled: data.wa_enabled ?? false,
    phoneNumberId: data.wa_phone_number_id ?? "",
    accessToken: data.wa_access_token ?? "",
    apiVersion: data.wa_api_version ?? "v20.0",
    logMensajes: data.wa_log_mensajes ?? true,
    distribuidorId: data.distribuidor_id,
  };
}

// ─── Enviar mensaje de texto via Meta Cloud API ───────────────────────────────

async function sendViaAPI(
  telefono: string,
  mensaje: string,
  config: WAConfig
): Promise<{ success: boolean; waMessageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizarTelefono(telefono),
    type: "text",
    text: {
      preview_url: false,
      body: mensaje,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg =
        data?.error?.message ?? data?.error?.error_data?.details ?? `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    const waMessageId = data?.messages?.[0]?.id as string | undefined;
    return { success: true, waMessageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error de red",
    };
  }
}

// ─── Guardar en log ───────────────────────────────────────────────────────────

async function guardarLog(opts: {
  distribuidorId?: string;
  telefono: string;
  mensaje: string;
  canal: CanalEnvio;
  estado: EstadoMensaje;
  waMessageId?: string;
  errorDetalle?: string;
  entidadTipo?: string;
  entidadId?: string;
  enviadoPorId?: string;
  enviadoPorNombre?: string;
}): Promise<string | undefined> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("whatsapp_mensajes")
      .insert({
        distribuidor_id: opts.distribuidorId ?? null,
        telefono: opts.telefono,
        mensaje: opts.mensaje,
        tipo: "outbound",
        canal: opts.canal,
        estado: opts.estado,
        wa_message_id: opts.waMessageId ?? null,
        error_detalle: opts.errorDetalle ?? null,
        entidad_tipo: opts.entidadTipo ?? null,
        entidad_id: opts.entidadId ?? null,
        enviado_por_id: opts.enviadoPorId ?? null,
        enviado_por_nombre: opts.enviadoPorNombre ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[WA log] Error al guardar:", error.message);
      return undefined;
    }
    return data?.id as string | undefined;
  } catch {
    return undefined;
  }
}

// ─── Función principal de envío ───────────────────────────────────────────────

/**
 * Envía un mensaje de WhatsApp.
 *
 * - Si la tienda tiene WA Business API configurada y activa → envía automáticamente
 * - Si no → retorna un link wa.me para que el usuario lo abra manualmente
 *
 * Esta función NUNCA lanza errores — retorna siempre un SendResult.
 */
export async function sendWhatsApp(opts: SendOptions): Promise<SendResult> {
  const { telefono, mensaje, distribuidorId, forceLinkMode } = opts;

  let config: WAConfig | null = null;

  if (!forceLinkMode) {
    config = await getWAConfig(distribuidorId).catch(() => null);
  }

  const useAPI =
    !forceLinkMode &&
    config !== null &&
    config.enabled &&
    config.phoneNumberId &&
    config.accessToken;

  // ── Modo API ────────────────────────────────────────────────────────────────
  if (useAPI && config) {
    const result = await sendViaAPI(telefono, mensaje, config);

    let logId: string | undefined;
    if (config.logMensajes) {
      logId = await guardarLog({
        distribuidorId,
        telefono,
        mensaje,
        canal: "api",
        estado: result.success ? "enviado" : "fallido",
        waMessageId: result.waMessageId,
        errorDetalle: result.error,
        entidadTipo: opts.entidadTipo,
        entidadId: opts.entidadId,
        enviadoPorId: opts.enviadoPorId,
        enviadoPorNombre: opts.enviadoPorNombre,
      });
    }

    if (result.success) {
      return { success: true, canal: "api", waMessageId: result.waMessageId, logId };
    }

    // Si la API falló, registrar el error y caer a modo link como fallback
    console.warn("[WA API] Falló, fallback a link:", result.error);
    // El log de fallo ya quedó guardado arriba
  }

  // ── Modo Link (fallback / sin API) ──────────────────────────────────────────
  const waLink = generarLinkWa(telefono, mensaje);

  let logId: string | undefined;
  if (config?.logMensajes || !config) {
    // Loggear incluso en modo link para tener historial de intentos
    logId = await guardarLog({
      distribuidorId,
      telefono,
      mensaje,
      canal: "link",
      estado: "pendiente", // el humano aún no lo ha enviado
      entidadTipo: opts.entidadTipo,
      entidadId: opts.entidadId,
      enviadoPorId: opts.enviadoPorId,
      enviadoPorNombre: opts.enviadoPorNombre,
    });
  }

  return { success: true, canal: "link", waLink, logId };
}

// ─── Verificar token de webhook ───────────────────────────────────────────────

export async function verificarWebhookToken(
  distribuidorId: string | undefined,
  token: string
): Promise<boolean> {
  const config = await getWAConfig(distribuidorId).catch(() => null);
  if (!config?.enabled) return false;

  // Obtener el verify token configurado
  const supabase = createAdminClient();
  let q = supabase
    .from("configuracion")
    .select("wa_webhook_verify_token");
  if (distribuidorId) q = q.eq("distribuidor_id", distribuidorId);
  else q = q.is("distribuidor_id", null);

  const { data } = await q.maybeSingle();
  return data?.wa_webhook_verify_token === token;
}
