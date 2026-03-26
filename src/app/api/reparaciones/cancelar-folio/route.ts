import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/reparaciones/cancelar-folio
 * Marca un folio reservado como cancelado.
 * Acepta POST para ser compatible con navigator.sendBeacon (beforeunload/visibilitychange).
 * También lo usa el PATCH de reservar-folio internamente.
 */
export async function POST(request: Request) {
  try {
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

    await supabase
      .from("folios_reparacion")
      .update({
        estado: "cancelado",
        cancelado_at: new Date().toISOString(),
      })
      .eq("folio", folio)
      .eq("estado", "reservado"); // Solo cancelar si aún está reservado

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/cancelar-folio:", error);
    return NextResponse.json(
      { success: false, error: "Error al cancelar folio" },
      { status: 500 }
    );
  }
}
