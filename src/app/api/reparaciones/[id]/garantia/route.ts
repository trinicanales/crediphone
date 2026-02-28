import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getOrdenReparacionById,
  getGarantiaByOrden,
  verificarGarantiaActiva,
  createGarantia,
  createOrdenGarantia,
} from "@/lib/db/reparaciones";
import type { TipoGarantia } from "@/types";

/**
 * GET /api/reparaciones/[id]/garantia
 * Obtiene información de la garantía de una orden
 *
 * Query params:
 * - verificar: Si es "true", verifica si la garantía está activa
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const verificar = searchParams.get("verificar");

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

    // Si se solicita verificación de garantía activa
    if (verificar === "true") {
      const resultado = await verificarGarantiaActiva(id);
      return NextResponse.json({
        success: true,
        data: resultado,
      });
    }

    // Obtener garantía de la orden
    const garantia = await getGarantiaByOrden(id);

    if (!garantia) {
      return NextResponse.json(
        {
          success: false,
          error: "Garantía no encontrada",
          message: "Esta orden no tiene garantía registrada",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: garantia,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/[id]/garantia:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener garantía",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reparaciones/[id]/garantia
 * Crea una garantía o reclama una garantía existente
 *
 * Casos de uso:
 * 1. Crear garantía al entregar orden (body.tipoGarantia, diasGarantia, notas)
 * 2. Reclamar garantía (body.crearOrdenGarantia = true, motivoReclamo)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

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

    // Caso 1: Reclamar garantía existente (crear orden en garantía)
    if (body.crearOrdenGarantia === true) {
      if (!body.motivoReclamo) {
        return NextResponse.json(
          {
            success: false,
            error: "Motivo de reclamo requerido",
            message: "Debe proporcionar el motivo del reclamo de garantía",
          },
          { status: 400 }
        );
      }

      const { userId } = await getAuthContext();
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "No autenticado" },
          { status: 401 }
        );
      }
      const creadoPor = userId;

      const ordenGarantia = await createOrdenGarantia(
        id,
        body.motivoReclamo,
        creadoPor
      );

      return NextResponse.json({
        success: true,
        data: ordenGarantia,
        message: `Orden en garantía ${ordenGarantia.folio} creada exitosamente`,
      });
    }

    // Caso 2: Crear garantía para orden completada
    if (body.tipoGarantia) {
      // Validar tipo de garantía
      const tiposValidos: TipoGarantia[] = [
        "garantia_pieza",
        "falla_tecnico",
        "daño_cliente",
      ];

      if (!tiposValidos.includes(body.tipoGarantia)) {
        return NextResponse.json(
          {
            success: false,
            error: "Tipo de garantía inválido",
            message: `El tipo de garantía debe ser uno de: ${tiposValidos.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Verificar que la orden está completada o entregada
      if (!["completado", "listo_entrega", "entregado"].includes(orden.estado)) {
        return NextResponse.json(
          {
            success: false,
            error: "Estado incorrecto",
            message:
              "Solo se puede crear garantía para órdenes completadas, listas para entrega o entregadas",
          },
          { status: 400 }
        );
      }

      const garantia = await createGarantia(id, {
        tipoGarantia: body.tipoGarantia,
        diasGarantia: body.diasGarantia || 30,
        notas: body.notas,
      });

      return NextResponse.json({
        success: true,
        data: garantia,
        message: "Garantía creada exitosamente",
      });
    }

    // Si no se proporcionan datos válidos
    return NextResponse.json(
      {
        success: false,
        error: "Datos insuficientes",
        message:
          "Debe proporcionar 'tipoGarantia' para crear garantía o 'crearOrdenGarantia' para reclamar",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/garantia:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al procesar garantía",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
