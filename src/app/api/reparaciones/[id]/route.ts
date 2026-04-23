import { NextResponse } from "next/server";
import {
  getOrdenReparacionById,
  getOrdenReparacionDetalladaById,
  updateDiagnostico,
  cambiarEstadoOrden,
} from "@/lib/db/reparaciones";
import { notificarCambioEstado } from "@/lib/notificaciones-reparaciones";
import { notificarResponsablesKassa } from "@/lib/db/notificaciones";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EstadoOrdenReparacion, DiagnosticoFormData } from "@/types";

/**
 * GET /api/reparaciones/[id]
 * Obtiene una orden de reparación por ID con información detallada
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const orden = await getOrdenReparacionDetalladaById(id);

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

    return NextResponse.json({
      success: true,
      data: orden,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener orden de reparación",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reparaciones/[id]
 * Actualiza una orden de reparación
 *
 * Casos de uso:
 * 1. Actualizar diagnóstico (body.diagnostico)
 * 2. Cambiar estado (body.estado)
 * 3. Actualizar notas u otros campos
 */
export async function PUT(
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

    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    let ordenActualizada;

    // Caso 1: Actualizar diagnóstico
    if (body.diagnostico) {
      // ── CONTROL DE PRECIOS PARA VENDEDORES ──────────────────────────────
      // Si un vendedor intenta cambiar costo_reparacion o costo_partes →
      // crear solicitud de aprobación en lugar de aplicar directamente.
      const esVendedor = role === "vendedor";
      const nuevoCostoRep = body.diagnostico.costoReparacion;
      const nuevoCostoPar = body.diagnostico.costoPartes;
      const hayNuevoPrecio = nuevoCostoRep !== undefined || nuevoCostoPar !== undefined;

      if (esVendedor && hayNuevoPrecio) {
        const supabase = createAdminClient();
        const ordenActual = await getOrdenReparacionById(id);

        const costoRepActual = ordenActual?.costoReparacion ?? 0;
        const costoParActual = ordenActual?.costoPartes ?? 0;
        const preciosCambian =
          (nuevoCostoRep !== undefined && Number(nuevoCostoRep) !== costoRepActual) ||
          (nuevoCostoPar !== undefined && Number(nuevoCostoPar) !== costoParActual);

        if (preciosCambian) {
          // Guardar solicitud de cambio de precio
          await supabase.from("solicitudes_cambio_precio").insert({
            orden_id: id,
            distribuidor_id: distribuidorId || null,
            solicitado_por: userId,
            estado: "pendiente",
            costo_reparacion_actual: costoRepActual,
            costo_partes_actual: costoParActual,
            costo_reparacion_propuesto: nuevoCostoRep !== undefined ? Number(nuevoCostoRep) : costoRepActual,
            costo_partes_propuesto: nuevoCostoPar !== undefined ? Number(nuevoCostoPar) : costoParActual,
            motivo: body.diagnostico.motivo || "Cambio solicitado por vendedor",
          });

          // Marcar la orden como "precio pendiente de aprobación"
          await supabase
            .from("ordenes_reparacion")
            .update({ precio_pendiente_aprobacion: true })
            .eq("id", id);

          // Notificar al admin para que apruebe
          const folio = ordenActual?.folio ?? id;
          notificarResponsablesKassa({
            distribuidorId: distribuidorId ?? undefined,
            titulo: `💰 Cambio de precio requiere aprobación — ${folio}`,
            cuerpo: `Vendedor propone cambio de precio en ${folio}: mano de obra $${Number(nuevoCostoRep ?? costoRepActual).toFixed(2)}, partes $${Number(nuevoCostoPar ?? costoParActual).toFixed(2)}. Revisar y aprobar en la orden.`,
            url: `/dashboard/reparaciones`,
            tipo: "orden_actualizada",
            ordenId: id,
            soloAdmins: true,
          }).catch(() => {});

          // Aplicar los cambios NO de precio (diagnóstico, partes, notas) sin cambiar precios
          const diagnosticoSinPrecios: DiagnosticoFormData = {
            diagnosticoTecnico: body.diagnostico.diagnosticoTecnico,
            costoReparacion: costoRepActual,  // mantener precio actual
            costoPartes: costoParActual,       // mantener precio actual
            partesReemplazadas: body.diagnostico.partesReemplazadas || [],
            fechaEstimadaEntrega: body.diagnostico.fechaEstimadaEntrega
              ? new Date(body.diagnostico.fechaEstimadaEntrega)
              : undefined,
            notasTecnico: body.diagnostico.notasTecnico,
            requiereAprobacion: body.diagnostico.requiereAprobacion ?? true,
          };

          ordenActualizada = await updateDiagnostico(id, diagnosticoSinPrecios);

          return NextResponse.json({
            success: true,
            data: ordenActualizada,
            message: "Diagnóstico actualizado. El cambio de precio fue enviado al admin para aprobación.",
            precioPendienteAprobacion: true,
          });
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      const diagnosticoData: DiagnosticoFormData = {
        diagnosticoTecnico: body.diagnostico.diagnosticoTecnico,
        costoReparacion: body.diagnostico.costoReparacion,
        costoPartes: body.diagnostico.costoPartes,
        partesReemplazadas: body.diagnostico.partesReemplazadas || [],
        fechaEstimadaEntrega: body.diagnostico.fechaEstimadaEntrega
          ? new Date(body.diagnostico.fechaEstimadaEntrega)
          : undefined,
        notasTecnico: body.diagnostico.notasTecnico,
        requiereAprobacion: body.diagnostico.requiereAprobacion ?? true,
      };

      ordenActualizada = await updateDiagnostico(id, diagnosticoData);

      // Si el diagnóstico resultó en estado "presupuesto", notificar al cliente
      // (esto crea el tracking token y envía el WhatsApp)
      if (ordenActualizada?.estado === "presupuesto") {
        try {
          const ordenDetallada = await getOrdenReparacionDetalladaById(id);
          if (ordenDetallada) {
            await notificarCambioEstado(ordenDetallada, "presupuesto");
          }
        } catch (notifError) {
          console.error("Error al notificar presupuesto (no bloquea):", notifError);
        }
      }

      return NextResponse.json({
        success: true,
        data: ordenActualizada,
        message: "Diagnóstico actualizado exitosamente",
      });
    }

    // Caso 2: Cambiar estado
    if (body.estado) {
      // Validar estado
      const estadosValidos: EstadoOrdenReparacion[] = [
        "recibido",
        "diagnostico",
        "presupuesto",
        "aprobado",
        "en_reparacion",
        "completado",
        "listo_entrega",
        "entregado",
        "no_reparable",
        "cancelado",
      ];

      if (!estadosValidos.includes(body.estado)) {
        return NextResponse.json(
          {
            success: false,
            error: "Estado inválido",
            message: `El estado debe ser uno de: ${estadosValidos.join(", ")}`,
          },
          { status: 400 }
        );
      }

      ordenActualizada = await cambiarEstadoOrden(
        id,
        body.estado,
        body.notas,
        body.aprobacionPresencial === true
      );

      // FASE 10: Notificar automáticamente al cambiar estado
      let notificaciones: any[] = [];
      try {
        const ordenDetallada = await getOrdenReparacionDetalladaById(id);
        if (ordenDetallada) {
          notificaciones = await notificarCambioEstado(
            ordenDetallada,
            body.estado,
            body.notas
          );
        }
      } catch (notifError) {
        console.error("Error al enviar notificaciones (no bloquea):", notifError);
      }

      return NextResponse.json({
        success: true,
        data: ordenActualizada,
        message: `Estado actualizado a "${body.estado}"`,
        notificaciones,
      });
    }

    // Caso 3: Actualizar campos sueltos (fechaEstimadaEntrega, requiereAprobacion)
    if (body.fechaEstimadaEntrega !== undefined || body.requiereAprobacion !== undefined) {
      const supabase = createAdminClient();
      const patchData: Record<string, unknown> = {};
      if (body.fechaEstimadaEntrega !== undefined) {
        patchData.fecha_estimada_entrega = body.fechaEstimadaEntrega || null;
      }
      if (body.requiereAprobacion !== undefined) {
        patchData.requiere_aprobacion = body.requiereAprobacion;
      }
      const { data, error } = await supabase
        .from("ordenes_reparacion")
        .update(patchData)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    }

    // Si no hay cambios específicos, retornar error
    return NextResponse.json(
      {
        success: false,
        error: "Datos insuficientes",
        message:
          "Debe proporcionar 'diagnostico', 'estado', 'fechaEstimadaEntrega' o 'requiereAprobacion' para actualizar la orden",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en PUT /api/reparaciones/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar orden de reparación",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reparaciones/[id]
 * Elimina permanentemente una orden de reparación.
 * SOLO super_admin tiene acceso.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "Solo super_admin puede eliminar órdenes" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Validar UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Eliminar registros dependientes primero para evitar FK violations
    await supabase.from("tracking_tokens").delete().eq("orden_id", id);
    await supabase.from("notificaciones").delete().eq("orden_reparacion_id", id);
    await supabase.from("anticipos_reparacion").delete().eq("orden_id", id);
    await supabase.from("imagenes_reparacion").delete().eq("orden_id", id);
    await supabase.from("reparacion_piezas").delete().eq("orden_id", id);
    await supabase.from("historial_estado_orden").delete().eq("orden_id", id);

    // Eliminar la orden principal
    const { error } = await supabase
      .from("ordenes_reparacion")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar orden:", error);
      return NextResponse.json(
        { success: false, error: "Error al eliminar la orden", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Orden eliminada permanentemente",
    });
  } catch (error) {
    console.error("Error en DELETE /api/reparaciones/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al eliminar orden de reparación",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
