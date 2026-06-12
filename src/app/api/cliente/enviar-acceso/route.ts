import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";
import { sendWhatsApp } from "@/lib/whatsapp-api";

/**
 * POST /api/cliente/enviar-acceso
 * Autenticado (admin/vendedor). Genera token para un clienteId específico
 * y envía el link por WhatsApp. Útil desde el perfil del cliente en el dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { clienteId } = await request.json();
    if (!clienteId) {
      return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verificar que el cliente existe y pertenece a este distribuidor
    let clienteQuery = supabase
      .from("clientes")
      .select("id, nombre, apellido, telefono, distribuidor_id")
      .eq("id", clienteId);

    if (!isSuperAdmin && distribuidorId) {
      clienteQuery = clienteQuery.eq("distribuidor_id", distribuidorId);
    }

    const { data: cliente } = await clienteQuery.maybeSingle();

    if (!cliente) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    // Generar token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expiraEn = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("tokens_acceso_cliente").upsert(
      {
        cliente_id: cliente.id,
        distribuidor_id: cliente.distribuidor_id,
        token,
        expira_en: expiraEn,
        ultimo_acceso: null,
      },
      { onConflict: "cliente_id,distribuidor_id", ignoreDuplicates: false }
    );

    // Construir link con subdominio si hay slug
    const { data: dist } = await supabase
      .from("distribuidores")
      .select("slug")
      .eq("id", cliente.distribuidor_id)
      .maybeSingle();

    const slug = dist?.slug;
    const origin =
      request.headers.get("origin") ??
      (slug ? `https://${slug}.crediphone.com.mx` : "https://crediphone.com.mx");

    const link = `${origin}/cliente/acceso?token=${token}`;
    const nombre = cliente.nombre ?? "Cliente";
    const mensaje =
      `Hola ${nombre}! Aquí está tu link para acceder a tu historial de servicios:\n\n` +
      `${link}\n\n` +
      `Válido por 30 días. Si no solicitaste esto, ignora este mensaje.`;

    const waResult = await sendWhatsApp({
      telefono: cliente.telefono,
      mensaje,
      distribuidorId: cliente.distribuidor_id ?? undefined,
    });

    if (waResult.canal === "link") {
      return NextResponse.json({ success: true, waLink: waResult.waLink });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[cliente/enviar-acceso] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
