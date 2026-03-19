import { NextResponse } from "next/server";
import {
  getLoteById,
  updateLote,
  deleteLote,
  marcarLoteRecibido,
} from "@/lib/db/lotes-piezas";
import { getAuthContext } from "@/lib/auth/server";
import type { LotePiezasFormData } from "@/types";

/**
 * GET /api/lotes-piezas/[id]
 * Obtiene un lote específico con sus items
 */
export async function GET(
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

    const lote = await getLoteById(id);

    if (!lote) {
      return NextResponse.json(
        { success: false, error: "Lote no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: lote });
  } catch (error) {
    console.error("Error en GET /api/lotes-piezas/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error obteniendo lote" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/lotes-piezas/[id]
 * Actualiza un lote existente
 * Body puede incluir: estado, fechaLlegada, costoEnvioTotal, etc.
 * Para marcar como "recibido", enviar { estado: "recibido" }
 */
export async function PATCH(
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
        { success: false, error: "Sin permisos para actualizar" },
        { status: 403 }
      );
    }

    const body: Partial<LotePiezasFormData> = await request.json();

    // Si se intenta marcar como recibido, registrar quién lo recibió
    if (body.estado === "recibido") {
      const lote = await marcarLoteRecibido(id, userId);
      return NextResponse.json({ success: true, data: lote });
    }

    const lote = await updateLote(id, body);

    return NextResponse.json({ success: true, data: lote });
  } catch (error) {
    console.error("Error en PATCH /api/lotes-piezas/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error actualizando lote" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lotes-piezas/[id]
 * Elimina un lote y todos sus items
 */
export async function DELETE(
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
        { success: false, error: "Sin permisos para eliminar" },
        { status: 403 }
      );
    }

    await deleteLote(id);

    return NextResponse.json({ success: true, message: "Lote eliminado" });
  } catch (error) {
    console.error("Error en DELETE /api/lotes-piezas/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error eliminando lote" },
      { status: 500 }
    );
  }
}
