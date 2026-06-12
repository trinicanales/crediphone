import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/whatsapp-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const telefono: string = (body.telefono ?? "").trim();

    if (!telefono) {
      return NextResponse.json({ success: false, error: "Teléfono requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Normalizar teléfono para búsqueda (con y sin formato)
    const telSolo = telefono.replace(/\D/g, "");

    const { data: userRow } = await supabase
      .from("users")
      .select("id, email, name, distribuidor_id, telefono")
      .or(`telefono.eq.${telefono},telefono.eq.${telSolo}`)
      .limit(1)
      .maybeSingle();

    // Anti-enumeración: siempre respuesta exitosa aunque no exista el usuario
    if (!userRow?.email) {
      return NextResponse.json({ success: true });
    }

    // Generar link de recuperación vía Supabase Admin API
    const origin =
      request.headers.get("origin") ??
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      "https://crediphone.com.mx";

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userRow.email,
      options: {
        redirectTo: `${origin}/auth/actualizar-password`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[reset-password] Error al generar link:", linkError);
      return NextResponse.json({ success: false, error: "Error al generar link de recuperación" }, { status: 500 });
    }

    const actionLink = linkData.properties.action_link;
    const nombre = userRow.name ?? "Empleado";
    const mensaje =
      `Hola ${nombre}! Para restablecer tu contraseña de CREDIPHONE abre este link (válido 1 hora):\n\n` +
      `${actionLink}\n\n` +
      `Si no solicitaste esto, ignora este mensaje.`;

    const waResult = await sendWhatsApp({
      telefono: userRow.telefono ?? telefono,
      mensaje,
      distribuidorId: userRow.distribuidor_id ?? undefined,
    });

    // Si WA API no está configurada, devolver link al frontend para redirección manual
    if (waResult.canal === "link") {
      return NextResponse.json({ success: true, waLink: waResult.waLink });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
