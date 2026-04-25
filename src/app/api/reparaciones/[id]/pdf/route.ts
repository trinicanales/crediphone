import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { generarOrdenPDF } from "@/lib/pdf/orden-pdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const host  = request.headers.get("host")              || "crediphone.com.mx";
    const proto = request.headers.get("x-forwarded-proto") || "https";

    let buffer: Buffer;
    try {
      buffer = await generarOrdenPDF(id, host, proto);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, message: msg }, { status: 404 });
    }

    // Fetch folio for filename
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("folio")
      .eq("id", id)
      .single();
    const folio = orden?.folio ?? id;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Orden-${folio}.pdf"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error al generar PDF:", msg);
    return NextResponse.json({ success: false, message: `Error al generar PDF: ${msg}` }, { status: 500 });
  }
}
