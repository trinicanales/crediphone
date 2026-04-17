import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CatalogoServicioReparacion,
  CatalogoServicioPrecioDistribuidor,
  CatalogoServicioFormData,
} from "@/types";

// ─────────────────────────────────────────────────────────────
// Mappers DB → TypeScript
// ─────────────────────────────────────────────────────────────

function mapServicioFromDB(db: Record<string, unknown>): CatalogoServicioReparacion {
  return {
    id: db.id as string,
    nombre: db.nombre as string,
    descripcion: db.descripcion as string | undefined,
    marca: db.marca as string | undefined,
    modelo: db.modelo as string | undefined,
    precioBase: Number(db.precio_base),
    tiempoEstimadoMinutos: db.tiempo_estimado_minutos
      ? Number(db.tiempo_estimado_minutos)
      : undefined,
    activo: db.activo as boolean,
    distribuidorId: db.distribuidor_id as string | undefined,
    createdBy: db.created_by as string | undefined,
    createdAt: new Date(db.created_at as string),
    updatedAt: new Date(db.updated_at as string),
    // precioEfectivo se calcula en getCatalogoServicios
    precioEfectivo: db.precio_efectivo !== undefined
      ? Number(db.precio_efectivo)
      : undefined,
  };
}

function mapPrecioFromDB(db: Record<string, unknown>): CatalogoServicioPrecioDistribuidor {
  return {
    id: db.id as string,
    servicioId: db.servicio_id as string,
    distribuidorId: db.distribuidor_id as string,
    precio: Number(db.precio),
    activo: db.activo as boolean,
    createdAt: new Date(db.created_at as string),
    updatedAt: new Date(db.updated_at as string),
  };
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

/**
 * Devuelve todos los servicios activos visibles para un distribuidor:
 *   - Servicios globales (distribuidor_id IS NULL)
 *   - Servicios propios del distribuidor
 * Para cada servicio, devuelve el precio efectivo:
 *   - Si el distribuidor tiene precio personalizado → precio personalizado
 *   - Si no → precio_base
 *
 * Si distribuidorId === null (super_admin) devuelve todos los servicios
 * con precio_base como precioEfectivo.
 */
export async function getCatalogoServicios(
  distribuidorId?: string | null,
  incluirInactivos = false,
  filtros?: { marca?: string; modelo?: string }
): Promise<CatalogoServicioReparacion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("catalogo_servicios_reparacion")
    .select("*")
    .order("nombre", { ascending: true });

  if (!incluirInactivos) {
    query = query.eq("activo", true);
  }

  // Super_admin (null) ve todo; distribuidor ve globals + propios
  if (distribuidorId) {
    query = query.or(`distribuidor_id.is.null,distribuidor_id.eq.${distribuidorId}`);
  }

  // Filtrar por marca: genéricos (NULL) + los que coinciden
  if (filtros?.marca) {
    query = query.or(`marca.is.null,marca.ilike.%${filtros.marca}%`);
  }

  // Filtrar por modelo: genéricos (NULL) + los que coinciden
  if (filtros?.modelo) {
    query = query.or(`modelo.is.null,modelo.ilike.%${filtros.modelo}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Error al obtener catálogo de servicios: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Si no hay distribuidor (super_admin), retornar con precio_base
  if (!distribuidorId) {
    return data.map((s) =>
      mapServicioFromDB({ ...s, precio_efectivo: s.precio_base })
    );
  }

  // Obtener precios personalizados para este distribuidor
  const servicioIds = data.map((s) => s.id);
  const { data: precios } = await supabase
    .from("catalogo_servicios_precios_distribuidor")
    .select("*")
    .eq("distribuidor_id", distribuidorId)
    .eq("activo", true)
    .in("servicio_id", servicioIds);

  const preciosMap = new Map<string, number>();
  if (precios) {
    for (const p of precios) {
      preciosMap.set(p.servicio_id, Number(p.precio));
    }
  }

  return data.map((s) => {
    const precioPersonalizado = preciosMap.get(s.id);
    return mapServicioFromDB({
      ...s,
      precio_efectivo:
        precioPersonalizado !== undefined ? precioPersonalizado : s.precio_base,
    });
  });
}

/**
 * Obtiene un servicio específico por id.
 * Incluye precios por distribuidor.
 */
export async function getServicioById(id: string): Promise<CatalogoServicioReparacion | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("catalogo_servicios_reparacion")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapServicioFromDB({ ...data, precio_efectivo: data.precio_base });
}

/**
 * Obtiene los precios personalizados de un servicio para todos los distribuidores.
 * Útil en la UI de admin para mostrar/editar sobrescrituras.
 */
export async function getPreciosPorServicio(
  servicioId: string
): Promise<CatalogoServicioPrecioDistribuidor[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("catalogo_servicios_precios_distribuidor")
    .select("*")
    .eq("servicio_id", servicioId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Error al obtener precios del servicio: ${error.message}`);

  return (data || []).map(mapPrecioFromDB);
}

// ─────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────

export async function createServicio(
  datos: CatalogoServicioFormData,
  createdBy: string
): Promise<CatalogoServicioReparacion> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("catalogo_servicios_reparacion")
    .insert({
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
      marca: datos.marca || null,
      modelo: datos.modelo || null,
      precio_base: datos.precioBase,
      tiempo_estimado_minutos: datos.tiempoEstimadoMinutos || null,
      activo: datos.activo ?? true,
      distribuidor_id: datos.distribuidorId || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear servicio: ${error.message}`);

  return mapServicioFromDB({ ...data, precio_efectivo: data.precio_base });
}

export async function updateServicio(
  id: string,
  datos: Partial<CatalogoServicioFormData>
): Promise<CatalogoServicioReparacion> {
  const supabase = createAdminClient();

  const updatePayload: Record<string, unknown> = {};
  if (datos.nombre !== undefined) updatePayload.nombre = datos.nombre;
  if (datos.descripcion !== undefined) updatePayload.descripcion = datos.descripcion || null;
  if (datos.marca !== undefined) updatePayload.marca = datos.marca || null;
  if (datos.modelo !== undefined) updatePayload.modelo = datos.modelo || null;
  if (datos.precioBase !== undefined) updatePayload.precio_base = datos.precioBase;
  if (datos.tiempoEstimadoMinutos !== undefined)
    updatePayload.tiempo_estimado_minutos = datos.tiempoEstimadoMinutos || null;
  if (datos.activo !== undefined) updatePayload.activo = datos.activo;

  const { data, error } = await supabase
    .from("catalogo_servicios_reparacion")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar servicio: ${error.message}`);

  return mapServicioFromDB({ ...data, precio_efectivo: data.precio_base });
}

export async function deleteServicio(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("catalogo_servicios_reparacion")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Error al eliminar servicio: ${error.message}`);
}

/**
 * Establece o actualiza el precio personalizado de un servicio para un distribuidor.
 * Si ya existe, lo actualiza; si no, lo crea (upsert).
 */
export async function upsertPrecioDistribuidor(
  servicioId: string,
  distribuidorId: string,
  precio: number
): Promise<CatalogoServicioPrecioDistribuidor> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("catalogo_servicios_precios_distribuidor")
    .upsert(
      {
        servicio_id: servicioId,
        distribuidor_id: distribuidorId,
        precio,
        activo: true,
      },
      { onConflict: "servicio_id,distribuidor_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Error al guardar precio del distribuidor: ${error.message}`);

  return mapPrecioFromDB(data);
}

export async function deletePrecioDistribuidor(
  servicioId: string,
  distribuidorId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("catalogo_servicios_precios_distribuidor")
    .delete()
    .eq("servicio_id", servicioId)
    .eq("distribuidor_id", distribuidorId);

  if (error) throw new Error(`Error al eliminar precio del distribuidor: ${error.message}`);
}
