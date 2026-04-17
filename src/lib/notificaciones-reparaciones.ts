/**
 * FASE 10: Servicio de Notificaciones Automatizadas para Reparaciones
 * Se ejecuta en el servidor cuando cambia el estado de una orden
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OrdenReparacionDetallada,
  EstadoOrdenReparacion,
} from "@/types";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/web-push-service";
import {
  generarMensajePresupuesto,
  generarMensajeReparacionCompletada,
  generarMensajeSeguimiento,
  generarMensajeListoEntrega,
  generarMensajeNoReparable,
  generarMensajeCancelacion,
} from "@/lib/whatsapp-reparaciones";
import { sendWhatsApp, generarLinkWa } from "@/lib/whatsapp-api";
import { getAdminIdsParaNotificar } from "@/lib/db/notificaciones";

// Tipos de notificación para reparaciones (match con DB constraint)
type TipoNotificacionReparacion =
  | "orden_actualizada"
  | "orden_completada"
  | "orden_lista_entrega"
  | "cliente_aprobo"
  | "cliente_rechazo";

interface NotificacionCreada {
  id: string;
  tipo: string;
  canal: string;
  mensaje: string;
  whatsappLink?: string;
}

/**
 * Notifica automáticamente al cambiar el estado de una orden.
 * No lanza errores - las notificaciones son opcionales y no deben bloquear el flujo.
 */
export async function notificarCambioEstado(
  orden: OrdenReparacionDetallada,
  nuevoEstado: EstadoOrdenReparacion,
  notas?: string
): Promise<NotificacionCreada[]> {
  const notificaciones: NotificacionCreada[] = [];

  try {
    const config = getConfiguracionNotificacion(nuevoEstado);

    if (!config) return notificaciones;

    // Para estado "presupuesto": crear token de tracking y usarlo en el mensaje
    let trackingUrlPresupuesto: string | undefined;
    if (nuevoEstado === "presupuesto") {
      trackingUrlPresupuesto = await crearTrackingToken(orden.id);
    }

    // Resolver IDs de admin del distribuidor (una sola vez, reutilizado en el loop)
    let adminIds: string[] = [];
    const necesitaAdmin = config.destinos.some((d) => d.tipo === "admin");
    if (necesitaAdmin) {
      adminIds = await getAdminIdsParaNotificar(orden.distribuidorId ?? undefined).catch(() => []);
    }

    for (const destino of config.destinos) {
      try {
        const mensaje = nuevoEstado === "presupuesto" && trackingUrlPresupuesto
          ? generarMensajePresupuesto(orden, trackingUrlPresupuesto)
          : config.generarMensaje(orden, notas);

        if (destino.tipo === "admin" && adminIds.length > 0) {
          // BUG FIX: Antes destinatarioId era undefined para admins → notif se perdía.
          // Ahora creamos una notificación por cada admin del distribuidor.
          for (const adminId of adminIds) {
            await crearNotificacionReparacion({
              ordenId: orden.id,
              destinatarioId: adminId,
              tipo: config.tipoNotificacion,
              canal: destino.canal,
              mensaje,
              folio: orden.folio,
            });
            notificaciones.push({
              id: adminId,
              tipo: config.tipoNotificacion,
              canal: destino.canal,
              mensaje,
            });
          }
        } else {
          const notificacion = await crearNotificacionReparacion({
            ordenId: orden.id,
            clienteId: destino.tipo === "cliente" ? orden.clienteId : undefined,
            destinatarioId: destino.tipo === "tecnico" ? orden.tecnicoId : undefined,
            tipo: config.tipoNotificacion,
            canal: destino.canal,
            mensaje,
            telefono: destino.tipo === "cliente" ? orden.clienteTelefono : undefined,
            folio: orden.folio,
          });

          const resultado: NotificacionCreada = {
            id: notificacion?.id || "",
            tipo: config.tipoNotificacion,
            canal: destino.canal,
            mensaje,
          };

          // Enviar / preparar WhatsApp si es canal whatsapp
          if (destino.canal === "whatsapp" && orden.clienteTelefono) {
            // Intentar envío via API; si no está configurada → retorna link
            const waResult = await sendWhatsApp({
              telefono:    orden.clienteTelefono,
              mensaje,
              distribuidorId: orden.distribuidorId ?? undefined,
              entidadTipo: "reparacion",
              entidadId:   orden.id,
            }).catch(() => null);

            if (waResult?.canal === "link" && waResult.waLink) {
              resultado.whatsappLink = waResult.waLink;
            } else if (!waResult) {
              resultado.whatsappLink = generarLinkWa(orden.clienteTelefono, mensaje);
            }
          }

          notificaciones.push(resultado);
        }
      } catch (err) {
        console.error(
          `Error al notificar ${destino.tipo} por ${destino.canal}:`,
          err
        );
      }
    }

    // Push nativo a destinatarios con canal "sistema" (fire-and-forget)
    const pushPayload = {
      title: `Orden ${orden.folio}`,
      body: config!.generarMensaje(orden),
      url: `/dashboard/reparaciones/${orden.id}`,
    };

    const idsParaPush: string[] = [];
    for (const d of config.destinos) {
      if (d.canal !== "sistema") continue;
      if (d.tipo === "tecnico" && orden.tecnicoId) idsParaPush.push(orden.tecnicoId);
      if (d.tipo === "admin") idsParaPush.push(...adminIds); // BUG FIX: admin push funcionando
    }

    if (idsParaPush.length > 0) {
      sendPushToUsers(idsParaPush, pushPayload).catch(() => {}); // fire-and-forget
    }
  } catch (error) {
    console.error("Error en notificarCambioEstado:", error);
  }

  return notificaciones;
}

