/**
 * FASE 18: Database Layer - Ventas POS
 * Funciones para gestión de ventas directas en punto de venta
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Venta,
  VentaDetallada,
  VentaItem,
  VentaItemDetallado,
  NuevaVentaFormData,
  EstadisticasPOS,
  Producto,
} from "@/types";

// =====================================================
// MAPPERS
// =====================================================

function mapVentaFromDB(row: any): Venta {
  return {
    id: row.id,
    folio: row.folio,
    clienteId: row.cliente_id,
    vendedorId: row.vendedor_id,
    sesionCajaId: row.sesion_caja_id,
    subtotal: parseFloat(row.subtotal),
    descuento: parseFloat(row.descuento),
    total: parseFloat(row.total),
    metodoPago: row.metodo_pago,
    desgloseMixto: row.desglose_mixto,
    referenciaPago: row.referencia_pago,
    montoRecibido: row.monto_recibido ? parseFloat(row.monto_recibido) : undefined,
    cambio: row.cambio ? parseFloat(row.cambio) : undefined,
    notas: row.notas,
    estado: row.estado,
    fechaVenta: new Date(row.fecha_venta),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapVentaDetalladaFromDB(row: any): VentaDetallada {
  const venta = mapVentaFromDB(row);
  return {
    ...venta,
    vendedorNombre: row.vendedor_nombre || row.users?.name,
    clienteNombre: row.cliente_nombre || row.clientes?.nombre,
    clienteApellido: row.cliente_apellido || row.clientes?.apellido,
    items: [], // Se llenan por separado
  };
}

function mapVentaItemFromDB(row: any): VentaItem {
  return {
    id: row.id,
    ventaId: row.venta_id,
    productoId: row.producto_id,
    cantidad: row.cantidad,
    precioUnitario: parseFloat(row.precio_unitario),
    subtotal: parseFloat(row.subtotal),
    productoNombre: row.producto_nombre,
    productoMarca: row.producto_marca,
    productoModelo: row.producto_modelo,
    createdAt: new Date(row.created_at),
  };
}

// =====================================================
// QUERIES - VENTAS
// =====================================================

/**
 * Obtiene todas las ventas con información de vendedor y cliente
 */
export async function getVentas(limit = 100, distribuidorId?: string): Promise<VentaDetallada[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ventas")
    .select(`
      *,
      users:vendedor_id (name),
      clientes:cliente_id (nombre, apellido)
    `)
    .order("fecha_venta", { ascending: false })
    .limit(limit);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching ventas:", error);
    throw new Error(`Error al obtener ventas: ${error.message}`);
  }

  return (data || []).map(mapVentaDetalladaFromDB);
}

/**
 * Obtiene una venta por ID con todos sus items y productos
 */
export async function getVentaById(id: string, distribuidorId?: string): Promise<VentaDetallada | null> {
  const supabase = createAdminClient();

  // Obtener venta con joins
  let query = supabase
    .from("ventas")
    .select(`
      *,
      users:vendedor_id (name),
      clientes:cliente_id (nombre, apellido, telefono)
    `)
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data: ventaData, error: ventaError } = await query.single();

  if (ventaError || !ventaData) {
    console.error("Error fetching venta:", ventaError);
    return null;
  }

  // Obtener items con productos
  const { data: itemsData, error: itemsError } = await supabase
    .from("ventas_items")
    .select(`
      *,
      productos:producto_id (*)
    `)
    .eq("venta_id", id);

  if (itemsError) {
    console.error("Error fetching venta items:", itemsError);
    throw new Error(`Error al obtener items de venta: ${itemsError.message}`);
  }

  const venta = mapVentaDetalladaFromDB(ventaData);

  // Mapear items con productos
  venta.items = (itemsData || []).map((item) => ({
    ...mapVentaItemFromDB(item),
    producto: item.productos ? {
      id: item.productos.id,
      nombre: item.productos.nombre,
      marca: item.productos.marca,
      modelo: item.productos.modelo,
      precio: parseFloat(item.productos.precio),
      stock: item.productos.stock,
      imagen: item.productos.imagen,
      descripcion: item.productos.descripcion,
      createdAt: new Date(item.productos.created_at),
      updatedAt: new Date(item.productos.updated_at),
    } : undefined,
  }));

  return venta;
}

