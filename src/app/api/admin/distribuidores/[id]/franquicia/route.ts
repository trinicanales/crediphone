import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getDistribuidorById, updateFranquiciaConfig } from "@/lib/db/distribuidores";

/**
 * PATCH /api/admin/distribuidores/[id]/franquicia
 * Actualiza la configuración de franquicia de un distribuidor.
 * Módulo independiente — no afecta el flujo de FASE 38/39.
 * Solo super_admin.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId || role !== "super_admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updated = await updateFranquiciaConfig(id, {
      modoOperacion: body.modoOperacion,
      grupoInventario: body.grupoInventario,
      accesoHabilitado: body.accesoHabilitado,
      tipoAcceso: body.tipoAcceso,
      pagosHabilitados: body.pagosHabilitados,
      notasFranquicia: body.notasFranquicia,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Configuración de franquicia actualizada",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/distribuidores/[id]/franquicia
 * Devuelve solo la config de franquicia de un distribuidor.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId || role !== "super_admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const distribuidor = await getDistribuidorById(id);
    if (!distribuidor) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: distribuidor.franquicia });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
