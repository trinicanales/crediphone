import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countSolicitudesPendientes } from "@/lib/db/autorizaciones";

/**
 * GET /api/dashboard/por-aprobar
 * Todo lo que espera la aprobación del admin: cambios de precio pedidos por vendedores,
 * depósitos por confirmar y descuentos por autorizar. Solo admin / super_admin.
 *
 * Esta información dejó de mostrarse en el dashboard desde FASE 53 (2026-03-19).
 */
export async function GET() {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // 1. Solicitudes de cambio de precio pendientes
    let solQuery = supabase
      .from("solicitudes_cambio_precio")
      .select(
        "id, orden_id, solicitado_por, motivo, created_at, costo_reparacion_actual, costo_partes_actual, costo_reparacion_propuesto, costo_partes_propuesto"
      )
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true });
    if (distId) solQuery = solQuery.eq("distribuidor_id", distId);
    const { data: solicitudes } = await solQuery;

    const ordenIds = [...new Set((solicitudes ?? []).map((s) => s.orden_id))];
    const solicitanteIds = [...new Set((solicitudes ?? []).map((s) => s.solicitado_por).filter(Boolean))];

    const [ordenesRes, usuariosRes] = await Promise.all([
      ordenIds.length
        ? supabase
            .from("ordenes_reparacion")
            .select("id, folio, estado, precio_total, costo_total, cliente:clientes(nombre, apellido)")
            .in("id", ordenIds)
        : Promise.resolve({ data: [] as any[] }),
      solicitanteIds.length
        ? supabase.from("users").select("id, name").in("id", solicitanteIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const ordenes = new Map((ordenesRes.data ?? []).map((o: any) => [o.id, o]));
    const usuarios = new Map((usuariosRes.data ?? []).map((u: any) => [u.id, u.name]));
    const ahora = Date.now();

    const precios = (solicitudes ?? []).map((s) => {
      const o: any = ordenes.get(s.orden_id);
      const propuesto = Number(s.costo_reparacion_propuesto ?? 0) + Number(s.costo_partes_propuesto ?? 0);
      const precioHoy = Number(o?.precio_total || o?.costo_total || 0);
      return {
        id: s.id as string,
        ordenId: s.orden_id as string,
        folio: (o?.folio as string) ?? "—",
        estadoOrden: (o?.estado as string) ?? "",
        cliente: o?.cliente ? `${o.cliente.nombre ?? ""} ${o.cliente.apellido ?? ""}`.trim() : "",
        solicitante: (usuarios.get(s.solicitado_por) as string) ?? "Vendedor",
        precioActual: Number(s.costo_reparacion_actual ?? 0) + Number(s.costo_partes_actual ?? 0),
        precioPropuesto: propuesto,
        precioHoyEnOrden: precioHoy,
        // El precio de la orden ya coincide con lo propuesto: solo falta cerrar la solicitud
        yaAplicada: precioHoy > 0 && Math.round(precioHoy) === Math.round(propuesto),
        motivo: (s.motivo as string) ?? "",
        diasEspera: Math.floor((ahora - new Date(s.created_at).getTime()) / 86400000),
      };
    });

    // 2. Depósitos por confirmar
    let depQuery = supabase
      .from("confirmaciones_deposito")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente_confirmacion");
    if (distId) depQuery = depQuery.eq("distribuidor_id", distId);
    const { count: depositos } = await depQuery;

    // 3. Descuentos por autorizar (vigentes)
    const descuentos = await countSolicitudesPendientes(distId);

    return NextResponse.json({
      success: true,
      data: {
        precios,
        depositos: depositos ?? 0,
        descuentos,
        total: precios.length + (depositos ?? 0) + descuentos,
      },
    });
  } catch (error) {
    console.error("[dashboard/por-aprobar] Error:", error);
    return NextResponse.json({ success: false, error: "Error al cargar pendientes" }, { status: 500 });
  }
}
