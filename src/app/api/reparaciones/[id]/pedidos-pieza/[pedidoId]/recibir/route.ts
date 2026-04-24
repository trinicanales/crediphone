import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/reparaciones/[id]/pedidos-pieza/[pedidoId]/recibir
 * Marca una pieza como RECIBIDA físicamente (aún pendiente de verificación).
 * NO agrega a reparacion_piezas todavía — eso ocurre en /verificar.
 * Body opcional: { costoReal?, costoEnvio?, notas? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pedidoId: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: ordenId, pedidoId } = await params;
    const body = await request.json().catch(() => ({}));
    const { costoReal, costoEnvio, notas } = body as {
      costoReal?: number; costoEnvio?: number; notas?: string;
    };

    const supabase = createAdminClient();

    // Fetch pedido + order for access check
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("*, ordenes_reparacion!inner(distribuidor_id)")
      .eq("id", pedidoId)
      .eq("orden_id", ordenId)
      .single();

    if (pedidoError || !pedido) {
      return NextResponse.json({ success: false, error: "Pedido no encontrado" }, { status: 404 });
    }

    const distId = (pedido as any).ordenes_reparacion?.distribuidor_id;
    if (!isSuperAdmin && distribuidorId && distId !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    const estadosNoReceivable = ["recibida", "verificada_ok", "instalada", "defectuosa", "cancelada"];
    if (estadosNoReceivable.includes(pedido.estado)) {
      return NextResponse.json({ success: false, error: `No se puede recibir: estado actual es '${pedido.estado}'` }, { status: 409 });
    }

    const costoFinal = costoReal !== undefined ? Number(costoReal) : Number(pedido.costo_estimado || 0);
    const envioFinal = costoEnvio !== undefined ? Number(costoEnvio) : Number(pedido.costo_envio || 0);
    const ahora = new Date().toISOString();

    // 1. Actualizar el pedido
    const { error: updateError } = await supabase
      .from("pedidos_pieza_reparacion")
      .update({
        estado: "recibida",
        fecha_recibida: ahora,
        recibido_por: userId,
        costo_estimado: costoFinal,
        costo_envio: envioFinal,
        ...(notas ? { notas } : {}),
      })
      .eq("id", pedidoId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Pieza marcada como recibida. Pendiente de verificación por el técnico." });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
