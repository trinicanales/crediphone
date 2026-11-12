import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/alertas/[id]  — marca una alerta interna como leída. Solo admin / super_admin de su tienda.
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();
    let q = supabase
      .from("alertas_internas")
      .update({ leida: true, leida_por: userId, leida_at: new Date().toISOString() })
      .eq("id", id);
    if (!isSuperAdmin && distribuidorId) q = q.eq("distribuidor_id", distribuidorId);
    const { error } = await q;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
