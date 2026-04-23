import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reparaciones/[id]/pedidos-pieza
 * Lista los pedidos de piezas de una orden.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: ordenId } = await params;
    const supabase = createAdminClient();

    // Verify access to the order
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("pedidos_pieza_reparacion")
      .select(`
        id, nombre_pieza, costo_estimado, costo_envio, estado,
        created_at, fecha_recibida, notas, producto_id,
        foto_comprobante_url, financiado_por, monto_de_caja,
        creadoPor:creado_por (name),
        recibidoPor:recibido_por (name)
      `)
      .eq("orden_id", ordenId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const mapped = (data || []).map((p: any) => ({
      id: p.id,
      nombrePieza: p.nombre_pieza,
      costoEstimado: Number(p.costo_estimado || 0),
      costoEnvio: Number(p.costo_envio || 0),
      estado: p.estado,
      createdAt: p.created_at,
      fechaRecibida: p.fecha_recibida,
      notas: p.notas,
      productoId: p.producto_id,
      fotoComprobanteUrl: p.foto_comprobante_url ?? null,
      financiadoPor: p.financiado_por ?? "bolsa",
      montoDeCaja: Number(p.monto_de_caja || 0),
      creadoPorNombre: p.creadoPor?.name ?? null,
      recibidoPorNombre: p.recibidoPor?.name ?? null,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/reparaciones/[id]/pedidos-pieza
 * Crea un nuevo pedido de pieza para la orden.
 * Body: { nombrePieza, costoEstimado, costoEnvio?, notas?, productoId?, recibirInmediatamente?, fotoComprobanteUrl? }
 *
 * Lógica de bolsa virtual:
 * - Si anticipo disponible >= costo total → financiado_por='bolsa'
 * - Si anticipo < costo total → diferencia la financia la caja (financiado_por='mixto' o 'caja')
 * - Se registra movimiento tipo='gasto_pieza' en movimientos_bolsa_virtual
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: ordenId } = await params;
    const body = await request.json();
    const {
      nombrePieza,
      costoEstimado = 0,
      costoEnvio = 0,
      notas,
      productoId,
      recibirInmediatamente = false,
      fotoComprobanteUrl,
    } = body;

    if (!nombrePieza?.trim()) {
      return NextResponse.json({ success: false, error: "nombrePieza es requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify order access
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    // Calcular financiamiento (bolsa vs caja)
    const costoTotal = (Number(costoEstimado) || 0) + (Number(costoEnvio) || 0);

    // Total anticipos disponibles para esta orden
    const { data: anticipos } = await supabase
      .from("anticipos_reparacion")
      .select("monto")
      .eq("orden_id", ordenId)
      .neq("estado", "devuelto");

    const totalAnticipos = (anticipos || []).reduce(
      (sum: number, a: any) => sum + Number(a.monto || 0),
      0
    );

    // Gastos previos de bolsa para esta orden
    const { data: gastosExistentes } = await supabase
      .from("movimientos_bolsa_virtual")
      .select("monto")
      .eq("orden_id", ordenId)
      .eq("tipo", "gasto_pieza");

    const totalGastado = (gastosExistentes || []).reduce(
      (sum: number, g: any) => sum + Number(g.monto || 0),
      0
    );

    const saldoDisponible = Math.max(0, totalAnticipos - totalGastado);

    let financiadoPor: "bolsa" | "caja" | "mixto" = "bolsa";
    let montoDeCaja = 0;

    if (costoTotal <= 0) {
      financiadoPor = "bolsa";
      montoDeCaja = 0;
    } else if (saldoDisponible >= costoTotal) {
      financiadoPor = "bolsa";
      montoDeCaja = 0;
    } else if (saldoDisponible <= 0) {
      financiadoPor = "caja";
      montoDeCaja = costoTotal;
    } else {
      financiadoPor = "mixto";
      montoDeCaja = costoTotal - saldoDisponible;
    }

    const estadoInicial = recibirInmediatamente ? "recibida" : "pendiente";
    const ahora = new Date().toISOString();

    const { data: pedido, error } = await supabase
      .from("pedidos_pieza_reparacion")
      .insert({
        orden_id: ordenId,
        distribuidor_id: orden.distribuidor_id,
        nombre_pieza: nombrePieza.trim(),
        costo_estimado: Number(costoEstimado) || 0,
        costo_envio: Number(costoEnvio) || 0,
        estado: estadoInicial,
        creado_por: userId,
        notas: notas?.trim() || null,
        producto_id: productoId || null,
        foto_comprobante_url: fotoComprobanteUrl || null,
        financiado_por: financiadoPor,
        monto_de_caja: montoDeCaja,
        ...(recibirInmediatamente ? { fecha_recibida: ahora, recibido_por: userId } : {}),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Registrar gasto en bolsa virtual
    if (costoTotal > 0) {
      await supabase.from("movimientos_bolsa_virtual").insert({
        orden_id: ordenId,
        distribuidor_id: orden.distribuidor_id,
        tipo: "gasto_pieza",
        monto: costoTotal,
        concepto: `Pieza: ${nombrePieza.trim()} (costo $${Number(costoEstimado).toFixed(2)} + envío $${Number(costoEnvio).toFixed(2)})`,
        pedido_pieza_id: pedido.id,
        registrado_por: userId,
      });
    }

    // Si se recibe inmediatamente, agregar a reparacion_piezas
    if (recibirInmediatamente) {
      await supabase.from("reparacion_piezas").insert({
        orden_id: ordenId,
        nombre_pieza: nombrePieza.trim(),
        cantidad: 1,
        costo_unitario: Number(costoEstimado) || 0,
        producto_id: productoId || null,
      });

      if (productoId) {
        await supabase.rpc("incrementar_stock", { p_producto_id: productoId, p_cantidad: 1 }).maybeSingle();
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: pedido.id,
        estado: pedido.estado,
        financiadoPor,
        montoDeCaja,
        saldoDisponible,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
