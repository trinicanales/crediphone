/**
 * FASE 20: Payjoy API Client
 * Clase para interactuar con la API REST de Payjoy
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logApiCall } from "./logger";
import type {
    PayjoyCustomer,
    PayjoyFinanceOrder,
    PayjoyFinanceOrderSummary,
    PayjoyApiResponse,
    TestConnectionResponse,
    PayjoyConnectionStatus,
} from "@/types/payjoy";

// =====================================================
// CONFIGURACIÓN
// =====================================================

interface PayjoyClientConfig {
    apiKey: string;
    baseUrl: string;
    enabled: boolean;
}

function getPayjoyConfig(): PayjoyClientConfig {
    return {
        apiKey: process.env.PAYJOY_API_KEY || "",
        baseUrl: process.env.PAYJOY_BASE_URL || "https://partner.payjoy.com/v1",
        enabled: process.env.PAYJOY_ENABLED === "true",
    };
}

// =====================================================
// PAYJOY CLIENT CLASS
// =====================================================

export class PayjoyClient {
    private config: PayjoyClientConfig;
    private accessToken: string | null = null;
    private tokenExpiresAt: number = 0;

    constructor(config?: Partial<PayjoyClientConfig>) {
        const defaultConfig = getPayjoyConfig();
        this.config = { ...defaultConfig, ...config };
    }

    /**
     * Verifica si la integración está habilitada
     */
    isEnabled(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }

    /**
     * Autentica con la API de Payjoy y obtiene un access token
     */
    private async authenticate(): Promise<string> {
        // Si el token aún es válido, reutilizarlo
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        const startTime = Date.now();
        const endpoint = "/auth/token";

        try {
            const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.config.apiKey,
                },
                body: JSON.stringify({
                    grant_type: "api_key",
                    api_key: this.config.apiKey,
                }),
            });

            const durationMs = Date.now() - startTime;
            const body = await response.json();

            await logApiCall({
                endpoint,
                method: "POST",
                requestPayload: { grant_type: "api_key" },
                responseStatus: response.status,
                responseBody: body,
                durationMs,
            });

            if (!response.ok) {
                throw new Error(
                    `Authentication failed: ${response.status} - ${body.error || body.message || "Unknown error"}`
                );
            }

            this.accessToken = body.access_token;
            // Token expira en 1 hora, refrescar 5 minutos antes
            this.tokenExpiresAt = Date.now() + (body.expires_in || 3600) * 1000 - 300000;

            return this.accessToken!;
        } catch (error) {
            const durationMs = Date.now() - startTime;
            await logApiCall({
                endpoint,
                method: "POST",
                requestPayload: { grant_type: "api_key" },
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                durationMs,
            });
            throw error;
        }
    }

    /**
     * Realiza una petición autenticada a la API de Payjoy
     */
    private async request<T>(
        endpoint: string,
        method: string = "GET",
        body?: Record<string, unknown>,
        creditoId?: string
    ): Promise<T> {
        const token = await this.authenticate();
        const startTime = Date.now();

        try {
            const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });

            const durationMs = Date.now() - startTime;
            const responseBody = await response.json();

            await logApiCall({
                endpoint,
                method,
                requestPayload: body,
                responseStatus: response.status,
                responseBody,
                durationMs,
                creditoId,
            });

            if (!response.ok) {
                throw new Error(
                    `Payjoy API error: ${response.status} - ${responseBody.error || responseBody.message || "Unknown error"}`
                );
            }

            return responseBody as T;
        } catch (error) {
            const durationMs = Date.now() - startTime;
            if (!(error instanceof Error && error.message.startsWith("Payjoy API error"))) {
                await logApiCall({
                    endpoint,
                    method,
                    requestPayload: body,
                    errorMessage: error instanceof Error ? error.message : "Unknown error",
                    durationMs,
                    creditoId,
                });
            }
            throw error;
        }
    }

    /**
     * Prueba la conexión con la API de Payjoy
     */
    async testConnection(): Promise<TestConnectionResponse> {
        const startTime = Date.now();
        const supabase = createAdminClient();

        try {
            if (!this.isEnabled()) {
                const result: TestConnectionResponse = {
                    connected: false,
                    status: "error" as PayjoyConnectionStatus,
                    message: "La integración con Payjoy no está habilitada o falta la API Key",
                    testedAt: new Date(),
                };

                // Guardar resultado en configuración
                await supabase
                    .from("configuracion")
                    .update({
                        payjoy_connection_status: result.status,
                        payjoy_last_connection_test: new Date().toISOString(),
                    })
                    .not("id", "is", null);

                return result;
            }

            // Intentar autenticar
            await this.authenticate();

            const latencyMs = Date.now() - startTime;
            const result: TestConnectionResponse = {
                connected: true,
                status: "connected" as PayjoyConnectionStatus,
                message: "Conexión exitosa con Payjoy API",
                latencyMs,
                testedAt: new Date(),
            };

            // Guardar resultado en configuración
            await supabase
                .from("configuracion")
                .update({
                    payjoy_connection_status: result.status,
                    payjoy_last_connection_test: new Date().toISOString(),
                })
                .not("id", "is", null);

            return result;
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            const result: TestConnectionResponse = {
                connected: false,
                status: "error" as PayjoyConnectionStatus,
                message: error instanceof Error ? error.message : "Error desconocido",
                latencyMs,
                testedAt: new Date(),
            };

            // Guardar resultado en configuración
            await supabase
                .from("configuracion")
                .update({
                    payjoy_connection_status: result.status,
                    payjoy_last_connection_test: new Date().toISOString(),
                })
                .not("id", "is", null);

            return result;
        }
    }

    /**
     * Busca un cliente en Payjoy por teléfono, IMEI o ID
     */
    async lookupCustomer(params: {
        phoneNumber?: string;
        imei?: string;
        customerId?: string;
    }): Promise<PayjoyCustomer | null> {
        if (!this.isEnabled()) {
            throw new Error("La integración con Payjoy no está habilitada");
        }

        let endpoint = "/customers/lookup";
        const queryParams = new URLSearchParams();

        if (params.customerId) {
            endpoint = `/customers/${params.customerId}`;
        } else if (params.phoneNumber) {
            queryParams.set("phone", params.phoneNumber);
        } else if (params.imei) {
            queryParams.set("imei", params.imei);
        } else {
            throw new Error("Debe proporcionar phoneNumber, imei o customerId");
        }

        const fullEndpoint =
            queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;

        try {
            const response = await this.request<PayjoyApiResponse<PayjoyCustomer>>(fullEndpoint);

            if (!response.success || !response.data) {
                return null;
            }

            return response.data;
        } catch (error) {
            // Si es 404, retornar null (cliente no encontrado)
            if (error instanceof Error && error.message.includes("404")) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Obtiene los detalles de una orden de financiamiento
     */
    async getFinanceOrder(financeOrderId: string, creditoId?: string): Promise<PayjoyFinanceOrder | null> {
        if (!this.isEnabled()) {
            throw new Error("La integración con Payjoy no está habilitada");
        }

        try {
            const response = await this.request<PayjoyApiResponse<PayjoyFinanceOrder>>(
                `/finance-orders/${financeOrderId}`,
                "GET",
                undefined,
                creditoId
            );

            if (!response.success || !response.data) {
                return null;
            }

            return response.data;
        } catch (error) {
            if (error instanceof Error && error.message.includes("404")) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Lista las órdenes de financiamiento de un cliente
     */
    async getCustomerOrders(customerId: string): Promise<PayjoyFinanceOrderSummary[]> {
        if (!this.isEnabled()) {
            throw new Error("La integración con Payjoy no está habilitada");
        }

        const response = await this.request<PayjoyApiResponse<PayjoyFinanceOrderSummary[]>>(
            `/customers/${customerId}/finance-orders`
        );

        return response.data || [];
    }
}

// =====================================================
// FACTORY
// =====================================================

/**
 * Crea una instancia del cliente de Payjoy
 */
export function createPayjoyClient(config?: Partial<PayjoyClientConfig>): PayjoyClient {
    return new PayjoyClient(config);
}
