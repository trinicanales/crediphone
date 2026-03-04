/**
 * FASE 20: Import Customer Endpoint
 * POST /api/payjoy/import-customer
 *
 * Busca un cliente en Payjoy y retorna datos pre-llenados
 * para el formulario de creación de cliente en CREDIPHONE
 */

import { NextRequest, NextResponse } from "next/server";
import { createPayjoyClient } from "@/lib/payjoy/client";
import type { ImportCustomerRequest } from "@/types/payjoy";

export async function POST(request: NextRequest) {
    try {
        const body: ImportCustomerRequest = await request.json();

        if (!body.customerId && !body.phoneNumber) {
            return NextResponse.json(
                { error: "Debe proporcionar customerId o phoneNumber" },
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

        // Buscar cliente en Payjoy
        const customer = await client.lookupCustomer({
            customerId: body.customerId,
            phoneNumber: body.phoneNumber,
        });

        if (!customer) {
            return NextResponse.json(
                { success: false, message: "Cliente no encontrado en Payjoy" },
                { status: 404 }
            );
        }

        // Mapear datos de Payjoy al formato de CREDIPHONE
        const clientePreLlenado = {
            nombre: customer.firstName || "",
            apellido: customer.lastName || "",
            telefono: customer.phone || "",
            email: customer.email || "",
            direccion: customer.address || "",
            // Datos adicionales de Payjoy
            payjoyCustomerId: customer.customerId,
            payjoyHasActiveCredit: customer.hasActiveCredit,
            payjoyCreditScore: customer.creditScore,
            payjoyTotalOrders: customer.totalOrders,
            payjoyActiveOrders: customer.activeFinanceOrders,
        };

        return NextResponse.json({
            success: true,
            data: clientePreLlenado,
        });
    } catch (error) {
        console.error("[Payjoy] Error importing customer:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 }
        );
    }
}
