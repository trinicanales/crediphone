/**
 * FASE 20: Webhook Endpoint para Payjoy
 * POST /api/payjoy/webhook
 *
 * Recibe webhooks de Payjoy, verifica firma HMAC-SHA256,
 * almacena el evento y procesa pagos automáticamente.
 *
 * ⚠️ CRÍTICO: Este endpoint debe retornar 200 OK rápidamente
 * para que Payjoy no reintente el webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import {
    verifyWebhookSignature,
    storeWebhookEvent,
    processWebhook,
} from "@/lib/payjoy/webhook-handler";
import type { PayjoyWebhookPayload } from "@/types/payjoy";

export async function POST(request: NextRequest) {
    try {
        // 1. Obtener el body raw para verificación de firma
        const rawBody = await request.text();
        const signature = request.headers.get("x-payjoy-signature") || "";
        const ipAddress =
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown";

        // 2. Verificar firma HMAC-SHA256
        if (process.env.PAYJOY_WEBHOOK_SECRET) {
            const isValid = await verifyWebhookSignature(rawBody, signature);
            if (!isValid) {
                console.error("[Webhook] Firma inválida");
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                );
            }
        }

        // 3. Parsear el payload
        let payload: PayjoyWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON payload" },
                { status: 400 }
            );
        }

        // 4. Validar campos requeridos
        if (!payload.event_type || !payload.data) {
            return NextResponse.json(
                { error: "Missing required fields: event_type, data" },
                { status: 400 }
            );
        }

        // 5. Almacenar el evento (con idempotencia)
        const { id: webhookId, isDuplicate } = await storeWebhookEvent(
            payload,
            signature,
            ipAddress
        );

        if (isDuplicate) {
            // Ya fue procesado, retornar 200 OK sin procesar de nuevo
            return NextResponse.json({
                status: "ok",
                message: "Webhook already processed (idempotent)",
                webhookId,
            });
        }

        // 6. Procesar según el tipo de evento
        const result = await processWebhook(payload, webhookId);

        // 7. Retornar 200 OK siempre (para que Payjoy no reintente)
        return NextResponse.json({
            status: "ok",
            message: result.message,
            webhookId,
            processed: result.success,
        });
    } catch (error) {
        console.error("[Webhook] Error procesando webhook:", error);

        // Aún retornamos 200 para evitar reintentos
        // El error queda registrado en la DB
        return NextResponse.json({
            status: "ok",
            message: "Received but processing failed",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

// Deshabilitar body parser de Next.js para manejar raw body
export const runtime = "nodejs";
