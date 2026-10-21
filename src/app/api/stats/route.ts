import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inicioDiaMX } from "@/lib/fechas";

/**
 * GET /api/stats — resumen para los dashboards de vendedor y cobrador.
 *
 * K1 (2026-10-20): antes descargaba clientes, créditos, pagos y productos COMPLETOS (select *)
 * solo para contarlos. Ahora cuenta en la base y trae únicamente las columnas necesarias.
 * "totalPagos" ahora es el número de pagos de HOY (antes era el histórico, aunque la tarjeta decía "hoy").
 */
export async function GET(request: Request) {
  try {
    // SEGURIDAD: usar getAuthContext() para obtener role + distribuidorId
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // super_admin puede filtrar por X-Distribuidor-Id header; otros solo su distribuidor
    const headerDistId = request.headers.get("X-Distribuidor-Id");
    const distId = isSuperAdmin ? (headerDistId ?? undefined) : (distribuidorId ?? undefined);

    const supabase = createAdminClient();
    const hoyISO = inicioDiaMX().toISOString();

    const [clientesRes, creditosRes, pagosHoyRes, productosRes, scoringRes] = await Promise.all([
      (() => {
        let q = supabase.from("clientes").select("id", { count: "exact", head: true });
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),
      (() => {
        let q = supabase.from("creditos").select("monto, estado, dias_mora, monto_mora");
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),
      (() => {
        let q = supabase.from("pagos").select("monto").gte("fecha_pago", hoyISO);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),
      (() => {
        let q = supabase.from("productos").select("precio, stock");
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),
      // SEGURIDAD: el scoring se filtra por distribuidor para que admin solo vea el suyo
      (() => {
        let q = supabase.from("scoring_clientes").select("nivel_riesgo");
        if (!isSuperAdmin && distribuidorId) q = q.eq("distribuidor_id", distribuidorId);
        return q;
      })(),
    ]);

    const creditos = creditosRes.data ?? [];
    const activos = creditos.filter((c) => c.estado === "activo");
    const montoTotalCreditos = creditos.reduce((s, c) => s + Number(c.monto ?? 0), 0);
    const montoTotalActivos = activos.reduce((s, c) => s + Number(c.monto ?? 0), 0);

    const conMora = activos.filter((c) => Number(c.dias_mora ?? 0) > 0);
    const montoTotalMora = conMora.reduce((s, c) => s + Number(c.monto_mora ?? 0), 0);

    // Tasa de recuperación (se mantiene la fórmula histórica: % de créditos que ya no están activos)
    const tasaRecuperacion =
      montoTotalCreditos > 0
        ? parseFloat((((montoTotalCreditos - montoTotalActivos) / montoTotalCreditos) * 100).toFixed(1))
        : 0;

    const productos = productosRes.data ?? [];
    const valorInventario = productos.reduce((s, p) => s + Number(p.precio ?? 0) * Number(p.stock ?? 0), 0);

    const pagosHoy = pagosHoyRes.data ?? [];
    const totalCobradoHoy = pagosHoy.reduce((s, p) => s + Number(p.monto ?? 0), 0);

    const scoring = scoringRes.data ?? [];
    const riesgoDistribucion = {
      BAJO: scoring.filter((s) => s.nivel_riesgo === "BAJO").length,
      MEDIO: scoring.filter((s) => s.nivel_riesgo === "MEDIO").length,
      ALTO: scoring.filter((s) => s.nivel_riesgo === "ALTO").length,
      MUY_ALTO: scoring.filter((s) => s.nivel_riesgo === "MUY_ALTO").length,
    };

    // Créditos que requieren atención (mora > 7 días): solo estos sí necesitan sus datos completos
    let atencionQuery = supabase
      .from("creditos")
      .select("id, cliente_id, dias_mora, monto_mora, monto")
      .eq("estado", "activo")
      .gt("dias_mora", 7)
      .order("dias_mora", { ascending: false })
      .limit(5);
    if (distId) atencionQuery = atencionQuery.eq("distribuidor_id", distId);
    const { data: atencion } = await atencionQuery;

    const creditosAtencion = (atencion ?? []).map((c) => ({
      id: c.id,
      clienteId: c.cliente_id,
      diasMora: c.dias_mora ?? 0,
      montoMora: c.monto_mora ?? 0,
      monto: c.monto,
    }));

    return NextResponse.json({
      success: true,
      data: {
        // Clientes
        totalClientes: clientesRes.count ?? 0,

        // Créditos
        totalCreditos: creditos.length,
        creditosActivos: activos.length,
        creditosConMora: conMora.length,
        montoTotalCreditos,
        montoTotalActivos,
        montoTotalMora,
        tasaRecuperacion,

        // Pagos de hoy
        totalPagos: pagosHoy.length,
        totalCobradoHoy,

        // Productos
        totalProductos: productos.length,
        productosEnStock: productos.filter((p) => Number(p.stock ?? 0) > 0).length,
        valorInventario,

        // Riesgo
        riesgoDistribucion,

        // Alertas
        creditosAtencion,
      },
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener estadísticas",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
