import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSaldoPuntos } from "@/lib/db/puntos";

/**
 * GET /api/clientes/[id]/resumen
 * Resumen financiero del cliente: órdenes activas, saldo pendiente y puntos.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: clienteId } = await params;
    const supabase = createAdminClient();
    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Verificar acceso al cliente
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, distribuidor_id")
      .eq("id", clienteId)
      .maybeSingle();

    if (!cliente) return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && cliente.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    // Órdenes activas (no canceladas, no entregadas)
    let ordenesQuery = supabase
      .from("ordenes_reparacion")
      .select("id, estado, costo_total, precio_total, total_anticipos, folio")
      .eq("cliente_id", clienteId)
      .not("estado", "in", "(cancelado,entregado)");
    if (distId) ordenesQuery = ordenesQuery.eq("distribuidor_id", distId);

    // Total de órdenes históricas
    let totalQuery = supabase
      .from("ordenes_reparacion")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId);
    if (distId) totalQuery = totalQuery.eq("distribuidor_id", distId);

    // C4: Últimas 3 órdenes entregadas (historial de reparaciones previas)
    let historialQuery = supabase
      .from("ordenes_reparacion")
      .select("id, folio, estado, marca_dispositivo, modelo_dispositivo, problema_reportado, precio_total, costo_total, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(4); // 4 para poder excluir la orden actual
    if (distId) historialQuery = historialQuery.eq("distribuidor_id", distId);

    const [{ data: ordenes }, { count: totalOrdenes }, saldo, { data: historialRaw }] = await Promise.all([
      ordenesQuery,
      totalQuery,
      getSaldoPuntos(clienteId, distId).catch(() => ({ saldoDisponible: 0, totalGanado: 0 })),
      historialQuery,
    ]);

    const ordenesActivas = (ordenes ?? []).length;
    const saldoPendiente = (ordenes ?? []).reduce(
      (sum, o) => sum + Math.max(0, Number(o.precio_total ?? o.costo_total ?? 0) - Number(o.total_anticipos ?? 0)),
      0
    );

    // Exponer los folios de órdenes activas (para mostrar en drawer)
    const ordenesActivasFolios = (ordenes ?? []).map((o) => ({ id: o.id, folio: o.folio, estado: o.estado }));

    return NextResponse.json({
      success: true,
      data: {
        ordenesActivas,
        saldoPendiente,
        puntos: saldo.saldoDisponible,
        totalOrdenes: totalOrdenes ?? 0,
        ordenesActivasFolios,
        historialReciente: (historialRaw ?? []).slice(0, 3).map((o) => ({
          id: o.id,
          folio: o.folio,
          estado: o.estado,
          marca: o.marca_dispositivo,
          modelo: o.modelo_dispositivo,
          problema: o.problema_reportado,
          total: Number(o.precio_total ?? o.costo_total ?? 0),
          fecha: o.created_at,
        })),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
