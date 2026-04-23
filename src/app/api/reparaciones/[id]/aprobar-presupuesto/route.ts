import { NextResponse } from "next/server";
import {
  aprobarPresupuesto,
  getOrdenReparacionById,
} from "@/lib/db/reparaciones";
import { guardarVersionPDF } from "@/lib/pdf/versiones-pdf";
import { getAuthContext } from "@/lib/auth/server";

/**
 * POST /api/reparaciones/[id]/aprobar-presupuesto
 * Aprueba el presupuesto de una orden (cambia estado a "aprobado")
 *
 * Esta función puede ser llamada:
 * 1. Desde el dashboard por admin/vendedor
 * 2. Desde el tracking público por el cliente
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let userId: string | undefined;
    try { userId = (await getAuthContext()).userId ?? undefined; } catch { /* público */ }
    const { id } = await params;

    // Validar UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID inválido",
          message: "El ID proporcionado no es un UUID válido",
        },
        { status: 400 }
      );
    }

    // Verificar que la orden existe
    const orden = await getOrdenReparacionById(id);
    if (!orden) {
      return NextResponse.json(
        {
          success: false,
          error: "Orden no encontrada",
          message: `No se encontró una orden con el ID ${id}`,
        },
        { status: 404 }
      );
    }

    // Verificar que la orden está en estado "presupuesto"
    if (orden.estado !== "presupuesto") {
      return NextResponse.json(
        {
          success: false,
          error: "Estado incorrecto",
          message: `La orden debe estar en estado "presupuesto" para aprobar. Estado actual: ${orden.estado}`,
        },
        { status: 400 }
      );
    }

    // Aprobar presupuesto
    const ordenActualizada = await aprobarPresupuesto(id);

    // PDF v2 — aprobación presencial (fire-and-forget)
    guardarVersionPDF(
      id,
      orden.folio,
      "reaprobacion_presencial",
      "Aprobación presencial registrada por empleado",
      userId
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: ordenActualizada,
      message: "Presupuesto aprobado exitosamente. La reparación puede proceder.",
    });
  } catch (error) {
    console.error(
      "Error en POST /api/reparaciones/[id]/aprobar-presupuesto:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: "Error al aprobar presupuesto",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
