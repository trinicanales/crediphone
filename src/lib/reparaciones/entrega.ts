import { createAdminClient } from "@/lib/supabase/admin";
import { guardarVersionPDF } from "@/lib/pdf/versiones-pdf";
import { createGarantia, getGarantiaByOrden } from "@/lib/db/reparaciones";

export interface EfectosEntregaParams {
  ordenId: string;
  folio: string;
  distribuidorId: string | null;
  clienteId: string | null;
  precioTotal: number;
  sesionCajaId: string | null;
  userId: string;
}

export interface EfectosEntregaResultado {
  costosPiezas: number;
  montoCajaAdvanced: number;
  ingresoNeto: number;
}

/**
 * Efectos compartidos al entregar una orden de reparación (después de que el
 * pago quedó completo y ANTES/DESPUÉS de marcar estado="entregado", según el caller):
 *  - Calcula ingreso neto (precio_total - costos de piezas pedidas al proveedor)
 *  - Registra movimientos en bolsa virtual (reembolso a caja si aplica + ingreso neto)
 *  - Descuenta stock real de piezas reservadas en `reparacion_piezas` (apartadas al
 *    agregarlas a la orden) Y piezas de catálogo instaladas vía `pedidos_pieza_reparacion`
 *    — ambas fuentes, para no dejar reservas de stock huérfanas
 *  - Acumula puntos de lealtad del cliente
 *  - Genera el PDF de acuse de entrega (fire-and-forget)
 *
 * Unifica lo que antes vivía duplicado en `pos/reparacion-cobro/route.ts` y
 * `reparaciones/[id]/entregar/route.ts` — ya habían divergido: la versión de POS
 * consumía stock de dos tablas (`reparacion_piezas` + `pedidos_pieza_reparacion`),
 * la del botón directo "Entregar" solo de una (`pedidos_pieza_reparacion`), lo que
 * podía dejar piezas apartadas sin liberar según la vía usada para entregar.
 *
 * NO maneja: marcar anticipos como aplicados, registrar el pago en caja, cambiar
 * el estado de la orden, ni el registro en `historial_estado_orden` — cada caller
 * mantiene esa lógica porque difiere legítimamente entre flujos (pago incremental
 * vía POS vs. liquidación única al entregar).
 */
