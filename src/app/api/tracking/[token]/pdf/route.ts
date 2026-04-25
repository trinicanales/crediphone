import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarOrdenPDF } from "@/lib/pdf/orden-pdf";

/**
 * GET /api/tracking/[token]/pdf
 * Genera y descarga el PDF de la orden usando el token público.
 * NO REQUIERE AUTENTICACIÓN — acceso validado por token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { success: false, error: "Token inválido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: trackingData, error: trackingError } = await supabase
      .from("tracking_tokens")
      .select("orden_id, expires_at")
      .eq("token", token)
      .single();

    if (trackingError || !trackingData) {
      return NextResponse.json(
        { success: false, error: "Link inválido o expirado" },
        { status: 404 }
      );
    }

    if (trackingData.expires_at) {
      const expirationDate = new Date(trackingData.expires_at);
      if (expirationDate < new Date()) {
        return NextResponse.json(
          { success: false, error: "Link expirado" },
          { status: 410 }
        );
      }
    }

    const host  = request.headers.get("host")              || "crediphone.com.mx";
    const proto = request.headers.get("x-forwarded-proto") || "https";

    let buffer: Buffer;
    try {
      buffer = await generarOrdenPDF(trackingData.orden_id, host, proto);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: msg }, { status: 404 });
    }

    // Fetch folio for filename
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("folio")
      .eq("id", trackingData.orden_id)
      .single();
    const folio = orden?.folio ?? trackingData.orden_id;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Orden-${folio}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error al generar PDF de tracking:", msg);
    return NextResponse.json(
      { success: false, error: `Error al generar PDF: ${msg}` },
      { status: 500 }
    );
  }
}
