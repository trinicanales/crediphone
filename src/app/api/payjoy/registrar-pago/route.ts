/**
 * POST /api/payjoy/registrar-pago
 *
 * Registra un pago presencial de un crédito Payjoy en la tienda.
 * - metodo_pago = "payjoy" (siempre — es un crédito Payjoy)
 * - metodo_pago_tienda = efectivo | tarjeta | transferencia
 *   (cómo pagó físicamente el cliente, para cuadre de caja interno)
 *
 * Este pago NO se reporta a Payjoy (Payjoy gestiona eso por webhooks).
 * Solo sirve para que la caja lleve el conteo correcto al cierre del turno.
 */
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MetodoPagoTienda = "efectivo" | "tarjeta" | "transferencia";

export async function POST(request: Request) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      credito_id,
      monto,
      metodo_pago_tienda = "efectivo",
      referencia,
      notas,
    } = body;

    /* ── Validaciones básicas ─────────────────────── */
    if (!credito_id || typeof credito_id !== "string") {
      return NextResponse.json(
        { success: false, error: "credito_id requerido" },
        { status: 400 }
      );
    }
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      return NextResponse.json(
        { success: false, error: "monto debe ser mayor a 0" },
        { status: 400 }
      );
    }
    const metodosValidos: MetodoPagoTienda[] = ["efectivo", "tarjeta", "transferencia"];
    if (!metodosValidos.includes(metodo_pago_tienda)) {
      return NextResponse.json(
        { success: false, error: "metodo_pago_tienda inválido. Use: efectivo, tarjeta o transferencia" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    /* ── Verificar que el crédito existe y pertenece al distribuidor ─── */
    const { data: credito, error: creditoError } = await supabase
      .from("creditos")
      .select("id, monto, estado, distribuidor_id, payjoy_finance_order_id")
      .eq("id", credito_id)
      .single();

    if (creditoError || !credito) {
      return NextResponse.json(
        { success: false, error: "Crédito no encontrado" },
        { status: 404 }
      );
    }

    // Verificar pertenencia al distribuidor (excepto super_admin)
    if (!isSuperAdmin && distribuidorId && credito.distribuidor_id !== distribuidorId) {
      return NextResponse.json(
        { success: false, error: "No tienes acceso a este crédito" },
        { status: 403 }
      );
    }

    // Verificar que tiene vínculo con Payjoy
    if (!credito.payjoy_finance_order_id) {
      return NextResponse.json(
        { success: false, error: "Este crédito no está vinculado a Payjoy" },
        { status: 400 }
      );
    }

    // Verificar que no esté pagado/cancelado
    if (credito.estado === "pagado" || credito.estado === "cancelado") {
      return NextResponse.json(
        { success: false, error: `El crédito está ${credito.estado}, no se pueden registrar pagos` },
        { status: 400 }
      );
    }

    // Calcular saldo pendiente desde pagos
    const { data: pagosCredito } = await supabase
      .from("pagos")
      .select("monto")
      .eq("credito_id", credito_id);

    const totalPagado = (pagosCredito || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto),
      0
    );
    const saldoPendiente = Math.max(0, Number(credito.monto) - totalPagado);

    const montoNumerico = Number(monto);

    /* ── Insertar pago ───────────────────────────── */
    const { data: nuevoPago, error: pagoError } = await supabase
      .from("pagos")
      .insert({
        credito_id,
        monto: montoNumerico,
        fecha_pago: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        metodo_pago: "payjoy",
        metodo_pago_tienda,                                  // Para cuadre de caja
        cobrador_id: userId,
        distribuidor_id: credito.distribuidor_id,
        referencia: referencia ?? null,
        // notas se guarda en referencia si no hay campo separado
      })
      .select()
      .single();

    if (pagoError) {
      console.error("[Payjoy] Error al insertar pago:", pagoError);
      throw pagoError;
    }

    /* ── Actualizar estado del crédito si quedó saldado ─────────────── */
    const nuevoSaldo = Math.max(0, saldoPendiente - montoNumerico);
    const nuevoEstado = nuevoSaldo === 0 ? "pagado" : credito.estado;

    await supabase
      .from("creditos")
      .update({
        estado: nuevoEstado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", credito_id);

    return NextResponse.json({
      success: true,
      data: nuevoPago,
      nuevoSaldo,
      nuevoEstado,
    });
  } catch (error) {
    console.error("[Payjoy] Error al registrar pago:", error);
    return NextResponse.json(
      { success: false, error: "Error al registrar pago Payjoy" },
      { status: 500 }
    );
  }
}
