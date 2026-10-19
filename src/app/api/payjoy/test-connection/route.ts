/**
 * FASE 20: Test Connection Endpoint
 * POST /api/payjoy/test-connection
 *
 * Prueba la conexión con la API de Payjoy (solo admin)
 */

import { NextResponse } from "next/server";
import { createPayjoyClient } from "@/lib/payjoy/client";
import { FEATURES } from "@/lib/features";
import { payjoyDeshabilitado } from "@/lib/features-server";

export async function POST() {
    if (!FEATURES.payjoy) return payjoyDeshabilitado();
    try {
        const client = createPayjoyClient();
        const result = await client.testConnection();

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Payjoy] Error testing connection:", error);
        return NextResponse.json(
            {
                connected: false,
                status: "error",
                message: error instanceof Error ? error.message : "Error desconocido",
                testedAt: new Date(),
            },
            { status: 500 }
        );
    }
}
