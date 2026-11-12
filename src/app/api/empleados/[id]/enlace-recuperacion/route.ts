import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarLinkWa } from "@/lib/whatsapp-api";

/**
 * POST /api/empleados/[id]/enlace-recuperacion
 * El admin genera el enlace para que un empleado cree su nueva contraseña
 * (decisión de Trini 2026-11-11: reemplaza la entrega pública del enlace).
 * Acceso: admin (solo empleados de su tienda) o super_admin.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Solo administradores" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: empleado } = await supabase
      .from("users")
      .select("id, email, name, role, telefono, distribuidor_id, activo")
      .eq("id", id)
      .maybeSingle();

    if (!empleado?.email) {
      return NextResponse.json({ success: false, error: "Empleado no encontrado" }, { status: 404 });
    }
    if (!isSuperAdmin && empleado.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Empleado no encontrado" }, { status: 404 });
    }
    if (!isSuperAdmin && empleado.role === "super_admin") {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const origin = new URL(request.url).origin;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: empleado.email,
      options: { redirectTo: `${origin}/auth/actualizar-password` },
    });

    const link = linkData?.properties?.action_link;
    if (linkError || !link) {
      console.error("[enlace-recuperacion] Error al generar enlace:", linkError);
      return NextResponse.json({ success: false, error: "No se pudo generar el enlace" }, { status: 500 });
    }

    const mensaje =
      `Hola ${empleado.name ?? "equipo"}! Para crear tu nueva contraseña de CREDIPHONE abre este enlace (válido 1 hora):\n\n${link}`;

    return NextResponse.json({
      success: true,
      data: {
        link,
        waLink: empleado.telefono ? generarLinkWa(empleado.telefono, mensaje) : null,
      },
    });
  } catch (error) {
    console.error("[enlace-recuperacion] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
