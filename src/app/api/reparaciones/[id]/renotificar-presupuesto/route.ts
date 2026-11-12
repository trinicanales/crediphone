import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/reparaciones/[id]/renotificar-presupuesto
 * Resetea la aprobación del cliente (aprobado_por_cliente = false)
 * para que el cliente pueda volver a aprobar/rechazar el presupuesto actualizado.
 * Requiere admin o super_admin.
 * Returns: { trackingToken, telefono } para componer el mensaje de WA desde el frontend.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Solo admin puede renotificar" }, { status: 403 });
    }

    const { id: ordenId } = await params;
    const supabase = createAdminClient();

    const { data: orden, error: fetchError } = await supabase
      .from("ordenes_reparacion")
      .select("id, estado, aprobado_por_cliente, requiere_aprobacion, distribuidor_id, clientes(telefono)")
      .eq("id", ordenId)
      .single();

    if (fetchError || !orden) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    if (!["presupuesto", "aprobado"].includes(orden.estado)) {
      return NextResponse.json(
        { success: false, error: "Solo se puede renotificar en estado presupuesto o aprobado" },
        { status: 409 }
      );
    }

    // Resetear aprobación del cliente
    const { error: updateError } = await supabase
      .from("ordenes_reparacion")
      .update({ aprobado_por_cliente: false })
      .eq("id", ordenId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const telefono = (orden.clientes as any)?.telefono ?? null;
    // El token vive en tracking_tokens (no en la orden): se toma el vigente más reciente
    const { data: tokenRow } = await supabase
      .from("tracking_tokens")
      .select("token")
      .eq("orden_id", ordenId)
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const trackingToken = tokenRow?.token ?? null;

    return NextResponse.json({
      success: true,
      message: "Aprobación reseteada. El cliente puede volver a aprobar el presupuesto actualizado.",
      trackingToken,
      telefono,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
