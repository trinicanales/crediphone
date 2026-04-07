import { createAdminClient } from "@/lib/supabase/admin";
import type {
  UbicacionInventario,
  NuevaUbicacionFormData,
  MovimientoUbicacion,
  MovimientoUbicacionDetallado,
  MoverProductoFormData,
} from "@/types";

// ==========================================
// Mappers - DB to Type
// ==========================================

function mapUbicacionFromDB(row: any): UbicacionInventario {
  return {
    id: row.id,
    nombre: row.nombre,
    codigo: row.codigo,
    tipo: row.tipo,
    descripcion: row.descripcion,
    capacidadMaxima: row.capacidad_maxima,
    qrCode: row.qr_code,
    activo: row.activo,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapMovimientoFromDB(row: any): MovimientoUbicacion {
  return {
    id: row.id,
    productoId: row.producto_id,
    ubicacionOrigenId: row.ubicacion_origen_id,
    ubicacionDestinoId: row.ubicacion_destino_id,
    usuarioId: row.usuario_id,
    motivo: row.motivo,
    notas: row.notas,
    fechaMovimiento: new Date(row.fecha_movimiento),
    createdAt: new Date(row.created_at),
  };
}

// ==========================================
// UBICACIONES CRUD
// ==========================================

/**
 * Get all active locations for a distribuidor
 */
export async function getUbicaciones(distribuidorId?: string): Promise<UbicacionInventario[]> {
  let query = createAdminClient()
    .from("ubicaciones_inventario")
    .select("*")
    .eq("activo", true)
    .order("codigo", { ascending: true });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapUbicacionFromDB);
}

/**
 * Get all locations including inactive for a distribuidor
 */
export async function getAllUbicaciones(distribuidorId?: string): Promise<UbicacionInventario[]> {
  let query = createAdminClient()
    .from("ubicaciones_inventario")
    .select("*")
    .order("codigo", { ascending: true });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapUbicacionFromDB);
}

/**
 * Get location by ID
 */
export async function getUbicacionById(
  id: string
): Promise<UbicacionInventario | null> {
  const { data, error } = await createAdminClient()
    .from("ubicaciones_inventario")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return mapUbicacionFromDB(data);
}

/**
 * Get location by codigo
 */
export async function getUbicacionByCodigo(
  codigo: string
): Promise<UbicacionInventario | null> {
  const { data, error } = await createAdminClient()
    .from("ubicaciones_inventario")
    .select("*")
    .eq("codigo", codigo)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return mapUbicacionFromDB(data);
}

/**
 * Create new location
 */
