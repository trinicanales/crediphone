/**
 * FASE 55: Control de Asistencia / Reloj Checador
 *
 * Patrón análogo a caja_sesiones:
 *  - abrirSesion → CHECK-IN (registro de entrada)
 *  - cerrarSesion → CHECK-OUT (registro de salida)
 *  - duracion_minutos se calcula automáticamente en la DB (GENERATED ALWAYS)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { AsistenciaSesion, EstadisticasAsistencia } from "@/types";

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapSesionFromDB(row: Record<string, unknown>): AsistenciaSesion {
  return {
    id: row.id as string,
    distribuidorId: row.distribuidor_id as string | undefined,
    usuarioId: row.usuario_id as string,
    usuarioNombre: row.usuario_nombre as string | undefined,
    fechaEntrada: new Date(row.fecha_entrada as string),
    fechaSalida: row.fecha_salida ? new Date(row.fecha_salida as string) : undefined,
    duracionMinutos: row.duracion_minutos as number | undefined,
    notasEntrada: row.notas_entrada as string | undefined,
    notasSalida: row.notas_salida as string | undefined,
    estado: row.estado as "activo" | "cerrado",
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Consultas ───────────────────────────────────────────────────────────────

/**
 * Devuelve la sesión activa del usuario (turno abierto), o null si no hay.
 */
