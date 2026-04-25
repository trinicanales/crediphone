import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/pos/caja/[id]/bolsas-cobradas
 * Retorna las reparaciones cuyo ingreso_neto se registró en esta sesión de caja.
 * Usado en el corte del día para mostrar "Bolsas cobradas hoy".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: sesionId } = await params;

    const supabase = createAdminClient();

    let query = supabase
      .from("movimientos_bolsa_virtual")
      .select(`
        id, monto, concepto, tipo, created_at,
        orden_id,
        ordenes_reparacion!inner(folio, marca_dispositivo, modelo_dispositivo,
          costo_total, total_anticipos,
          clientes!inner(nombre, apellido))
      `)
      .eq("sesion_caja_id", sesionId)
      .in("tipo", ["ingreso_caja", "reembolso_caja"])
      .order("created_at", { ascending: false });

    if (!isSuperAdmin && distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Agrupar por orden_id — puede haber ingreso_caja + reembolso_caja para la misma orden
    const porOrden: Record<string, {
      ordenId: string; folio: string; dispositivo: string;
      clienteNombre: string; costoTotal: number; totalAnticipos: number;
      ingresoNeto: number; reembolsoCaja: number;
    }> = {};

    for (const m of (data || [])) {
      const o = m.ordenes_reparacion as any;
      const ordenId = m.orden_id as string;
      if (!porOrden[ordenId]) {
        porOrden[ordenId] = {
          ordenId,
          folio: o?.folio ?? "",
          dispositivo: [o?.marca_dispositivo, o?.modelo_dispositivo].filter(Boolean).join(" "),
          clienteNombre: [o?.clientes?.nombre, o?.clientes?.apellido].filter(Boolean).join(" "),
          costoTotal: Number(o?.costo_total ?? 0),
          totalAnticipos: Number(o?.total_anticipos ?? 0),
          ingresoNeto: 0,
          reembolsoCaja: 0,
        };
      }
      if (m.tipo === "ingreso_caja") porOrden[ordenId].ingresoNeto += Number(m.monto);
      if (m.tipo === "reembolso_caja") porOrden[ordenId].reembolsoCaja += Number(m.monto);
    }

    const lista = Object.values(porOrden);
    const totalIngresado = lista.reduce((s, o) => s + o.ingresoNeto - o.reembolsoCaja, 0);

    return NextResponse.json({ success: true, data: lista, totalIngresado });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
