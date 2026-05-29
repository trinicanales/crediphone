import { NextResponse } from "next/server";
import { getDashboardCompleto } from "@/lib/db/reparaciones-dashboard";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/reparaciones/dashboard
 * Obtiene todos los datos del dashboard de reparaciones.
 * Cada admin solo ve datos de su propio distribuidor.
 */
export async function GET() {
  try {
    const auth = await requireAuth(["admin", "tecnico", "super_admin"]);
    if (!auth.ok) return auth.response;

    // super_admin ve todo (undefined); admin/tecnico ven solo su distribuidor
    const distribuidorId = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const data = await getDashboardCompleto(distribuidorId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error al obtener dashboard de reparaciones:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al cargar dashboard",
        message:
          error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
