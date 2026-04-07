import { createAdminClient } from "@/lib/supabase/admin";
import type { Producto } from "@/types";

/**
 * Convierte una fila de la tabla `productos` (snake_case) al tipo TypeScript `Producto` (camelCase).
 * Sin este mapper los campos compuestos como `categoria_id`, `codigo_barras`, `es_serializado`, etc.
 * quedan como `undefined` en el frontend y el formulario de edición no puede pre-rellenarlos.
 */
function mapProductoFromDB(db: any): Producto {
  return {
    id:               db.id,
    distribuidorId:   db.distribuidor_id   ?? undefined,
    nombre:           db.nombre,
    marca:            db.marca,
    modelo:           db.modelo,
    precio:           db.precio,
    stock:            db.stock,
    imagen:           db.imagen            ?? undefined,
    descripcion:      db.descripcion       ?? undefined,
    activo:           db.activo            ?? undefined,

    // FASE 22: Inventario Avanzado
    categoriaId:      db.categoria_id      ?? undefined,
    subcategoriaId:   db.subcategoria_id   ?? undefined,
    proveedorId:      db.proveedor_id      ?? undefined,
    costo:            db.costo             ?? undefined,
    stockMinimo:      db.stock_minimo      ?? undefined,
    stockMaximo:      db.stock_maximo      ?? undefined,
    tipo:             db.tipo              ?? undefined,
    esSerializado:    db.es_serializado    ?? undefined,
    ubicacionFisica:  db.ubicacion_fisica  ?? undefined,

    // FASE 19: Barcode y ubicación
    codigoBarras:     db.codigo_barras     ?? undefined,
    sku:              db.sku               ?? undefined,
    ubicacionId:      db.ubicacion_id      ?? undefined,
    ultimaVerificacion: db.ultima_verificacion ? new Date(db.ultima_verificacion) : undefined,
    verificadoPor:    db.verificado_por    ?? undefined,

    // FASE 27: Campos de equipo celular
    imei:             db.imei              ?? undefined,
    color:            db.color             ?? undefined,
    ram:              db.ram               ?? undefined,
    almacenamiento:   db.almacenamiento    ?? undefined,
    folioRemision:    db.folio_remision    ?? undefined,

    createdAt:        db.created_at        ? new Date(db.created_at)  : new Date(),
    updatedAt:        db.updated_at        ? new Date(db.updated_at)  : new Date(),
  };
}

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
  return (data as any[]).map(mapProductoFromDB);
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
  return mapProductoFromDB(data);
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
  return (data as any[]).map(mapProductoFromDB);
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
      categoria_id:    producto.categoriaId,
      subcategoria_id: producto.subcategoriaId ?? null, // FASE 57
      proveedor_id: producto.proveedorId,
      costo: producto.costo,
      stock_minimo: producto.stockMinimo,
      stock_maximo: producto.stockMaximo,
      tipo: producto.tipo,
      es_serializado: producto.esSerializado,
      ubicacion_fisica: producto.ubicacionFisica,
      // FASE 19: Código de barras, SKU y ubicación estructurada
      codigo_barras: producto.codigoBarras || null,
      sku: producto.sku || null,
      ubicacion_id:  producto.ubicacionId  || null,
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
  return mapProductoFromDB(data);
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
  if (producto.categoriaId    !== undefined) updates.categoria_id    = producto.categoriaId;
  if (producto.subcategoriaId !== undefined) updates.subcategoria_id = producto.subcategoriaId || null; // FASE 57
  if (producto.proveedorId    !== undefined) updates.proveedor_id    = producto.proveedorId;
  if (producto.costo !== undefined) updates.costo = producto.costo;
  if (producto.stockMinimo !== undefined) updates.stock_minimo = producto.stockMinimo;
  if (producto.stockMaximo !== undefined) updates.stock_maximo = producto.stockMaximo;
  if (producto.tipo !== undefined) updates.tipo = producto.tipo;
  if (producto.esSerializado !== undefined) updates.es_serializado = producto.esSerializado;
  if (producto.ubicacionFisica !== undefined) updates.ubicacion_fisica = producto.ubicacionFisica;
  // FASE 19 Fields
  if (producto.codigoBarras !== undefined) updates.codigo_barras = producto.codigoBarras || null;
  if (producto.sku !== undefined) updates.sku = producto.sku || null;
  if (producto.ubicacionId  !== undefined) updates.ubicacion_id  = producto.ubicacionId  || null;
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
  return mapProductoFromDB(data);
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
  return (data as any[]).map(mapProductoFromDB);
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

  return mapProductoFromDB(data);
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
  return mapProductoFromDB(data);
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
  return (data as any[]).map(mapProductoFromDB);
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
  return (data as any[]).map(mapProductoFromDB);
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
  return (data as any[]).map(mapProductoFromDB);
}
