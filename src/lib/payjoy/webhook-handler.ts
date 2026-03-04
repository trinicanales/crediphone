/**
 * FASE 20: Payjoy Webhook Handler
 * Procesamiento de webhooks recibidos de Payjoy
 * - Verificación de firma HMAC-SHA256
 * - Almacenamiento de eventos
 * - Procesamiento de pagos (idempotente)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
    PayjoyWebhookPayload,
    PayjoyWebhookRecord,
    PayjoyEventType,
} from "@/types/payjoy";

// =====================================================
// VERIFICACIÓN DE FIRMA
// =====================================================

/**
 * Verifica la firma HMAC-SHA256 del webhook de Payjoy
 */
export async function verifyWebhookSignature(
    payload: string,
    signature: string
): Promise<boolean> {
    const secret = process.env.PAYJOY_WEBHOOK_SECRET;

    if (!secret) {
        console.error("[Webhook] PAYJOY_WEBHOOK_SECRET no configurado");
        return false;
    }

    try {
        // Crear HMAC usando Web Crypto API (compatible con Edge Runtime)
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(payload)
        );

        // Convertir a hex string
        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        // Comparación segura en tiempo constante
        if (signature.length !== expectedSignature.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < signature.length; i++) {
            result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
        }

        return result === 0;
    } catch (error) {
        console.error("[Webhook] Error verificando firma:", error);
        return false;
    }
}

// =====================================================
// ALMACENAMIENTO DE WEBHOOKS
// =====================================================

/**
 * Almacena un evento webhook en la base de datos
 * Retorna el ID del registro o null si ya existe (idempotencia)
 */
export async function storeWebhookEvent(
    payload: PayjoyWebhookPayload,
    signature?: string,
    ipAddress?: string
): Promise<{ id: string; isDuplicate: boolean }> {
    const supabase = createAdminClient();
    const transactionId = payload.data.transaction_id;

    // Verificar idempotencia por transaction_id
    if (transactionId) {
        const { data: existing } = await supabase
            .from("payjoy_webhooks")
            .select("id")
            .eq("transaction_id", transactionId)
            .single();

        if (existing) {
            return { id: existing.id, isDuplicate: true };
        }
    }

    // Insertar nuevo webhook
    const { data, error } = await supabase
        .from("payjoy_webhooks")
        .insert({
            event_type: payload.event_type,
            finance_order_id: payload.data.finance_order_id || null,
            customer_id: payload.data.customer_id || null,
            transaction_id: transactionId || null,
            amount: payload.data.amount || null,
            currency: payload.data.currency || "MXN",
            payment_date: payload.data.payment_date || null,
            raw_payload: payload,
            signature: signature || null,
            ip_address: ipAddress || null,
            processed: false,
        })
        .select("id")
        .single();

    if (error) {
        // Si falla por constraint de unique transaction_id, es duplicado
        if (error.code === "23505") {
            const { data: dup } = await supabase
                .from("payjoy_webhooks")
                .select("id")
                .eq("transaction_id", transactionId)
                .single();

            return { id: dup?.id || "", isDuplicate: true };
        }
        throw new Error(`Error almacenando webhook: ${error.message}`);
    }

    return { id: data.id, isDuplicate: false };
}

// =====================================================
// PROCESAMIENTO DE PAGOS
// =====================================================

/**
 * Procesa un pago recibido desde Payjoy
 * Crea un registro en la tabla pagos y vincula con el crédito
 */
async function processPaymentReceived(
    payload: PayjoyWebhookPayload,
    webhookId: string
): Promise<{ success: boolean; pagoId?: string; error?: string }> {
    const supabase = createAdminClient();
    const data = payload.data;

    if (!data.finance_order_id) {
        return { success: false, error: "finance_order_id no proporcionado" };
    }

    if (!data.amount || data.amount <= 0) {
        return { success: false, error: "Monto inválido" };
    }

    // 1. Buscar el crédito vinculado por payjoy_finance_order_id
    const { data: credito, error: creditoError } = await supabase
        .from("creditos")
        .select("id, estado, vendedor_id")
        .eq("payjoy_finance_order_id", data.finance_order_id)
        .single();

    if (creditoError || !credito) {
        return {
            success: false,
            error: `Crédito no encontrado para finance_order_id: ${data.finance_order_id}`,
        };
    }

    if (credito.estado === "pagado") {
        return {
            success: false,
            error: `Crédito ${credito.id} ya está pagado`,
        };
    }

    if (credito.estado === "cancelado") {
        return {
            success: false,
            error: `Crédito ${credito.id} está cancelado`,
        };
    }

    // 2. Verificar idempotencia por transaction_id en pagos
    if (data.transaction_id) {
        const { data: existingPago } = await supabase
            .from("pagos")
            .select("id")
            .eq("payjoy_transaction_id", data.transaction_id)
            .single();

        if (existingPago) {
            return {
                success: true,
                pagoId: existingPago.id,
                error: "Pago ya registrado (idempotencia)",
            };
        }
    }

    // 3. Crear registro de pago
    const { data: pago, error: pagoError } = await supabase
        .from("pagos")
        .insert({
            credito_id: credito.id,
            monto: data.amount,
            fecha_pago: data.payment_date || new Date().toISOString(),
            metodo_pago: "payjoy",
            payjoy_transaction_id: data.transaction_id || null,
            payjoy_payment_method: data.payment_method || null,
            payjoy_customer_name: data.customer_name || null,
            payjoy_webhook_id: webhookId,
            cobrador_id: credito.vendedor_id, // Usar vendedor como cobrador
            referencia: `Payjoy TX: ${data.transaction_id || "N/A"}`,
        })
        .select("id")
        .single();

    if (pagoError) {
        return { success: false, error: `Error creando pago: ${pagoError.message}` };
    }

    // 4. Actualizar webhook con referencia al pago y crédito
    await supabase
        .from("payjoy_webhooks")
        .update({
            pago_id: pago.id,
            credito_id: credito.id,
            processed: true,
            processed_at: new Date().toISOString(),
        })
        .eq("id", webhookId);

    // Nota: El trigger check_credito_paid_status() en la DB
    // se encarga automáticamente de verificar si el crédito está pagado

    return { success: true, pagoId: pago.id };
}

