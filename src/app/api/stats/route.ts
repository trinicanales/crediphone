import { NextResponse } from "next/server";
import { getClientes } from "@/lib/db/clientes";
import { getCreditos, getCreditosActivos } from "@/lib/db/creditos";
import { getPagos, getTotalPagosDelDia } from "@/lib/db/pagos";
import { getProductos } from "@/lib/db/productos";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    // SEGURIDAD: usar getAuthContext() para obtener role + distribuidorId
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // super_admin ve todo (distId = undefined → sin filtro); otros solo su distribuidor
    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Ejecutar todas las consultas en paralelo para mejor rendimiento
    const [clientes, creditos, creditosActivos, pagosHoy, totalPagosHoy, productos] = await Promise.all([
      getClientes(distId),
      getCreditos(distId),
      getCreditosActivos(distId),
      getPagos(distId),
      getTotalPagosDelDia(distId),
      getProductos(distId),
    ]);

    // Calcular montos totales de créditos
    const montoTotalCreditos = creditos.reduce((sum, c) => sum + Number(c.monto), 0);
    const montoTotalActivos = creditosActivos.reduce((sum, c) => sum + Number(c.monto), 0);

    // Calcular valor del inventario
    const valorInventario = productos.reduce((sum, p) => sum + (Number(p.precio) * p.stock), 0);

    // Calcular créditos con mora
    const creditosConMora = creditosActivos.filter((c) => (c.diasMora ?? 0) > 0);
    const montoTotalMora = creditosConMora.reduce((sum, c) => sum + Number(c.montoMora || 0), 0);

    // Calcular tasa de recuperación (pagos vs monto esperado)
    const tasaRecuperacion = montoTotalCreditos > 0
      ? ((montoTotalCreditos - montoTotalActivos) / montoTotalCreditos * 100).toFixed(1)
      : "0";

    // Obtener distribución de riesgo desde scoring_clientes
    // SEGURIDAD: filtrar por distribuidor para que admin solo vea su propio scoring
    const supabase = createAdminClient();
    let scoringQuery = supabase
      .from("scoring_clientes")
      .select("nivel_riesgo");

    if (!isSuperAdmin && distribuidorId) {
      scoringQuery = scoringQuery.eq("distribuidor_id", distribuidorId) as typeof scoringQuery;
    }

    const { data: scoringData } = await scoringQuery;

    const riesgoDistribucion = {
      BAJO: scoringData?.filter((s) => s.nivel_riesgo === "BAJO").length || 0,
      MEDIO: scoringData?.filter((s) => s.nivel_riesgo === "MEDIO").length || 0,
      ALTO: scoringData?.filter((s) => s.nivel_riesgo === "ALTO").length || 0,
      MUY_ALTO: scoringData?.filter((s) => s.nivel_riesgo === "MUY_ALTO").length || 0,
    };

    // Obtener créditos que requieren atención (mora > 7 días)
    const creditosAtencion = creditosActivos
      .filter((c) => (c.diasMora ?? 0) > 7)
      .sort((a, b) => (b.diasMora ?? 0) - (a.diasMora ?? 0))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        clienteId: c.clienteId,
        diasMora: c.diasMora ?? 0,
        montoMora: c.montoMora ?? 0,
        monto: c.monto,
      }));

    return NextResponse.json({
      success: true,
      data: {
        // Clientes
        totalClientes: clientes.length,

        // Créditos
        totalCreditos: creditos.length,
        creditosActivos: creditosActivos.length,
        creditosConMora: creditosConMora.length,
        montoTotalCreditos,
        montoTotalActivos,
        montoTotalMora,
        tasaRecuperacion: parseFloat(tasaRecuperacion),

        // Pagos
        totalPagos: pagosHoy.length,
        totalCobradoHoy: totalPagosHoy,

        // Productos
        totalProductos: productos.length,
        productosEnStock: productos.filter((p) => p.stock > 0).length,
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
