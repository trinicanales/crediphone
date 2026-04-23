import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reparaciones/[id]/solicitudes-precio
 * Lista solicitudes de cambio de precio para la orden.
 * Visible para admin, super_admin y el solicitante.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: ordenId } = await params;
    const supabase = createAdminClient();

    // Verify order access
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id, folio, precio_pendiente_aprobacion")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("solicitudes_cambio_precio")
      .select(`
        id, estado, motivo, created_at,
        costo_reparacion_actual, costo_partes_actual,
        costo_reparacion_propuesto, costo_partes_propuesto,
        revisado_at,
        solicitadoPor:solicitado_por (name),
        revisadoPor:revisado_por (name)
      `)
      .eq("orden_id", ordenId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const mapped = (data ?? []).map((s: any) => ({
      id: s.id,
      estado: s.estado,
      motivo: s.motivo,
      createdAt: s.created_at,
      revisadoAt: s.revisado_at,
      costoReparacionActual: Number(s.costo_reparacion_actual || 0),
      costoPartesActual: Number(s.costo_partes_actual || 0),
      costoReparacionPropuesto: Number(s.costo_reparacion_propuesto || 0),
      costoPartesPropuesto: Number(s.costo_partes_propuesto || 0),
      solicitadoPorNombre: s.solicitadoPor?.name ?? null,
      revisadoPorNombre: s.revisadoPor?.name ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      precioPendienteAprobacion: orden.precio_pendiente_aprobacion ?? false,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/reparaciones/[id]/solicitudes-precio
 * Aprueba o rechaza una solicitud de cambio de precio.
 * Solo admin y super_admin.
 *
 * Body: { solicitudId: string, accion: "aprobar" | "rechazar" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    if (!["admin", "super_admin"].includes(role || "")) {
      return NextResponse.json({ success: false, error: "Solo admin puede aprobar/rechazar precios" }, { status: 403 });
    }

    const { id: ordenId } = await params;
    const body = await request.json();
    const { solicitudId, accion } = body as { solicitudId: string; accion: "aprobar" | "rechazar" };

    if (!solicitudId || !["aprobar", "rechazar"].includes(accion)) {
      return NextResponse.json({ success: false, error: "solicitudId y accion (aprobar|rechazar) son requeridos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify order access
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id, folio")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    // Get the solicitud
    const { data: solicitud, error: solErr } = await supabase
      .from("solicitudes_cambio_precio")
      .select("*")
      .eq("id", solicitudId)
      .eq("orden_id", ordenId)
      .eq("estado", "pendiente")
      .single();

    if (solErr || !solicitud) {
      return NextResponse.json({ success: false, error: "Solicitud no encontrada o ya revisada" }, { status: 404 });
    }

    const ahora = new Date().toISOString();

    if (accion === "aprobar") {
      // Aplicar los nuevos precios a la orden
      await supabase
        .from("ordenes_reparacion")
        .update({
          costo_reparacion: solicitud.costo_reparacion_propuesto,
          costo_partes: solicitud.costo_partes_propuesto,
          precio_pendiente_aprobacion: false,
          updated_at: ahora,
        })
        .eq("id", ordenId);

      // Marcar solicitud como aprobada
      await supabase
        .from("solicitudes_cambio_precio")
        .update({ estado: "aprobado", revisado_por: userId, revisado_at: ahora })
        .eq("id", solicitudId);

      return NextResponse.json({
        success: true,
        message: `Precio aprobado y aplicado a la orden ${orden.folio}`,
        data: {
          costoReparacion: Number(solicitud.costo_reparacion_propuesto),
          costoPartes: Number(solicitud.costo_partes_propuesto),
        },
      });
    } else {
      // Rechazar — precios quedan como están
      await supabase
        .from("solicitudes_cambio_precio")
        .update({ estado: "rechazado", revisado_por: userId, revisado_at: ahora })
        .eq("id", solicitudId);

      // Verificar si quedan otras solicitudes pendientes
      const { count } = await supabase
        .from("solicitudes_cambio_precio")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", ordenId)
        .eq("estado", "pendiente");

      if ((count ?? 0) === 0) {
        // Limpiar el flag
        await supabase
          .from("ordenes_reparacion")
          .update({ precio_pendiente_aprobacion: false })
          .eq("id", ordenId);
      }

      return NextResponse.json({
        success: true,
        message: `Solicitud rechazada. Los precios de la orden ${orden.folio} no cambiaron.`,
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