/**
 * Obtiene ventas por rango de fechas
 */
export async function getVentasByFecha(
  fechaInicio: Date,
  fechaFin: Date,
  distribuidorId?: string
): Promise<VentaDetallada[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ventas")
    .select(`
      *,
      users:vendedor_id (name),
      clientes:cliente_id (nombre, apellido)
    `)
    .gte("fecha_venta", fechaInicio.toISOString())
    .lte("fecha_venta", fechaFin.toISOString())
    .order("fecha_venta", { ascending: false });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching ventas by fecha:", error);
    throw new Error(`Error al obtener ventas por fecha: ${error.message}`);
  }

  return (data || []).map(mapVentaDetalladaFromDB);
}

/**
 * Obtiene ventas del día actual
 */
export async function getVentasDelDia(distribuidorId?: string): Promise<VentaDetallada[]> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  return getVentasByFecha(hoy, manana, distribuidorId);
}

/**
 * Crea una nueva venta con sus items
 * El stock se decrementa automáticamente por trigger
 */
export async function createVenta(
  formData: NuevaVentaFormData,
  vendedorId: string,
  sesionCajaId?: string,
  distribuidorId?: string
): Promise<VentaDetallada> {
  const supabase = createAdminClient();

  // Calcular totales
  const subtotal = formData.items.reduce(
    (sum, item) => sum + item.cantidad * item.precioUnitario,
    0
  );
  const total = subtotal - formData.descuento;

  // Calcular cambio si es efectivo
  let cambio = 0;
  if (formData.metodoPago === "efectivo" && formData.montoRecibido) {
    cambio = formData.montoRecibido - total;
  }

  // Validar pago mixto
  if (formData.metodoPago === "mixto" && formData.desgloseMixto) {
    const sumaMixto =
      (formData.desgloseMixto.efectivo || 0) +
      (formData.desgloseMixto.transferencia || 0) +
      (formData.desgloseMixto.tarjeta || 0);

    if (Math.abs(sumaMixto - total) > 0.01) {
      throw new Error(
        `Pago mixto no coincide. Total: $${total.toFixed(2)}, Suma pagos: $${sumaMixto.toFixed(2)}`
      );
    }
  }

  // 1. Insertar venta (folio se genera automáticamente por trigger)
  const { data: ventaData, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      distribuidor_id: distribuidorId, // FASE 21
      folio: "", // El trigger lo genera
      cliente_id: formData.clienteId || null,
      vendedor_id: vendedorId,
      sesion_caja_id: sesionCajaId || null,
      subtotal,
      descuento: formData.descuento,
      total,
      metodo_pago: formData.metodoPago,
      desglose_mixto: formData.desgloseMixto || null,
      referencia_pago: formData.referenciaPago || null,
      monto_recibido: formData.montoRecibido || null,
      cambio: cambio || null,
      notas: formData.notas || null,
      estado: "completada",
      fecha_venta: new Date().toISOString(),
    })
    .select()
    .single();

  if (ventaError || !ventaData) {
    console.error("Error creating venta:", ventaError);
    throw new Error(`Error al crear venta: ${ventaError?.message || "Unknown error"}`);
  }

  // 2. Insertar items (el trigger decrementará el stock automáticamente)
  const itemsToInsert = formData.items.map((item) => ({
    venta_id: ventaData.id,
    producto_id: item.productoId,
    cantidad: item.cantidad,
    precio_unitario: item.precioUnitario,
    subtotal: item.cantidad * item.precioUnitario,
    // Los campos de snapshot se llenarán con trigger o dejamos que el frontend los envíe
  }));

  // Obtener nombres de productos para snapshot
  const { data: productosData } = await supabase
    .from("productos")
    .select("id, nombre, marca, modelo")
    .in("id", formData.items.map((i) => i.productoId));

  const productosMap = new Map(
    (productosData || []).map((p) => [p.id, p])
  );

  const itemsWithSnapshot = itemsToInsert.map((item) => {
    const producto = productosMap.get(item.producto_id);
    return {
      ...item,
      producto_nombre: producto?.nombre || "",
      producto_marca: producto?.marca || "",
      producto_modelo: producto?.modelo || "",
    };
  });

  const { error: itemsError } = await supabase
    .from("ventas_items")
    .insert(itemsWithSnapshot);

  if (itemsError) {
    console.error("Error creating venta items:", itemsError);
    // Intentar eliminar la venta si falla la creación de items
    await supabase.from("ventas").delete().eq("id", ventaData.id);
    throw new Error(`Error al crear items de venta: ${itemsError.message}`);
  }

  // 3. Retornar venta completa
  const ventaCompleta = await getVentaById(ventaData.id, distribuidorId);
  if (!ventaCompleta) {
    throw new Error("Error al recuperar venta creada");
  }

  return ventaCompleta;
}

