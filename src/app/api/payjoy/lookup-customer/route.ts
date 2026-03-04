/**
 * FASE 20: Lookup Customer Endpoint
 * POST /api/payjoy/lookup-customer
 *
 * Busca un cliente en Payjoy por teléfono, IMEI o ID
 */

import { NextRequest, NextResponse } from "next/server";
import { createPayjoyClient } from "@/lib/payjoy/client";
import type { LookupCustomerRequest } from "@/types/payjoy";

export async function POST(request: NextRequest) {
    try {
        const body: LookupCustomerRequest = await request.json();

        // Validar que al menos un campo de búsqueda esté presente
        if (!body.phoneNumber && !body.imei && !body.customerId) {
            return NextResponse.json(
                { error: "Debe proporcionar phoneNumber, imei o customerId" },
                { status: 400 }
            );
        }

        const client = createPayjoyClient();

        if (!client.isEnabled()) {
            return NextResponse.json(
                { error: "La integración con Payjoy no está habilitada" },
                { status: 503 }
            );
        }

        const customer = await client.lookupCustomer({
            phoneNumber: body.phoneNumber,
            imei: body.imei,
            customerId: body.customerId,
        });

        if (!customer) {
            return NextResponse.json(
                { success: false, message: "Cliente no encontrado en Payjoy" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: customer,
        });
    } catch (error) {
        console.error("[Payjoy] Error looking up customer:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 }
        );
    }
}
