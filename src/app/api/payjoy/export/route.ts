/**
 * FASE 20: Export Data Endpoint
 * GET /api/payjoy/export
 *
 * Exporta todos los datos de Payjoy (webhooks, logs, estadísticas)
 * Solo admin
 */

import { NextResponse } from "next/server";
import { getAllWebhooks, getAllApiLogs, getPayjoyStats } from "@/lib/db/payjoy";
import { getAuthContext } from "@/lib/auth/server";

export async function GET() {
    try {
        const { userId, isSuperAdmin } = await getAuthContext();
        if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        if (!isSuperAdmin) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
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
