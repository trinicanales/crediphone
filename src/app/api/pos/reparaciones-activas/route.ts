import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ESTADOS_INACTIVOS = ["entregado", "cancelado", "no_reparable"];

/**
 * GET /api/pos/reparaciones-activas
 * Retorna órdenes activas con anticipos para la Bolsa Virtual del POS.
 * Independiente de sesión de caja — muestra todo el dinero recibido.
 *
 * ?resumen=true → solo { totalBolsa, conteoOrdenes } (para badge)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const soloResumen = url.searchParams.get("resumen") === "true";
    const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    const supabase = createAdminClient();

    // 1. Fetch active orders
    let ordenQuery = supabase
      .from("ordenes_reparacion")
      .select(`
        id, folio, estado, marca_dispositivo, modelo_dispositivo,
        presupuesto_total, costo_total, precio_total,
        created_at,
        clientes:cliente_id (nombre, apellido, telefono)
      `)
      .not("estado", "in", `(${ESTADOS_INACTIVOS.map((e) => `"${e}"`).join(",")})`)
      .order("created_at", { ascending: false });

    if (filterDistribuidorId) {
      ordenQuery = ordenQuery.eq("distribuidor_id", filterDistribuidorId);
    }

    const { data: ordenes, error: ordenError } = await ordenQuery;
    if (ordenError) {
      return NextResponse.json({ success: false, error: ordenError.message }, { status: 500 });
    }
    if (!ordenes || ordenes.length === 0) {
      if (soloResumen) return NextResponse.json({ success: true, data: { totalBolsa: 0, conteoOrdenes: 0 } });
      return NextResponse.json({ success: true, data: [] });
    }

    const ordenIds = ordenes.map((o: any) => o.id);

    // 2. Fetch anticipos for those orders (all non-devuelto)
    const { data: anticipos } = await supabase
      .from("anticipos_reparacion")
      .select(`
        id, orden_id, monto, tipo_pago, fecha_anticipo, estado,
        recibido_por,
        users:recibido_por (name)
      `)
      .in("orden_id", ordenIds)
      .neq("estado", "devuelto")
      .order("fecha_anticipo", { ascending: true });

    // 3. Fetch gastos de bolsa (costos de piezas pedidas) por orden
    const { data: gastosBolsa } = await supabase
      .from("movimientos_bolsa_virtual")
      .select("orden_id, monto, concepto, created_at")
      .in("orden_id", ordenIds)
      .eq("tipo", "gasto_pieza")
      .order("created_at", { ascending: true });

    // 4. Group anticipos and gastos by order
    const anticiposPorOrden: Record<string, {
      id: string; monto: number; tipoPago: string;
      fechaAnticipo: string; recibidoPorNombre: string | null;
    }[]> = {};
    const totalPorOrden: Record<string, number> = {};

    for (const a of (anticipos || []) as any[]) {
      if (!anticiposPorOrden[a.orden_id]) anticiposPorOrden[a.orden_id] = [];
      anticiposPorOrden[a.orden_id].push({
        id: a.id,
        monto: Number(a.monto || 0),
        tipoPago: a.tipo_pago || "efectivo",
        fechaAnticipo: a.fecha_anticipo,
        recibidoPorNombre: a.users?.name ?? null,
      });
      totalPorOrden[a.orden_id] = (totalPorOrden[a.orden_id] || 0) + Number(a.monto || 0);
    }

    const gastosPorOrden: Record<string, number> = {};
    for (const g of (gastosBolsa || []) as any[]) {
      gastosPorOrden[g.orden_id] = (gastosPorOrden[g.orden_id] || 0) + Number(g.monto || 0);
    }

    if (soloResumen) {
      const totalBolsa = Object.values(totalPorOrden).reduce((s, v) => s + v, 0);
      const conteoOrdenes = Object.keys(totalPorOrden).filter((id) => totalPorOrden[id] > 0).length;
      return NextResponse.json({ success: true, data: { totalBolsa, conteoOrdenes } });
    }

    // 5. Build response — only include orders that have anticipos OR saldo pendiente > 0
    const result = (ordenes as any[]).map((o) => {
      const totalAnticipada = totalPorOrden[o.id] || 0;
      const costosPiezas = gastosPorOrden[o.id] || 0;
      const presupuestoTotal = Number(o.precio_total || o.presupuesto_total || o.costo_total || 0);
      const saldoPendiente = Math.max(presupuestoTotal - totalAnticipada, 0);
      const saldoDisponibleBolsa = Math.max(totalAnticipada - costosPiezas, 0);
      const ingresoNetoEstimado = Math.max(presupuestoTotal - costosPiezas, 0);
      const cli = o.clientes as { nombre?: string; apellido?: string; telefono?: string } | null;
      return {
        ordenId: o.id,
        folio: o.folio,
        estado: o.estado,
        clienteNombre: cli ? `${cli.nombre || ""} ${cli.apellido || ""}`.trim() : "—",
        clienteTelefono: cli?.telefono ?? null,
        marcaDispositivo: o.marca_dispositivo ?? "",
        modeloDispositivo: o.modelo_dispositivo ?? "",
        presupuestoTotal,
        totalAnticipos: totalAnticipada,
        costosPiezas,
        saldoPendiente,
        saldoDisponibleBolsa,
        ingresoNetoEstimado,
        anticipos: anticiposPorOrden[o.id] || [],
      };
    });

    // Filter: show orders that either have anticipos or have a presupuesto set
    const filtrados = result.filter(
      (o) => o.anticipos.length > 0 || o.presupuestoTotal > 0
    );

    return NextResponse.json({ success: true, data: filtrados });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error en reparaciones-activas:", msg);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
