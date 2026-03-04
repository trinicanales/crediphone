/**
 * FASE 20: Payjoy API Logger
 * Registra todas las llamadas salientes a la API de Payjoy en payjoy_api_logs
 */

import { createAdminClient } from "@/lib/supabase/admin";

interface LogApiCallParams {
    endpoint: string;
    method: string;
    requestPayload?: Record<string, unknown>;
    responseStatus?: number;
    responseBody?: Record<string, unknown>;
    errorMessage?: string;
    durationMs?: number;
    creditoId?: string;
}

/**
 * Registra una llamada a la API de Payjoy en la tabla payjoy_api_logs
 */
export async function logApiCall(params: LogApiCallParams): Promise<void> {
    try {
        const supabase = createAdminClient();

        await supabase.from("payjoy_api_logs").insert({
            endpoint: params.endpoint,
            method: params.method,
            request_payload: params.requestPayload || null,
            response_status: params.responseStatus || null,
            response_body: params.responseBody || null,
            error_message: params.errorMessage || null,
            duration_ms: params.durationMs || null,
            credito_id: params.creditoId || null,
        });
    } catch (error) {
        // No lanzar error si falla el logging para no afectar el flujo principal
        console.error("[Payjoy Logger] Error logging API call:", error);
    }
}
