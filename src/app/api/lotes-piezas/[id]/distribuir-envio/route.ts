import { NextResponse } from "next/server";
import { distribuirCostoEnvio } from "@/lib/db/lotes-piezas";
import { getAuthContext } from "@/lib/auth/server";

/**
 * POST /api/lotes-piezas/[id]/distribuir-envio
 * Distribuye el costo de envío del lote entre las reparaciones asociadas
 * Calcula: costo_envio_total / cantidad_piezas_en_reparaciones
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

    const result = await distribuirCostoEnvio(id);

    return NextResponse.json({
      success: result,
      message: "Costo de envío distribuido exitosamente",
    });
  } catch (error) {
    console.error(
      "Error en POST /api/lotes-piezas/[id]/distribuir-envio:",
      error
    );
    return NextResponse.json(
      { success: false, error: "Error distribuyendo costo de envío" },
      { status: 500 }
    );
  }
}
