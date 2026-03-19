import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionActiva } from "@/lib/db/caja";
import type { TipoPago, DesglosePagoMixto } from "@/types";

/**
 * POST /api/pos/reparacion-cobro
 *
 * Registra un cobro de reparación (anticipo o saldo final) desde el POS.
 *
 * Body:
 *  - ordenId: UUID de la orden
 *  - tipo: "anticipo" | "saldo_final"
 *  - monto: número
 *  - metodoPago: TipoPago (efectivo, tarjeta, transferencia, deposito)
 *  - desgloseMixto?: DesglosePagoMixto (opcional, para pagos mixtos)
 *
 * Retorna:
 *  - { success: true, nuevoSaldo: number, entregado: boolean }
 */
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
    const { ordenId, tipo, monto, metodoPago, desgloseMixto } = body;

    if (!ordenId || !tipo || !monto || !metodoPago) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    if (tipo !== "anticipo" && tipo !== "saldo_final") {
      return NextResponse.json(
        { success: false, error: "Tipo de cobro inválido" },
        { status: 400 }
      );
    }

    if (parseFloat(monto) <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Obtener datos de la orden
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("id, folio, cliente_id, costo_total, distribuidor_id")
      .eq("id", ordenId)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Validar que el usuario pertenece al mismo distribuidor
    if (!isSuperAdmin && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos en este distribuidor" },
        { status: 403 }
      );
    }

    // Obtener sesión de caja activa
    let sesionCajaId: string | null = null;
    try {
      const sesion = await getSesionActiva(userId);
      sesionCajaId = sesion?.id || null;
    } catch {
      // Sin sesión activa — no hay problema, el anticipo se registra sin caja
    }

    // Obtener total de anticipos existentes
    const { data: anticiposExistentes } = await supabase
      .from("anticipos_reparacion")
      .select("monto")
      .eq("orden_id", ordenId)
      .eq("estado", "aplicado");

    const totalAnticiposActual = anticiposExistentes
      ? anticiposExistentes.reduce((sum: number, a: any) => sum + parseFloat(a.monto || 0), 0)
      : 0;

    const costoTotal = parseFloat(orden.costo_total || 0);
    const nuevoTotalAnticipos = totalAnticiposActual + parseFloat(monto);
    const nuevoSaldo = Math.max(0, costoTotal - nuevoTotalAnticipos);

    // Crear anticipo
    const { data: nuevoAnticipo, error: insertError } = await supabase
      .from("anticipos_reparacion")
      .insert({
        orden_id: ordenId,
        monto: parseFloat(monto),
        tipo_pago: metodoPago as TipoPago,
        desglose_mixto: desgloseMixto as DesglosePagoMixto | null,
        recibido_por: userId,
        estado: "aplicado",
        caja_sesion_id: sesionCajaId,
        creado_por: userId,
        created_at: new Date().toISOString(),
      })
      .select("id");

    if (insertError) {
      console.error("Error al insertar anticipo:", insertError);
      return NextResponse.json(
        { success: false, error: "Error al registrar anticipo" },
        { status: 500 }
      );
    }

    // Si es saldo final y el nuevo saldo es 0 o negativo, marcar como entregado
    let entregado = false;
    if (tipo === "saldo_final" && nuevoSaldo <= 0) {
      const { error: updateError } = await supabase
        .from("ordenes_reparacion")
        .update({
          estado: "entregado",
          fecha_entregado: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ordenId);

      if (updateError) {
        console.error("Error al marcar como entregada:", updateError);
        // No fallamos aquí, solo registramos
      } else {
        entregado = true;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        anticipoId: nuevoAnticipo?.[0]?.id,
        nuevoSaldo: Math.max(0, nuevoSaldo),
        entregado,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/pos/reparacion-cobro:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
