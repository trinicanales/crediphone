/**
 * FASE 20: Link Credit Endpoint
 * POST /api/payjoy/link-credit
 *
 * Vincula un crédito de CREDIPHONE con una orden de financiamiento de Payjoy
 */

import { NextRequest, NextResponse } from "next/server";
import { linkCreditToPayjoy } from "@/lib/db/payjoy";
import type { LinkCreditRequest } from "@/types/payjoy";

export async function POST(request: NextRequest) {
    try {
        const body: LinkCreditRequest = await request.json();

        // Validar campos requeridos
        if (!body.creditoId || !body.financeOrderId || !body.customerId) {
            return NextResponse.json(
                {
                    error:
                        "Campos requeridos: creditoId, financeOrderId, customerId",
                },
                { status: 400 }
            );
        }

        await linkCreditToPayjoy(
            body.creditoId,
            body.financeOrderId,
            body.customerId,
            body.syncEnabled ?? true
        );

        return NextResponse.json({
            success: true,
            message: "Crédito vinculado con Payjoy exitosamente",
        });
    } catch (error) {
        console.error("[Payjoy] Error linking credit:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 }
        );
    }
}
