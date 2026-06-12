import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/whatsapp-api";

/**
 * POST /api/cliente/solicitar-acceso
 * Pública: cliente ingresa su teléfono → sistema genera token → envía link por WA.
 * Respuesta siempre genérica (anti-enumeración).
 */
export async function POST(request: NextRequest) {
  try {
    const { telefono } = await request.json();
    if (!telefono?.trim()) {
      return NextResponse.json({ success: true }); // silencioso
    }

    const supabase = createAdminClient();

    // Resolver distribuidorId desde el subdominio del Host
    const host = request.headers.get("host") ?? "";
    const slug = getSubdomainFromHost(host);
    let distribuidorId: string | null = null;

    if (slug) {
      const { data: dist } = await supabase
        .from("distribuidores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      distribuidorId = dist?.id ?? null;
    }

    // Buscar cliente por teléfono (y distribuidor si aplica)
    const telNorm = (telefono as string).trim().replace(/\D/g, "");
    let clienteQuery = supabase
      .from("clientes")
      .select("id, nombre, apellido, telefono, distribuidor_id")
      .or(`telefono.eq.${(telefono as string).trim()},telefono.eq.${telNorm}`)
      .limit(1);

    if (distribuidorId) {
      clienteQuery = clienteQuery.eq("distribuidor_id", distribuidorId);
    }

    const { data: cliente } = await clienteQuery.maybeSingle();

    if (!cliente) {
      return NextResponse.json({ success: true }); // anti-enumeración
    }

    // Generar o renovar token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expiraEn = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert: reemplaza token anterior del cliente para este distribuidor
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

    // Construir link con subdominio si aplica
    const origin =
      request.headers.get("origin") ??
      (slug ? `https://${slug}.crediphone.com.mx` : "https://crediphone.com.mx");
    const link = `${origin}/cliente/acceso?token=${token}`;

    const nombre = cliente.nombre ?? "Cliente";
    const mensaje =
      `Hola ${nombre}! Aquí está tu link para acceder a tu historial de servicios en nuestra tienda:\n\n` +
      `${link}\n\n` +
      `Válido por 30 días. Si no solicitaste esto, ignora este mensaje.`;

    await sendWhatsApp({
      telefono: cliente.telefono,
      mensaje,
      distribuidorId: cliente.distribuidor_id ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[cliente/solicitar-acceso] Error:", error);
    return NextResponse.json({ success: true }); // siempre éxito hacia afuera
  }
}

function getSubdomainFromHost(host: string): string | null {
  const main = "crediphone.com.mx";
  const withoutPort = host.split(":")[0];
  if (!withoutPort.endsWith(`.${main}`)) return null;
  const sub = withoutPort.slice(0, -(main.length + 1));
  if (!sub || sub === "www") return null;
  return sub;
}
