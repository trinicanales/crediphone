/**
 * FASE 55: GET /api/asistencia/activa
 * Devuelve la sesión activa del usuario actual, o null si no tiene turno abierto.
 * Usada por WidgetChecador para mostrar el estado actual.
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getSesionActivaUsuario } from "@/lib/db/asistencia";

export async function GET() {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const sesion = await getSesionActivaUsuario(userId);
    return NextResponse.json({ success: true, data: sesion ?? null });
  } catch (error) {
    console.error("[GET /api/asistencia/activa]", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar sesión activa" },
      { status: 500 }
    );
  }
}
