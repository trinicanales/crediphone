/**
 * POST /api/reparaciones/[id]/entregar
 *
 * Cobro final + entrega del equipo.
 * - Calcula saldo pendiente (total - anticipos aplicados)
 * - Calcula ingreso_neto = precio_total - sum(costo_pieza + costo_envio)
 * - Si caja financió piezas (monto_de_caja > 0) → registra reembolso a caja primero
 * - Registra ingreso_neto en movimientos_bolsa_virtual
 * - Registra el saldo en caja
 * - Marca todos los anticipos pendientes como "aplicado"
 * - Cambia el estado de la orden a "entregado"
 * - Registra en historial
 */
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicarAnticiposOrden } from "@/lib/db/reparaciones";
import { getSesionActiva } from "@/lib/db/caja";
import { ejecutarEfectosEntrega } from "@/lib/reparaciones/entrega";
import type { TipoPago } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const permitidos = ["admin", "super_admin", "vendedor", "cobrador"];
    if (!permitidos.includes(role || "")) {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    // SEGURIDAD: validar que la orden pertenece al distribuidor del usuario
    if (!isSuperAdmin) {
      const supabaseCheck = createAdminClient();
      const { data: chk } = await supabaseCheck.from("ordenes_reparacion").select("distribuidor_id").eq("id", id).single();
      if (!chk || chk.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
    }

    const body = await request.json();
    const metodoPago: TipoPago = body.metodoPago || "efectivo";

    const supabase = createAdminClient();

    // 1. Obtener la orden
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("id, folio, estado, precio_total, costo_total, distribuidor_id, cliente_id")
      .eq("id", id)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    const estadosValidos = ["listo_entrega", "completado", "aprobado", "en_reparacion"];
    if (!estadosValidos.includes(orden.estado)) {
      return NextResponse.json({
        success: false,
        error: `No se puede entregar una orden en estado "${orden.estado}"`,
      }, { status: 400 });
    }

    // 2. Calcular totales de anticipos pendientes
    const { data: anticiposPendientes } = await supabase
      .from("anticipos_reparacion")
      .select("id, monto")
      .eq("orden_id", id)
      .eq("estado", "pendiente");

    const totalAnticipos = (anticiposPendientes || []).reduce(
      (sum: number, a: any) => sum + parseFloat(a.monto),
      0
    );
    const precioTotal = parseFloat(orden.precio_total || orden.costo_total || 0);
    const saldoFinal = Math.max(0, precioTotal - totalAnticipos);

    // 4. Sesión de caja activa
    let sesionCajaId: string | undefined;
    try {
      const sesion = await getSesionActiva(userId);
      sesionCajaId = sesion?.id;
    } catch { /* sin caja activa */ }

    // 5. Aplicar anticipos + registrar saldo en caja
    await aplicarAnticiposOrden(
      id,
      orden.folio,
      sesionCajaId,
      saldoFinal,
      metodoPago,
      userId
    );

    // 6. Cambiar estado a "entregado"
    // BUG-ENTREGA-001 (2026-07-23): la columna real en Supabase es "fecha_entregado",
    // NO "fecha_entrega" (esa columna no existe). El nombre incorrecto hacía que este
    // UPDATE fallara en silencio y la orden se quedara atorada en "listo_entrega"
    // (47 órdenes afectadas). Verificado contra Supabase en vivo — no confiar en
    // docs/memoria locales para nombres de columnas, siempre confirmar con MCP.
    await supabase
      .from("ordenes_reparacion")
      .update({ estado: "entregado", fecha_entregado: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);

    // 7-8. Efectos compartidos: bolsa virtual, stock (ambas tablas), puntos, PDF de acuse
    const { costosPiezas, montoCajaAdvanced, ingresoNeto } = await ejecutarEfectosEntrega({
      ordenId: id,
      folio: orden.folio,
      distribuidorId: orden.distribuidor_id ?? null,
      clienteId: orden.cliente_id ?? null,
      precioTotal,
      sesionCajaId: sesionCajaId ?? null,
      userId,
    });

    // 9. Registrar historial
    await supabase.from("historial_estado_orden").insert({
      orden_id: id,
      estado_anterior: orden.estado,
      estado_nuevo: "entregado",
      comentario: saldoFinal > 0
        ? `Equipo entregado. Saldo cobrado: $${saldoFinal.toFixed(2)} (${metodoPago}). Ingreso neto: $${ingresoNeto.toFixed(2)}`
        : `Equipo entregado. Pagado completamente con anticipo(s). Ingreso neto: $${ingresoNeto.toFixed(2)}`,
      usuario_id: userId,
    });

    return NextResponse.json({
      success: true,
      message: "Equipo entregado correctamente",
      data: {
        folio: orden.folio,
        precioTotal,
        totalAnticipos,
        saldoCobrado: saldoFinal,
        costosPiezas,
        ingresoNeto,
        montoCajaAdvanced,
        registradoEnCaja: !!sesionCajaId,
        metodoPago,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/entregar:", error);
    return NextResponse.json({
      success: false,
      error: "Error al procesar entrega",
      message: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 500 });
  }
}
