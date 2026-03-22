import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    // Solo roles que atienden clientes pueden registrar consentimiento presencial
    const rolesPermitidos = ["admin", "super_admin", "vendedor"];
    if (!role || !rolesPermitidos.includes(role)) {
      return NextResponse.json({ success: false, error: "Sin permiso para registrar consentimiento" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // SEGURIDAD: verificar que el cliente pertenece al distribuidor del usuario (multi-tenant)
    if (!isSuperAdmin && distribuidorId) {
      const { data: clienteCheck } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", id)
        .eq("distribuidor_id", distribuidorId)
        .single();

      if (!clienteCheck) {
        return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
      }
    }

    const body = await request.json();
    const { error } = await supabase.from("clientes").update({
      acepta_notificaciones_whatsapp: body.aceptaNotificaciones ?? false,
      acepta_promociones_whatsapp: body.aceptaPromociones ?? false,
      preferencias_promociones: body.preferencias ?? {},
      fecha_consentimiento: new Date().toISOString(),
      consentimiento_canal: "presencial",
      consentimiento_fecha: new Date().toISOString(),
      consentimiento_empleado_id: userId,
    }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: "Consentimiento registrado" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al registrar consentimiento" }, { status: 500 });
  }
}