/**
 * Cancela una venta
 * El trigger restaurará el stock automáticamente
 */
export async function cancelarVenta(
  id: string,
  motivo?: string
): Promise<Venta> {
  const supabase = createAdminClient();

  const updateData: any = {
    estado: "cancelada",
    updated_at: new Date().toISOString(),
  };

  if (motivo) {
    updateData.notas = motivo;
  }

  const { data, error } = await supabase
    .from("ventas")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("Error canceling venta:", error);
    throw new Error(`Error al cancelar venta: ${error?.message || "Unknown error"}`);
  }

  return mapVentaFromDB(data);
}

/**
 * Obtiene estadísticas del POS
 */
export async function getEstadisticasPOS(distribuidorId?: string): Promise<EstadisticasPOS> {
  const supabase = createAdminClient();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay());

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  // Helper para filtro
  const applyDistFilter = (q: any) => {
    if (distribuidorId) return q.eq("distribuidor_id", distribuidorId);
    return q;
  };

  // Ventas de hoy
  const { data: ventasHoy } = await applyDistFilter(supabase
    .from("ventas")
    .select("total")
    .eq("estado", "completada")
    .gte("fecha_venta", hoy.toISOString()));

  const totalHoy = (ventasHoy || []).reduce(
    (sum: any, v: any) => sum + parseFloat(v.total),
    0
  );

  // Ventas de la semana
  const { data: ventasSemana } = await applyDistFilter(supabase
    .from("ventas")
    .select("total")
    .eq("estado", "completada")
    .gte("fecha_venta", inicioSemana.toISOString()));

  const totalSemana = (ventasSemana || []).reduce(
    (sum: any, v: any) => sum + parseFloat(v.total),
    0
  );

  // Ventas del mes
  const { data: ventasMes } = await applyDistFilter(supabase
    .from("ventas")
    .select("total")
    .eq("estado", "completada")
    .gte("fecha_venta", inicioMes.toISOString()));

  const totalMes = (ventasMes || []).reduce(
    (sum: any, v: any) => sum + parseFloat(v.total),
    0
  );

  // Productos más vendidos del mes
  // Note: ventas!inner join filters items by sales filter
  let itemsQuery = supabase
    .from("ventas_items")
    .select(`
      producto_id,
      producto_nombre,
      cantidad,
      subtotal,
      ventas!inner(estado, fecha_venta, distribuidor_id)
    `)
    .eq("ventas.estado", "completada")
    .gte("ventas.fecha_venta", inicioMes.toISOString());

  if (distribuidorId) {
    itemsQuery = itemsQuery.eq("ventas.distribuidor_id", distribuidorId);
  }

  const { data: itemsMes } = await itemsQuery;

  // Agrupar por producto
  const productosMap = new Map<
    string,
    { nombre: string; cantidad: number; total: number }
  >();

  (itemsMes || []).forEach((item: any) => {
    const existing = productosMap.get(item.producto_id);
    if (existing) {
      existing.cantidad += item.cantidad;
      existing.total += parseFloat(item.subtotal);
    } else {
      productosMap.set(item.producto_id, {
        nombre: item.producto_nombre || "Sin nombre",
        cantidad: item.cantidad,
        total: parseFloat(item.subtotal),
      });
    }
  });

  const productosMasVendidos = Array.from(productosMap.entries())
    .map(([id, data]) => ({
      productoId: id,
      productoNombre: data.nombre,
      cantidadVendida: data.cantidad,
      totalVentas: data.total,
    }))
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
    .slice(0, 10);

  return {
    ventasHoy: ventasHoy?.length || 0,
    totalHoy,
    ventasSemana: ventasSemana?.length || 0,
    totalSemana,
    ventasMes: ventasMes?.length || 0,
    totalMes,
    productosMasVendidos,
  };
}
