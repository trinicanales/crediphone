import { NextRequest, NextResponse } from "next/server";
import { recalcularScoring } from "@/lib/db/scoring";
import { getAuthContext } from "@/lib/auth/server";

/**
 * POST /api/scoring/:clienteId/recalcular
 * Recalcula el scoring de un cliente manualmente
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id: clienteId } = await params;

    const scoring = await recalcularScoring(clienteId);

    if (!scoring) {
      return NextResponse.json(
        { error: "No se pudo recalcular el scoring" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Scoring recalculado exitosamente",
      scoring
    });
  } catch (error) {
    console.error("Error en POST /api/scoring/recalcular:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