/**
 * Configuración de notificaciones por estado
 */
interface ConfigNotificacion {
  tipoNotificacion: TipoNotificacionReparacion;
  destinos: Array<{
    tipo: "cliente" | "tecnico" | "admin";
    canal: "whatsapp" | "sistema";
  }>;
  generarMensaje: (orden: OrdenReparacionDetallada, notas?: string) => string;
}

function getConfiguracionNotificacion(
  estado: EstadoOrdenReparacion
): ConfigNotificacion | null {
  const configuraciones: Partial<
    Record<EstadoOrdenReparacion, ConfigNotificacion>
  > = {
    diagnostico: {
      tipoNotificacion: "orden_actualizada",
      destinos: [{ tipo: "admin", canal: "sistema" }],
      generarMensaje: (orden) =>
        `Orden ${orden.folio}: Diagnóstico iniciado para ${orden.marcaDispositivo} ${orden.modeloDispositivo}`,
    },

    presupuesto: {
      tipoNotificacion: "orden_actualizada",
      destinos: [{ tipo: "cliente", canal: "whatsapp" }],
      generarMensaje: (orden) => generarMensajePresupuesto(orden),
    },

    aprobado: {
      tipoNotificacion: "orden_actualizada",
      destinos: [{ tipo: "tecnico", canal: "sistema" }],
      generarMensaje: (orden) =>
        `Orden ${orden.folio} APROBADA: ${orden.marcaDispositivo} ${orden.modeloDispositivo} - Cliente autorizó la reparación. Presupuesto: $${(orden.costoTotal || 0).toFixed(2)}`,
    },

    en_reparacion: {
      tipoNotificacion: "orden_actualizada",
      destinos: [{ tipo: "cliente", canal: "whatsapp" }],
      generarMensaje: (orden) => generarMensajeSeguimiento(orden),
    },

    completado: {
      tipoNotificacion: "orden_completada",
      destinos: [
        { tipo: "admin", canal: "sistema" },     // aviso interno al admin
        { tipo: "cliente", canal: "whatsapp" },  // B3: aviso al cliente "tu equipo está listo"
      ],
      generarMensaje: (orden) => generarMensajeReparacionCompletada(orden),
    },

    listo_entrega: {
      tipoNotificacion: "orden_lista_entrega",
      destinos: [{ tipo: "cliente", canal: "whatsapp" }],
      generarMensaje: (orden) => generarMensajeListoEntrega(orden),
    },

    entregado: {
      tipoNotificacion: "orden_actualizada",
      destinos: [{ tipo: "cliente", canal: "whatsapp" }],
      generarMensaje: (orden) => generarMensajeReparacionCompletada(orden),
    },

    no_reparable: {
      tipoNotificacion: "orden_actualizada",
      destinos: [
        { tipo: "cliente", canal: "whatsapp" },
        { tipo: "admin", canal: "sistema" },
      ],
      generarMensaje: (orden) => generarMensajeNoReparable(orden),
    },

    cancelado: {
      tipoNotificacion: "orden_actualizada",
      destinos: [
        { tipo: "cliente", canal: "whatsapp" },
        { tipo: "tecnico", canal: "sistema" },
      ],
      generarMensaje: (orden, notas) =>
        generarMensajeCancelacion(orden, notas),
    },
  };

  return configuraciones[estado] || null;
}

/**
 * Crea o renueva un token de tracking (64 caracteres) para que el cliente
 * pueda aprobar/rechazar el presupuesto desde el link de WhatsApp.
 * Retorna la URL completa del tracking link, o undefined si falla.
 */
