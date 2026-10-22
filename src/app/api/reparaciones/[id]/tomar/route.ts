import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asignarOrden, type MotivoAsignacion } from "@/lib/reparaciones/asignacion";

/**
 * POST /api/reparaciones/[id]/tomar
 * El usuario que llama toma la orden para sí mismo.
 *  - técnico / admin / super_admin.
 *  - Body opcional: { motivo: "inicio_diagnostico" | "tomada_por_admin" }
 * Se usa (1) al empezar a capturar el diagnóstico y (2) con el botón "Tomar esta orden".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["tecnico", "admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const motivo: MotivoAsignacion =
      body?.motivo === "inicio_diagnostico" ? "inicio_diagnostico" : "tomada_por_admin";

    // SEGURIDAD: la orden debe ser de la tienda del usuario (super_admin: cualquiera)
    if (!isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: chk } = await supabase
        .from("ordenes_reparacion")
        .select("distribuidor_id")
        .eq("id", id)
        .single();
      if (!chk || chk.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
    }

    const r = await asignarOrden({ ordenId: id, usuarioId: userId, motivo, porUsuarioId: userId });
    return NextResponse.json({ success: true, data: r });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error al tomar la orden" },
      { status: 400 }
    );
  }
}
