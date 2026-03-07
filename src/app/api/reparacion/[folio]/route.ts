import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reparacion/[folio]
 * Obtiene información pública de una orden por folio.
 * NO requiere autenticación — usada por la página de tracking del QR del contrato.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folio: string }> }
) {
  try {
    const { folio } = await params;

    if (!folio) {
      return NextResponse.json(
        { success: false, message: "Folio requerido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Buscar la orden por folio — solo campos públicos
    const { data: orden, error } = await supabase
      .from("ordenes_reparacion")
      .select(`
        id,
        folio,
        estado,
        marca_dispositivo,
        modelo_dispositivo,
        problema_reportado,
        diagnostico_tecnico,
        prioridad,
        fecha_recepcion,
        fecha_estimada_entrega,
        fecha_completado,
        es_garantia,
        costo_total,
        precio_total,
        requiere_aprobacion,
        aprobado_por_cliente,
        aprobacion_parcial,
        cliente:clientes(nombre, apellido),
        tecnico:users!ordenes_reparacion_tecnico_id_fkey(name)
      `)
      .eq("folio", folio.toUpperCase())
      .single();

    if (error || !orden) {
      return NextResponse.json(
        { success: false, message: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Buscar token de tracking si existe (para mostrar link completo)
    const { data: tokenData } = await supabase
      .from("tracking_tokens")
      .select("token, expires_at")
      .eq("orden_id", orden.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Obtener historial de estados (solo los campos públicos)
    const { data: historial } = await supabase
      .from("historial_estado_orden")
      .select("estado_nuevo, estado_anterior, comentario, created_at")
      .eq("orden_id", orden.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        folio: orden.folio,
        estado: orden.estado,
        marcaDispositivo: orden.marca_dispositivo,
        modeloDispositivo: orden.modelo_dispositivo,
        problemaReportado: orden.problema_reportado,
        diagnosticoTecnico: orden.diagnostico_tecnico,
        prioridad: orden.prioridad,
        fechaRecepcion: orden.fecha_recepcion,
        fechaEstimadaEntrega: orden.fecha_estimada_entrega,
        fechaCompletado: orden.fecha_completado,
        esGarantia: orden.es_garantia,
        costoTotal: orden.costo_total || orden.precio_total || 0,
        requiereAprobacion: orden.requiere_aprobacion,
        aprobadoPorCliente: orden.aprobado_por_cliente,
        aprobacionParcial: orden.aprobacion_parcial,
        clienteNombre: orden.cliente
          ? `${(orden.cliente as any).nombre} ${(orden.cliente as any).apellido}`
          : undefined,
        tecnicoNombre: orden.tecnico ? (orden.tecnico as any).name : undefined,
        historial: historial || [],
        trackingToken: tokenData?.token || null,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/reparacion/[folio]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
