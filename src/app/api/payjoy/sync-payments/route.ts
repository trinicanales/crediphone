/**
 * FASE 20: Sync Payments Endpoint
 * POST /api/payjoy/sync-payments
 *
 * Sincronización manual: consulta webhooks no procesados de un crédito
 * y retorna el historial de pagos Payjoy registrados
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWebhooksByCredito } from "@/lib/db/payjoy";
import { getAuthContext } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
    try {
        const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
        if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

        const body = await request.json();

        if (!body.creditoId) {
            return NextResponse.json(
                { error: "Campo requerido: creditoId" },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // Verificar que el crédito está vinculado a Payjoy
        const { data: credito, error: creditoError } = await supabase
            .from("creditos")
            .select("id, distribuidor_id, payjoy_finance_order_id, payjoy_customer_id, payjoy_sync_enabled, payjoy_last_sync_at")
            .eq("id", body.creditoId)
            .single();

        if (creditoError || !credito) {
            return NextResponse.json(
                { error: "Crédito no encontrado" },
                { status: 404 }
            );
        }

        // Validar aislamiento por franquicia
        if (!isSuperAdmin && credito.distribuidor_id && credito.distribuidor_id !== distribuidorId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        if (!credito.payjoy_finance_order_id) {
            return NextResponse.json(
                { error: "El crédito no está vinculado a una orden de Payjoy" },
                { status: 400 }
            );
        }

        // Obtener pagos Payjoy registrados para este crédito
        const { data: pagos } = await supabase
            .from("pagos")
            .select("id, monto, fecha_pago, payjoy_transaction_id, payjoy_payment_method, payjoy_customer_name, created_at")
            .eq("credito_id", body.creditoId)
            .eq("metodo_pago", "payjoy")
            .order("created_at", { ascending: false });

        // Obtener webhooks del crédito
        const webhooks = await getWebhooksByCredito(body.creditoId);

        // Actualizar timestamp de sincronización
        await supabase
            .from("creditos")
            .update({ payjoy_last_sync_at: new Date().toISOString() })
            .eq("id", body.creditoId);

        return NextResponse.json({
            success: true,
            financeOrderId: credito.payjoy_finance_order_id,
            customerId: credito.payjoy_customer_id,
            pagos: pagos || [],
            webhooks: webhooks.length,
            lastSyncAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("[Payjoy] Error syncing payments:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 }
        );
    }
}
