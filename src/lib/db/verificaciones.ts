import { createAdminClient } from "@/lib/supabase/admin";
import type {
  VerificacionInventario,
  VerificacionInventarioDetallada,
  VerificacionItem,
  VerificacionItemDetallado,
  AlertaProductoNuevo,
  AlertaProductoNuevoDetallada,
  NuevaVerificacionFormData,
  ScanProductoFormData,
  EstadisticasVerificacion,
  DiferenciaVerificacion,
} from "@/types";

// ==========================================
// Mappers - DB to Type
// ==========================================

function mapVerificacionFromDB(row: any): VerificacionInventario {
  return {
    id: row.id,
    folio: row.folio,
    usuarioId: row.usuario_id,
    ubicacionId: row.ubicacion_id,
    fechaInicio: new Date(row.fecha_inicio),
    fechaFin: row.fecha_fin ? new Date(row.fecha_fin) : undefined,
    estado: row.estado,
    totalProductosEsperados: row.total_productos_esperados,
    totalProductosEscaneados: row.total_productos_escaneados,
    totalProductosFaltantes: row.total_productos_faltantes,
    totalDuplicados: row.total_duplicados,
    notas: row.notas,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapVerificacionItemFromDB(row: any): VerificacionItem {
  return {
    id: row.id,
    verificacionId: row.verificacion_id,
    productoId: row.producto_id,
    codigoEscaneado: row.codigo_escaneado,
    cantidadEscaneada: row.cantidad_escaneada,
    esDuplicado: row.es_duplicado,
    esProductoNuevo: row.es_producto_nuevo,
    ubicacionEncontradaId: row.ubicacion_encontrada_id,
    notasScan: row.notas_scan,
    fechaScan: new Date(row.fecha_scan),
    createdAt: new Date(row.created_at),
  };
}

function mapAlertaFromDB(row: any): AlertaProductoNuevo {
  return {
    id: row.id,
    verificacionId: row.verificacion_id,
    verificacionItemId: row.verificacion_item_id,
    codigoEscaneado: row.codigo_escaneado,
    escanadoPor: row.escaneado_por,
    imagenUrl: row.imagen_url,
    notas: row.notas,
    estado: row.estado,
    revisadoPor: row.revisado_por,
    fechaRevision: row.fecha_revision ? new Date(row.fecha_revision) : undefined,
    fechaAlerta: new Date(row.fecha_alerta),
    createdAt: new Date(row.created_at),
  };
}

// ==========================================
// VERIFICACIONES CRUD
// ==========================================

/**
 * Create new inventory verification session
 */
export async function createVerificacion(
  formData: NuevaVerificacionFormData,
  usuarioId: string,
  distribuidorId: string
): Promise<VerificacionInventario> {
  const supabase = createAdminClient();

  // Calculate expected products count if ubicacion specified
  let totalEsperados = 0;
  if (formData.ubicacionId) {
    const { count } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("ubicacion_id", formData.ubicacionId)
      .eq("distribuidor_id", distribuidorId)
      .eq("activo", true);

    totalEsperados = count || 0;
  } else {
    // All active products for this distribuidor
    const { count } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("distribuidor_id", distribuidorId)
      .eq("activo", true);

    totalEsperados = count || 0;
  }

  const { data, error } = await supabase
    .from("verificaciones_inventario")
    .insert({
      usuario_id: usuarioId,
      ubicacion_id: formData.ubicacionId,
      notas: formData.notas,
      total_productos_esperados: totalEsperados,
      estado: "en_proceso",
      distribuidor_id: distribuidorId,
    })
    .select()
    .single();

  if (error) throw error;
  return mapVerificacionFromDB(data);
}

/**
 * Get verification by ID
 */
export async function getVerificacionById(
  id: string
): Promise<VerificacionInventarioDetallada | null> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("verificaciones_inventario")
    .select(
      `
      *,
      usuario:usuarios(id, name, email),
      ubicacion:ubicaciones_inventario(id, nombre, codigo)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  // Get items
  const items = await getVerificacionItems(id);

  return {
    ...mapVerificacionFromDB(data),
    usuario: data.usuario,
    ubicacion: data.ubicacion,
    items,
  };
}

/**
 * Get all verification items for a session
 */
export async function getVerificacionItems(
  verificacionId: string
): Promise<VerificacionItemDetallado[]> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("verificaciones_items")
    .select(
      `
      *,
      producto:productos(id, nombre, marca, modelo, imagen, stock),
      ubicacion_encontrada:ubicaciones_inventario(id, nombre, codigo)
    `
    )
    .eq("verificacion_id", verificacionId)
    .order("fecha_scan", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    ...mapVerificacionItemFromDB(row),
    producto: row.producto,
    ubicacionEncontrada: row.ubicacion_encontrada,
  }));
}

/**
 * Get user's verification sessions
 */
export async function getVerificacionesByUsuario(
  usuarioId: string
): Promise<VerificacionInventario[]> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("verificaciones_inventario")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("fecha_inicio", { ascending: false });

  if (error) throw error;
  return data.map(mapVerificacionFromDB);
}

/**
 * Get active verification for user
 */
export async function getVerificacionActiva(
  usuarioId: string
): Promise<VerificacionInventario | null> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("verificaciones_inventario")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("estado", "en_proceso")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return mapVerificacionFromDB(data);
}

/**
 * Get all verifications (admin)
 */
export async function getAllVerificaciones(
  distribuidorId?: string
): Promise<VerificacionInventarioDetallada[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("verificaciones_inventario")
    .select(
      `
      *,
      usuario:usuarios(id, name, email),
      ubicacion:ubicaciones_inventario(id, nombre, codigo)
    `
    )
    .order("fecha_inicio", { ascending: false })
    .limit(100);

  // Filtrar por distribuidor cuando el rol no es super_admin
  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map((row) => ({
    ...mapVerificacionFromDB(row),
    usuario: row.usuario,
    ubicacion: row.ubicacion,
  }));
}

/**
 * Complete verification session
 */
export async function completarVerificacion(
  id: string,
  notas?: string
): Promise<VerificacionInventario> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("verificaciones_inventario")
    .update({
      estado: "completada",
      fecha_fin: new Date().toISOString(),
      notas: notas,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapVerificacionFromDB(data);
}

/**
 * Cancel verification session
 */
export async function cancelarVerificacion(
  id: string
): Promise<VerificacionInventario> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("verificaciones_inventario")
    .update({
      estado: "cancelada",
      fecha_fin: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapVerificacionFromDB(data);
}

// ==========================================
// SCAN OPERATIONS
// ==========================================

/**
 * Scan a product (add to verification)
 */
export async function scanProducto(
  formData: ScanProductoFormData
): Promise<VerificacionItem> {
  const supabase = createAdminClient();
  const codigo = formData.codigoEscaneado.trim();

  // Get verification session data (distribuidor_id + usuario_id) upfront
  const { data: verificacion } = await supabase
    .from("verificaciones_inventario")
    .select("distribuidor_id, usuario_id")
    .eq("id", formData.verificacionId)
    .single();

  const distribuidorId = verificacion?.distribuidor_id;

  // Find product by barcode or SKU (filter by distribuidor for safety)
  const productoQuery = supabase
    .from("productos")
    .select("*")
    .or(`codigo_barras.eq.${codigo},sku.eq.${codigo}`)
    .eq("activo", true);

  if (distribuidorId) {
    productoQuery.eq("distribuidor_id", distribuidorId);
  }

  const { data: producto } = await productoQuery.single();

  // Check if already scanned in this session
  const { data: existing } = await supabase
    .from("verificaciones_items")
    .select("*")
    .eq("verificacion_id", formData.verificacionId)
    .eq("codigo_escaneado", codigo)
    .order("created_at", { ascending: false })
    .limit(1);

  const esProductoNuevo = !producto;
  const cantidad = formData.cantidad ?? 1;

  let data: any;
  let error: any;

  if (existing && existing.length > 0) {
    // FASE 30: Upsert — actualizar la cantidad contada en lugar de crear duplicado
    const result = await supabase
      .from("verificaciones_items")
      .update({
        cantidad_escaneada: cantidad,
        es_duplicado: false,
        notas_scan: formData.notasScan ?? existing[0].notas_scan,
      })
      .eq("id", existing[0].id)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    // Primer escaneo de este producto — crear registro
    const result = await supabase
      .from("verificaciones_items")
      .insert({
        verificacion_id: formData.verificacionId,
        producto_id: producto?.id,
        codigo_escaneado: codigo,
        cantidad_escaneada: cantidad,
        es_duplicado: false,
        es_producto_nuevo: esProductoNuevo,
        ubicacion_encontrada_id: formData.ubicacionEncontradaId,
        notas_scan: formData.notasScan,
        distribuidor_id: distribuidorId,
      })
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) throw error;

  // Update product last verification if found
  if (producto) {
    await supabase
      .from("productos")
      .update({
        ultima_verificacion: new Date().toISOString(),
        verificado_por: verificacion?.usuario_id,
      })
      .eq("id", producto.id);
  }

  return mapVerificacionItemFromDB(data);
}

/**
 * Registrar conteo de un producto seleccionado manualmente (sin escanear código).
 * Útil para accesorios sin código de barras/SKU.
 */
export async function scanProductoById(
  verificacionId: string,
  productoId: string,
  cantidad: number
): Promise<VerificacionItem> {
  const supabase = createAdminClient();

  // Obtener datos de la sesión
  const { data: verificacion } = await supabase
    .from("verificaciones_inventario")
    .select("distribuidor_id, usuario_id")
    .eq("id", verificacionId)
    .single();

  const distribuidorId = verificacion?.distribuidor_id;

  // Obtener el producto por ID
  const { data: producto, error: prodError } = await supabase
    .from("productos")
    .select("id, codigo_barras, sku, nombre")
    .eq("id", productoId)
    .eq("activo", true)
    .single();

  if (prodError || !producto) throw new Error("Producto no encontrado");

  // Código sintético para el registro: usa barcode si existe, si no el ID
  const codigoEscaneado = (producto.codigo_barras || producto.sku || producto.id) as string;

  // Verificar si ya fue registrado en esta sesión (buscar por producto_id)
  const { data: existing } = await supabase
    .from("verificaciones_items")
    .select("*")
    .eq("verificacion_id", verificacionId)
    .eq("producto_id", productoId)
    .order("created_at", { ascending: false })
    .limit(1);

  let data: any;
  let error: any;

  if (existing && existing.length > 0) {
    // Actualizar conteo existente
    const result = await supabase
      .from("verificaciones_items")
      .update({ cantidad_escaneada: cantidad, es_duplicado: false })
      .eq("id", existing[0].id)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    // Primera vez que se registra este producto
    const result = await supabase
      .from("verificaciones_items")
      .insert({
        verificacion_id: verificacionId,
        producto_id: productoId,
        codigo_escaneado: codigoEscaneado,
        cantidad_escaneada: cantidad,
        es_duplicado: false,
        es_producto_nuevo: false,
        distribuidor_id: distribuidorId,
      })
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) throw error;

  // Marcar última verificación en el producto
  await supabase
    .from("productos")
    .update({
      ultima_verificacion: new Date().toISOString(),
      verificado_por: verificacion?.usuario_id,
    })
    .eq("id", productoId);

  return mapVerificacionItemFromDB(data);
}

/**
 * Get missing products for a verification session
 */
export async function getProductosFaltantes(
  verificacionId: string
): Promise<any[]> {
  const supabase = createAdminClient();
  const { data: verificacion } = await supabase
    .from("verificaciones_inventario")
    .select("ubicacion_id")
    .eq("id", verificacionId)
    .single();

  if (!verificacion) return [];

  // Get all products that should be verified
  let query = supabase
    .from("productos")
    .select("id, nombre, marca, modelo, imagen, stock, ubicacion_id")
    .eq("activo", true);

  if (verificacion.ubicacion_id) {
    query = query.eq("ubicacion_id", verificacion.ubicacion_id);
  }

  const { data: allProductos } = await query;
  if (!allProductos) return [];

  // Get scanned product IDs
  const { data: scanned } = await supabase
    .from("verificaciones_items")
    .select("producto_id")
    .eq("verificacion_id", verificacionId)
    .eq("es_duplicado", false)
    .not("producto_id", "is", null);

  const scannedIds = new Set(scanned?.map((s) => s.producto_id) || []);

  // Return products not scanned
  return allProductos.filter((p) => !scannedIds.has(p.id));
}

// ==========================================
// FASE 30: Diferencias y Ajuste de Stock
// ==========================================

/**
 * Retorna la comparación entre cantidades contadas y stock del sistema.
 * Solo productos que ya fueron escaneados en la sesión.
 */
export async function getDiferenciasVerificacion(
  verificacionId: string
): Promise<DiferenciaVerificacion[]> {
  const supabase = createAdminClient();

  // Items escaneados con datos del producto
  const { data: items } = await supabase
    .from("verificaciones_items")
    .select(
      `id, producto_id, cantidad_escaneada,
       productos!inner(id, nombre, marca, modelo, codigo_barras, stock)`
    )
    .eq("verificacion_id", verificacionId)
    .not("producto_id", "is", null);

  if (!items) return [];

  // Agrupar por producto_id (puede haber varios scans si hubo duplicados históricos)
  const map = new Map<string, DiferenciaVerificacion>();
  for (const item of items) {
    const p = (item as any).productos;
    if (!p) continue;
    // Usar el item más reciente (last write wins)
    map.set(p.id, {
      productoId: p.id,
      nombre: p.nombre,
      marca: p.marca,
      modelo: p.modelo,
      codigoBarras: p.codigo_barras ?? undefined,
      stockSistema: p.stock,
      cantidadContada: (item as any).cantidad_escaneada,
      diferencia: (item as any).cantidad_escaneada - p.stock,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    Math.abs(b.diferencia) - Math.abs(a.diferencia)
  );
}

/**
 * Aplica los ajustes de stock: actualiza productos.stock con las cantidades contadas.
 * Solo admin/super_admin pueden llamar esto.
 * Retorna cuántos productos fueron actualizados.
 */
export async function ajustarStockVerificacion(
  verificacionId: string
): Promise<{ actualizados: number; detalles: { nombre: string; antes: number; despues: number }[] }> {
  const supabase = createAdminClient();

  const diferencias = await getDiferenciasVerificacion(verificacionId);
  const conDiferencia = diferencias.filter((d) => d.diferencia !== 0);

  const detalles: { nombre: string; antes: number; despues: number }[] = [];

  for (const d of conDiferencia) {
    await supabase
      .from("productos")
      .update({ stock: d.cantidadContada })
      .eq("id", d.productoId);

    detalles.push({
      nombre: `${d.marca} ${d.modelo} ${d.nombre}`.trim(),
      antes: d.stockSistema,
      despues: d.cantidadContada,
    });
  }

  return { actualizados: conDiferencia.length, detalles };
}

// ==========================================
// ALERTAS - New Product Notifications
// ==========================================

/**
 * Get all pending alerts (admin) — filtrado por distribuidor
 */
export async function getAlertasPendientes(distribuidorId?: string): Promise<
  AlertaProductoNuevoDetallada[]
> {
  const supabase = createAdminClient();
  let query = supabase
    .from("alertas_productos_nuevos")
    .select(
      `
      *,
      verificacion:verificaciones_inventario(id, folio, fecha_inicio),
      verificacion_item:verificaciones_items(id, codigo_escaneado, fecha_scan),
      usuario_escaner:usuarios!escaneado_por(id, name, email),
      usuario_revisor:usuarios!revisado_por(id, name, email)
    `
    )
    .eq("estado", "pendiente")
    .order("fecha_alerta", { ascending: false });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((row) => ({
    ...mapAlertaFromDB(row),
    verificacion: row.verificacion,
    verificacionItem: row.verificacion_item,
    usuarioEscaner: row.usuario_escaner,
    usuarioRevisor: row.usuario_revisor,
  }));
}

/**
 * Get all alerts (any state) — filtrado por distribuidor
 */
export async function getAllAlertas(distribuidorId?: string): Promise<AlertaProductoNuevoDetallada[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("alertas_productos_nuevos")
    .select(
      `
      *,
      verificacion:verificaciones_inventario(id, folio, fecha_inicio),
      verificacion_item:verificaciones_items(id, codigo_escaneado, fecha_scan),
      usuario_escaner:usuarios!escaneado_por(id, name, email),
      usuario_revisor:usuarios!revisado_por(id, name, email)
    `
    )
    .order("fecha_alerta", { ascending: false })
    .limit(100);

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((row) => ({
    ...mapAlertaFromDB(row),
    verificacion: row.verificacion,
    verificacionItem: row.verificacion_item,
    usuarioEscaner: row.usuario_escaner,
    usuarioRevisor: row.usuario_revisor,
  }));
}

/**
 * Update alert status
 */
export async function updateAlertaEstado(
  id: string,
  estado: "revisado" | "registrado" | "descartado",
  revisadoPor: string,
  notas?: string
): Promise<AlertaProductoNuevo> {
  const supabase = createAdminClient(); const { data, error } = await supabase
    .from("alertas_productos_nuevos")
    .update({
      estado,
      revisado_por: revisadoPor,
      fecha_revision: new Date().toISOString(),
      notas: notas,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapAlertaFromDB(data);
}

// ==========================================
// STATISTICS
// ==========================================

/**
 * Get verification statistics
 */
export async function getEstadisticasVerificacion(): Promise<EstadisticasVerificacion> {
  const supabase = createAdminClient();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Verifications today
  const { count: verificacionesHoy } = await supabase
    .from("verificaciones_inventario")
    .select("id", { count: "exact", head: true })
    .gte("fecha_inicio", hoy.toISOString());

  // Products scanned today
  const { count: productosEscaneadosHoy } = await supabase
    .from("verificaciones_items")
    .select("id", { count: "exact", head: true })
    .gte("fecha_scan", hoy.toISOString())
    .eq("es_duplicado", false)
    .not("producto_id", "is", null);

  // Missing products (from active verifications)
  const { data: activeVerifications } = await supabase
    .from("verificaciones_inventario")
    .select("total_productos_faltantes")
    .eq("estado", "en_proceso");

  const productosFaltantesHoy = activeVerifications
    ? activeVerifications.reduce(
        (sum, v) => sum + v.total_productos_faltantes,
        0
      )
    : 0;

  // Pending alerts
  const { count: alertasPendientes } = await supabase
    .from("alertas_productos_nuevos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");

  // Active locations
  const { count: ubicacionesActivas } = await supabase
    .from("ubicaciones_inventario")
    .select("id", { count: "exact", head: true })
    .eq("activo", true);

  return {
    verificacionesHoy: verificacionesHoy || 0,
    productosEscaneadosHoy: productosEscaneadosHoy || 0,
    productosFaltantesHoy,
    alertasPendientes: alertasPendientes || 0,
    ubicacionesActivas: ubicacionesActivas || 0,
  };
}