export async function createUbicacion(
  formData: NuevaUbicacionFormData,
  distribuidorId: string | null
): Promise<UbicacionInventario> {
  // Generate codigo if not provided
  let codigo = formData.codigo;
  if (!codigo) {
    // Auto-generate based on tipo
    const prefix = formData.tipo.charAt(0).toUpperCase();
    const { data: existing } = await createAdminClient()
      .from("ubicaciones_inventario")
      .select("codigo")
      .like("codigo", `${prefix}%`)
      .order("codigo", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (existing && existing.length > 0) {
      const lastCodigo = existing[0].codigo;
      const match = lastCodigo.match(/\d+$/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }
    codigo = `${prefix}${nextNum}`;
  }

  const { data, error } = await createAdminClient()
    .from("ubicaciones_inventario")
    .insert({
      nombre: formData.nombre,
      codigo,
      tipo: formData.tipo,
      descripcion: formData.descripcion,
      capacidad_maxima: formData.capacidadMaxima,
      distribuidor_id: distribuidorId,
    })
    .select()
    .single();

  if (error) throw error;

  // Generate QR code
  const qrText = `UBICACION:${codigo}`;
  await createAdminClient()
    .from("ubicaciones_inventario")
    .update({ qr_code: qrText })
    .eq("id", data.id);

  return mapUbicacionFromDB({ ...data, qr_code: qrText });
}

/**
 * Update location
 */
export async function updateUbicacion(
  id: string,
  updates: Partial<NuevaUbicacionFormData>
): Promise<UbicacionInventario> {
  const updateData: any = {};

  if (updates.nombre !== undefined) updateData.nombre = updates.nombre;
  if (updates.tipo !== undefined) updateData.tipo = updates.tipo;
  if (updates.descripcion !== undefined)
    updateData.descripcion = updates.descripcion;
  if (updates.capacidadMaxima !== undefined)
    updateData.capacidad_maxima = updates.capacidadMaxima;

  // If codigo is being updated, regenerate QR
  if (updates.codigo !== undefined) {
    updateData.codigo = updates.codigo;
    updateData.qr_code = `UBICACION:${updates.codigo}`;
  }

  const { data, error } = await createAdminClient()
    .from("ubicaciones_inventario")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapUbicacionFromDB(data);
}

/**
 * Soft delete location (set activo = false)
 */
export async function deleteUbicacion(id: string): Promise<void> {
  // Check if any products are currently in this location
  const { data: productos } = await createAdminClient()
    .from("productos")
    .select("id")
    .eq("ubicacion_id", id)
    .limit(1);

  if (productos && productos.length > 0) {
    throw new Error(
      "No se puede eliminar ubicación con productos asignados. Mueva los productos primero."
    );
  }

  const { error } = await createAdminClient()
    .from("ubicaciones_inventario")
    .update({ activo: false })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Hard delete location (permanently remove)
 */
export async function hardDeleteUbicacion(id: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("ubicaciones_inventario")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Get products count by location
 */
export async function getProductosCountByUbicacion(
  ubicacionId: string
): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("ubicacion_id", ubicacionId)
    .eq("activo", true);

  if (error) throw error;
  return count || 0;
}

/**
 * Get all locations with product counts for a distribuidor
 */
export async function getUbicacionesWithCounts(distribuidorId?: string): Promise<
  Array<UbicacionInventario & { productosCount: number }>
> {
  const ubicaciones = await getUbicaciones(distribuidorId);

  const ubicacionesWithCounts = await Promise.all(
    ubicaciones.map(async (ubicacion) => {
      const count = await getProductosCountByUbicacion(ubicacion.id);
      return {
        ...ubicacion,
        productosCount: count,
      };
    })
  );

  return ubicacionesWithCounts;
}

// ==========================================
// MOVIMIENTOS DE UBICACION
// ==========================================

/**
 * Move product to new location
 */
export async function moverProducto(
  formData: MoverProductoFormData,
  usuarioId: string
): Promise<MovimientoUbicacion> {
  // Get current location
  const { data: producto } = await createAdminClient()
    .from("productos")
    .select("ubicacion_id")
    .eq("id", formData.productoId)
    .single();

  const ubicacionOrigenId = producto?.ubicacion_id;

  // Update product location
  const { error: updateError } = await createAdminClient()
    .from("productos")
    .update({ ubicacion_id: formData.ubicacionDestinoId })
    .eq("id", formData.productoId);

  if (updateError) throw updateError;

  // Create movement record
  const { data, error } = await createAdminClient()
    .from("movimientos_ubicacion")
    .insert({
      producto_id: formData.productoId,
      ubicacion_origen_id: ubicacionOrigenId,
      ubicacion_destino_id: formData.ubicacionDestinoId,
      usuario_id: usuarioId,
      motivo: formData.motivo,
      notas: formData.notas,
    })
    .select()
    .single();

  if (error) throw error;
  return mapMovimientoFromDB(data);
}

/**
 * Get movement history for a product
 */
export async function getMovimientosProducto(
  productoId: string
): Promise<MovimientoUbicacionDetallado[]> {
  const { data, error } = await createAdminClient()
    .from("movimientos_ubicacion")
    .select(
      `
      *,
      producto:productos(id, nombre, marca, modelo),
      ubicacion_origen:ubicacion_origen_id(id, nombre, codigo),
      ubicacion_destino:ubicacion_destino_id(id, nombre, codigo),
      usuario:usuarios(id, name, email)
    `
    )
    .eq("producto_id", productoId)
    .order("fecha_movimiento", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    ...mapMovimientoFromDB(row),
    producto: row.producto,
    ubicacionOrigen: row.ubicacion_origen
      ? mapUbicacionFromDB(row.ubicacion_origen)
      : undefined,
    ubicacionDestino: row.ubicacion_destino
      ? mapUbicacionFromDB(row.ubicacion_destino)
      : undefined,
    usuario: row.usuario,
  }));
}

/**
 * Get all movements by location
 */
export async function getMovimientosByUbicacion(
  ubicacionId: string
): Promise<MovimientoUbicacionDetallado[]> {
  const { data, error } = await createAdminClient()
    .from("movimientos_ubicacion")
    .select(
      `
      *,
      producto:productos(id, nombre, marca, modelo),
      ubicacion_origen:ubicacion_origen_id(id, nombre, codigo),
      ubicacion_destino:ubicacion_destino_id(id, nombre, codigo),
      usuario:usuarios(id, name, email)
    `
    )
    .or(
      `ubicacion_origen_id.eq.${ubicacionId},ubicacion_destino_id.eq.${ubicacionId}`
    )
    .order("fecha_movimiento", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    ...mapMovimientoFromDB(row),
    producto: row.producto,
    ubicacionOrigen: row.ubicacion_origen
      ? mapUbicacionFromDB(row.ubicacion_origen)
      : undefined,
    ubicacionDestino: row.ubicacion_destino
      ? mapUbicacionFromDB(row.ubicacion_destino)
      : undefined,
    usuario: row.usuario,
  }));
}

/**
 * Get recent movements (last 50)
 */
export async function getMovimientosRecientes(): Promise<
  MovimientoUbicacionDetallado[]
> {
  const { data, error } = await createAdminClient()
    .from("movimientos_ubicacion")
    .select(
      `
      *,
      producto:productos(id, nombre, marca, modelo),
      ubicacion_origen:ubicacion_origen_id(id, nombre, codigo),
      ubicacion_destino:ubicacion_destino_id(id, nombre, codigo),
      usuario:usuarios(id, name, email)
    `
    )
    .order("fecha_movimiento", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data.map((row) => ({
    ...mapMovimientoFromDB(row),
    producto: row.producto,
    ubicacionOrigen: row.ubicacion_origen
      ? mapUbicacionFromDB(row.ubicacion_origen)
      : undefined,
    ubicacionDestino: row.ubicacion_destino
      ? mapUbicacionFromDB(row.ubicacion_destino)
      : undefined,
    usuario: row.usuario,
  }));
}