export async function getSesionActivaUsuario(
  usuarioId: string
): Promise<AsistenciaSesion | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("asistencia_sesiones")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("estado", "activo")
    .order("fecha_entrada", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Error al obtener sesión activa: ${error.message}`);
  return data ? mapSesionFromDB(data) : null;
}

/**
 * Historial de sesiones con filtros. Para la página de admin.
 */
export async function getSesiones(params: {
  distribuidorId?: string;
  usuarioId?: string;
  desde?: Date;
  hasta?: Date;
  estado?: "activo" | "cerrado";
  limit?: number;
  offset?: number;
}): Promise<{ sesiones: AsistenciaSesion[]; total: number }> {
  const supabase = createAdminClient();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = supabase
    .from("asistencia_sesiones")
    .select("*", { count: "exact" })
    .order("fecha_entrada", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.distribuidorId) query = query.eq("distribuidor_id", params.distribuidorId);
  if (params.usuarioId)      query = query.eq("usuario_id", params.usuarioId);
  if (params.estado)         query = query.eq("estado", params.estado);
  if (params.desde)          query = query.gte("fecha_entrada", params.desde.toISOString());
  if (params.hasta)          query = query.lte("fecha_entrada", params.hasta.toISOString());

  const { data, error, count } = await query;
  if (error) throw new Error(`Error al obtener sesiones: ${error.message}`);

  return {
    sesiones: (data ?? []).map(mapSesionFromDB),
    total: count ?? 0,
  };
}

/**
 * Estadísticas para el panel de admin.
 */
export async function getEstadisticasAsistencia(
  distribuidorId?: string
): Promise<EstadisticasAsistencia> {
  const supabase = createAdminClient();
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  // Sesiones activas ahora
  let qActivas = supabase
    .from("asistencia_sesiones")
    .select("usuario_id, usuario_nombre", { count: "exact" })
    .eq("estado", "activo");
  if (distribuidorId) qActivas = qActivas.eq("distribuidor_id", distribuidorId);
  const { data: activas, count: presentes } = await qActivas;

  // Sesiones cerradas hoy
  let qHoy = supabase
    .from("asistencia_sesiones")
    .select("duracion_minutos, usuario_id, usuario_nombre")
    .eq("estado", "cerrado")
    .gte("fecha_entrada", inicioHoy.toISOString());
  if (distribuidorId) qHoy = qHoy.eq("distribuidor_id", distribuidorId);
  const { data: sesionesHoy } = await qHoy;

  // Sesiones del mes
  let qMes = supabase
    .from("asistencia_sesiones")
    .select("duracion_minutos, usuario_id, usuario_nombre, fecha_entrada")
    .eq("estado", "cerrado")
    .gte("fecha_entrada", inicioMes.toISOString());
  if (distribuidorId) qMes = qMes.eq("distribuidor_id", distribuidorId);
  const { data: sesionesMes } = await qMes;

  // Calcular totales
  const minutosHoy = (sesionesHoy ?? []).reduce(
    (s: number, r: Record<string, unknown>) => s + ((r.duracion_minutos as number) || 0),
    0
  );
  const minutosMes = (sesionesMes ?? []).reduce(
    (s: number, r: Record<string, unknown>) => s + ((r.duracion_minutos as number) || 0),
    0
  );

  // Días únicos con sesiones este mes
  const diasUnicos = new Set(
    (sesionesMes ?? []).map((r: Record<string, unknown>) =>
      new Date(r.fecha_entrada as string).toDateString()
    )
  );
  const diasTrabajados = diasUnicos.size || 1;

  // Resumen por empleado este mes (cerradas + activas)
  const mapEmpleados: Record<
    string,
    { nombre: string; minutos: number; dias: Set<string>; activo: boolean }
  > = {};

  // Sesiones cerradas del mes
  for (const s of sesionesMes ?? []) {
    const row = s as Record<string, unknown>;
    const uid = row.usuario_id as string;
    if (!mapEmpleados[uid]) {
      mapEmpleados[uid] = { nombre: (row.usuario_nombre as string) || uid, minutos: 0, dias: new Set(), activo: false };
    }
    mapEmpleados[uid].minutos += (row.duracion_minutos as number) || 0;
    mapEmpleados[uid].dias.add(new Date(row.fecha_entrada as string).toDateString());
  }

  // Marcar los que están presentes ahora
  for (const a of activas ?? []) {
    const row = a as Record<string, unknown>;
    const uid = row.usuario_id as string;
    if (!mapEmpleados[uid]) {
      mapEmpleados[uid] = { nombre: (row.usuario_nombre as string) || uid, minutos: 0, dias: new Set(), activo: true };
    }
    mapEmpleados[uid].activo = true;
  }

  const resumenEmpleados = Object.entries(mapEmpleados).map(([uid, d]) => ({
    usuarioId: uid,
    nombre: d.nombre,
    horasMes: Math.round((d.minutos / 60) * 10) / 10,
    diasTrabajados: d.dias.size,
    estadoActual: d.activo ? ("presente" as const) : ("ausente" as const),
  }));

  return {
    presentes: presentes ?? 0,
    totalHorasHoy: Math.round((minutosHoy / 60) * 10) / 10,
    totalHorasMes: Math.round((minutosMes / 60) * 10) / 10,
    promedioHorasDia: Math.round(((minutosMes / diasTrabajados) / 60) * 10) / 10,
    resumenEmpleados,
  };
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

/**
 * Abre un nuevo turno (CHECK-IN).
 * Falla si el usuario ya tiene un turno activo.
 */
export async function abrirSesion(
  usuarioId: string,
  usuarioNombre: string,
  distribuidorId?: string,
  notas?: string
): Promise<AsistenciaSesion> {
  const supabase = createAdminClient();

  // Verificar que no haya turno activo
  const activa = await getSesionActivaUsuario(usuarioId);
  if (activa) {
    throw new Error("Ya tienes un turno activo. Registra tu salida primero.");
  }

  const { data, error } = await supabase
    .from("asistencia_sesiones")
    .insert({
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
      distribuidor_id: distribuidorId || null,
      notas_entrada: notas || null,
      estado: "activo",
    })
    .select()
    .single();

  if (error) throw new Error(`Error al registrar entrada: ${error.message}`);
  return mapSesionFromDB(data);
}

/**
 * Cierra el turno activo (CHECK-OUT).
 * duracion_minutos se calcula automáticamente en la DB.
 */
export async function cerrarSesion(
  sesionId: string,
  notas?: string
): Promise<AsistenciaSesion> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("asistencia_sesiones")
    .update({
      fecha_salida: new Date().toISOString(),
      notas_salida: notas || null,
      estado: "cerrado",
    })
    .eq("id", sesionId)
    .eq("estado", "activo")   // seguridad: solo cerrar si está activa
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Sesión no encontrada o ya cerrada.");
  }
  return mapSesionFromDB(data);
}

/**
 * El admin cierra el turno de otro empleado (olvidó registrar salida).
 */
export async function cerrarSesionDeEmpleado(
  usuarioId: string,
  notas?: string
): Promise<AsistenciaSesion | null> {
  const activa = await getSesionActivaUsuario(usuarioId);
  if (!activa) return null;
  return cerrarSesion(activa.id, notas ?? "Turno cerrado por administrador.");
}
