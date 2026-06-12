import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cliente/perfil
 * Requiere cookie `cliente_sesion` con un token válido.
 * Devuelve: datos del cliente, órdenes, garantías activas, créditos, puntos,
 *           y configuración de la franquicia (nombre, WA) para el portal.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("cliente_sesion")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const ahora = new Date().toISOString();

    // Validar token
    const { data: tokenRecord } = await supabase
      .from("tokens_acceso_cliente")
      .select("id, cliente_id, distribuidor_id, expira_en")
      .eq("token", token)
      .gt("expira_en", ahora)
      .maybeSingle();

    if (!tokenRecord) {
      return NextResponse.json({ success: false, error: "Sesión inválida o expirada" }, { status: 401 });
    }

    const { cliente_id, distribuidor_id } = tokenRecord;

    // Cargar en paralelo
    const [clienteRes, ordenesRes, garantiasRes, creditosRes, puntosRes, configRes] =
      await Promise.all([
        // Datos básicos del cliente
        supabase
          .from("clientes")
          .select("id, nombre, apellido, telefono, email, scoring")
          .eq("id", cliente_id)
          .maybeSingle(),

        // Todas las órdenes de reparación
        supabase
          .from("ordenes_reparacion")
          .select(
            "id, folio, estado, marca_dispositivo, modelo_dispositivo, imei, costo_total, fecha_recepcion, fecha_completado, es_garantia"
          )
          .eq("cliente_id", cliente_id)
          .eq("distribuidor_id", distribuidor_id)
          .order("fecha_recepcion", { ascending: false })
          .limit(50),

        // Garantías activas
        supabase
          .from("garantias_reparacion")
          .select("id, orden_id, dias_garantia, fecha_vencimiento, estado")
          .eq("distribuidor_id", distribuidor_id)
          .eq("estado", "activa")
          .gt("fecha_vencimiento", ahora),

        // Créditos
        supabase
          .from("creditos")
          .select(
            "id, folio, monto, saldo_pendiente, estado, fecha_inicio, tasa_interes, plazo_semanas"
          )
          .eq("cliente_id", cliente_id)
          .eq("distribuidor_id", distribuidor_id)
          .order("fecha_inicio", { ascending: false })
          .limit(20),

        // Puntos disponibles
        supabase
          .from("puntos_cliente")
          .select("puntos_disponibles, puntos_acumulados_total")
          .eq("cliente_id", cliente_id)
          .eq("distribuidor_id", distribuidor_id)
          .maybeSingle(),

        // Config de la franquicia (nombre, WA)
        supabase
          .from("configuracion")
          .select("nombre_empresa, whatsapp_numero")
          .eq("distribuidor_id", distribuidor_id)
          .maybeSingle(),
      ]);

    if (!clienteRes.data) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    // Construir mapa de garantías activas por orden_id
    const garantiasPorOrden = new Map<string, { diasGarantia: number; fechaVencimiento: string }>();
    for (const g of garantiasRes.data ?? []) {
      garantiasPorOrden.set(g.orden_id, {
        diasGarantia: g.dias_garantia,
        fechaVencimiento: g.fecha_vencimiento,
      });
    }

    const ordenes = (ordenesRes.data ?? []).map((o) => ({
      id: o.id,
      folio: o.folio,
      estado: o.estado,
      marcaDispositivo: o.marca_dispositivo,
      modeloDispositivo: o.modelo_dispositivo,
      imei: o.imei,
      costoTotal: o.costo_total ?? 0,
      fechaRecepcion: o.fecha_recepcion,
      fechaCompletado: o.fecha_completado,
      esGarantia: o.es_garantia ?? false,
      garantiaActiva: garantiasPorOrden.get(o.id) ?? null,
    }));

    const creditos = (creditosRes.data ?? []).map((c) => ({
      id: c.id,
      folio: c.folio,
      monto: c.monto,
      saldoPendiente: c.saldo_pendiente ?? 0,
      estado: c.estado,
      fechaInicio: c.fecha_inicio,
      tasaInteres: c.tasa_interes ?? 0,
      plazoSemanas: c.plazo_semanas ?? 0,
    }));

    const puntos = {
      disponibles: puntosRes.data?.puntos_disponibles ?? 0,
      acumulados: puntosRes.data?.puntos_acumulados_total ?? 0,
    };

    const config = {
      nombreEmpresa: configRes.data?.nombre_empresa ?? "CREDIPHONE",
      whatsappNumero: configRes.data?.whatsapp_numero ?? null,
    };

    return NextResponse.json({
      success: true,
      data: {
        cliente: {
          id: clienteRes.data.id,
          nombre: clienteRes.data.nombre,
          apellido: clienteRes.data.apellido,
          telefono: clienteRes.data.telefono,
          email: clienteRes.data.email,
          scoring: clienteRes.data.scoring,
        },
        ordenes,
        creditos,
        puntos,
        config,
      },
    });
  } catch (error) {
    console.error("[cliente/perfil] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
