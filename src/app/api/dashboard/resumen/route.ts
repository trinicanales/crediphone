import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/dashboard/resumen
 * FASE 53: Endpoint unificado para el Command Center del dashboard.
 * Devuelve todos los datos del "Pulso del Día" en una sola llamada.
 */
export async function GET() {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Fecha de inicio del día actual (medianoche MX = UTC-6)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyISO = hoy.toISOString();

    // ── Queries en paralelo ───────────────────────────────────────
    const [
      repActivas,
      repListasEntrega,
      repEsperandoPiezas,
      repAbiertas,
      pagosHoy,
      ventasHoy,
      creditosConMora,
      stockCritico,
      cajaActiva,
    ] = await Promise.all([
      // 1. Reparaciones activas (no canceladas, no entregadas)
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("id, estado, fecha_recepcion, prioridad", { count: "exact" })
          .not("estado", "in", "(cancelado,entregado)");
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

      // 5. Monto cobrado HOY (pagos de créditos)
      (() => {
        let q = supabase
          .from("pagos")
          .select("monto")
          .gte("fecha_pago", hoyISO);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // 6. Ventas POS HOY
      (() => {
        let q = supabase
          .from("ventas")
          .select("total")
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

      // 8. Productos con stock crítico (stock <= stock_minimo o stock == 0)
      (() => {
        let q = supabase
          .from("productos")
          .select("id", { count: "exact", head: true })
          .eq("activo", true)
          .or("stock.eq.0,stock.lte.stock_minimo");
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

    // Urgentes = reparaciones activas con prioridad urgente o con días > 7 en diagnóstico
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
        },
        creditos: {
          conMora: creditosConMora.count ?? 0,
          montoMoraTotal,
        },
        inventario: {
          stockCritico: stockCritico.count ?? 0,
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
