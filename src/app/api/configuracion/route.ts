import { NextResponse } from "next/server";
import { getConfiguracion, updateConfiguracion } from "@/lib/db/configuracion";
import { getAuthContext } from "@/lib/auth/server";

/**
 * GET /api/configuracion
 * Obtiene la configuracion del sistema.
 * Acceso: Cualquier usuario autenticado (necesario para filtrar sidebar por modulos).
 * Si getAuthContext falla (sesión no iniciada aún), responde igualmente con la config por defecto.
 */
export async function GET() {
  try {
    // Intentar obtener distribuidorId — si falla (ej: sin sesión), continuar sin filtro
    let distribuidorId: string | null = null;
    try {
      const auth = await getAuthContext();
      distribuidorId = auth.distribuidorId ?? null;
    } catch {
      // Sin sesión o error de auth → usar config sin filtro de distribuidor
    }

    const config = await getConfiguracion(distribuidorId);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error("Error en GET /api/configuracion:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener configuracion" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/configuracion
 * Actualiza la configuracion del sistema.
 * Acceso: Solo administradores.
 */
export async function PUT(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado. Solo administradores." },
        { status: 403 }
      );
    }

    // Obtener datos del body
    const body = await request.json();

    // Enforce: modulos CORE siempre activos
    if (body.modulosHabilitados) {
      body.modulosHabilitados.dashboard = true;
      body.modulosHabilitados.reparaciones = true;
    }

    // Actualizar configuracion — pasar distribuidorId para filtrar la fila correcta
    const updated = await updateConfiguracion(body, userId, distribuidorId ?? null);

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Configuracion actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error en PUT /api/configuracion:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar configuracion" },
      { status: 500 }
    );
  }
}
