import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPiezasReparacion,
  agregarPiezaReparacion,
  quitarPiezaReparacion,
} from "@/lib/db/reparaciones";

/**
 * GET /api/reparaciones/[id]/piezas
 * Obtiene las piezas de inventario usadas en una reparación
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const piezas = await getPiezasReparacion(id);

    return NextResponse.json({ success: true, data: piezas });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/[id]/piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al obtener piezas",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reparaciones/[id]/piezas
 * Agrega una pieza del inventario a la reparación (descuenta stock)
 * Acceso: admin, tecnico, super_admin
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "tecnico", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "Solo técnicos y administradores pueden agregar piezas" },
        { status: 403 }
      );
    }

    const { id: ordenId } = await params;
    const body = await request.json();
    const { productoId, cantidad, notas } = body;
    // costoUnitario del cliente se IGNORA — siempre se lee desde la BD para evitar fraude

    if (!productoId) {
      return NextResponse.json(
        { success: false, error: "productoId es requerido" },
        { status: 400 }
      );
    }

    if (!cantidad || typeof cantidad !== "number" || cantidad < 1) {
      return NextResponse.json(
        { success: false, error: "cantidad debe ser un número mayor a 0" },
        { status: 400 }
      );
    }

    // Leer producto desde BD: stock + costo real (no confiar en el cliente)
    const supabase = createAdminClient();
    const { data: producto } = await supabase
      .from("productos")
      .select("id, nombre, stock, costo, precio")
      .eq("id", productoId)
      .single();

    if (!producto) {
      return NextResponse.json(
        { success: false, error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    if (producto.stock < cantidad) {
      // Sin stock suficiente → 409 con flag para que el frontend ofrezca solicitud_pieza
      return NextResponse.json(
        {
          success: false,
          sinStock: true,
          error: `Stock insuficiente. Disponible: ${producto.stock}, solicitado: ${cantidad}`,
          productoId,
          productoNombre: producto.nombre,
          stockDisponible: producto.stock,
          cantidadSolicitada: cantidad,
        },
        { status: 409 }
      );
    }

    // Costo real desde BD: usar costo de compra si existe, si no el precio de venta
    const costoUnitarioReal = parseFloat(producto.costo ?? producto.precio ?? 0);

    const pieza = await agregarPiezaReparacion(
      ordenId,
      productoId,
      cantidad,
      costoUnitarioReal,
      userId,
      notas
    );

    return NextResponse.json(
      { success: true, data: pieza, message: "Pieza agregada y stock actualizado" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/piezas:", error);
    // Detectar error de stock de agregarPiezaReparacion (fallback por si el check previo falló)
    const msg = error instanceof Error ? error.message : "Error al agregar pieza";
    const sinStock = msg.toLowerCase().includes("stock insuficiente");
    return NextResponse.json(
      { success: false, sinStock, error: msg },
      { status: sinStock ? 409 : 500 }
    );
  }
}

/**
 * DELETE /api/reparaciones/[id]/piezas
 * Quita una pieza de la reparación (devuelve stock al inventario)
 * Body: { piezaId: string }
 * Acceso: admin, tecnico, super_admin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "tecnico", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "Solo técnicos y administradores pueden quitar piezas" },
        { status: 403 }
      );
    }

    const { id: ordenId } = await params;
    const body = await request.json();
    const { piezaId } = body;

    if (!piezaId) {
      return NextResponse.json(
        { success: false, error: "piezaId es requerido" },
        { status: 400 }
      );
    }

    await quitarPiezaReparacion(piezaId, ordenId);

    return NextResponse.json({
      success: true,
      message: "Pieza retirada y stock devuelto al inventario",
    });
  } catch (error) {
    console.error("Error en DELETE /api/reparaciones/[id]/piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al quitar pieza",
      },
      { status: 500 }
    );
  }
}
