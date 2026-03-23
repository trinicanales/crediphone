import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers, sendPushToUser } from "@/lib/push/web-push-service";
import type {
  Notificacion,
  AlertaRecordatorio,
  TipoNotificacion,
  EstadoNotificacion,
  PrioridadAlerta,
  RecordatoriosOptions,
} from "@/lib/types/notificaciones";

/**
 * Obtiene créditos que requieren recordatorio
 */
export async function getCreditosParaRecordatorio(
  options?: RecordatoriosOptions
): Promise<AlertaRecordatorio[]> {
  const supabase = createAdminClient();
  const diasAnticipacion = options?.diasAnticipacion ?? 7;

  // Query para créditos activos con información del cliente
  let query = supabase
    .from("creditos")
    .select(
      `
      id,
      folio,
      monto,
      fecha_fin,
      dias_mora,
      monto_mora,
      estado,
      cliente_id,
      vendedor_id,
      clientes!inner(
        id,
        nombre,
        apellido,
        telefono,
        whatsapp,
        email
      )
    `
    )
    .eq("estado", "activo");

  // Filtrar por vendedor si se especifica
  if (options?.vendedorId) {
    query = query.eq("vendedor_id", options.vendedorId);
  }

  const { data, error } = await query.order("fecha_fin", { ascending: true });

  if (error) throw error;

  // Procesar y clasificar alertas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const alertas: AlertaRecordatorio[] = [];

  for (const credito of data || []) {
    const fechaFin = new Date(credito.fecha_fin);
    fechaFin.setHours(0, 0, 0, 0);

    const diasHastaVencimiento = Math.floor(
      (fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );

    let incluir = false;
    let tipo: TipoNotificacion = "proximo_vencer";
    let prioridad: PrioridadAlerta = "baja";

    const diasMora = credito.dias_mora ?? 0;

    // Lógica de clasificación
    if (diasMora > 0) {
      incluir = true;
      tipo = diasMora > 30 ? "mora_alta" : "vencido";
      prioridad =
        diasMora > 30
          ? "urgente"
          : diasMora > 7
            ? "alta"
            : "media";
    } else if (diasHastaVencimiento >= 0 && diasHastaVencimiento <= diasAnticipacion) {
      incluir = true;
      tipo = "proximo_vencer";
      prioridad =
        diasHastaVencimiento <= 1
          ? "alta"
          : diasHastaVencimiento <= 3
            ? "media"
            : "baja";
    }

    // Filtro: solo vencidos
    if (options?.soloVencidos && diasMora === 0) {
      incluir = false;
    }

    // Filtro: por prioridad
    if (options?.prioridad && prioridad !== options.prioridad) {
      incluir = false;
    }

    if (incluir) {
      // clientes puede venir como array, tomar el primer elemento
      const clienteData = Array.isArray(credito.clientes) ? credito.clientes[0] : credito.clientes;

      alertas.push({
        credito: {
          id: credito.id,
          folio: credito.folio || credito.id.slice(0, 8),
          monto: Number(credito.monto),
          saldoPendiente: 0, // Se calculará con RPC si es necesario
          fechaFin: credito.fecha_fin,
          diasMora: diasMora,
          estado: credito.estado,
        },
        cliente: {
          id: clienteData.id,
          nombre: clienteData.nombre,
          apellido: clienteData.apellido,
          telefono: clienteData.telefono,
          whatsapp: clienteData.whatsapp || clienteData.telefono,
          email: clienteData.email,
        },
        tipo,
        prioridad,
        diasHastaVencimiento: diasHastaVencimiento >= 0 ? diasHastaVencimiento : undefined,
      });
    }
  }

  // Ordenar por prioridad: urgente > alta > media > baja
  const prioridadOrden: Record<PrioridadAlerta, number> = {
    urgente: 0,
    alta: 1,
    media: 2,
    baja: 3,
  };

  alertas.sort((a, b) => {
    const ordenA = prioridadOrden[a.prioridad];
    const ordenB = prioridadOrden[b.prioridad];
    if (ordenA !== ordenB) return ordenA - ordenB;

    // Mismo nivel de prioridad: ordenar por días de mora (mayor primero)
    return (b.credito.diasMora ?? 0) - (a.credito.diasMora ?? 0);
  });

  return alertas;
}

/**
 * Registra una notificación enviada
 */
export async function registrarNotificacion(
  notificacion: Omit<Notificacion, "id" | "createdAt" | "updatedAt">
): Promise<Notificacion> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notificaciones")
    .insert({
      credito_id: notificacion.creditoId,
      cliente_id: notificacion.clienteId,
      tipo: notificacion.tipo,
      canal: notificacion.canal,
      estado: notificacion.estado,
      mensaje: notificacion.mensaje,
      telefono: notificacion.telefono,
      email: notificacion.email,
      enviado_por: notificacion.enviadoPor,
      fecha_programada: notificacion.fechaProgramada,
      fecha_enviado: notificacion.fechaEnviado,
    })
    .select()
    .single();

  if (error) throw error;

  // Mapear snake_case a camelCase
  return {
    id: data.id,
    creditoId: data.credito_id,
    clienteId: data.cliente_id,
    tipo: data.tipo,
    canal: data.canal,
    estado: data.estado,
    mensaje: data.mensaje,
    telefono: data.telefono,
    email: data.email,
    enviadoPor: data.enviado_por,
    fechaProgramada: data.fecha_programada,
    fechaEnviado: data.fecha_enviado,
    fechaLeido: data.fecha_leido,
    respuesta: data.respuesta,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Obtiene historial de notificaciones de un crédito
 */
export async function getHistorialNotificaciones(
  creditoId: string
): Promise<Notificacion[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("credito_id", creditoId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Mapear snake_case a camelCase
  return (data || []).map((n) => ({
    id: n.id,
    creditoId: n.credito_id,
    clienteId: n.cliente_id,
    tipo: n.tipo,
    canal: n.canal,
    estado: n.estado,
    mensaje: n.mensaje,
    telefono: n.telefono,
    email: n.email,
    enviadoPor: n.enviado_por,
    fechaProgramada: n.fecha_programada,
    fechaEnviado: n.fecha_enviado,
    fechaLeido: n.fecha_leido,
    respuesta: n.respuesta,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));
}

/**
 * Obtiene historial de notificaciones de un cliente
 */
export async function getHistorialNotificacionesCliente(
  clienteId: string
): Promise<Notificacion[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Mapear snake_case a camelCase
  return (data || []).map((n) => ({
    id: n.id,
    creditoId: n.credito_id,
    clienteId: n.cliente_id,
    tipo: n.tipo,
    canal: n.canal,
    estado: n.estado,
    mensaje: n.mensaje,
    telefono: n.telefono,
    email: n.email,
    enviadoPor: n.enviado_por,
    fechaProgramada: n.fecha_programada,
    fechaEnviado: n.fecha_enviado,
    fechaLeido: n.fecha_leido,
    respuesta: n.respuesta,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));
}

/**
 * Actualiza estado de una notificación
 */
export async function actualizarEstadoNotificacion(
  id: string,
  estado: EstadoNotificacion,
  respuesta?: string
): Promise<Notificacion> {
  const supabase = createAdminClient();

  const updateData: Record<string, any> = {
    estado,
    updated_at: new Date().toISOString(),
  };

  if (respuesta) {
    updateData.respuesta = respuesta;
  }

  if (estado === "enviado" && !respuesta) {
    updateData.fecha_enviado = new Date().toISOString();
  }

  if (estado === "entregado") {
    updateData.fecha_leido = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("notificaciones")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Mapear snake_case a camelCase
  return {
    id: data.id,
    creditoId: data.credito_id,
    clienteId: data.cliente_id,
    tipo: data.tipo,
    canal: data.canal,
    estado: data.estado,
    mensaje: data.mensaje,
    telefono: data.telefono,
    email: data.email,
    enviadoPor: data.enviado_por,
    fechaProgramada: data.fecha_programada,
    fechaEnviado: data.fecha_enviado,
    fechaLeido: data.fecha_leido,
    respuesta: data.respuesta,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Obtiene la última notificación enviada para un crédito
 */
export async function getUltimaNotificacion(
  creditoId: string
): Promise<Notificacion | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("credito_id", creditoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No se encontró ninguna notificación
      return null;
    }
    throw error;
  }

  // Mapear snake_case a camelCase
  return {
    id: data.id,
    creditoId: data.credito_id,
    clienteId: data.cliente_id,
    tipo: data.tipo,
    canal: data.canal,
    estado: data.estado,
    mensaje: data.mensaje,
    telefono: data.telefono,
    email: data.email,
    enviadoPor: data.enviado_por,
    fechaProgramada: data.fecha_programada,
    fechaEnviado: data.fecha_enviado,
    fechaLeido: data.fecha_leido,
    respuesta: data.respuesta,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Elimina una notificación
 */
export async function deleteNotificacion(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notificaciones").delete().eq("id", id);

  if (error) throw error;
}

// =====================================================
// FASE 3: Notificaciones para Reparaciones
// =====================================================

/**
 * Crea una notificación para el técnico cuando el cliente aprueba/rechaza presupuesto
 * FASE 3: Notificaciones desde tracking público
 */
export async function crearNotificacionTecnico(data: {
  ordenId: string;
  tecnicoId: string;
  tipo: "cliente_aprobo" | "cliente_rechazo";
  folio: string;
  mensaje: string;
}): Promise<void> {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.from("notificaciones").insert({
      orden_reparacion_id: data.ordenId,
      tipo: data.tipo,
      canal: "sistema",
      mensaje: data.mensaje,
      destinatario_id: data.tecnicoId,
      estado: "pendiente",
      datos_adicionales: {
        folio: data.folio,
        origen: "tracking_publico",
        fecha_accion: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Error al crear notificación para técnico:", error);
      // No lanzar error - las notificaciones son opcionales
    } else {
      // BUG FIX: Usar sendPushToUser directamente en vez de fetch a localhost
      sendPushToUser(data.tecnicoId, {
        title: "CREDIPHONE — Nueva notificación",
        body: data.mensaje.replace(/^[^\w\s]+\s*/, "").substring(0, 120),
        url: "/dashboard/reparaciones",
      }).catch(() => {});
    }
  } catch (error) {
    console.error("Error en crearNotificacionTecnico:", error);
    // No lanzar error - las notificaciones son opcionales
  }
}

/**
 * Obtiene todas las notificaciones pendientes de un técnico/vendedor
 */
export async function getNotificacionesPendientesTecnico(
  usuarioId: string
): Promise<any[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("destinatario_id", usuarioId)
    .in("estado", ["pendiente", "enviado"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error al obtener notificaciones pendientes:", error);
    return [];
  }

  return data || [];
}

/**
 * Marca una notificación como leída
 */
export async function marcarNotificacionComoLeida(notificacionId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("notificaciones")
    .update({
      estado: "leido",
      fecha_leido: new Date().toISOString(),
    })
    .eq("id", notificacionId);

  if (error) {
    console.error("Error al marcar notificación como leída:", error);
    // No lanzar error
  }
}

// =====================================================
// HELPERS DE NOTIFICACIÓN PARA FLUJO DE CAJA/ANTICIPOS
// =====================================================

/**
 * Obtiene los IDs de los administradores de un distribuidor.
 * Si no hay admins en el distribuidor, devuelve los super_admins.
 * Usado para notificaciones de alerta de caja.
 */
export async function getAdminIdsParaNotificar(distribuidorId?: string): Promise<string[]> {
  const supabase = createAdminClient();

  if (distribuidorId) {
    // Primero buscar admins del distribuidor
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("distribuidor_id", distribuidorId)
      .eq("role", "admin")
      .eq("activo", true);

    if (admins && admins.length > 0) {
      return admins.map((u: { id: string }) => u.id);
    }
  }

  // Fallback: super_admins (distribuidor_id IS NULL)
  const { data: superAdmins } = await supabase
    .from("users")
    .select("id")
    .is("distribuidor_id", null)
    .eq("role", "super_admin")
    .eq("activo", true);

  return (superAdmins || []).map((u: { id: string }) => u.id);
}

/**
 * Obtiene los IDs de todos los vendedores activos de un distribuidor.
 * Incluye también a los admins del distribuidor.
 */
export async function getVendedorIdsParaNotificar(distribuidorId?: string): Promise<string[]> {
  const supabase = createAdminClient();

  if (!distribuidorId) return [];

  const { data: vendedores } = await supabase
    .from("users")
    .select("id")
    .eq("distribuidor_id", distribuidorId)
    .in("role", ["vendedor", "admin"])
    .eq("activo", true);

  return (vendedores || []).map((u: { id: string }) => u.id);
}

/**
 * Notifica a los responsables de caja de un distribuidor (admin + vendedores).
 * Guarda notificación en DB + envía push.
 * Fire-and-forget — no lanza errores al caller.
 */
export async function notificarResponsablesKassa(params: {
  distribuidorId?: string;
  titulo: string;
  cuerpo: string;
  url?: string;
  tipo: string;
  ordenId?: string;
  soloAdmins?: boolean; // si true, no incluye vendedores
}): Promise<void> {
  try {
    const supabase = createAdminClient();

    const adminIds = await getAdminIdsParaNotificar(params.distribuidorId);
    const vendedorIds = params.soloAdmins
      ? []
      : await getVendedorIdsParaNotificar(params.distribuidorId);

    // Unir sin duplicados
    const destinatarios = [...new Set([...adminIds, ...vendedorIds])];
    if (destinatarios.length === 0) return;

    // Insertar notificaciones en DB para cada destinatario
    const notifs = destinatarios.map((userId) => ({
      orden_reparacion_id: params.ordenId ?? null,
      tipo: params.tipo,
      canal: "sistema",
      mensaje: `${params.titulo}: ${params.cuerpo}`,
      destinatario_id: userId,
      estado: "pendiente",
      datos_adicionales: {
        titulo: params.titulo,
        cuerpo: params.cuerpo,
        url: params.url ?? "/dashboard",
      },
    }));

    const { error } = await supabase.from("notificaciones").insert(notifs);
    if (error) {
      console.error("[notificarResponsablesKassa] Error insertando notificaciones:", error);
    }

    // BUG FIX: Usar sendPushToUsers directamente en vez de fetch a localhost
    // (fetch a localhost fallaba silenciosamente en producción)
    await sendPushToUsers(destinatarios, {
      title: params.titulo,
      body: params.cuerpo,
      url: params.url ?? "/dashboard",
    });
  } catch (err) {
    console.error("[notificarResponsablesKassa] Error:", err);
    // No relanzar — notificaciones son opcionales, no deben frenar el flujo principal
  }
}
