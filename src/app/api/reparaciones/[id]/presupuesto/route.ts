import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalcularTotalesOrden } from "@/lib/db/reparaciones";
import type { PiezaCotizacion } from "@/types";

/**
 * PATCH /api/reparaciones/[id]/presupuesto
 * F3-B: Edición directa del presupuesto usando piezasCotizacion.
 * Solo admin/super_admin. No cambia estado — solo actualiza precios.
 * Body: { precioManoObra: number; piezasCotizacion: PiezaCotizacion[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Solo admins pueden editar el presupuesto" }, { status: 403 });
    }

    const { id: ordenId } = await params;
    const body = await request.json().catch(() => ({}));
    const { precioManoObra, piezasCotizacion } = body as {
      precioManoObra?: number;
      piezasCotizacion?: PiezaCotizacion[];
    };

    if (precioManoObra === undefined && !piezasCotizacion) {
      return NextResponse.json({ success: false, error: "Se requiere precioManoObra o piezasCotizacion" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verificar acceso
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id, estado")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }
    if (["entregado", "cancelado", "no_reparable"].includes(orden.estado)) {
      return NextResponse.json({ success: false, error: "No se puede editar el presupuesto de una orden terminal" }, { status: 409 });
    }

    // Guardar snapshot de la cotización actual antes de modificar (si no existe ya)
    const { data: ordenActual } = await supabase
      .from("ordenes_reparacion")
      .select("piezas_cotizacion, snapshot_cotizacion_inicial")
      .eq("id", ordenId)
      .single();

    const updateData: Record<string, unknown> = {};

    if (piezasCotizacion !== undefined) {
      // Si no hay snapshot previo, guardar el actual como snapshot inicial
      if (!ordenActual?.snapshot_cotizacion_inicial && ordenActual?.piezas_cotizacion) {
        updateData.snapshot_cotizacion_inicial = ordenActual.piezas_cotizacion;
      }
      updateData.piezas_cotizacion = piezasCotizacion;
    }

    if (precioManoObra !== undefined) {
      updateData.precio_mano_obra = precioManoObra;
      updateData.costo_reparacion = precioManoObra;
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from("ordenes_reparacion")
        .update(updateData)
        .eq("id", ordenId);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Recalcular totales usando piezas_cotizacion como fuente de verdad
    await recalcularTotalesOrden(ordenId);

    return NextResponse.json({ success: true, message: "Presupuesto actualizado" });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
