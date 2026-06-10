import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getKitById, updateKit, deleteKit } from "@/lib/db/kits";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    const { id } = await params;
    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    const kit = await getKitById(id, filterDist);
    if (!kit) return NextResponse.json({ success: false, error: "Kit no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: kit });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? ""))
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    const kit = await updateKit(id, body, filterDist);
    return NextResponse.json({ success: true, data: kit });
  } catch (error) {
    console.error("PUT /api/kits/[id]:", error);
    return NextResponse.json({ success: false, error: "Error al actualizar kit" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? ""))
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    const { id } = await params;
    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    await deleteKit(id, filterDist);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al eliminar kit" }, { status: 500 });
  }
}
