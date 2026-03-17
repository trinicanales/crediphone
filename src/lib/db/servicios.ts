import { createAdminClient } from "@/lib/supabase/admin";
import type { Servicio, ServicioFormData } from "@/types";

// =====================================================
// FASE 36: DB Layer — Servicios sin inventario
// =====================================================

function mapServicioFromDB(db: Record<string, unknown>): Servicio {
  return {
    id: db.id as string,
    distribuidorId: db.distribuidor_id as string | undefined,
    nombre: db.nombre as string,
    descripcion: db.descripcion as string | undefined,
    precioBase: Number(db.precio_base),
    precioFijo: db.precio_fijo as boolean,
    precioMin: db.precio_min != null ? Number(db.precio_min) : undefined,
    precioMax: db.precio_max != null ? Number(db.precio_max) : undefined,
    categoria: (db.categoria as Servicio["categoria"]) ?? "otro",
    activo: db.activo as boolean,
    createdAt: new Date(db.created_at as string),
    updatedAt: new Date(db.updated_at as string),
  };
}

export async function getServicios(distribuidorId?: string): Promise<Servicio[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("servicios")
    .select("*")
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapServicioFromDB);
}

export async function getServiciosActivos(distribuidorId?: string): Promise<Servicio[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("servicios")
    .select("*")
    .eq("activo", true)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapServicioFromDB);
}

export async function getServicioById(id: string, distribuidorId?: string): Promise<Servicio | null> {
  const supabase = createAdminClient();
  let query = supabase.from("servicios").select("*").eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapServicioFromDB(data as Record<string, unknown>);
}

export async function createServicio(servicio: ServicioFormData): Promise<Servicio> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("servicios")
    .insert({
      distribuidor_id: servicio.distribuidorId ?? null,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? null,
      precio_base: servicio.precioBase,
      precio_fijo: servicio.precioFijo,
      precio_min: servicio.precioMin ?? null,
      precio_max: servicio.precioMax ?? null,
      categoria: servicio.categoria,
      activo: servicio.activo,
    })
    .select()
    .single();

  if (error) throw error;
  return mapServicioFromDB(data as Record<string, unknown>);
}

export async function updateServicio(
  id: string,
  updates: Partial<ServicioFormData>,
  distribuidorId?: string
): Promise<Servicio> {
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {};

  if (updates.nombre !== undefined) payload.nombre = updates.nombre;
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion ?? null;
  if (updates.precioBase !== undefined) payload.precio_base = updates.precioBase;
  if (updates.precioFijo !== undefined) payload.precio_fijo = updates.precioFijo;
  if (updates.precioMin !== undefined) payload.precio_min = updates.precioMin ?? null;
  if (updates.precioMax !== undefined) payload.precio_max = updates.precioMax ?? null;
  if (updates.categoria !== undefined) payload.categoria = updates.categoria;
  if (updates.activo !== undefined) payload.activo = updates.activo;

  let query = supabase.from("servicios").update(payload).eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return mapServicioFromDB(data as Record<string, unknown>);
}

export async function deleteServicio(id: string, distribuidorId?: string): Promise<void> {
  const supabase = createAdminClient();
  let query = supabase.from("servicios").delete().eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function toggleServicioActivo(
  id: string,
  activo: boolean,
  distribuidorId?: string
): Promise<Servicio> {
  return updateServicio(id, { activo }, distribuidorId);
}
