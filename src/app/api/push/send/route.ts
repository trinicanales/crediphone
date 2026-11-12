import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/push/send
 * Uso INTERNO — llamado desde crearNotificacionTecnico() u otros triggers.
 *
 * Body: {
 *   userIds: string[];   // UUIDs de los destinatarios
 *   title: string;
 *   body: string;
 *   url?: string;        // URL a abrir al hacer click en la notificación
 *   icon?: string;
 * }
 *
 * No requiere auth del cliente final — se llama server-to-server.
 * Protegido por verificar que la llamada venga de la propia app (header interno).
 */

// Configurar VAPID
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL ?? "mailto:admin@crediphone.mx";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: Request) {
  try {
    // Verificar header interno de seguridad
    const internalSecret = request.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ success: false, error: "Ruta interna deshabilitada" }, { status: 503 });
    }
    if (internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("[push/send] VAPID keys no configuradas — push deshabilitado");
      return NextResponse.json({ success: true, enviados: 0, razon: "VAPID no configurado" });
    }

    const body = await request.json();
    const { userIds, title, body: mensaje, url, icon } = body as {
      userIds: string[];
      title: string;
      body: string;
      url?: string;
      icon?: string;
    };

    if (!userIds?.length || !title || !mensaje) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Obtener todas las suscripciones activas de los destinatarios
    const { data: suscripciones, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (error) throw error;
    if (!suscripciones?.length) {
      return NextResponse.json({ success: true, enviados: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: mensaje,
      url: url ?? "/dashboard",
      icon: icon ?? "/icon-192.png",
      badge: "/icon-72.png",
    });

    const expiradas: string[] = [];
    let enviados = 0;

    // Enviar a cada dispositivo suscrito
    await Promise.allSettled(
      suscripciones.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 86400 } // 24 horas
          );
          enviados++;

          // Actualizar last_used_at
          await supabase
            .from("push_subscriptions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", sub.id);
        } catch (err: unknown) {
          // 410 Gone = suscripción expirada (usuario eliminó permisos)
          const httpErr = err as { statusCode?: number };
          if (httpErr?.statusCode === 410) {
            expiradas.push(sub.id);
          } else {
            console.warn("[push/send] Error al enviar push:", err);
          }
        }
      })
    );

    // Limpiar suscripciones expiradas
    if (expiradas.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiradas);
    }

    return NextResponse.json({ success: true, enviados });
  } catch (error) {
    console.error("Error en POST /api/push/send:", error);
    return NextResponse.json(
      { error: "Error al enviar push" },
      { status: 500 }
    );
  }
}
