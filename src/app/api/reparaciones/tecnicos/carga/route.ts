import { NextResponse } from "next/server";
import { getCargaTecnicos } from "@/lib/db/reparaciones";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/reparaciones/tecnicos/carga
 * Obtiene estadísticas de carga de trabajo para técnicos del distribuidor.
 * Cada admin solo ve sus propios técnicos.
 */
export async function GET() {
  try {
    const auth = await requireAuth(["admin", "super_admin", "tecnico"]);
    if (!auth.ok) return auth.response;

    const distribuidorId = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const cargaTecnicos = await getCargaTecnicos(distribuidorId);

    return NextResponse.json({
      success: true,
      count: cargaTecnicos.length,
      data: cargaTecnicos,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/tecnicos/carga:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener carga de técnicos",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
