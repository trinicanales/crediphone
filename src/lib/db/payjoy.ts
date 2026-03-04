/**
 * FASE 20: Database Layer - Payjoy
 * Funciones CRUD para webhooks, API logs y vinculación de créditos con Payjoy
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { PayjoyWebhookRecord, PayjoyApiLogRecord } from "@/types/payjoy";
import { mapWebhookFromDB } from "@/lib/payjoy/webhook-handler";

// =====================================================
// MAPPERS
// =====================================================

function mapApiLogFromDB(row: any): PayjoyApiLogRecord {
    return {
        id: row.id,
        endpoint: row.endpoint,
        method: row.method,
        requestPayload: row.request_payload,
        responseStatus: row.response_status,
        responseBody: row.response_body,
        errorMessage: row.error_message,
        durationMs: row.duration_ms,
        creditoId: row.credito_id,
        createdAt: new Date(row.created_at),
    };
}

// =====================================================
// WEBHOOKS
// =====================================================

/**
 * Obtiene los webhooks asociados a un crédito
 */
export async function getWebhooksByCredito(
    creditoId: string
): Promise<PayjoyWebhookRecord[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("payjoy_webhooks")
        .select("*")
        .eq("credito_id", creditoId)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Error obteniendo webhooks: ${error.message}`);
    }

    return (data || []).map(mapWebhookFromDB);
}

/**
 * Obtiene todos los webhooks con paginación
 */
export async function getAllWebhooks(
    limit = 50,
    offset = 0
): Promise<{ webhooks: PayjoyWebhookRecord[]; total: number }> {
    const supabase = createAdminClient();

    const { data, error, count } = await supabase
        .from("payjoy_webhooks")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        throw new Error(`Error obteniendo webhooks: ${error.message}`);
    }

    return {
        webhooks: (data || []).map(mapWebhookFromDB),
        total: count || 0,
    };
}

/**
 * Obtiene webhooks no procesados
 */
export async function getUnprocessedWebhooks(): Promise<PayjoyWebhookRecord[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("payjoy_webhooks")
        .select("*")
        .eq("processed", false)
        .order("created_at", { ascending: true });

    if (error) {
        throw new Error(`Error obteniendo webhooks no procesados: ${error.message}`);
    }

    return (data || []).map(mapWebhookFromDB);
}

// =====================================================
// API LOGS
// =====================================================

/**
 * Obtiene los logs de API asociados a un crédito
 */
export async function getApiLogsByCredito(
    creditoId: string
): Promise<PayjoyApiLogRecord[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("payjoy_api_logs")
        .select("*")
        .eq("credito_id", creditoId)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Error obteniendo API logs: ${error.message}`);
    }

    return (data || []).map(mapApiLogFromDB);
}

/**
 * Obtiene todos los logs de API con paginación
 */
export async function getAllApiLogs(
    limit = 50,
    offset = 0
): Promise<{ logs: PayjoyApiLogRecord[]; total: number }> {
    const supabase = createAdminClient();

    const { data, error, count } = await supabase
        .from("payjoy_api_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        throw new Error(`Error obteniendo API logs: ${error.message}`);
    }

    return {
        logs: (data || []).map(mapApiLogFromDB),
        total: count || 0,
    };
}

// =====================================================
// VINCULACIÓN DE CRÉDITOS
// =====================================================

/**
 * Vincula un crédito local con una orden de financiamiento de Payjoy
 */
export async function linkCreditToPayjoy(
    creditoId: string,
    financeOrderId: string,
    customerId: string,
    syncEnabled: boolean = true
): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("creditos")
        .update({
            payjoy_finance_order_id: financeOrderId,
            payjoy_customer_id: customerId,
            payjoy_sync_enabled: syncEnabled,
            payjoy_last_sync_at: new Date().toISOString(),
        })
        .eq("id", creditoId);

    if (error) {
        throw new Error(`Error vinculando crédito con Payjoy: ${error.message}`);
    }
}

/**
 * Desvincula un crédito de Payjoy
 */
export async function unlinkCreditFromPayjoy(creditoId: string): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("creditos")
        .update({
            payjoy_finance_order_id: null,
            payjoy_customer_id: null,
            payjoy_sync_enabled: false,
            payjoy_last_sync_at: null,
        })
        .eq("id", creditoId);

    if (error) {
        throw new Error(`Error desvinculando crédito de Payjoy: ${error.message}`);
    }
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

/**
 * Obtiene estadísticas generales de la integración Payjoy
 */
export async function getPayjoyStats(): Promise<{
    totalWebhooks: number;
    processedWebhooks: number;
    failedWebhooks: number;
    totalApiCalls: number;
    avgLatencyMs: number;
    creditosVinculados: number;
}> {
    const supabase = createAdminClient();

    // Webhooks stats
    const { count: totalWebhooks } = await supabase
        .from("payjoy_webhooks")
        .select("*", { count: "exact", head: true });

    const { count: processedWebhooks } = await supabase
        .from("payjoy_webhooks")
        .select("*", { count: "exact", head: true })
        .eq("processed", true)
        .is("error_message", null);

    const { count: failedWebhooks } = await supabase
        .from("payjoy_webhooks")
        .select("*", { count: "exact", head: true })
        .eq("processed", true)
        .not("error_message", "is", null);

    // API logs stats
    const { count: totalApiCalls } = await supabase
        .from("payjoy_api_logs")
        .select("*", { count: "exact", head: true });

    const { data: avgData } = await supabase
        .from("payjoy_api_logs")
        .select("duration_ms")
        .not("duration_ms", "is", null);

    const avgLatencyMs =
        avgData && avgData.length > 0
            ? avgData.reduce((sum: number, row: any) => sum + (row.duration_ms || 0), 0) /
            avgData.length
            : 0;

    // Créditos vinculados
    const { count: creditosVinculados } = await supabase
        .from("creditos")
        .select("*", { count: "exact", head: true })
        .not("payjoy_finance_order_id", "is", null);

    return {
        totalWebhooks: totalWebhooks || 0,
        processedWebhooks: processedWebhooks || 0,
        failedWebhooks: failedWebhooks || 0,
        totalApiCalls: totalApiCalls || 0,
        avgLatencyMs: Math.round(avgLatencyMs),
        creditosVinculados: creditosVinculados || 0,
    };
}
