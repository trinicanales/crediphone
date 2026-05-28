import { NextResponse } from "next/server";
import { updateOrdenBasicInfo } from "@/lib/db/reparaciones";
import type { PrioridadOrden } from "@/types";
import { requireAuth } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PUT /api/reparaciones/[id]/editar-info
 * Actualiza la información básica de una orden de reparación
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

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

    // SEGURIDAD: validar que la orden pertenece al distribuidor del usuario
    if (!auth.isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: chk } = await supabase.from("ordenes_reparacion").select("distribuidor_id").eq("id", id).single();
      if (!chk || chk.distribuidor_id !== auth.distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
    }

    // Validar datos requeridos
    if (!body.clienteId || !body.marcaDispositivo || !body.modeloDispositivo) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos insuficientes",
          message:
            "Los campos clienteId, marcaDispositivo y modeloDispositivo son requeridos",
        },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData = {
      clienteId: body.clienteId,
      marcaDispositivo: body.marcaDispositivo,
      modeloDispositivo: body.modeloDispositivo,
      imei: body.imei,
      numeroSerie: body.numeroSerie,
      problemaReportado: body.problemaReportado,
      prioridad: body.prioridad as PrioridadOrden,
      fechaEstimadaEntrega: body.fechaEstimadaEntrega
        ? new Date(body.fechaEstimadaEntrega)
        : undefined,
      notasInternas: body.notasInternas,
      condicionDispositivo: body.condicionDispositivo,
    };

    const ordenActualizada = await updateOrdenBasicInfo(id, updateData);

    return NextResponse.json({
      success: true,
      data: ordenActualizada,
      message: "Información de la orden actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error en PUT /api/reparaciones/[id]/editar-info:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar información de la orden",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