export async function ejecutarEfectosEntrega(
  params: EfectosEntregaParams
): Promise<EfectosEntregaResultado> {
  const { ordenId, folio, distribuidorId, clienteId, precioTotal, sesionCajaId, userId } = params;
  const supabase = createAdminClient();

  // 1. Calcular costos de piezas para ingreso neto
  const { data: pedidosPieza } = await supabase
    .from("pedidos_pieza_reparacion")
    .select("costo_estimado, costo_envio, monto_de_caja, estado")
    .eq("orden_id", ordenId)
    .neq("estado", "cancelada");

  const costosPiezas = (pedidosPieza || []).reduce(
    (sum: number, p: any) => sum + Number(p.costo_estimado || 0) + Number(p.costo_envio || 0),
    0
  );
  const montoCajaAdvanced = (pedidosPieza || []).reduce(
    (sum: number, p: any) => sum + Number(p.monto_de_caja || 0),
    0
  );
  const ingresoNeto = Math.max(0, precioTotal - costosPiezas);

  // 2. Registrar movimientos en bolsa virtual
  const movimientosBolsa: any[] = [];
  if (montoCajaAdvanced > 0) {
    movimientosBolsa.push({
      orden_id: ordenId,
      distribuidor_id: distribuidorId,
      tipo: "reembolso_caja",
      monto: montoCajaAdvanced,
      concepto: `Reembolso a caja: adelanto por piezas $${montoCajaAdvanced.toFixed(2)}`,
      sesion_caja_id: sesionCajaId,
      registrado_por: userId,
    });
  }
  movimientosBolsa.push({
    orden_id: ordenId,
    distribuidor_id: distribuidorId,
    tipo: "ingreso_caja",
    monto: ingresoNeto,
    concepto: `Ingreso neto: precio $${precioTotal.toFixed(2)} - costos piezas $${costosPiezas.toFixed(2)}`,
    sesion_caja_id: sesionCajaId,
    registrado_por: userId,
  });
  await supabase.from("movimientos_bolsa_virtual").insert(movimientosBolsa);

  // 3a. Consumir stock de piezas reservadas en reparacion_piezas (apartadas al agregarlas)
  const { data: piezasApartadas } = await supabase
    .from("reparacion_piezas")
    .select("producto_id, nombre_pieza, cantidad")
    .eq("orden_id", ordenId)
    .not("producto_id", "is", null);

  for (const pieza of piezasApartadas || []) {
    const { data: prodAp } = await supabase
      .from("productos")
      .select("stock, stock_apartado")
      .eq("id", pieza.producto_id)
      .single();
    if (!prodAp) continue;
    const nuevoStock = Math.max(0, (prodAp.stock ?? 0) - pieza.cantidad);
    const nuevoApartado = Math.max(0, (prodAp.stock_apartado ?? 0) - pieza.cantidad);
    await supabase
      .from("productos")
      .update({ stock: nuevoStock, stock_apartado: nuevoApartado })
      .eq("id", pieza.producto_id);
    await supabase.from("movimientos_stock").insert({
      producto_id: pieza.producto_id,
      distribuidor_id: distribuidorId,
      tipo: "uso_reparacion",
      cantidad: -pieza.cantidad,
      stock_antes: prodAp.stock ?? 0,
      stock_despues: nuevoStock,
      referencia_id: ordenId,
      referencia_tipo: "orden_reparacion",
      referencia_folio: folio,
      registrado_por: userId,
      notas: `Pieza "${pieza.nombre_pieza}" consumida al entregar ${folio}`,
    });
  }

  // 3b. Descontar stock de piezas del catálogo instaladas (pedidos_pieza_reparacion)
  const { data: piezasCatalogo } = await supabase
    .from("pedidos_pieza_reparacion")
    .select("id, producto_id, nombre_pieza")
    .eq("orden_id", ordenId)
    .not("producto_id", "is", null)
    .in("estado", ["instalada", "verificada_ok"]);

  for (const pieza of piezasCatalogo || []) {
    const { data: prod } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", pieza.producto_id)
      .single();
    if (!prod) continue;
    const stockAntes = Number(prod.stock ?? 0);
    const stockDespues = Math.max(0, stockAntes - 1);
    await supabase.from("productos").update({ stock: stockDespues }).eq("id", pieza.producto_id);
    await supabase.from("movimientos_stock").insert({
      producto_id: pieza.producto_id,
      distribuidor_id: distribuidorId,
      tipo: "uso_reparacion",
      cantidad: -1,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      referencia_id: ordenId,
      referencia_tipo: "orden_reparacion",
      referencia_folio: folio,
      registrado_por: userId,
      notas: `Pieza "${pieza.nombre_pieza}" instalada en ${folio}`,
    });
  }

  // 4. Acumular puntos de lealtad
  if (clienteId && precioTotal > 0) {
    import("@/lib/db/puntos").then(({ acumularPuntos }) =>
      acumularPuntos({
        clienteId,
        distribuidorId: distribuidorId ?? undefined,
        monto: precioTotal,
        referenciaId: ordenId,
        referenciaTipo: "reparacion",
        descripcion: `Reparación ${folio} — $${precioTotal.toFixed(2)}`,
      })
    ).catch(() => {});
  }

  // 5. PDF de acuse de entrega (fire-and-forget)
  guardarVersionPDF(
    ordenId,
    folio,
    "entrega",
    `Acuse de entrega. Ingreso neto: $${ingresoNeto.toFixed(2)}`,
    userId
  ).catch(() => {});

  // 6. Garantía automática — 90 días naturales sobre mano de obra (LFPC Art. 76 bis),
  // el mismo plazo que ya se le promete al cliente en los términos del PDF de resguardo.
  // Idempotente: si la orden ya tiene garantía (p.ej. reintento de entrega) no duplica.
  try {
    const garantiaExistente = await getGarantiaByOrden(ordenId);
    if (!garantiaExistente) {
      await createGarantia(ordenId, { tipoGarantia: "garantia_pieza", diasGarantia: 90 });
    }
  } catch (e) {
    console.error(`[entrega] Error al crear garantía automática para ${folio}:`, e);
  }

  return { costosPiezas, montoCajaAdvanced, ingresoNeto };
}
