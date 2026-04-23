import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVersionesPDF, guardarVersionPDF } from "@/lib/pdf/versiones-pdf";
import type { MotivoPDF } from "@/lib/pdf/versiones-pdf";

/**
 * GET /api/reparaciones/[id]/versiones-pdf
 * Lista todas las versiones PDF de una orden.
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

    // Verify access
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id, folio")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    const versiones = await getVersionesPDF(ordenId);
    return NextResponse.json({ success: true, data: versiones });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/reparaciones/[id]/versiones-pdf
 * Genera y guarda una nueva versión PDF de la orden.
 * Body: { motivo: MotivoPDF, descripcion?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: ordenId } = await params;
    const body = await request.json().catch(() => ({}));
    const { motivo = "cambio_presupuesto", descripcion } = body as { motivo?: MotivoPDF; descripcion?: string };

    const supabase = createAdminClient();

    // Verify access
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, distribuidor_id, folio")
      .eq("id", ordenId)
      .single();

    if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    if (!isSuperAdmin && distribuidorId && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    const urlPdf = await guardarVersionPDF(ordenId, orden.folio, motivo, descripcion, userId);
    if (!urlPdf) {
      return NextResponse.json({ success: false, error: "Error al generar PDF" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { urlPdf } });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
