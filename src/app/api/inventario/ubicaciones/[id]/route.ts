import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getUbicacionById,
  updateUbicacion,
  deleteUbicacion,
  getProductosCountByUbicacion,
  getMovimientosByUbicacion,
} from "@/lib/db/ubicaciones";
import { getProductosByUbicacion } from "@/lib/db/productos";
import type { NuevaUbicacionFormData } from "@/types";
import { registroEsDeMiTienda } from "@/lib/auth/tienda";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await registroEsDeMiTienda("ubicaciones_inventario", id, distribuidorId, isSuperAdmin))) {
      return NextResponse.json({ success: false, error: "Recurso no encontrado" }, { status: 404 });
    }
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    if (action === "productos") {
      const productos = await getProductosByUbicacion(id);
      return NextResponse.json({ success: true, data: productos });
    }

    if (action === "count") {
      const count = await getProductosCountByUbicacion(id);
      return NextResponse.json({ success: true, data: { count } });
    }

    if (action === "movimientos") {
      const movimientos = await getMovimientosByUbicacion(id);
      return NextResponse.json({ success: true, data: movimientos });
    }

    const ubicacion = await getUbicacionById(id);

    if (!ubicacion) {
      return NextResponse.json(
        { success: false, error: "Ubicación no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: ubicacion });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/ubicaciones/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener ubicación" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "vendedor", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "No tiene permisos para actualizar ubicaciones" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!(await registroEsDeMiTienda("ubicaciones_inventario", id, distribuidorId, isSuperAdmin))) {
      return NextResponse.json({ success: false, error: "Recurso no encontrado" }, { status: 404 });
    }
    const body = await request.json();

    const updates: Partial<NuevaUbicacionFormData> = {};
    if (body.nombre !== undefined) updates.nombre = body.nombre;
    if (body.codigo !== undefined) updates.codigo = body.codigo;
    if (body.tipo !== undefined) updates.tipo = body.tipo;
    if (body.descripcion !== undefined) updates.descripcion = body.descripcion;
    if (body.capacidadMaxima !== undefined)
      updates.capacidadMaxima = body.capacidadMaxima;

    const ubicacion = await updateUbicacion(id, updates);

    return NextResponse.json({ success: true, data: ubicacion });
  } catch (error: any) {
    console.error("Error in PUT /api/inventario/ubicaciones/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al actualizar ubicación",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "Solo administradores pueden eliminar ubicaciones" },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!(await registroEsDeMiTienda("ubicaciones_inventario", id, distribuidorId, isSuperAdmin))) {
      return NextResponse.json({ success: false, error: "Recurso no encontrado" }, { status: 404 });
    }

    await deleteUbicacion(id);

    return NextResponse.json({
      success: true,
      message: "Ubicación eliminada correctamente",
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/inventario/ubicaciones/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al eliminar ubicación" },
      { status: 500 }
    );
  }
}
