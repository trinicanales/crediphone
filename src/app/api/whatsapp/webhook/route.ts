/**
 * FASE 55: WhatsApp Business API — Webhook
 *
 * GET  → verificación de webhook (Meta llama para confirmar el endpoint)
 * POST → recepción de eventos (status updates, mensajes entrantes)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── GET: Verificación del webhook ────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Buscar en todas las configuraciones si el token coincide
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("configuracion")
    .select("wa_webhook_verify_token, wa_enabled")
    .eq("wa_webhook_verify_token", token)
    .eq("wa_enabled", true)
    .limit(1);

  if (!data || data.length === 0) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Verificación exitosa: retornar el challenge
  return new NextResponse(challenge, { status: 200 });
}

// ─── POST: Eventos del webhook ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Procesar solo eventos de tipo "whatsapp_business_account"
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // ── Status updates (enviado, entregado, leído, fallido) ────────────
        for (const status of value.statuses ?? []) {
          const waMessageId: string = status.id;
          const newStatus: string   = status.status; // sent | delivered | read | failed

          const estadoMap: Record<string, string> = {
            sent:      "enviado",
            delivered: "entregado",
            read:      "leido",
            failed:    "fallido",
          };

          const estadoDB = estadoMap[newStatus] ?? newStatus;

          await supabase
            .from("whatsapp_mensajes")
            .update({ estado: estadoDB, updated_at: new Date().toISOString() })
            .eq("wa_message_id", waMessageId);
        }

        // ── Mensajes entrantes ─────────────────────────────────────────────
        for (const msg of value.messages ?? []) {
          if (msg.type === "text") {
            const telefono: string = msg.from;
            const texto: string    = msg.text?.body ?? "";
            const waId: string     = msg.id;

            // Buscar a qué distribuidor corresponde este phone_number_id
            let distribuidorId: string | null = null;
            if (value.metadata?.phone_number_id) {
              const { data: cfg } = await supabase
                .from("configuracion")
                .select("distribuidor_id")
                .eq("wa_phone_number_id", value.metadata.phone_number_id)
                .maybeSingle();
              distribuidorId = cfg?.distribuidor_id ?? null;
            }

            // Guardar el mensaje entrante
            await supabase.from("whatsapp_mensajes").insert({
              distribuidor_id: distribuidorId,
              telefono,
              mensaje: texto,
              tipo:    "inbound",
              canal:   "api",
              estado:  "recibido",
              wa_message_id: waId,
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[WA Webhook POST]", error);
    // Meta espera 200 siempre para no reintentar
    return NextResponse.json({ received: true });
  }
}
