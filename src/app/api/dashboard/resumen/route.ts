import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inicioDiaMX } from "@/lib/fechas";
import { ESTADOS_ACTIVOS, ingresoOrden } from "@/lib/reparaciones/estados";
import { esStockCritico, esStockNegativo } from "@/lib/inventario/stock";

/**
 * GET /api/dashboard/resumen
 * FASE 53: Endpoint unificado para el Command Center del dashboard.
 * Devuelve todos los datos del "Pulso del Día" en una sola llamada.
 *
 * K0 (2026-10-20): "hoy" en hora de México, dinero del día desde caja real,
 * una sola definición de orden activa y stock crítico calculado correctamente.
 */
export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Medianoche de HOY en México (el servidor corre en UTC)
    const hoyISO = inicioDiaMX().toISOString();

    // caja_movimientos casi nunca trae distribuidor_id (146 de 177) y no tiene FK a la sesión:
    // se filtra por las sesiones de caja de la sucursal (o por su propio distribuidor_id).
    let filtroCaja: string | null = null;
    if (distId) {
      const hace3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: ses } = await supabase
        .from("caja_sesiones")
        .select("id")
        .eq("distribuidor_id", distId)
        .gte("fecha_apertura", hace3d);
      const ids = (ses ?? []).map((s: { id: string }) => s.id);
      filtroCaja = ids.length
        ? "distribuidor_id.eq." + distId + ",sesion_id.in.(" + ids.join(",") + ")"
        : "distribuidor_id.eq." + distId;
    }

    // ── Queries en paralelo ───────────────────────────────────────
    const [
      repActivas,
      repListasEntrega,
      repEsperandoPiezas,
      repAbiertas,
      pagosHoy,
      ventasHoy,
      creditosConMora,
      productos,
      cajaActiva,
      movCajaHoy,
      entregadasHoy,
    ] = await Promise.all([
      // 1. Reparaciones activas (definición única: ESTADOS_ACTIVOS)
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("id, estado, fecha_recepcion, prioridad", { count: "exact" })
          .in("estado", ESTADOS_ACTIVOS);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 2. Listas para entrega
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("id", { count: "exact", head: true })
          .eq("estado", "listo_entrega");
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 3. Esperando piezas
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("id", { count: "exact", head: true })
          .eq("estado", "esperando_piezas");
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 4. Abiertas HOY (recibidas hoy)
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("id", { count: "exact", head: true })
          .gte("fecha_recepcion", hoyISO);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 5. Pagos de créditos / apartados HOY
      (() => {
        let q = supabase
          .from("pagos")
          .select("monto")
          .gte("fecha_pago", hoyISO);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 6. Ventas POS HOY (solo completadas: no canceladas ni reembolsadas)
      (() => {
        let q = supabase
          .from("ventas")
          .select("total")
          .eq("estado", "completada")
          .gte("fecha_venta", hoyISO);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 7. Créditos con mora
      (() => {
        let q = supabase
          .from("creditos")
          .select("id, dias_mora, monto_mora", { count: "exact" })
          .eq("estado", "activo")
          .gt("dias_mora", 0);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 8. Productos activos (stock crítico se evalúa en código: PostgREST no compara columnas)
      (() => {
        let q = supabase
          .from("productos")
          .select("id, stock, stock_minimo")
          .eq("activo", true);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 9. Caja activa
      (() => {
        let q = supabase
          .from("caja_sesiones")
          .select("id, folio, estado")
          .eq("estado", "abierta")
          .limit(1);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 10. Movimientos de caja de HOY (anticipos, cobros de reparación y devoluciones)
      (() => {
        let q = supabase
          .from("caja_movimientos")
          .select("tipo, monto")
          .in("tipo", ["entrada_anticipo", "cobro_reparacion", "devolucion_anticipo"])
          .gte("created_at", hoyISO);
        if (filtroCaja) q = q.or(filtroCaja);
        return q;
      })(),

      // 11. Servicios entregados HOY (precio total de las órdenes entregadas hoy)
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("precio_total, costo_total")
          .eq("estado", "entregado")
          .gte("fecha_entregado", hoyISO);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),
    ]);

    // ── Agregaciones ─────────────────────────────────────────────
    const cobradoHoy = (pagosHoy.data ?? []).reduce(
      (sum: number, p: { monto: number }) => sum + Number(p.monto),
      0
    );
    const ventasHoyTotal = (ventasHoy.data ?? []).reduce(
      (sum: number, v: { total: number }) => sum + Number(v.total),
      0
    );
    const montoMoraTotal = (creditosConMora.data ?? []).reduce(
      (sum: number, c: { monto_mora: number }) => sum + Number(c.monto_mora ?? 0),
      0
    );

    // Dinero del día = anticipos + cobros de reparación + ventas POS + pagos de crédito − devoluciones
    let anticiposHoy = 0;
    let cobrosReparacionHoy = 0;
    let devolucionesHoy = 0;
    for (const m of movCajaHoy.data ?? []) {
      const monto = Number(m.monto ?? 0);
      if (m.tipo === "entrada_anticipo") anticiposHoy += monto;
      else if (m.tipo === "cobro_reparacion") cobrosReparacionHoy += monto;
      else if (m.tipo === "devolucion_anticipo") devolucionesHoy += monto;
    }
    const dineroHoy =
      anticiposHoy + cobrosReparacionHoy + ventasHoyTotal + cobradoHoy - devolucionesHoy;

    // Servicios entregados hoy (lo que pagó el cliente por las órdenes que salieron)
    const entregadoHoy = (entregadasHoy.data ?? []).reduce(
      (sum: number, o: { precio_total: unknown; costo_total: unknown }) => sum + ingresoOrden(o),
      0
    );
    const cantidadEntregadasHoy = (entregadasHoy.data ?? []).length;

    // Stock crítico (mínimo por defecto 1) y negativos
    const prods = productos.data ?? [];
    const stockCritico = prods.filter((p: { stock: number; stock_minimo: number | null }) =>
      esStockCritico(p.stock, p.stock_minimo)
    ).length;
    const stockNegativo = prods.filter((p: { stock: number }) => esStockNegativo(p.stock)).length;

    // Urgentes = reparaciones activas con prioridad urgente
    const urgentes = (repActivas.data ?? []).filter(
      (r: { prioridad?: string }) => r.prioridad === "urgente"
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        reparaciones: {
          activas: repActivas.count ?? 0,
          listasEntrega: repListasEntrega.count ?? 0,
          esperandoPiezas: repEsperandoPiezas.count ?? 0,
          abiertas: repAbiertas.count ?? 0,
          urgentes,
        },
        finanzas: {
          cobradoHoy,
          ventasHoy: ventasHoyTotal,
          totalIngresoHoy: cobradoHoy + ventasHoyTotal,
          // K0: dinero real del día y servicios entregados (se muestran ambos)
          dineroHoy,
          anticiposHoy,
          cobrosReparacionHoy,
          devolucionesHoy,
          entregadoHoy,
          entregadasHoy: cantidadEntregadasHoy,
        },
        creditos: {
          conMora: creditosConMora.count ?? 0,
          montoMoraTotal,
        },
        inventario: {
          stockCritico,
          stockNegativo,
        },
        caja: {
          activa: !!(cajaActiva.data && cajaActiva.data.length > 0),
          folio: cajaActiva.data?.[0]?.folio ?? null,
        },
      },
    });
  } catch (error) {
    console.error("[dashboard/resumen] Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al cargar resumen del dashboard" },
      { status: 500 }
    );
  }
}
