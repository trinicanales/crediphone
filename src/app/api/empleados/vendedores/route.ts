import { NextResponse } from "next/server";
import { getEmpleadosPorRol } from "@/lib/db/empleados";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/empleados/vendedores
 * Obtiene solo los vendedores activos del distribuidor del admin que consulta.
 * super_admin recibe vendedores de todos los distribuidores.
 */
export async function GET() {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    // super_admin ve todos (distribuidorId null → undefined = sin filtro)
    // admin solo ve los de su distribuidor
    const distribuidorFilter = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const vendedores = await getEmpleadosPorRol("vendedor", distribuidorFilter);

    return NextResponse.json({
      success: true,
      count: vendedores.length,
      data: vendedores,
    });
  } catch (error) {
    console.error("Error en GET /api/empleados/vendedores:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener vendedores",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
