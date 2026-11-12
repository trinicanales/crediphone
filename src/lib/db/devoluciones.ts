import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Devolucion,
  DevolucionDetallada,
  DevolucionItem,
  DevolucionItemDetallado,
  DevolucionElegibilidad,
  NuevaDevolucionPayload,
} from "@/types";

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapDevolucionFromDB(db: any): Devolucion {
  return {
    id: db.id,
    distribuidorId: db.distribuidor_id,
    ventaId: db.venta_id,
    folio: db.folio,
    procesadoPor: db.procesado_por,
    montoDevuelto: parseFloat(db.monto_devuelto) || 0,
    metodoReembolso: db.metodo_reembolso,
    referenciaReembolso: db.referencia_reembolso || undefined,
    bloqueadoPayjoy: db.bloqueado_payjoy ?? false,
    motivo: db.motivo || undefined,
    notas: db.notas || undefined,
    estado: db.estado,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

function mapItemFromDB(db: any): DevolucionItem {
  return {
    id: db.id,
    devolucionId: db.devolucion_id,
    ventaItemId: db.venta_item_id,
    productoId: db.producto_id || undefined,
    cantidadDevuelta: db.cantidad_devuelta,
    precioUnitario: parseFloat(db.precio_unitario) || 0,
    subtotalDevuelto: parseFloat(db.subtotal_devuelto) || 0,
    stockReintegrado: db.stock_reintegrado ?? false,
    createdAt: new Date(db.created_at),
  };
}

// ─── Generador de folio ─────────────────────────────────────────────────────

async function generarFolioDevolucion(
  distribuidorId: string | null,
  ventaFolio: string
): Promise<string> {
  const supabase = createAdminClient();
  // Contar devoluciones del día para este distribuidor
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString();

  const query = supabase
    .from("devoluciones")
    .select("id", { count: "exact" })
    .gte("created_at", inicio)
    .lt("created_at", fin);

  if (distribuidorId) query.eq("distribuidor_id", distribuidorId);

  const { count } = await query;
  const seq = String((count ?? 0) + 1).padStart(5, "0");
  const año = hoy.getFullYear();
  return `DEV-${ventaFolio.replace("VENTA-", "")}-${seq}`;
}

// ─── Verificar elegibilidad ─────────────────────────────────────────────────

export async function verificarElegibilidad(
  ventaId: string,
  diasMaxDevolucion: number
): Promise<DevolucionElegibilidad> {
  const supabase = createAdminClient();

  // Obtener venta
  const { data: venta, error } = await supabase
    .from("ventas")
    .select("id, folio, fecha_venta, metodo_pago, estado, distribuidor_id")
    .eq("id", ventaId)
    .single();

  if (error || !venta) {
    return {
      elegible: false,
      razon: "Venta no encontrada",
      diasTranscurridos: 0,
      limiteMaximoDias: diasMaxDevolucion,
      esPayjoy: false,
    };
  }

  // Calcular días transcurridos
  const fechaVenta = new Date(venta.fecha_venta);
  const ahora = new Date();
  const diasTranscurridos = Math.floor(
    (ahora.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Venta ya cancelada o reembolsada
  if (venta.estado !== "completada") {
    return {
      elegible: false,
      razon: `Esta venta ya está en estado "${venta.estado}" y no puede ser devuelta`,
      diasTranscurridos,
      limiteMaximoDias: diasMaxDevolucion,
      esPayjoy: false,
    };
  }

  // Verificar si hay devolución total previa
  const { count: devCount } = await supabase
    .from("devoluciones")
    .select("id", { count: "exact" })
    .eq("venta_id", ventaId)
    .eq("estado", "procesada");

  if ((devCount ?? 0) > 0) {
    // Puede haber devolucion parcial previa — verificamos si ya se devolvió todo
    // (simplificado: bloqueamos si ya existe alguna devolución total)
    // En implementación real se pueden acumular parciales
  }

  const esPayjoy =
    venta.metodo_pago === "payjoy" ||
    (typeof venta.metodo_pago === "string" && venta.metodo_pago.includes("payjoy"));

  // Regla Payjoy: máximo 7 días desde la venta
  if (esPayjoy) {
    if (diasTranscurridos > 7) {
      return {
        elegible: false,
        razon: `Las ventas Payjoy solo pueden reembolsarse dentro de los primeros 7 días. Han pasado ${diasTranscurridos} días.`,
        diasTranscurridos,
        limiteMaximoDias: 7,
        esPayjoy: true,
        primerPagoPayjoy: false,
      };
    }

    // Verificar si el cliente ya realizó su primer pago en Payjoy
    // Buscamos en payjoy_webhooks pagos asociados a esta venta
    const { data: webhooks } = await supabase
      .from("payjoy_webhooks")
      .select("id, tipo, created_at")
      .eq("venta_id", ventaId)
      .in("tipo", ["payment", "payment_received", "first_payment"])
      .limit(1);

    const primerPagoPayjoy = !!(webhooks && webhooks.length > 0);

    if (primerPagoPayjoy) {
      return {
        elegible: false,
        razon:
          "El cliente ya realizó su primer pago en Payjoy. La devolución queda anulada según las políticas del financiamiento.",
        diasTranscurridos,
        limiteMaximoDias: 7,
        esPayjoy: true,
        primerPagoPayjoy: true,
      };
    }

    return {
      elegible: true,
      diasTranscurridos,
      limiteMaximoDias: 7,
      esPayjoy: true,
      primerPagoPayjoy: false,
    };
  }

  // Regla estándar: días máximos configurables
  if (diasTranscurridos > diasMaxDevolucion) {
    return {
      elegible: false,
      razon: `La política de devoluciones solo permite hasta ${diasMaxDevolucion} días. Han pasado ${diasTranscurridos} días desde la venta.`,
      diasTranscurridos,
      limiteMaximoDias: diasMaxDevolucion,
      esPayjoy: false,
    };
  }

  return {
    elegible: true,
    diasTranscurridos,
    limiteMaximoDias: diasMaxDevolucion,
    esPayjoy: false,
  };
}

// ─── Crear devolución ───────────────────────────────────────────────────────

export async function crearDevolucion(
  payload: NuevaDevolucionPayload,
  procesadoPorId: string,
  distribuidorId: string | null
): Promise<DevolucionDetallada> {
  const supabase = createAdminClient();

  // 1. Obtener venta y sus items
  const { data: venta } = await supabase
    .from("ventas")
    .select("id, folio, metodo_pago, estado, distribuidor_id")
    .eq("id", payload.ventaId)
    .single();

  if (!venta) throw new Error("Venta no encontrada");
  if (venta.estado !== "completada") throw new Error("Solo se pueden devolver ventas completadas");

  // 2. Obtener los ventas_items a devolver
  const ventaItemIds = payload.items.map((i) => i.ventaItemId);
  const { data: ventaItems } = await supabase
    .from("ventas_items")
    .select("id, producto_id, cantidad, precio_unitario, subtotal, nombre_producto, imei")
    .in("id", ventaItemIds);

  if (!ventaItems || ventaItems.length === 0) {
    throw new Error("No se encontraron los items de la venta");
  }

  // 3. Calcular monto total a devolver
  let montoDevuelto = 0;
  const itemsParaInsertar: any[] = [];

  for (const payloadItem of payload.items) {
    const vi = ventaItems.find((i) => i.id === payloadItem.ventaItemId);
    if (!vi) throw new Error(`Item ${payloadItem.ventaItemId} no encontrado`);
    if (payloadItem.cantidadDevuelta > vi.cantidad) {
      throw new Error(
        `No puede devolver más de ${vi.cantidad} unidades del producto "${vi.nombre_producto}"`
      );
    }
    const subtotalItem =
      parseFloat(vi.precio_unitario) * payloadItem.cantidadDevuelta;
    montoDevuelto += subtotalItem;
    itemsParaInsertar.push({
      ventaItemId: payloadItem.ventaItemId,
      productoId: vi.producto_id,
      cantidadDevuelta: payloadItem.cantidadDevuelta,
      precioUnitario: parseFloat(vi.precio_unitario),
      subtotalDevuelto: subtotalItem,
    });
  }

  // 4. Generar folio
  const folio = await generarFolioDevolucion(distribuidorId, venta.folio);

  // 5. Insertar encabezado devolución
  const { data: devDB, error: devError } = await supabase
    .from("devoluciones")
    .insert({
      distribuidor_id: distribuidorId,
      venta_id: payload.ventaId,
      folio,
      procesado_por: procesadoPorId,
      monto_devuelto: montoDevuelto,
      metodo_reembolso: payload.metodoReembolso,
      referencia_reembolso: payload.referenciaReembolso || null,
      bloqueado_payjoy: false,
      motivo: payload.motivo || null,
      notas: payload.notas || null,
      estado: "procesada",
    })
    .select()
    .single();

  if (devError) throw devError;

  // 6. Insertar líneas de devolución + reintegrar stock
  const devolucionId = devDB.id;
  const itemsInsert = itemsParaInsertar.map((it) => ({
    devolucion_id: devolucionId,
    venta_item_id: it.ventaItemId,
    producto_id: it.productoId,
    cantidad_devuelta: it.cantidadDevuelta,
    precio_unitario: it.precioUnitario,
    subtotal_devuelto: it.subtotalDevuelto,
    stock_reintegrado: false,
  }));

  const { data: itemsDB, error: itemsError } = await supabase
    .from("devoluciones_items")
    .insert(itemsInsert)
    .select();

  if (itemsError) throw itemsError;

  // 7. Reintegrar stock en productos
  for (const it of itemsParaInsertar) {
    if (it.productoId) {
      // Incrementar stock
      const { data: prod } = await supabase
        .from("productos")
        .select("stock")
        .eq("id", it.productoId)
        .single();

      if (prod) {
        const stockAntes = prod.stock ?? 0;
        const stockDespues = stockAntes + it.cantidadDevuelta;
        await supabase
          .from("productos")
          .update({ stock: stockDespues })
          .eq("id", it.productoId);
        await supabase.from("movimientos_stock").insert({
          producto_id: it.productoId,
          distribuidor_id: distribuidorId,
          tipo: "devolucion",
          cantidad: it.cantidadDevuelta,
          stock_antes: stockAntes,
          stock_despues: stockDespues,
          referencia_id: devolucionId,
          referencia_tipo: "devolucion",
          referencia_folio: folio,
          registrado_por: procesadoPorId,
          notas: `Devolución: ${it.cantidadDevuelta} u.`,
        });
      }

      // Marcar stock_reintegrado = true en el item
      await supabase
        .from("devoluciones_items")
        .update({ stock_reintegrado: true })
        .eq("devolucion_id", devolucionId)
        .eq("venta_item_id", it.ventaItemId);
    }
  }

  // 8. Marcar venta como reembolsada (si es devolución total)
  // Verificar si se devolvieron TODOS los items en su totalidad
  const { data: todosItems } = await supabase
    .from("ventas_items")
    .select("id, cantidad")
    .eq("venta_id", payload.ventaId);

  // Se suman TODAS las devoluciones procesadas de la venta (antes solo la actual: una segunda
  // devolución parcial que completaba la venta nunca la marcaba como reembolsada).
  const { data: todasDevoluciones } = await supabase
    .from("devoluciones_items")
    .select("venta_item_id, cantidad_devuelta, devoluciones!inner(venta_id, estado)")
    .eq("devoluciones.venta_id", payload.ventaId)
    .eq("devoluciones.estado", "procesada");

  const devueltoPorItem = new Map<string, number>();
  for (const d of todasDevoluciones ?? []) {
    devueltoPorItem.set(d.venta_item_id, (devueltoPorItem.get(d.venta_item_id) ?? 0) + Number(d.cantidad_devuelta));
  }

  const esDevolucionTotal =
    !!todosItems &&
    todosItems.length > 0 &&
    todosItems.every((vi) => (devueltoPorItem.get(vi.id) ?? 0) >= vi.cantidad);

  // Con la venta marcada como reembolsada, el trigger de la base devuelve al stock SOLO lo que falta
  // (cantidad vendida - lo ya reintegrado por estas devoluciones): ya no se duplica.
  if (esDevolucionTotal) {
    await supabase
      .from("ventas")
      .update({ estado: "reembolsada" })
      .eq("id", payload.ventaId);
  }

  // 9. Ensamblar DevolucionDetallada para respuesta
  const devolucion = mapDevolucionFromDB(devDB);
  const devItems: DevolucionItemDetallado[] = (itemsDB || []).map((item) => {
    const vi = ventaItems.find((v) => v.id === item.venta_item_id);
    return {
      ...mapItemFromDB(item),
      productoNombre: vi?.nombre_producto,
      imei: vi?.imei,
    };
  });

  return {
    ...devolucion,
    ventaFolio: venta.folio,
    items: devItems,
  };
}

// ─── Listar devoluciones de una venta ───────────────────────────────────────

export async function getDevoluciones(
  ventaId: string
): Promise<DevolucionDetallada[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("devoluciones")
    .select("*")
    .eq("venta_id", ventaId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const result: DevolucionDetallada[] = [];
  for (const dev of data || []) {
    const { data: items } = await supabase
      .from("devoluciones_items")
      .select("*")
      .eq("devolucion_id", dev.id);

    result.push({
      ...mapDevolucionFromDB(dev),
      items: (items || []).map(mapItemFromDB),
    });
  }

  return result;
}
