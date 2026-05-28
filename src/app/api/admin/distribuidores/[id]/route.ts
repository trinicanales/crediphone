import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getDistribuidorById, updateDistribuidor } from "@/lib/db/distribuidores";

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
    return NextResponse.json({ success: true, data: distribuidor });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

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

    const updated = await updateDistribuidor(id, {
      nombre: body.nombre,
      slug: body.slug,
      logoUrl: body.logoUrl,
      activo: body.activo,
      tipoTenant: body.tipoTenant,
      parentDistribuidorId: body.parentDistribuidorId,
      permiteImpersonacion: body.permiteImpersonacion,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
