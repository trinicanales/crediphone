/**
 * FASE 46 — DB layer para Órdenes de Compra a Proveedores.
 * Maneja la tabla ordenes_compra + ordenes_compra_items.
 * Al recibir (total o parcial), actualiza el stock de productos.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OrdenCompra,
  OrdenCompraItem,
  EstadoOrdenCompra,
} from "@/types";

// ─────────────────────────────────────────────────────────────────
// MAPPERS
// ─────────────────────────────────────────────────────────────────

function mapItem(row: Record<string, unknown>): OrdenCompraItem {
  return {
    id:             row.id as string,
    ordenCompraId:  row.orden_compra_id as string,
    productoId:     row.producto_id as string | null,
    descripcion:    row.descripcion as string,
    sku:            row.sku as string | undefined,
    marca:          row.marca as string | undefined,
    modelo:         row.modelo as string | undefined,
    cantidad:       row.cantidad as number,
    cantidadRecibida: row.cantidad_recibida as number,
    precioUnitario: parseFloat(row.precio_unitario as string),
    descuentoPct:   parseFloat(row.descuento_pct as string),
    subtotal:       parseFloat(row.subtotal as string),
    notas:          row.notas as string | undefined,
    createdAt:      new Date(row.created_at as string),
    updatedAt:      new Date(row.updated_at as string),
  };
}

function mapOrden(row: Record<string, unknown>): OrdenCompra {
  const items = Array.isArray(row.ordenes_compra_items)
    ? (row.ordenes_compra_items as Record<string, unknown>[]).map(mapItem)
    : undefined;

  const proveedorRaw = row.proveedores as Record<string, unknown> | null | undefined;

  return {
    id:              row.id as string,
    distribuidorId:  row.distribuidor_id as string | null,
    proveedorId:     row.proveedor_id as string | null,
    folio:           row.folio as string,
    estado:          row.estado as EstadoOrdenCompra,
    fechaOrden:      row.fecha_orden as string,
    fechaEsperada:   row.fecha_esperada as string | undefined,
    fechaRecibida:   row.fecha_recibida as string | undefined,
    subtotal:        parseFloat(row.subtotal as string),
    descuento:       parseFloat(row.descuento as string),
    total:           parseFloat(row.total as string),
    moneda:          row.moneda as string,
    condicionesPago: row.condiciones_pago as string | undefined,
    notas:           row.notas as string | undefined,
    notasRecepcion:  row.notas_recepcion as string | undefined,
    creadoPor:       row.creado_por as string | undefined,
    createdAt:       new Date(row.created_at as string),
    updatedAt:       new Date(row.updated_at as string),
    items,
    proveedor: proveedorRaw
      ? {
          id:       proveedorRaw.id as string,
          nombre:   proveedorRaw.nombre as string,
          telefono: proveedorRaw.telefono as string | undefined,
          email:    proveedorRaw.email as string | undefined,
        }
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// FOLIO GENERATOR
// ─────────────────────────────────────────────────────────────────

async function generarFolio(distribuidorId: string | null): Promise<string> {
  const supabase = createAdminClient();
  let query = supabase
    .from("ordenes_compra")
    .select("folio")
    .order("created_at", { ascending: false })
    .limit(1);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  } else {
    query = query.is("distribuidor_id", null);
  }

  const { data } = await query;
  const lastFolio = data?.[0]?.folio ?? "OC-0000";
  const lastNum = parseInt(lastFolio.replace(/\D/g, ""), 10) || 0;
  const next = lastNum + 1;
  return `OC-${String(next).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────

export interface ListarOrdenesCompraOpts {
  distribuidorId?: string;
  estado?: EstadoOrdenCompra;
  proveedorId?: string;
  limit?: number;
  offset?: number;
}

export async function listarOrdenesCompra(
  opts: ListarOrdenesCompraOpts = {}
): Promise<OrdenCompra[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("ordenes_compra")
    .select(`
      *,
      proveedores (id, nombre, telefono, email),
      ordenes_compra_items (*)
    `)
    .order("created_at", { ascending: false });

  if (opts.distribuidorId) query = query.eq("distribuidor_id", opts.distribuidorId);
  if (opts.estado)         query = query.eq("estado", opts.estado);
  if (opts.proveedorId)    query = query.eq("proveedor_id", opts.proveedorId);
  if (opts.limit)          query = query.limit(opts.limit);
  if (opts.offset)         query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw new Error(`Error al listar órdenes de compra: ${error.message}`);
  return (data ?? []).map((r) => mapOrden(r as Record<string, unknown>));
}

export async function getOrdenCompra(id: string): Promise<OrdenCompra | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ordenes_compra")
    .select(`
      *,
      proveedores (id, nombre, telefono, email),
      ordenes_compra_items (*)
    `)
    .eq("id", id)
    .single();

  if (error) return null;
  return mapOrden(data as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────
// CREAR ORDEN
// ─────────────────────────────────────────────────────────────────

export interface CrearOrdenCompraInput {
  distribuidorId: string | null;
  proveedorId?: string;
  fechaOrden?: string;
  fechaEsperada?: string;
  condicionesPago?: string;
  notas?: string;
  descuento?: number;
  creadoPor?: string;
  items: Array<{
    productoId?: string;
    descripcion: string;
    sku?: string;
    marca?: string;
    modelo?: string;
    cantidad: number;
    precioUnitario: number;
    descuentoPct?: number;
    notas?: string;
  }>;
}

export async function crearOrdenCompra(
  input: CrearOrdenCompraInput
): Promise<OrdenCompra> {
  const supabase = createAdminClient();
  const folio = await generarFolio(input.distribuidorId);

  // Calcular totales
  let subtotal = 0;
  const itemsConSubtotal = input.items.map((item) => {
    const descPct = item.descuentoPct ?? 0;
    const sub = item.cantidad * item.precioUnitario * (1 - descPct / 100);
    subtotal += sub;
    return { ...item, subtotal: sub };
  });

  const descuento = input.descuento ?? 0;
  const total = Math.max(0, subtotal - descuento);

  // Insertar orden
  const { data: ordenData, error: ordenError } = await supabase
    .from("ordenes_compra")
    .insert({
      distribuidor_id:  input.distribuidorId,
      proveedor_id:     input.proveedorId ?? null,
      folio,
      estado:           "borrador",
      fecha_orden:      input.fechaOrden ?? new Date().toISOString().split("T")[0],
      fecha_esperada:   input.fechaEsperada ?? null,
      condiciones_pago: input.condicionesPago ?? null,
      notas:            input.notas ?? null,
      subtotal,
      descuento,
      total,
      creado_por:       input.creadoPor ?? null,
    })
    .select("id")
    .single();

  if (ordenError) throw new Error(`Error al crear orden: ${ordenError.message}`);
  const ordenId = (ordenData as { id: string }).id;

  // Insertar items
  if (itemsConSubtotal.length > 0) {
    const { error: itemsError } = await supabase
      .from("ordenes_compra_items")
      .insert(
        itemsConSubtotal.map((item) => ({
          orden_compra_id:  ordenId,
          producto_id:      item.productoId ?? null,
          descripcion:      item.descripcion,
          sku:              item.sku ?? null,
          marca:            item.marca ?? null,
          modelo:           item.modelo ?? null,
          cantidad:         item.cantidad,
          cantidad_recibida: 0,
          precio_unitario:  item.precioUnitario,
          descuento_pct:    item.descuentoPct ?? 0,
          subtotal:         item.subtotal,
          notas:            item.notas ?? null,
        }))
      );
    if (itemsError) throw new Error(`Error al insertar items: ${itemsError.message}`);
  }

  const orden = await getOrdenCompra(ordenId);
  if (!orden) throw new Error("No se pudo recuperar la orden creada");
  return orden;
}

// ─────────────────────────────────────────────────────────────────
// ACTUALIZAR ESTADO
// ─────────────────────────────────────────────────────────────────

export async function actualizarEstadoOrdenCompra(
  id: string,
  nuevoEstado: EstadoOrdenCompra,
  notas?: string
): Promise<OrdenCompra> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { estado: nuevoEstado };
  if (notas !== undefined) updates.notas_recepcion = notas;
  if (nuevoEstado === "recibida") updates.fecha_recibida = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("ordenes_compra")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(`Error al actualizar estado: ${error.message}`);

  const orden = await getOrdenCompra(id);
  if (!orden) throw new Error("Orden no encontrada");
  return orden;
}

// ─────────────────────────────────────────────────────────────────
// RECEPCIÓN DE MERCANCÍA (actualiza cantidades + stock de productos)
// ─────────────────────────────────────────────────────────────────

export interface RecepcionItemInput {
  itemId: string;
  cantidadRecibida: number; // Cantidad que llegó en esta recepción
}

export async function recibirMercancia(
  ordenId: string,
  recepciones: RecepcionItemInput[],
  notasRecepcion?: string
): Promise<OrdenCompra> {
  const supabase = createAdminClient();

  // Cargar la orden con items
  const orden = await getOrdenCompra(ordenId);
  if (!orden) throw new Error("Orden no encontrada");
  if (!["enviada", "recibida_parcial"].includes(orden.estado)) {
    throw new Error("Solo se puede recibir mercancía en órdenes enviadas o con recepción parcial");
  }

  const items = orden.items ?? [];

  // Procesar cada recepción
  for (const rec of recepciones) {
    if (rec.cantidadRecibida <= 0) continue;
    const item = items.find((i) => i.id === rec.itemId);
    if (!item) continue;

    const nuevaCantRecibida = Math.min(
      item.cantidadRecibida + rec.cantidadRecibida,
      item.cantidad
    );
    const deltaRecibido = nuevaCantRecibida - item.cantidadRecibida;
    if (deltaRecibido <= 0) continue;

    // Actualizar cantidad_recibida del item
    await supabase
      .from("ordenes_compra_items")
      .update({ cantidad_recibida: nuevaCantRecibida })
      .eq("id", rec.itemId);

    // Incrementar stock del producto si está vinculado
    if (item.productoId) {
      // Leemos el stock actual y sumamos el delta recibido
      const { data: prod } = await supabase
        .from("productos")
        .select("stock")
        .eq("id", item.productoId)
        .single();
      if (prod) {
        await supabase
          .from("productos")
          .update({ stock: ((prod as { stock: number }).stock ?? 0) + deltaRecibido })
          .eq("id", item.productoId);
      }
    }
  }

  // Determinar nuevo estado de la orden
  const ordenActualizada = await getOrdenCompra(ordenId);
  const todosItems = ordenActualizada?.items ?? [];
  const todoRecibido = todosItems.every((i) => i.cantidadRecibida >= i.cantidad);
  const algoRecibido = todosItems.some((i) => i.cantidadRecibida > 0);

  let nuevoEstado: EstadoOrdenCompra = orden.estado;
  if (todoRecibido) nuevoEstado = "recibida";
  else if (algoRecibido) nuevoEstado = "recibida_parcial";

  return actualizarEstadoOrdenCompra(ordenId, nuevoEstado, notasRecepcion);
}

// ─────────────────────────────────────────────────────────────────
// ELIMINAR (solo borradores)
// ─────────────────────────────────────────────────────────────────

export async function eliminarOrdenCompra(id: string): Promise<void> {
  const supabase = createAdminClient();
  const orden = await getOrdenCompra(id);
  if (!orden) throw new Error("Orden no encontrada");
  if (orden.estado !== "borrador") {
    throw new Error("Solo se pueden eliminar órdenes en estado borrador");
  }

  const { error } = await supabase
    .from("ordenes_compra")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Error al eliminar: ${error.message}`);
}
