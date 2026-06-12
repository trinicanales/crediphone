import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cliente/auth
 * Valida un token de acceso del cliente y establece cookie de sesión.
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ success: false, error: "Token requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const ahora = new Date().toISOString();

    const { data: tokenRecord } = await supabase
      .from("tokens_acceso_cliente")
      .select("id, cliente_id, distribuidor_id, expira_en")
      .eq("token", token)
      .gt("expira_en", ahora)
      .maybeSingle();

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: "Link inválido o expirado" },
        { status: 401 }
      );
    }

    // Actualizar último acceso
    await supabase
      .from("tokens_acceso_cliente")
      .update({ ultimo_acceso: ahora })
      .eq("id", tokenRecord.id);

    const response = NextResponse.json({ success: true });
    response.cookies.set("cliente_sesion", token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60, // 30 días
      path: "/",
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    console.error("[cliente/auth] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/cliente/auth
 * Cierra la sesión del cliente eliminando la cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("cliente_sesion", "", { maxAge: 0, path: "/" });
  return response;
}
