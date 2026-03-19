import { NextResponse } from "next/server";
import { addItemToLote } from "@/lib/db/lotes-piezas";
import { getAuthContext } from "@/lib/auth/server";
import type { LotePiezasItem } from "@/types";

/**
 * POST /api/lotes-piezas/[id]/items
 * Agrega un item a un lote
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body: Omit<LotePiezasItem, "id" | "loteId" | "createdAt"> =
      await request.json();

    // Validar campos requeridos
    if (!body.descripcion || !body.cantidadPedida) {
      return NextResponse.json(
        { success: false, error: "Descripción y cantidad son requeridas" },
        { status: 400 }
      );
    }

    const item = await addItemToLote(id, body);

    return NextResponse.json(
      { success: true, data: item },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/lotes-piezas/[id]/items:", error);
    return NextResponse.json(
      { success: false, error: "Error agregando item" },
      { status: 500 }
    );
  }
}