// =====================================================
// ROUTER DE EVENTOS
// =====================================================

/**
 * Procesa un webhook completo de Payjoy
 * Router principal que decide qué hacer según el tipo de evento
 */
export async function processWebhook(
    payload: PayjoyWebhookPayload,
    webhookId: string
): Promise<{ success: boolean; message: string }> {
    const supabase = createAdminClient();

    try {
        switch (payload.event_type as PayjoyEventType) {
            case "payment.received": {
                const result = await processPaymentReceived(payload, webhookId);

                if (!result.success) {
                    // Marcar webhook como fallido
                    await supabase
                        .from("payjoy_webhooks")
                        .update({
                            processed: true,
                            processed_at: new Date().toISOString(),
                            error_message: result.error,
                        })
                        .eq("id", webhookId);

                    return {
                        success: false,
                        message: result.error || "Error procesando pago",
                    };
                }

                return {
                    success: true,
                    message: `Pago registrado: ${result.pagoId}`,
                };
            }

            case "payment.reversed": {
                // Marcar webhook como procesado pero sin acción automática
                // Las reversiones se manejan manualmente por el admin
                await supabase
                    .from("payjoy_webhooks")
                    .update({
                        processed: true,
                        processed_at: new Date().toISOString(),
                        error_message: "Reversión de pago - requiere revisión manual",
                    })
                    .eq("id", webhookId);

                return {
                    success: true,
                    message: "Reversión registrada - pendiente revisión manual",
                };
            }

            case "order.completed": {
                // Actualizar estado del crédito si existe
                if (payload.data.finance_order_id) {
                    const { data: credito } = await supabase
                        .from("creditos")
                        .select("id")
                        .eq("payjoy_finance_order_id", payload.data.finance_order_id)
                        .single();

                    if (credito) {
                        await supabase
                            .from("creditos")
                            .update({
                                estado: "pagado",
                                payjoy_last_sync_at: new Date().toISOString(),
                            })
                            .eq("id", credito.id);
                    }
                }

                await supabase
                    .from("payjoy_webhooks")
                    .update({
                        processed: true,
                        processed_at: new Date().toISOString(),
                    })
                    .eq("id", webhookId);

                return {
                    success: true,
                    message: "Orden completada procesada",
                };
            }

            case "order.defaulted":
            case "device.locked":
            case "device.unlocked": {
                // Solo registrar, no acción automática
                await supabase
                    .from("payjoy_webhooks")
                    .update({
                        processed: true,
                        processed_at: new Date().toISOString(),
                    })
                    .eq("id", webhookId);

                return {
                    success: true,
                    message: `Evento ${payload.event_type} registrado`,
                };
            }

            default: {
                await supabase
                    .from("payjoy_webhooks")
                    .update({
                        processed: true,
                        processed_at: new Date().toISOString(),
                        error_message: `Tipo de evento no soportado: ${payload.event_type}`,
                    })
                    .eq("id", webhookId);

                return {
                    success: true,
                    message: `Evento desconocido registrado: ${payload.event_type}`,
                };
            }
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error desconocido";

        // Marcar webhook como fallido
        await supabase
            .from("payjoy_webhooks")
            .update({
                processed: true,
                processed_at: new Date().toISOString(),
                error_message: errorMsg,
            })
            .eq("id", webhookId);

        return {
            success: false,
            message: errorMsg,
        };
    }
}

/**
 * Mapea un registro de la DB a PayjoyWebhookRecord
 */
export function mapWebhookFromDB(row: any): PayjoyWebhookRecord {
    return {
        id: row.id,
        eventType: row.event_type,
        financeOrderId: row.finance_order_id,
        customerId: row.customer_id,
        transactionId: row.transaction_id,
        amount: row.amount ? parseFloat(row.amount) : undefined,
        currency: row.currency || "MXN",
        paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
        rawPayload: row.raw_payload,
        signature: row.signature,
        ipAddress: row.ip_address,
        processed: row.processed,
        processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
        errorMessage: row.error_message,
        pagoId: row.pago_id,
        creditoId: row.credito_id,
        createdAt: new Date(row.created_at),
    };
}
