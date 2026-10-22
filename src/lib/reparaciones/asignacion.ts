import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Asignación de una orden a quien la trabaja (técnico o admin).
 *
 * Reemplaza al RPC `reasignar_tecnico`, que solo aceptaba role='tecnico' (un admin nunca podía
 * tomar una orden aunque la lista lo mostrara) y no validaba la tienda ni guardaba historial.
 * Reglas (K3a, 2026-10-21):
 *  - el usuario asignado debe estar activo y ser técnico, admin o super_admin;
 *  - debe pertenecer a la tienda de la orden (el super_admin, que no tiene tienda, puede tomar cualquiera);
 *  - se guarda quién la tenía, quién la tomó y por qué (tabla asignaciones_orden).
 */
export type MotivoAsignacion = "inicio_diagnostico" | "tomada_por_admin" | "reasignada";

export interface ResultadoAsignacion {
  cambio: boolean;
  deUsuarioId: string | null;
  aUsuarioId: string;
}

export async function asignarOrden(params: {
  ordenId: string;
  usuarioId: string;
  motivo: MotivoAsignacion;
  /** Quién realiza la acción (puede ser el mismo usuario, o un admin que reasigna a otro) */
  porUsuarioId: string;
}): Promise<ResultadoAsignacion> {
  const supabase = createAdminClient();

  const { data: orden, error: ordenErr } = await supabase
    .from("ordenes_reparacion")
    .select("id, tecnico_id, distribuidor_id")
    .eq("id", params.ordenId)
    .single();
  if (ordenErr || !orden) throw new Error("Orden no encontrada");

  const { data: usuario } = await supabase
    .from("users")
    .select("id, role, activo, distribuidor_id")
    .eq("id", params.usuarioId)
    .single();
  if (!usuario || usuario.activo === false) {
    throw new Error("El usuario no existe o no está activo");
  }
  if (!["tecnico", "admin", "super_admin"].includes(usuario.role)) {
    throw new Error("Solo un técnico o un administrador puede tener asignada una orden");
  }
  if (usuario.role !== "super_admin" && usuario.distribuidor_id !== orden.distribuidor_id) {
    throw new Error("El usuario no pertenece a la tienda de esta orden");
  }

  // Ya la tiene: no se registra nada
  if (orden.tecnico_id === usuario.id) {
    return { cambio: false, deUsuarioId: orden.tecnico_id, aUsuarioId: usuario.id };
  }

  const { error: updErr } = await supabase
    .from("ordenes_reparacion")
    .update({ tecnico_id: usuario.id, updated_at: new Date().toISOString() })
    .eq("id", orden.id);
  if (updErr) throw new Error(`No se pudo asignar la orden: ${updErr.message}`);

  // Historial (si falla no se revierte la asignación)
  const { error: histErr } = await supabase.from("asignaciones_orden").insert({
    orden_id: orden.id,
    distribuidor_id: orden.distribuidor_id,
    de_usuario_id: orden.tecnico_id ?? null,
    a_usuario_id: usuario.id,
    motivo: params.motivo,
    creado_por: params.porUsuarioId,
  });
  if (histErr) console.error("[asignarOrden] historial:", histErr.message);

  return { cambio: true, deUsuarioId: orden.tecnico_id ?? null, aUsuarioId: usuario.id };
}
