/**
 * FASE 55: POST /api/whatsapp/test-connection
 * Verifica que las credenciales de Meta Cloud API sean válidas
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";

export async function POST(request: Request) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const { phoneNumberId, accessToken, apiVersion = "v20.0" } = await request.json();

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "phoneNumberId y accessToken son requeridos" },
        { status: 400 }
      );
    }

    // Llamar a la Graph API para verificar el número de teléfono
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ success: false, error: errMsg });
    }

    // Extraer número de teléfono visible (display_phone_number)
    const displayPhoneNumber = data?.display_phone_number ?? data?.verified_name ?? phoneNumberId;

    return NextResponse.json({
      success: true,
      displayPhoneNumber,
      verifiedName: data?.verified_name,
      qualityRating: data?.quality_rating,
    });
  } catch (error) {
    console.error("[POST /api/whatsapp/test-connection]", error);
    return NextResponse.json(
      { success: false, error: "Error al verificar conexión" },
      { status: 500 }
    );
  }
}
