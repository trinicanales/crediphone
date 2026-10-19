import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfiguracion } from "@/lib/db/configuracion";

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

function soloDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/**
 * POST /api/reparacion/[folio]
 * Body: { ultimos4: "1234" } — ultimos 4 digitos del telefono del cliente.
 * Si coinciden, devuelve el token del seguimiento completo. Limitado a 5 intentos
 * fallidos por folio (bloqueo de 15 min) para evitar recorrer folios/telefonos.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ folio: string }> }
) {
  try {
    const { folio: folioRaw } = await params;
    const folio = (folioRaw ?? "").toUpperCase();
    const body = await request.json().catch(() => ({}));
    const ultimos4 = soloDigitos(body?.ultimos4);

    if (!folio || ultimos4.length !== 4) {
      return NextResponse.json(
        { success: false, message: "Ingresa los últimos 4 dígitos de tu teléfono" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: intento } = await supabase
      .from("tracking_intentos")
      .select("intentos, bloqueado_hasta")
      .eq("folio", folio)
      .maybeSingle();

    if (intento?.bloqueado_hasta && new Date(intento.bloqueado_hasta) > new Date()) {
      return NextResponse.json(
        { success: false, message: "Demasiados intentos. Intenta de nuevo en unos minutos o usa el link que te enviamos." },
        { status: 429 }
      );
    }

    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id, cliente:clientes(telefono)")
      .eq("folio", folio)
      .maybeSingle();

    const telefono = soloDigitos((orden?.cliente as any)?.telefono);
    const coincide = !!orden && telefono.length >= 4 && telefono.slice(-4) === ultimos4;

    if (!coincide) {
      const intentos = (intento?.intentos ?? 0) + 1;
      await supabase.from("tracking_intentos").upsert({
        folio,
        intentos: intentos >= MAX_INTENTOS ? 0 : intentos,
        bloqueado_hasta:
          intentos >= MAX_INTENTOS
            ? new Date(Date.now() + BLOQUEO_MIN * 60_000).toISOString()
            : null,
        distribuidor_id: (orden as any)?.distribuidor_id ?? null,
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { success: false, message: "Los dígitos no coinciden" },
        { status: 403 }
      );
    }

    const { data: tokenData } = await supabase
      .from("tracking_tokens")
      .select("token")
      .eq("orden_id", orden!.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenData) {
      return NextResponse.json(
        { success: false, message: "Esta orden aún no tiene seguimiento completo" },
        { status: 404 }
      );
    }

    await supabase.from("tracking_intentos").delete().eq("folio", folio);
    return NextResponse.json({ success: true, data: { trackingToken: tokenData.token } });
  } catch (error) {
    console.error("Error en POST /api/reparacion/[folio]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

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
        distribuidor_id,
        cliente:clientes(nombre, telefono),
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

    // El token NUNCA se devuelve aqui (los folios son consecutivos y adivinables).
    // Solo indicamos si existe seguimiento completo verificable con el telefono del cliente.
    const { data: tokenData } = await supabase
      .from("tracking_tokens")
      .select("id")
      .eq("orden_id", orden.id)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    const telefonoDigitos = soloDigitos((orden.cliente as any)?.telefono);
    const requiereVerificacion = !!tokenData && telefonoDigitos.length >= 4;

    // Obtener datos del distribuidor de la orden (nombre y WhatsApp)
    let whatsappSoporte = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391";
    let nombreEmpresa = "CREDIPHONE";
    try {
      const config = await getConfiguracion((orden as any).distribuidor_id ?? null);
      if (config.whatsappNumero) whatsappSoporte = config.whatsappNumero;
      if (config.nombreEmpresa) nombreEmpresa = config.nombreEmpresa;
    } catch {
      // No crítico
    }

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
        // Solo primer nombre: el folio es publico
        clienteNombre: orden.cliente
          ? String((orden.cliente as any).nombre ?? "").trim().split(/\s+/)[0] || undefined
          : undefined,
        tecnicoNombre: orden.tecnico ? (orden.tecnico as any).name : undefined,
        historial: historial || [],
        requiereVerificacion,
        whatsappSoporte,
        nombreEmpresa,
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
