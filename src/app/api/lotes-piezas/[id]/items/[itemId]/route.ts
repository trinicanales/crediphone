import { NextResponse } from "next/server";
import {
  updateItemEstado,
  deleteItemFromLote,
} from "@/lib/db/lotes-piezas";
import { getAuthContext } from "@/lib/auth/server";

/**
 * PATCH /api/lotes-piezas/[id]/items/[itemId]
 * Actualiza el estado de un item
 * Body: { estadoItem, cantidadRecibida?, notas? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { userId, role } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Sin permisos" },
        { status: 403 }
      );
    }

    const body: {
      estadoItem: string;
      cantidadRecibida?: number;
      notas?: string;
    } = await request.json();

    if (!body.estadoItem) {
      return NextResponse.json(
        { success: false, error: "Estado del item es requerido" },
        { status: 400 }
      );
    }

    const item = await updateItemEstado(
      itemId,
      body.estadoItem,
      body.cantidadRecibida,
      body.notas
    );

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Error en PATCH /api/lotes-piezas/[id]/items/[itemId]:", error);
    return NextResponse.json(
      { success: false, error: "Error actualizando item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lotes-piezas/[id]/items/[itemId]
 * Elimina un item del lote
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { userId, role } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Sin permisos" },
        { status: 403 }
      );
    }

    await deleteItemFromLote(itemId);

    return NextResponse.json({ success: true, message: "Item eliminado" });
  } catch (error) {
    console.error("Error en DELETE /api/lotes-piezas/[id]/items/[itemId]:", error);
    return NextResponse.json(
      { success: false, error: "Error eliminando item" },
      { status: 500 }
    );
  }
}
