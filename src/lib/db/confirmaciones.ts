import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfirmacionDeposito } from "@/types";

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapConfirmacionFromDB(row: any): ConfirmacionDeposito {
  return {
    id: row.id,
    distribuidorId: row.distribuidor_id,
    reparacionId: row.reparacion_id,
    anticipoId: row.anticipo_id,
    monto: Number(row.monto),
    tipoPago: row.tipo_pago,
    referenciaBancaria: row.referencia_bancaria,
    fotoComprobanteUrl: row.foto_comprobante_url,
    registradoPor: row.registrado_por,
    estado: row.estado,
    confirmadoPor: row.confirmado_por,
    confirmadoAt: row.confirmado_at ? new Date(row.confirmado_at) : undefined,
    razonRechazo: row.razon_rechazo,
    linkToken: row.link_token,
    whatsappEnviadoAt: row.whatsapp_enviado_at ? new Date(row.whatsapp_enviado_at) : undefined,
    folioOrden: row.folio_orden,
    clienteNombre: row.cliente_nombre,
    registradorNombre: row.registrador_nombre,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    // Joins (si vienen del query)
    confirmadorNombre: row.confirmador?.nombre
      ? [row.confirmador.nombre, row.confirmador.apellido].filter(Boolean).join(" ")
      : undefined,
  };
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Crea una nueva confirmación de depósito/transferencia.
 * El anticipo ya fue creado en anticipos_reparacion (sin caja).
 * La caja solo se asienta cuando el admin confirme.
 */
export async function createConfirmacionDeposito(params: {
  distribuidorId?: string;
  reparacionId: string;
  anticipoId: string;
  monto: number;
  tipoPago: "transferencia" | "deposito";
  referenciaBancaria?: string;
  registradoPor: string;
  folioOrden?: string;
  clienteNombre?: string;
  registradorNombre?: string;
}): Promise<ConfirmacionDeposito> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("confirmaciones_deposito")
    .insert({
      distribuidor_id: params.distribuidorId ?? null,
      reparacion_id: params.reparacionId,
      anticipo_id: params.anticipoId,
      monto: params.monto,
      tipo_pago: params.tipoPago,
      referencia_bancaria: params.referenciaBancaria ?? null,
      registrado_por: params.registradoPor,
      folio_orden: params.folioOrden ?? null,
      cliente_nombre: params.clienteNombre ?? null,
      registrador_nombre: params.registradorNombre ?? null,
      estado: "pendiente_confirmacion",
    })
    .select()
    .single();

  if (error) throw error;
  return mapConfirmacionFromDB(data);
}

/**
 * Obtiene las confirmaciones pendientes (para panel del admin).
 */
export async function getConfirmacionesPendientes(
  distribuidorId?: string | null
): Promise<ConfirmacionDeposito[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("confirmaciones_deposito")
    .select("*")
    .eq("estado", "pendiente_confirmacion")
    .order("created_at", { ascending: false });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapConfirmacionFromDB);
}

/**
 * Obtiene todas las confirmaciones (para historial).
 */
export async function getConfirmaciones(
  distribuidorId?: string | null,
  limit = 50
): Promise<ConfirmacionDeposito[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("confirmaciones_deposito")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapConfirmacionFromDB);
}

/**
 * Obtiene una confirmación por su link_token (para la página pública de WhatsApp).
 * No requiere auth — solo el token es suficiente para identificar el registro.
 */
export async function getConfirmacionByToken(
  token: string
): Promise<ConfirmacionDeposito | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("confirmaciones_deposito")
    .select("*")
    .eq("link_token", token)
    .single();

  if (error) return null;
  return mapConfirmacionFromDB(data);
}

/**
 * Obtiene una confirmación por su ID.
 */
export async function getConfirmacionById(
  id: string
): Promise<ConfirmacionDeposito | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("confirmaciones_deposito")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return mapConfirmacionFromDB(data);
}

/**
 * Confirma un depósito/transferencia.
 * Actualiza el estado a "confirmado" y crea la entrada en caja.
 */
export async function confirmarDeposito(
  id: string,
  adminId: string,
  sesionCajaId?: string
): Promise<ConfirmacionDeposito> {
  const supabase = createAdminClient();

  // 1. Obtener la confirmación
  const { data: conf, error: confErr } = await supabase
    .from("confirmaciones_deposito")
    .select("*")
    .eq("id", id)
    .single();

  if (confErr || !conf) throw new Error("Confirmación no encontrada");
  if (conf.estado !== "pendiente_confirmacion") {
    throw new Error(`No se puede confirmar: estado actual es "${conf.estado}"`);
  }

  // 2. Si hay sesión de caja → crear entrada en caja
  if (sesionCajaId) {
    await supabase.from("caja_movimientos").insert({
      sesion_id: sesionCajaId,
      tipo: "anticipo_reparacion",
      monto: conf.monto,
      descripcion: `Anticipo por ${conf.tipo_pago} — ${conf.folio_orden || conf.reparacion_id}`,
      referencia_id: conf.reparacion_id,
      registrado_por: adminId,
    });
  }

  // 3. Actualizar estado de la confirmación
  const { data: updated, error: updErr } = await supabase
    .from("confirmaciones_deposito")
    .update({
      estado: "confirmado",
      confirmado_por: adminId,
      confirmado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updErr) throw updErr;
  return mapConfirmacionFromDB(updated);
}

/**
 * Rechaza un depósito/transferencia.
 */
export async function rechazarDeposito(
  id: string,
  adminId: string,
  razon: string
): Promise<ConfirmacionDeposito> {
  const supabase = createAdminClient();

  const { data: conf } = await supabase
    .from("confirmaciones_deposito")
    .select("estado")
    .eq("id", id)
    .single();

  if (!conf) throw new Error("Confirmación no encontrada");
  if (conf.estado !== "pendiente_confirmacion") {
    throw new Error(`No se puede rechazar: estado actual es "${conf.estado}"`);
  }

  const { data: updated, error } = await supabase
    .from("confirmaciones_deposito")
    .update({
      estado: "rechazado",
      confirmado_por: adminId,
      confirmado_at: new Date().toISOString(),
      razon_rechazo: razon,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapConfirmacionFromDB(updated);
}

/**
 * Obtiene el conteo de confirmaciones pendientes (para badge).
 */
export async function countConfirmacionesPendientes(
  distribuidorId?: string | null
): Promise<number> {
  const supabase = createAdminClient();

  let query = supabase
    .from("confirmaciones_deposito")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente_confirmacion");

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { count } = await query;
  return count ?? 0;
}

/**
 * Obtiene las confirmaciones de una reparación específica.
 */
export async function getConfirmacionesByReparacion(
  reparacionId: string
): Promise<ConfirmacionDeposito[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("confirmaciones_deposito")
    .select("*")
    .eq("reparacion_id", reparacionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapConfirmacionFromDB);
}
