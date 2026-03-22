/**
 * FASE 55: GET /api/whatsapp/mensajes
 * Historial de mensajes de WhatsApp (admin/super_admin)
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit  = parseInt(searchParams.get("limit") ?? "50");
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const filterDistribuidorId =
      role === "super_admin"
        ? (searchParams.get("distribuidorId") ?? undefined)
        : (distribuidorId ?? undefined);

    const supabase = createAdminClient();

    let q = supabase
      .from("whatsapp_mensajes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filterDistribuidorId) {
      q = q.eq("distribuidor_id", filterDistribuidorId);
    }

    const { data, error, count } = await q;

    if (error) throw error;

    // Mapear snake_case → camelCase
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      id:               r.id,
      distribuidorId:   r.distribuidor_id,
      entidadTipo:      r.entidad_tipo,
      entidadId:        r.entidad_id,
      telefono:         r.telefono,
      mensaje:          r.mensaje,
      tipo:             r.tipo,
      canal:            r.canal,
      estado:           r.estado,
      waMessageId:      r.wa_message_id,
      errorDetalle:     r.error_detalle,
      enviadoPorId:     r.enviado_por_id,
      enviadoPorNombre: r.enviado_por_nombre,
      createdAt:        r.created_at,
      updatedAt:        r.updated_at,
    }));

    return NextResponse.json({ success: true, data: mapped, total: count ?? 0 });
  } catch (error) {
    console.error("[GET /api/whatsapp/mensajes]", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener mensajes" },
      { status: 500 }
    );
  }
}
