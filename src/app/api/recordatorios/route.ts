import { NextRequest, NextResponse } from "next/server";
import { getCreditosParaRecordatorio } from "@/lib/db/notificaciones";
import type { RecordatoriosOptions, PrioridadAlerta } from "@/lib/types/notificaciones";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/recordatorios
 * Obtiene lista de créditos que requieren recordatorio
 *
 * Query params:
 * - diasAnticipacion: Días antes de vencimiento (default: 7)
 * - soloVencidos: true/false - Solo créditos vencidos (default: false)
 * - prioridad: baja|media|alta|urgente - Filtrar por prioridad
 * - vendedorId: UUID - Filtrar por vendedor
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(["admin", "vendedor", "cobrador", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { searchParams } = request.nextUrl;

    // Parsear parámetros de búsqueda
    const diasAnticipacion = parseInt(searchParams.get("diasAnticipacion") || "7");
    const soloVencidos = searchParams.get("soloVencidos") === "true";
    const prioridad = searchParams.get("prioridad") as PrioridadAlerta | null;
    const vendedorId = searchParams.get("vendedorId") || undefined;

    // Validar diasAnticipacion
    if (isNaN(diasAnticipacion) || diasAnticipacion < 0 || diasAnticipacion > 90) {
      return NextResponse.json(
        {
          success: false,
          error: "Parámetro 'diasAnticipacion' inválido (debe ser 0-90)",
        },
        { status: 400 }
      );
    }

    // Validar prioridad si se proporciona
    if (prioridad && !["baja", "media", "alta", "urgente"].includes(prioridad)) {
      return NextResponse.json(
        {
          success: false,
          error: "Parámetro 'prioridad' inválido (baja|media|alta|urgente)",
        },
        { status: 400 }
      );
    }

    // Construir opciones de filtrado
    const options: RecordatoriosOptions = {
      diasAnticipacion,
      soloVencidos,
      prioridad: prioridad || undefined,
      vendedorId,
      distribuidorId: auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined),
    };

    // Obtener alertas
    const alertas = await getCreditosParaRecordatorio(options);

    // Agrupar por prioridad
    const porPrioridad = {
      urgente: alertas.filter((a) => a.prioridad === "urgente"),
      alta: alertas.filter((a) => a.prioridad === "alta"),
      media: alertas.filter((a) => a.prioridad === "media"),
      baja: alertas.filter((a) => a.prioridad === "baja"),
    };

    return NextResponse.json({
      success: true,
      data: {
        total: alertas.length,
        alertas,
        porPrioridad: {
          urgente: porPrioridad.urgente.length,
          alta: porPrioridad.alta.length,
          media: porPrioridad.media.length,
          baja: porPrioridad.baja.length,
        },
        alertasPorPrioridad: porPrioridad,
      },
    });
  } catch (error) {
    console.error("[API] Error en /api/recordatorios:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener recordatorios",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