async function crearTrackingToken(
  ordenId: string
): Promise<string | undefined> {
  try {
    const supabase = createAdminClient();
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex"); // 64 chars hex
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 días

    const { error } = await supabase.from("tracking_tokens").insert({
      orden_id: ordenId,
      token,
      expires_at: expiresAt.toISOString(),
      accesos: 0,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error al crear tracking token:", error);
      return undefined;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone-one.vercel.app";
    return `${baseUrl}/tracking/${token}`;
  } catch (err) {
    console.error("Error en crearTrackingToken:", err);
    return undefined;
  }
}

/**
 * Crea un registro de notificación en la base de datos
 */
async function crearNotificacionReparacion(data: {
  ordenId: string;
  clienteId?: string;
  destinatarioId?: string;
  tipo: string;
  canal: string;
  mensaje: string;
  telefono?: string;
  folio: string;
}): Promise<{ id: string } | null> {
  try {
    const supabase = createAdminClient();

    const { data: result, error } = await supabase
      .from("notificaciones")
      .insert({
        orden_reparacion_id: data.ordenId,
        cliente_id: data.clienteId || null,
        destinatario_id: data.destinatarioId || null,
        tipo: data.tipo,
        canal: data.canal,
        estado: data.canal === "sistema" ? "enviado" : "pendiente",
        mensaje: data.mensaje,
        telefono: data.telefono || null,
        fecha_enviado:
          data.canal === "sistema" ? new Date().toISOString() : null,
        datos_adicionales: {
          folio: data.folio,
          origen: "cambio_estado_automatico",
          fecha_accion: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error al crear notificación:", error);
      return null;
    }

    return result;
  } catch (error) {
    console.error("Error en crearNotificacionReparacion:", error);
    return null;
  }
}

/**
 * Obtiene notificaciones de una orden específica
 */
export async function getNotificacionesOrden(
  ordenId: string
): Promise<any[]> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("orden_reparacion_id", ordenId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al obtener notificaciones de orden:", error);
      return [];
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      ordenId: n.orden_reparacion_id,
      clienteId: n.cliente_id,
      destinatarioId: n.destinatario_id,
      tipo: n.tipo,
      canal: n.canal,
      estado: n.estado,
      mensaje: n.mensaje,
      telefono: n.telefono,
      fechaEnviado: n.fecha_enviado,
      fechaLeido: n.fecha_leido,
      datosAdicionales: n.datos_adicionales,
      createdAt: n.created_at,
    }));
  } catch (error) {
    console.error("Error en getNotificacionesOrden:", error);
    return [];
  }
}

/**
 * Obtiene notificaciones pendientes/no leídas de un usuario
 */
export async function getNotificacionesUsuario(
  usuarioId: string,
  soloNoLeidas: boolean = false,
  limite: number = 20
): Promise<any[]> {
  try {
    const supabase = createAdminClient();

    let query = supabase
      .from("notificaciones")
      .select("*")
      .eq("destinatario_id", usuarioId)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (soloNoLeidas) {
      query = query.in("estado", ["pendiente", "enviado"]);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error al obtener notificaciones del usuario:", error);
      return [];
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      ordenId: n.orden_reparacion_id,
      creditoId: n.credito_id,
      tipo: n.tipo,
      canal: n.canal,
      estado: n.estado,
      mensaje: n.mensaje,
      datosAdicionales: n.datos_adicionales,
      createdAt: n.created_at,
      fechaLeido: n.fecha_leido,
    }));
  } catch (error) {
    console.error("Error en getNotificacionesUsuario:", error);
    return [];
  }
}

/**
 * Cuenta notificaciones no leídas de un usuario
 */
export async function contarNotificacionesNoLeidas(
  usuarioId: string
): Promise<number> {
  try {
    const supabase = createAdminClient();

    const { count, error } = await supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("destinatario_id", usuarioId)
      .in("estado", ["pendiente", "enviado"]);

    if (error) {
      console.error("Error al contar notificaciones:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Error en contarNotificacionesNoLeidas:", error);
    return 0;
  }
}

/**
 * Marca todas las notificaciones de un usuario como leídas
 */
export async function marcarTodasComoLeidas(
  usuarioId: string
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("notificaciones")
      .update({
        estado: "entregado",
        fecha_leido: new Date().toISOString(),
      })
      .eq("destinatario_id", usuarioId)
      .in("estado", ["pendiente", "enviado"]);

    if (error) {
      console.error("Error al marcar todas como leídas:", error);
    }
  } catch (error) {
    console.error("Error en marcarTodasComoLeidas:", error);
  }
}
