import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionActiva } from "@/lib/db/caja";
import { calcularCredito, calcularTasaAjustada } from "@/lib/calculosCredito";

/**
 * POST /api/pos/venta-credito
 * Crea una venta a crédito de equipo: registra la venta (con enganche) + el crédito.
 *
 * Body:
 *   clienteId:           string (requerido)
 *   items:               { productoId, cantidad, precioUnitario, imei? }[]
 *   montoTotal:          number
 *   enganchePorcentaje:  number (10–50)
 *   plazo:               number (meses)
 *   frecuenciaPago:      "semanal" | "quincenal" | "mensual"
 *   tasaInteresBase:     number (porcentaje anual base)
 *   metodoPagoEnganche:  "efectivo" | "transferencia" | "tarjeta"
 *   montoRecibido?:      number (para efectivo)
 *   referenciaPago?:     string
 *
 * Retorna: { ventaId, creditoId, folio }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!role || !["admin", "vendedor", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      clienteId,
      items,
      montoTotal,
      enganchePorcentaje,
      plazo,
      frecuenciaPago,
      tasaInteresBase,
      metodoPagoEnganche,
      montoRecibido,
      referenciaPago,
    } = body;

    if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ success: false, error: "items requeridos" }, { status: 400 });
    if (!items.some((i: any) => i.imei)) return NextResponse.json({ success: false, error: "Se requiere al menos un equipo con IMEI" }, { status: 400 });

    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    const supabase = createAdminClient();

    // ── Calcular crédito ─────────────────────────────────────────────────────
    const calc = calcularCredito({
      montoOriginal: montoTotal,
      enganchePorcentaje,
      plazo,
      tasaInteresBase: tasaInteresBase ?? 20,
      frecuenciaPago,
    });

    const tasaInteresAjustada = calcularTasaAjustada(tasaInteresBase ?? 20, plazo);
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + plazo);

    const cambio = metodoPagoEnganche === "efectivo" && montoRecibido
      ? Math.max(0, montoRecibido - calc.montoEnganche)
      : 0;

    // ── Sesión de caja activa ─────────────────────────────────────────────────
    const sesionActiva = await getSesionActiva(userId);

    // ── 1. Crear venta (registra el enganche en POS) ─────────────────────────
    const { data: ventaData, error: ventaError } = await supabase
      .from("ventas")
      .insert({
        distribuidor_id: distId ?? null,
        folio: "",
        cliente_id: clienteId,
        vendedor_id: userId,
        sesion_caja_id: sesionActiva?.id ?? null,
        subtotal: montoTotal,
        descuento: 0,
        total: montoTotal,
        metodo_pago: "credito",
        referencia_pago: referenciaPago ?? null,
        monto_recibido: metodoPagoEnganche === "efectivo" ? (montoRecibido ?? null) : null,
        cambio: cambio > 0 ? cambio : null,
        notas: `Venta a crédito — enganche $${calc.montoEnganche.toFixed(2)} por ${metodoPagoEnganche}`,
        estado: "completada",
        fecha_venta: new Date().toISOString(),
      })
      .select()
      .single();

    if (ventaError || !ventaData) {
      throw new Error(ventaError?.message ?? "Error al crear venta");
    }

    // ── 2. Insertar items (trigger decrementará stock) ────────────────────────
    const productIds = items.filter((i: any) => i.productoId).map((i: any) => i.productoId);
    let productosMap = new Map<string, { nombre: string; marca: string; modelo: string; stock: number }>();
    if (productIds.length > 0) {
      const { data: pdata } = await supabase
        .from("productos")
        .select("id, nombre, marca, modelo, stock")
        .in("id", productIds);
      productosMap = new Map((pdata ?? []).map((p: any) => [p.id, p]));
    }

    const itemsToInsert = items.map((item: any) => {
      const prod = productosMap.get(item.productoId ?? "");
      return {
        venta_id: ventaData.id,
        producto_id: item.productoId ?? null,
        es_servicio: false,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.cantidad * item.precioUnitario,
        imei: item.imei ?? null,
        producto_nombre: prod?.nombre ?? "",
        producto_marca: prod?.marca ?? "",
        producto_modelo: prod?.modelo ?? "",
      };
    });

    const { error: itemsError } = await supabase.from("ventas_items").insert(itemsToInsert);
    if (itemsError) {
      await supabase.from("ventas").delete().eq("id", ventaData.id);
      throw new Error(itemsError.message);
    }

    // ── 3. Movimientos de stock (trazabilidad) ────────────────────────────────
    const movimientosStock = items
      .filter((i: any) => i.productoId)
      .map((i: any) => {
        const prod = productosMap.get(i.productoId);
        const stockAntes = prod?.stock ?? 0;
        return {
          producto_id: i.productoId,
          distribuidor_id: distId ?? null,
          tipo: "venta_credito",
          cantidad: -i.cantidad,
          stock_antes: stockAntes,
          stock_despues: Math.max(0, stockAntes - i.cantidad),
          referencia_id: ventaData.id,
          referencia_tipo: "venta",
          notas: `Venta a crédito — IMEI: ${i.imei ?? "N/A"}`,
          creado_por: userId,
        };
      });

    if (movimientosStock.length > 0) {
      supabase.from("movimientos_stock").insert(movimientosStock).then(
        () => {},
        (e) => console.error("[venta-credito] movimientos_stock error:", e)
      );
    }

    // ── 4. Crear crédito ──────────────────────────────────────────────────────
    const { data: creditoData, error: creditoError } = await supabase
      .from("creditos")
      .insert({
        distribuidor_id: distId ?? null,
        cliente_id: clienteId,
        monto: calc.montoFinanciar,
        monto_original: montoTotal,
        enganche: calc.montoEnganche,
        enganche_porcentaje: enganchePorcentaje,
        plazo,
        tasa_interes: tasaInteresAjustada,
        frecuencia_pago: frecuenciaPago,
        monto_pago: calc.montoPorPago,
        pago_quincenal: calc.montoPorPago,
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin: fechaFin.toISOString(),
        estado: "activo",
        dias_mora: 0,
        monto_mora: 0,
        tasa_mora_diaria: 50,
        vendedor_id: userId,
        productos_ids: JSON.stringify(items.filter((i: any) => i.productoId).map((i: any) => i.productoId)),
      })
      .select()
      .single();

    if (creditoError || !creditoData) {
      // Rollback: eliminar venta e items (los items se eliminan en cascada)
      await supabase.from("ventas").delete().eq("id", ventaData.id);
      throw new Error(creditoError?.message ?? "Error al crear crédito");
    }

    return NextResponse.json({
      success: true,
      data: {
        ventaId: ventaData.id,
        creditoId: creditoData.id,
        folio: ventaData.folio ?? ventaData.id,
        enganche: calc.montoEnganche,
        montoPorPago: calc.montoPorPago,
        numeroPagos: calc.numeroPagos,
      },
    });
  } catch (e) {
    console.error("[POST /api/pos/venta-credito]", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
