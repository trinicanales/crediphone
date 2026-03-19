import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getOrdenReparacionById,
  cambiarEstadoOrden,
  devolverTodasLasPiezas,
  devolverAnticiposOrden,
} from "@/lib/db/reparaciones";

/**
 * POST /api/reparaciones/[id]/cancelar
 *
 * Cancela una orden de reparación con flujo completo:
 * 1. Cambia estado a "cancelado"
 * 2. Devuelve todas las piezas reservadas al inventario
 * 3. Opcionalmente marca los anticipos como "devuelto"
 *
 * Body:
 *   - motivo: string (requerido)
 *   - devolverAnticipos: boolean (default true)
 *   - sesionCajaId?: string (para registrar la devolución de efectivo en caja activa)
 *
 * Roles: admin, super_admin
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Solo admin puede cancelar órdenes" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const motivo: string = body.motivo?.trim() || "Sin motivo especificado";
    const devolverAnticipos: boolean = body.devolverAnticipos ?? true;
    const sesionCajaId: string | undefined = body.sesionCajaId || undefined;

    // Obtener la orden para validar que existe y no esté ya cancelada
    const orden = await getOrdenReparacionById(id);
    if (!orden) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    if (orden.estado === "cancelado") {
      return NextResponse.json(
        { success: false, error: "La orden ya está cancelada" },
        { status: 409 }
      );
    }

    if (orden.estado === "entregado") {
      return NextResponse.json(
        { success: false, error: "No se puede cancelar una orden ya entregada" },
        { status: 409 }
      );
    }

    // ── 1. Cambiar estado a cancelado ────────────────────────────────────
    await cambiarEstadoOrden(id, "cancelado", `Cancelado: ${motivo}`);

    // ── 2. Devolver piezas al inventario ─────────────────────────────────
    // devolverTodasLasPiezas restaura el stock de cada pieza en reparacion_piezas
    // y elimina los registros de la orden
    await devolverTodasLasPiezas(id);

    // ── 3. Devolver anticipos (opcional) ─────────────────────────────────
    let totalDevuelto = 0;
    if (devolverAnticipos) {
      totalDevuelto = await devolverAnticiposOrden(
        id,
        orden.folio,
        motivo,
        sesionCajaId,
        userId
      );
    }

    return NextResponse.json({
      success: true,
      message: `Orden ${orden.folio} cancelada`,
      folio: orden.folio,
      piezasDevueltas: true,
      anticiposDevueltos: devolverAnticipos,
      totalAnticipoDevuelto: totalDevuelto,
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/cancelar:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al cancelar la orden",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
