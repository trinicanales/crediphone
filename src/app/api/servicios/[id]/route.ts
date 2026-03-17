import { NextResponse } from "next/server";
import { getServicioById, updateServicio, deleteServicio } from "@/lib/db/servicios";
import { getAuthContext } from "@/lib/auth/server";

// GET /api/servicios/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const filterDistribuidorId =
      role === "super_admin" ? undefined : (distribuidorId ?? undefined);

    const servicio = await getServicioById(id, filterDistribuidorId);

    if (!servicio) {
      return NextResponse.json({ success: false, error: "Servicio no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: servicio });
  } catch (error) {
    console.error("Error al obtener servicio:", error);
    return NextResponse.json({ success: false, error: "Error al obtener servicio" }, { status: 500 });
  }
}

// PATCH /api/servicios/[id] — solo admin / super_admin
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const filterDistribuidorId =
      role === "super_admin" ? undefined : (distribuidorId ?? undefined);

    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.nombre !== undefined) updates.nombre = body.nombre;
    if (body.descripcion !== undefined) updates.descripcion = body.descripcion;
    if (body.precioBase !== undefined) updates.precioBase = Number(body.precioBase);
    if (body.precio_base !== undefined) updates.precioBase = Number(body.precio_base);
    if (body.precioFijo !== undefined) updates.precioFijo = body.precioFijo;
    if (body.precio_fijo !== undefined) updates.precioFijo = body.precio_fijo;
    if (body.precioMin !== undefined) updates.precioMin = body.precioMin;
    if (body.precioMax !== undefined) updates.precioMax = body.precioMax;
    if (body.categoria !== undefined) updates.categoria = body.categoria;
    if (body.activo !== undefined) updates.activo = body.activo;

    const servicio = await updateServicio(id, updates as Parameters<typeof updateServicio>[1], filterDistribuidorId);

    return NextResponse.json({ success: true, data: servicio });
  } catch (error) {
    console.error("Error al actualizar servicio:", error);
    return NextResponse.json({ success: false, error: "Error al actualizar servicio" }, { status: 500 });
  }
}

// DELETE /api/servicios/[id] — solo admin / super_admin
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const filterDistribuidorId =
      role === "super_admin" ? undefined : (distribuidorId ?? undefined);

    await deleteServicio(id, filterDistribuidorId);

    return NextResponse.json({ success: true, message: "Servicio eliminado" });
  } catch (error) {
    console.error("Error al eliminar servicio:", error);
    return NextResponse.json({ success: false, error: "Error al eliminar servicio" }, { status: 500 });
  }
}
