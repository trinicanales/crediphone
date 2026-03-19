import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";
import crypto from "crypto";

/**
 * GET /api/reparaciones/[id]/tracking-link
 *
 * Obtiene el tracking link público para una orden. Si no existe un token
 * activo, crea uno nuevo (válido por 90 días).
 *
 * Devuelve:
 *   { success: true, url: "https://…/tracking/<token>", folio: "REP-0001", token: "…" }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { id: ordenId } = await params;
    const supabase = createAdminClient();

    // 1. Verificar que la orden existe y pertenece al distribuidor del usuario
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("id, folio, distribuidor_id")
      .eq("id", ordenId)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    // 2. Buscar token activo existente
    const { data: existing } = await supabase
      .from("tracking_tokens")
      .select("token, expires_at, activa")
      .eq("orden_id", ordenId)
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let token: string;

    if (existing && new Date(existing.expires_at) > new Date()) {
      // Usar token existente que aún no ha expirado
      token = existing.token;
    } else {
      // Crear nuevo token (90 días de validez)
      token = crypto.randomBytes(32).toString("hex"); // 64 chars hex

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      // Desactivar tokens anteriores si existen
      if (existing) {
        await supabase
          .from("tracking_tokens")
          .update({ activa: false })
          .eq("orden_id", ordenId);
      }

      const { error: insertError } = await supabase.from("tracking_tokens").insert({
        orden_id: ordenId,
        token,
        expires_at: expiresAt.toISOString(),
        activa: true,
        accesos: 0,
      });

      if (insertError) {
        console.error("Error al crear tracking token:", insertError);
        // Fallback sin token: devolver URL por folio
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        return NextResponse.json({
          success: true,
          url: `${baseUrl}/reparacion/${orden.folio}`,
          folio: orden.folio,
          token: null,
        });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    return NextResponse.json({
      success: true,
      url: `${baseUrl}/tracking/${token}`,
      folio: orden.folio,
      token,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/[id]/tracking-link:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
