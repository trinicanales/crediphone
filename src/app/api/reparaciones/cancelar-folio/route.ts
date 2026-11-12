import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";

/**
 * POST /api/reparaciones/cancelar-folio
 * Marca un folio reservado como cancelado.
 * Acepta POST para ser compatible con navigator.sendBeacon (beforeunload/visibilitychange).
 * También lo usa el PATCH de reservar-folio internamente.
 */
export async function POST(request: Request) {
  try {
    // sendBeacon envía las cookies de sesión del mismo origen: ya se exige sesión y tienda
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    let folio: string | undefined;

    try {
      const body = await request.json();
      folio = body?.folio;
    } catch {
      // sendBeacon puede no enviar JSON válido en algunos navegadores
    }

    if (!folio) {
      return NextResponse.json({ success: false, error: "Folio requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("folios_reparacion")
      .update({
        estado: "cancelado",
        cancelado_at: new Date().toISOString(),
      })
      .eq("folio", folio)
      .eq("estado", "reservado"); // Solo cancelar si aún está reservado
    if (!isSuperAdmin && distribuidorId) query = query.eq("distribuidor_id", distribuidorId);
    await query;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/cancelar-folio:", error);
    return NextResponse.json(
      { success: false, error: "Error al cancelar folio" },
      { status: 500 }
    );
  }
}
