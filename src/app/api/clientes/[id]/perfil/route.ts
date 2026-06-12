import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";

/**
 * GET /api/clientes/[id]/perfil
 * Perfil completo del cliente: reparaciones, garantías activas, créditos, pagos recientes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: clienteId } = await params;
    const supabase = createAdminClient();

    // Datos del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, nombre, apellido, telefono, email, distribuidor_id, scoring, puntos_disponibles, puntos_acumulados")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    // Validar aislamiento por franquicia
    if (!isSuperAdmin && distribuidorId && cliente.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const filterDist = !isSuperAdmin && distribuidorId ? distribuidorId : null;

    // Órdenes de reparación (todas)
    let ordenesQuery = supabase
      .from("ordenes_reparacion")
      .select("id, folio, estado, marca_dispositivo, modelo_dispositivo, imei, costo_total, fecha_recepcion, fecha_completado, tecnico_id, distribuidor_id, es_garantia")
      .eq("cliente_id", clienteId)
      .order("fecha_recepcion", { ascending: false });
    if (filterDist) ordenesQuery = ordenesQuery.eq("distribuidor_id", filterDist);
    const { data: ordenes } = await ordenesQuery;

    // Garantías activas del cliente
    const hoy = new Date().toISOString();
    const { data: garantias } = await supabase
      .from("garantias_reparacion")
      .select("id, orden_id, dias_garantia, fecha_vencimiento, estado, tipo_garantia")
      .eq("cliente_id", clienteId)
      .eq("estado", "activa")
      .gte("fecha_vencimiento", hoy);

    // Créditos
    let creditosQuery = supabase
      .from("creditos")
      .select("id, folio, monto, saldo_pendiente, estado, fecha_inicio, tasa_interes, plazo_semanas")
      .eq("cliente_id", clienteId)
      .order("fecha_inicio", { ascending: false });
    if (filterDist) creditosQuery = creditosQuery.eq("distribuidor_id", filterDist);
    const { data: creditos } = await creditosQuery;

    // Últimos 20 pagos (via créditos del cliente)
    let pagosData: any[] = [];
    if (creditos && creditos.length > 0) {
      const creditoIds = creditos.map((c: any) => c.id);
      const { data: pagos } = await supabase
        .from("pagos")
        .select("id, monto, fecha_pago, metodo_pago, credito_id")
        .in("credito_id", creditoIds)
        .order("fecha_pago", { ascending: false })
        .limit(20);
      pagosData = pagos || [];
    }

    // Construir mapa de garantías por orden_id
    const garantiasMap = new Map<string, { diasGarantia: number; fechaVencimiento: string }>();
    (garantias || []).forEach((g: any) => {
      garantiasMap.set(g.orden_id, {
        diasGarantia: g.dias_garantia,
        fechaVencimiento: g.fecha_vencimiento,
      });
    });

    const ordenesConGarantia = (ordenes || []).map((o: any) => ({
      id: o.id,
      folio: o.folio,
      estado: o.estado,
      marcaDispositivo: o.marca_dispositivo,
      modeloDispositivo: o.modelo_dispositivo,
      imei: o.imei,
      costoTotal: parseFloat(o.costo_total || "0"),
      fechaRecepcion: o.fecha_recepcion,
      fechaCompletado: o.fecha_completado,
      esGarantia: o.es_garantia,
      garantiaActiva: garantiasMap.has(o.id) ? garantiasMap.get(o.id) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          telefono: cliente.telefono,
          email: cliente.email,
          scoring: cliente.scoring,
          puntosDisponibles: cliente.puntos_disponibles ?? 0,
          puntosAcumulados: cliente.puntos_acumulados ?? 0,
        },
        ordenes: ordenesConGarantia,
        creditos: (creditos || []).map((c: any) => ({
          id: c.id,
          folio: c.folio,
          monto: parseFloat(c.monto),
          saldoPendiente: parseFloat(c.saldo_pendiente || "0"),
          estado: c.estado,
          fechaInicio: c.fecha_inicio,
          tasaInteres: c.tasa_interes,
          plazoSemanas: c.plazo_semanas,
        })),
        pagos: pagosData.map((p: any) => ({
          id: p.id,
          monto: parseFloat(p.monto),
          fechaPago: p.fecha_pago,
          metodoPago: p.metodo_pago,
          creditoId: p.credito_id,
        })),
        stats: {
          totalReparaciones: ordenesConGarantia.length,
          reparacionesActivas: ordenesConGarantia.filter((o) =>
            !["entregado", "cancelado", "no_reparable"].includes(o.estado)
          ).length,
          garantiasActivas: garantias?.length ?? 0,
          creditosActivos: (creditos || []).filter((c: any) => c.estado === "activo").length,
        },
      },
    });
  } catch (error) {
    console.error("[perfil] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
