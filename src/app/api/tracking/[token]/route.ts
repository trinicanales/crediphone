import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrdenReparacionById,
  aprobarPresupuesto,
  aprobarPresupuestoParcial,
  cambiarEstadoOrden,
  getHistorialEstadosOrden,
} from "@/lib/db/reparaciones";
import { crearNotificacionTecnico } from "@/lib/db/notificaciones";

/**
 * GET /api/tracking/[token]
 * Obtiene información de una orden usando el token público
 * NO REQUIERE AUTENTICACIÓN - Acceso público
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 64) {
      return NextResponse.json(
        {
          success: false,
          error: "Token inválido",
          message: "El token proporcionado no es válido",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Buscar el token en la base de datos
    const { data: trackingData, error: trackingError } = await supabase
      .from("tracking_tokens")
      .select("orden_id, expires_at, accesos")
      .eq("token", token)
      .single();

    if (trackingError || !trackingData) {
      return NextResponse.json(
        {
          success: false,
          error: "Link inválido o expirado",
          message: "El link de tracking no existe o ha expirado",
        },
        { status: 404 }
      );
    }

    // Verificar si el token ha expirado
    if (trackingData.expires_at) {
      const expirationDate = new Date(trackingData.expires_at);
      if (expirationDate < new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: "Link expirado",
            message: "Este link de tracking ha expirado",
          },
          { status: 410 }
        );
      }
    }

    // Incrementar contador de accesos
    await supabase
      .from("tracking_tokens")
      .update({ accesos: trackingData.accesos + 1 })
      .eq("token", token);

    // Obtener información de la orden
    const orden = await getOrdenReparacionById(trackingData.orden_id);

    if (!orden) {
      return NextResponse.json(
        {
          success: false,
          error: "Orden no encontrada",
          message: "La orden asociada a este tracking no existe",
        },
        { status: 404 }
      );
    }

    // Obtener información del cliente (solo datos básicos + consentimiento FASE 27)
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nombre, apellido, acepta_promociones_whatsapp, preferencias_promociones")
      .eq("id", orden.clienteId)
      .single();

    // Obtener información del técnico (solo nombre)
    const { data: tecnico } = await supabase
      .from("users")
      .select("name")
      .eq("id", orden.tecnicoId)
      .single();

    // FASE 3: Obtener historial de estados para timeline
    let historial: any[] = [];
    try {
      historial = await getHistorialEstadosOrden(trackingData.orden_id);
    } catch (error) {
      console.error("Error al obtener historial (no crítico):", error);
      // Continuar sin historial si falla
    }

    // FASE 3: Obtener anticipos (opcional)
    const { data: anticipos } = await supabase
      .from("anticipos_reparacion")
      .select("monto, tipo_pago, fecha_anticipo, notas")
      .eq("orden_id", trackingData.orden_id)
      .order("fecha_anticipo", { ascending: false });

    const totalAnticipos = anticipos?.reduce((sum, a) => sum + Number(a.monto), 0) || 0;

    // Retornar solo información pública (sin datos sensibles)
    return NextResponse.json({
      success: true,
      data: {
        orden: {
          id: orden.id,
          folio: orden.folio,
          estado: orden.estado,
          marcaDispositivo: orden.marcaDispositivo,
          modeloDispositivo: orden.modeloDispositivo,
          imei: orden.imei,
          problemaReportado: orden.problemaReportado,
          diagnosticoTecnico: orden.diagnosticoTecnico,
          costoReparacion: orden.costoReparacion,
          costoPartes: orden.costoPartes,
          costoTotal: orden.costoTotal,
          partesReemplazadas: orden.partesReemplazadas,
          fechaRecepcion: orden.fechaRecepcion,
          fechaEstimadaEntrega: orden.fechaEstimadaEntrega,
          fechaCompletado: orden.fechaCompletado,
          prioridad: orden.prioridad,
          requiereAprobacion: orden.requiereAprobacion,
          aprobadoPorCliente: orden.aprobadoPorCliente,
          esGarantia: orden.esGarantia,
          totalAnticipos,
          saldoPendiente: orden.costoTotal - totalAnticipos,
        },
        cliente: {
          nombre: cliente?.nombre || "",
          apellido: cliente?.apellido || "",
          // Consentimiento FASE 27 (para mostrar promociones en tracking)
          aceptaPromociones: cliente?.acepta_promociones_whatsapp ?? false,
          preferenciasPromociones: cliente?.preferencias_promociones ?? {},
        },
        tecnico: {
          nombre: tecnico?.name || "",
        },
        historial,
        anticipos: anticipos || [],
      },
    });
  } catch (error) {
    console.error("Error en GET /api/tracking/[token]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener tracking",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tracking/[token]
 * Permite al cliente aprobar o rechazar presupuesto desde el tracking público
 * NO REQUIERE AUTENTICACIÓN - Acceso público
 *
 * Body:
 * - accion: "aprobar" | "rechazar"
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();

    if (!token || token.length !== 64) {
      return NextResponse.json(
        {
          success: false,
          error: "Token inválido",
          message: "El token proporcionado no es válido",
        },
        { status: 400 }
      );
    }

    if (!body.accion || !["aprobar", "aprobar_parcial", "rechazar"].includes(body.accion)) {
      return NextResponse.json(
        {
          success: false,
          error: "Acción inválida",
          message: 'La acción debe ser "aprobar", "aprobar_parcial" o "rechazar"',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validar token y obtener orden_id
    const { data: trackingData, error: trackingError } = await supabase
      .from("tracking_tokens")
      .select("orden_id, expires_at")
      .eq("token", token)
      .single();

    if (trackingError || !trackingData) {
      return NextResponse.json(
        {
          success: false,
          error: "Token inválido",
          message: "El link de tracking no existe o ha expirado",
        },
        { status: 404 }
      );
    }

    // Verificar expiración
    if (trackingData.expires_at) {
      const expirationDate = new Date(trackingData.expires_at);
      if (expirationDate < new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: "Link expirado",
            message: "Este link de tracking ha expirado",
          },
          { status: 410 }
        );
      }
    }

    // Obtener orden
    const orden = await getOrdenReparacionById(trackingData.orden_id);

    if (!orden) {
      return NextResponse.json(
        {
          success: false,
          error: "Orden no encontrada",
        },
        { status: 404 }
      );
    }

    // Verificar que la orden esté en estado "presupuesto"
    if (orden.estado !== "presupuesto") {
      return NextResponse.json(
        {
          success: false,
          error: "Estado incorrecto",
          message: `Esta orden ya no requiere aprobación. Estado actual: ${orden.estado}`,
        },
        { status: 400 }
      );
    }

    if (body.accion === "aprobar") {
      // Aprobar presupuesto
      await aprobarPresupuesto(trackingData.orden_id);

      // FASE 3: Crear notificación para el técnico
      try {
        await crearNotificacionTecnico({
          ordenId: trackingData.orden_id,
          tecnicoId: orden.tecnicoId!,
          tipo: "cliente_aprobo",
          folio: orden.folio,
          mensaje: `✅ El cliente aprobó el presupuesto del folio ${orden.folio}. Puedes proceder con la reparación.`,
        });
      } catch (error) {
        console.error("Error al crear notificación (no crítico):", error);
        // Continuar aunque falle la notificación
      }

      return NextResponse.json({
        success: true,
        message:
          "Presupuesto aprobado exitosamente. El técnico ha sido notificado y procederá con la reparación.",
      });
    } else if (body.accion === "aprobar_parcial") {
      // Aprobación parcial: cliente acepta solo el problema original
      await aprobarPresupuestoParcial(trackingData.orden_id, body.notasCliente);

      try {
        await crearNotificacionTecnico({
          ordenId: trackingData.orden_id,
          tecnicoId: orden.tecnicoId!,
          tipo: "cliente_aprobo",
          folio: orden.folio,
          mensaje: `⚠️ El cliente del folio ${orden.folio} SOLO aprobó el problema original. NO autoriza reparaciones adicionales del diagnóstico. Por favor revisa las indicaciones antes de proceder.`,
        });
      } catch (error) {
        console.error("Error al crear notificación (no crítico):", error);
      }

      return NextResponse.json({
        success: true,
        message:
          "Has aprobado únicamente el problema original. El técnico fue notificado de proceder solo con eso. Gracias.",
      });
    } else if (body.accion === "rechazar") {
      // Rechazar presupuesto = cancelar orden
      await cambiarEstadoOrden(
        trackingData.orden_id,
        "cancelado",
        "Cliente rechazó presupuesto desde tracking público"
      );

      // FASE 3: Crear notificación para el técnico
      try {
        await crearNotificacionTecnico({
          ordenId: trackingData.orden_id,
          tecnicoId: orden.tecnicoId!,
          tipo: "cliente_rechazo",
          folio: orden.folio,
          mensaje: `❌ El cliente rechazó el presupuesto del folio ${orden.folio}. La orden ha sido cancelada.`,
        });
      } catch (error) {
        console.error("Error al crear notificación (no crítico):", error);
        // Continuar aunque falle la notificación
      }

      return NextResponse.json({
        success: true,
        message:
          "Presupuesto rechazado. La orden ha sido cancelada. Gracias por tu respuesta.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Acción no procesada",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en POST /api/tracking/[token]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al procesar solicitud",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
