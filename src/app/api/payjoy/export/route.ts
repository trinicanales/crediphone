/**
 * FASE 20: Export Data Endpoint
 * GET /api/payjoy/export
 *
 * Exporta todos los datos de Payjoy (webhooks, logs, estadísticas)
 * Solo admin
 */

import { NextResponse } from "next/server";
import { getAllWebhooks, getAllApiLogs, getPayjoyStats } from "@/lib/db/payjoy";

export async function GET() {
    try {
        // Obtener todos los datos
        const [webhooksResult, logsResult, stats] = await Promise.all([
            getAllWebhooks(1000, 0),
            getAllApiLogs(1000, 0),
            getPayjoyStats(),
        ]);

        const exportData = {
            webhooks: webhooksResult.webhooks,
            apiLogs: logsResult.logs,
            stats: {
                ...stats,
                totalWebhooksExported: webhooksResult.total,
                totalApiLogsExported: logsResult.total,
            },
            exportedAt: new Date().toISOString(),
        };

        return NextResponse.json(exportData);
    } catch (error) {
        console.error("[Payjoy] Error exporting data:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 }
        );
    }
}
