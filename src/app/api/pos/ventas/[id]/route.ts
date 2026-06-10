import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getVentaById, cancelarVenta } from "@/lib/db/ventas";

/**
 * GET /api/pos/ventas/[id]
 * Obtiene el detalle de una venta
 * Acceso: admin, vendedor, cobrador
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "vendedor", "cobrador", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    // Obtener venta
    const venta = await getVentaById(id, filterDist);

    if (!venta) {
      return NextResponse.json(
        { success: false, error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: venta });
  } catch (error) {
    console.error("Error en GET /api/pos/ventas/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al obtener venta",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pos/ventas/[id]
 * Actualiza una venta (cancelar)
 * Acceso: admin
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado. Solo administradores pueden cancelar ventas.",
        },
        { status: 403 }
      );
    }

    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    // Obtener datos del body
    const body = await request.json();
    const { action, motivo } = body;

    if (action === "cancelar") {
      const venta = await cancelarVenta(id, motivo, filterDist);
      return NextResponse.json({
        success: true,
        data: venta,
        message: "Venta cancelada exitosamente",
      });
    }

    return NextResponse.json(
      { success: false, error: "Acción no válida" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en PUT /api/pos/ventas/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error al actualizar venta",
      },
      { status: 500 }
    );
  }
}
