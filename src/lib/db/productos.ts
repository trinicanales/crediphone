import { createAdminClient } from "@/lib/supabase/admin";
import type { Producto } from "@/types";

export async function getProductos(distribuidorId?: string): Promise<Producto[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Producto[];
}

export async function getProductoById(id: string, distribuidorId?: string): Promise<Producto | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Producto;
}

export async function getProductosEnStock(distribuidorId?: string): Promise<Producto[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .gt("stock", 0)
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Producto[];
}

export async function createProducto(producto: Omit<Producto, "id" | "createdAt" | "updatedAt">): Promise<Producto> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("productos")
    .insert({
      distribuidor_id: producto.distribuidorId, // FASE 21
      nombre: producto.nombre,
      marca: producto.marca,
      modelo: producto.modelo,
      precio: producto.precio,
      stock: producto.stock,
      imagen: producto.imagen,
      descripcion: producto.descripcion,
      // FASE 22: Inventario Avanzado
      categoria_id: producto.categoriaId,
      proveedor_id: producto.proveedorId,
      costo: producto.costo,
      stock_minimo: producto.stockMinimo,
      stock_maximo: producto.stockMaximo,
      tipo: producto.tipo,
      es_serializado: producto.esSerializado,
      ubicacion_fisica: producto.ubicacionFisica,
      // FASE 27: Campos dedicados para equipos
      imei: producto.imei || null,
      color: producto.color || null,
      ram: producto.ram || null,
      almacenamiento: producto.almacenamiento || null,
      folio_remision: producto.folioRemision || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Producto;
}

export async function updateProducto(id: string, producto: Partial<Producto>, distribuidorId?: string): Promise<Producto> {
  const supabase = createAdminClient();

  // Prepare update object mapping camelCase to snake_case
  const updates: any = {};
  if (producto.nombre !== undefined) updates.nombre = producto.nombre;
  if (producto.marca !== undefined) updates.marca = producto.marca;
  if (producto.modelo !== undefined) updates.modelo = producto.modelo;
  if (producto.precio !== undefined) updates.precio = producto.precio;
  if (producto.stock !== undefined) updates.stock = producto.stock;
  if (producto.imagen !== undefined) updates.imagen = producto.imagen;
  if (producto.descripcion !== undefined) updates.descripcion = producto.descripcion;
  if (producto.activo !== undefined) updates.activo = producto.activo;

  // FASE 22 Fields
  if (producto.categoriaId !== undefined) updates.categoria_id = producto.categoriaId;
  if (producto.proveedorId !== undefined) updates.proveedor_id = producto.proveedorId;
  if (producto.costo !== undefined) updates.costo = producto.costo;
  if (producto.stockMinimo !== undefined) updates.stock_minimo = producto.stockMinimo;
  if (producto.stockMaximo !== undefined) updates.stock_maximo = producto.stockMaximo;
  if (producto.tipo !== undefined) updates.tipo = producto.tipo;
  if (producto.esSerializado !== undefined) updates.es_serializado = producto.esSerializado;
  if (producto.ubicacionFisica !== undefined) updates.ubicacion_fisica = producto.ubicacionFisica;
  // FASE 27 Fields
  if (producto.imei !== undefined) updates.imei = producto.imei || null;
  if (producto.color !== undefined) updates.color = producto.color || null;
  if (producto.ram !== undefined) updates.ram = producto.ram || null;
  if (producto.almacenamiento !== undefined) updates.almacenamiento = producto.almacenamiento || null;
  if (producto.folioRemision !== undefined) updates.folio_remision = producto.folioRemision || null;

  let query = supabase
    .from("productos")
    .update(updates)
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query
    .select()
    .single();

  if (error) throw error;
  return data as Producto;
}

export async function deleteProducto(id: string, distribuidorId?: string): Promise<void> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .delete()
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { error } = await query;

  if (error) throw error;
}

export async function searchProductos(query: string, distribuidorId?: string): Promise<Producto[]> {
  const supabase = createAdminClient();
  let dbQuery = supabase
    .from("productos")
    .select("*")
    .or(`nombre.ilike.%${query}%,marca.ilike.%${query}%,modelo.ilike.%${query}%`)
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    dbQuery = dbQuery.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await dbQuery;

  if (error) throw error;
  return data as Producto[];
}

// ==========================================
// FASE 19: Barcode and Location functions
// ==========================================

/**
 * Search product by barcode or SKU
 */
export async function searchProductoByBarcode(
  codigo: string,
  distribuidorId?: string
): Promise<Producto | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .or(`codigo_barras.eq.${codigo},sku.eq.${codigo}`)
    .eq("activo", true);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as Producto;
}

/**
 * Update product barcode/SKU
 */
export async function updateProductoBarcode(
  id: string,
  codigoBarras?: string,
  sku?: string
): Promise<Producto> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("productos")
    .update({
      codigo_barras: codigoBarras,
      sku: sku,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Producto;
}

/**
 * Get products by location
 */
export async function getProductosByUbicacion(
  ubicacionId: string,
  distribuidorId?: string
): Promise<Producto[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .eq("ubicacion_id", ubicacionId)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Producto[];
}

/**
 * Get products without location
 */
export async function getProductosSinUbicacion(distribuidorId?: string): Promise<Producto[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .is("ubicacion_id", null)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Producto[];
}

/**
 * Get products without barcode
 */
export async function getProductosSinBarcode(distribuidorId?: string): Promise<Producto[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("productos")
    .select("*")
    .is("codigo_barras", null)
    .is("sku", null)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Producto[];
}
