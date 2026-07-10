import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSaldoPuntos } from "@/lib/db/puntos";

/**
 * GET /api/cliente/perfil
 * Requiere cookie `cliente_sesion` con un token válido.
 * Devuelve: datos del cliente, órdenes, garantías activas, créditos, puntos,
 *           y configuración de la franquicia (nombre, WA) para el portal.
 *
 * IMPORTANTE: el cliente NUNCA debe ver costo_total (costo interno) — solo precio_total
 * (lo que paga). Ver .claude/REGLAS-NEGOCIO.md sección "PRECIO AL CLIENTE vs COSTO INTERNO".
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
    const [clienteRes, ordenesRes, garantiasRes, creditosRes, saldoPuntos, configRes] =
      await Promise.all([
        // Datos básicos del cliente (scoring vive en tabla separada scoring_clientes)
        supabase
          .from("clientes")
          .select("id, nombre, apellido, telefono, email")
          .eq("id", cliente_id)
          .maybeSingle(),

        // Todas las órdenes de reparación — precio_total (lo que paga el cliente), NUNCA costo_total
        supabase
          .from("ordenes_reparacion")
          .select(
            "id, folio, estado, marca_dispositivo, modelo_dispositivo, imei, precio_total, fecha_recepcion, fecha_completado, es_garantia"
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

        // Créditos (excluye apartados — tipo="credito")
        supabase
          .from("creditos")
          .select(
            "id, folio, monto, estado, fecha_inicio, tasa_interes, plazo, tipo"
          )
          .eq("cliente_id", cliente_id)
          .eq("distribuidor_id", distribuidor_id)
          .order("fecha_inicio", { ascending: false })
          .limit(20),

        // Puntos disponibles (helper centralizado — respeta el corte anual)
        getSaldoPuntos(cliente_id, distribuidor_id),

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
      precioTotal: o.precio_total ?? 0,
      fechaRecepcion: o.fecha_recepcion,
      fechaCompletado: o.fecha_completado,
      esGarantia: o.es_garantia ?? false,
      garantiaActiva: garantiasPorOrden.get(o.id) ?? null,
    }));

    // Créditos activos reales (excluye apartados, que son tipo="apartado" en la misma tabla)
    const creditosReales = (creditosRes.data ?? []).filter((c) => (c.tipo ?? "credito") === "credito");

    // saldo_pendiente no es una columna — se calcula como monto - total pagado (igual que getCarteraVencida)
    const creditoIds = creditosReales.map((c) => c.id);
    const pagosPorCredito: Record<string, number> = {};
    if (creditoIds.length > 0) {
      const { data: pagosData } = await supabase
        .from("pagos")
        .select("credito_id, monto")
        .in("credito_id", creditoIds)
        .not("estado", "eq", "cancelado");
      for (const p of pagosData ?? []) {
        pagosPorCredito[p.credito_id] = (pagosPorCredito[p.credito_id] ?? 0) + Number(p.monto);
      }
    }

    const creditos = creditosReales.map((c) => {
      const monto = Number(c.monto) || 0;
      const totalPagado = pagosPorCredito[c.id] ?? 0;
      return {
        id: c.id,
        folio: c.folio,
        monto,
        saldoPendiente: Math.max(0, monto - totalPagado),
        estado: c.estado,
        fechaInicio: c.fecha_inicio,
        tasaInteres: c.tasa_interes ?? 0,
        plazo: c.plazo ?? 0,
      };
    });

    const puntos = {
      disponibles: saldoPuntos.saldoDisponible,
      acumulados: saldoPuntos.totalGanado,
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
