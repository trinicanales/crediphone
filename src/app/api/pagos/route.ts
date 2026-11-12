import { NextResponse } from "next/server";
import { getPagos, createPago } from "@/lib/db/pagos";
import { requireAuth } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await requireAuth(["admin", "vendedor", "cobrador", "super_admin"]);
    if (!auth.ok) return auth.response;

    const distribuidorId = auth.isSuperAdmin ? null : auth.distribuidorId;
    const pagos = await getPagos(distribuidorId ?? undefined);

    return NextResponse.json({
      success: true,
      count: pagos.length,
      data: pagos,
    });
  } catch (error) {
    console.error("Error al obtener pagos:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener pagos",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // vendedor incluido: el abono también se recibe desde el POS (decisión de Trini 2026-11-11)
    const auth = await requireAuth(["admin", "cobrador", "vendedor", "super_admin"]);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const monto = Number(body.monto);
    if (!body.creditoId || !Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ success: false, error: "Crédito y monto mayor a 0 son requeridos" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: credito } = await supabase
      .from("creditos")
      .select("id, distribuidor_id, monto, estado, folio")
      .eq("id", body.creditoId)
      .maybeSingle();

    // Mismo mensaje si no existe o es de otra tienda (no revelar que existe)
    if (!credito || (!auth.isSuperAdmin && credito.distribuidor_id !== auth.distribuidorId)) {
      return NextResponse.json({ success: false, error: "Crédito no encontrado" }, { status: 404 });
    }
    if (credito.estado === "pagado" || credito.estado === "cancelado") {
      return NextResponse.json({ success: false, error: `El crédito ya está ${credito.estado}` }, { status: 409 });
    }

    // El cobrador y la tienda salen de la sesión / del crédito, no del navegador
    const nuevoPago = await createPago(
      { ...body, monto, cobradorId: auth.userId },
      credito.distribuidor_id
    );

    // Saldo después del pago; si queda en 0 el crédito se marca pagado
    const { data: pagosRows } = await supabase.from("pagos").select("monto").eq("credito_id", credito.id);
    const totalPagado = (pagosRows ?? []).reduce((sum, p) => sum + Number(p.monto ?? 0), 0);
    const saldoRestante = Math.max(0, Number(credito.monto) - totalPagado);
    if (saldoRestante === 0) {
      await supabase.from("creditos").update({ estado: "pagado" }).eq("id", credito.id);
    }

    return NextResponse.json({
      success: true,
      data: nuevoPago,
      saldoRestante,
      creditoLiquidado: saldoRestante === 0,
    }, { status: 201 });
  } catch (error) {
    console.error("Error al crear pago:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al crear pago",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
