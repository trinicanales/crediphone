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
import { sendWhatsApp, generarLinkWa } from "@/lib/whatsapp-api";
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

      // C7: capturar precio anterior antes de aplicar el cambio (solo para admin)
      const ordenPrevia = !esVendedor ? await getOrdenReparacionById(id) : null;

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

      // C7: Si admin cambió precio y la orden ya tiene tracking token → notificar al cliente
      if (!esVendedor && ordenPrevia && hayNuevoPrecio) {
        // Usar precio_total (sistema nuevo) para la comparación y notificación al cliente
        const precioAntes = (ordenPrevia.presupuestoTotal && ordenPrevia.presupuestoTotal > 0)
          ? ordenPrevia.presupuestoTotal
          : (ordenPrevia.costoTotal ?? 0);
        const precioDespues = (Number(nuevoCostoRep ?? 0)) + (Number(nuevoCostoPar ?? 0));
        if (precioAntes !== precioDespues) {
          ;(async () => {
            try {
              const supabase = createAdminClient();
              const { data: token } = await supabase
                .from("tracking_tokens")
                .select("token")
                .eq("orden_id", id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!token?.token) return; // sin tracking, no se puede notificar

              const ordenDetallada = await getOrdenReparacionDetalladaById(id);
              if (!ordenDetallada?.clienteTelefono) return;

              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://crediphone.com.mx";
              const trackingUrl = `${baseUrl}/tracking/${token.token}`;
              const nombreCliente = `${ordenDetallada.clienteNombre || ""} ${(ordenDetallada as any).clienteApellido || ""}`.trim() || "Cliente";

              const mensaje = [
                `🔧 *Actualización de presupuesto — CREDIPHONE*`,
                ``,
                `Hola *${nombreCliente}*,`,
                ``,
                `El precio de tu reparación ha sido actualizado:`,
                ``,
                `📱 *Folio:* ${ordenDetallada.folio}`,
                `💰 *Precio anterior:* $${precioAntes.toFixed(2)}`,
                `💰 *Precio nuevo:* $${precioDespues.toFixed(2)}`,
                ``,
                `🔗 Revisa tu presupuesto actualizado:`,
                trackingUrl,
                ``,
                `Si tienes preguntas, responde a este mensaje.`,
                `📱 CREDIPHONE`,
              ].join("\n");

              await sendWhatsApp({ telefono: ordenDetallada.clienteTelefono, mensaje, distribuidorId: ordenDetallada.distribuidorId ?? undefined }).catch(() => {
                // fallback: no bloquea si WA no configurado
              });

              // Registrar en historial
              await supabase.from("historial_estado_orden").insert({
                orden_id: id,
                estado_anterior: ordenDetallada.estado,
                estado_nuevo: ordenDetallada.estado,
                comentario: `Precio actualizado por admin: $${precioAntes.toFixed(2)} → $${precioDespues.toFixed(2)}. Notificación enviada al cliente.`,
                usuario_id: userId,
              });
              // C11: registro en tabla de historial de precios
              await supabase.from("historial_precios_orden").insert({
                orden_id: id,
                distribuidor_id: ordenDetallada.distribuidorId ?? null,
                precio_anterior: precioAntes,
                precio_nuevo: precioDespues,
                costo_reparacion_anterior: ordenPrevia.costoReparacion ?? 0,
                costo_partes_anterior: ordenPrevia.costoPartes ?? 0,
                costo_reparacion_nuevo: Number(nuevoCostoRep ?? ordenPrevia.costoReparacion ?? 0),
                costo_partes_nuevo: Number(nuevoCostoPar ?? ordenPrevia.costoPartes ?? 0),
                cambiado_por: userId,
                motivo: "Cambio directo por admin",
                via: "admin_directo",
              });
            } catch (e) {
              console.error("[C7] Error al notificar cambio de precio al cliente (no bloquea):", e);
            }
          })();
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
        "esperando_piezas",
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

      // BUG-TRACK-001: Generar token de tracking si no existe para cualquier estado activo.
      // "presupuesto" ya crea el token via notificarCambioEstado → excluirlo para evitar duplicados.
      // "recibido", "cancelado", "no_reparable" → no necesitan tracking.
      const estadosSinTracking: EstadoOrdenReparacion[] = ["recibido", "presupuesto", "cancelado", "no_reparable"];
      if (!estadosSinTracking.includes(body.estado)) {
        try {
          const supabaseT = createAdminClient();
          const { data: existeToken } = await supabaseT
            .from("tracking_tokens")
            .select("id")
            .eq("orden_id", id)
            .limit(1)
            .maybeSingle();
          if (!existeToken) {
            const { randomBytes } = await import("crypto");
            const token = randomBytes(32).toString("hex");
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 90);
            await supabaseT.from("tracking_tokens").insert({
              orden_id: id,
              token,
              expires_at: expiresAt.toISOString(),
              activa: true,
              accesos: 0,
            });
          }
        } catch (tokenErr) {
          console.error("[TRACK-001] Error auto-generando tracking token (no bloquea):", tokenErr);
        }
      }

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

      // Si es no_reparable, verificar si hay piezas pendientes de resolución
      let piezasPendientesResolucion: { id: string; nombre: string; estado: string }[] = [];
      let piezasSinCatalogo: { id: string; nombre: string; costoEstimado: number }[] = [];

      if (body.estado === "no_reparable" || body.estado === "cancelado") {
        const supabase = createAdminClient();
        const { data: piezasPendientes } = await supabase
          .from("pedidos_pieza_reparacion")
          .select("id, nombre_pieza, estado, producto_id, costo_estimado")
          .eq("orden_id", id)
          .in("estado", ["pendiente", "en_camino", "recibida", "defectuosa"]);

        if (body.estado === "no_reparable") {
          piezasPendientesResolucion = (piezasPendientes ?? []).map((p: any) => ({
            id: p.id,
            nombre: p.nombre_pieza,
            estado: p.estado,
          }));
        }

        if (body.estado === "cancelado") {
          // Piezas ya llegadas (recibida/defectuosa) sin producto_id → sin catálogo
          const llegadas = (piezasPendientes ?? []).filter(
            (p: any) => ["recibida", "defectuosa"].includes(p.estado) && !p.producto_id
          );
          piezasSinCatalogo = llegadas.map((p: any) => ({
            id: p.id,
            nombre: p.nombre_pieza,
            costoEstimado: Number(p.costo_estimado ?? 0),
          }));

          // C1: Piezas instaladas del catálogo → devolver stock (fire-and-forget)
          const piezasInstaladas = (piezasPendientes ?? []).filter(
            (p: any) => ["instalada", "verificada_ok"].includes(p.estado) && p.producto_id
          );
          // También buscar instaladas (que no estaban en "pendiente/en_camino/recibida/defectuosa")
          const { data: instaladas } = await supabase
            .from("pedidos_pieza_reparacion")
            .select("id, producto_id, nombre_pieza")
            .eq("orden_id", id)
            .not("producto_id", "is", null)
            .in("estado", ["instalada", "verificada_ok"]);

          const todasInstaladas = [
            ...piezasInstaladas,
            ...(instaladas ?? []).filter((i: any) => !piezasInstaladas.find((p: any) => p.id === i.id)),
          ];

          for (const pieza of todasInstaladas) {
            const { data: prod } = await supabase.from("productos").select("stock").eq("id", pieza.producto_id).single();
            if (!prod) continue;
            const stockAntes = Number(prod.stock ?? 0);
            const stockDespues = stockAntes + 1;
            await supabase.from("productos").update({ stock: stockDespues }).eq("id", pieza.producto_id);
            await supabase.from("movimientos_stock").insert({
              producto_id: pieza.producto_id,
              distribuidor_id: distribuidorId ?? null,
              tipo: "cancelacion_reparacion",
              cantidad: 1,
              stock_antes: stockAntes,
              stock_despues: stockDespues,
              referencia_id: id,
              referencia_tipo: "orden_reparacion",
              registrado_por: userId,
              notas: `Pieza "${pieza.nombre_pieza}" devuelta al cancelar orden`,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: ordenActualizada,
        message: `Estado actualizado a "${body.estado}"`,
        notificaciones,
        ...(piezasPendientesResolucion.length > 0 ? { piezasPendientesResolucion } : {}),
        ...(piezasSinCatalogo.length > 0 ? { piezasSinCatalogo } : {}),
      });
    }

    // Caso 3: Actualizar campos sueltos (fechaEstimadaEntrega, requiereAprobacion, tecnicoId)
    if (body.fechaEstimadaEntrega !== undefined || body.requiereAprobacion !== undefined || body.tecnicoId !== undefined) {
      // Solo admin/super_admin puede reasignar técnico
      if (body.tecnicoId !== undefined && !["admin", "super_admin"].includes(role ?? "")) {
        return NextResponse.json({ success: false, error: "Solo admin puede reasignar técnicos" }, { status: 403 });
      }
      const supabase = createAdminClient();
      const patchData: Record<string, unknown> = {};
      if (body.fechaEstimadaEntrega !== undefined) {
        patchData.fecha_estimada_entrega = body.fechaEstimadaEntrega || null;
      }
      if (body.requiereAprobacion !== undefined) {
        patchData.requiere_aprobacion = body.requiereAprobacion;
      }
      if (body.tecnicoId !== undefined) {
        patchData.tecnico_id = body.tecnicoId || null;
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

    // Caso 4: Actualizar piezas cotizadas (B3) + recalcular precio_total
    if (body.piezasCotizacion !== undefined) {
      if (role !== "admin" && role !== "super_admin" && role !== "tecnico") {
        return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
      }
      const supabase = createAdminClient();
      const piezas = Array.isArray(body.piezasCotizacion) ? body.piezasCotizacion : [];
      const nuevoPrecioPiezas = piezas.reduce(
        (s: number, p: any) => s + Number(p.precioTotal ?? p.precio_total ?? 0),
        0
      );
      // Obtener precio_mano_obra actual para no pisarlo
      const { data: ordenActual } = await supabase
        .from("ordenes_reparacion")
        .select("precio_mano_obra")
        .eq("id", id)
        .single();
      const manoObra = Number(ordenActual?.precio_mano_obra ?? 0);
      const nuevoTotal = manoObra + nuevoPrecioPiezas;
      const { data, error } = await supabase
        .from("ordenes_reparacion")
        .update({
          piezas_cotizacion: piezas,
          precio_piezas: nuevoPrecioPiezas,
          precio_total: nuevoTotal,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, data, message: "Cotización actualizada" });
    }

    // Si no hay cambios específicos, retornar error
    return NextResponse.json(
      {
        success: false,
        error: "Datos insuficientes",
        message:
          "Debe proporcionar 'diagnostico', 'estado', 'fechaEstimadaEntrega', 'requiereAprobacion', 'tecnicoId' o 'piezasCotizacion' para actualizar la orden",
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
    await supabase.from("pedidos_pieza_reparacion").delete().eq("orden_id", id);
    await supabase.from("movimientos_bolsa_virtual").delete().eq("orden_id", id);
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
