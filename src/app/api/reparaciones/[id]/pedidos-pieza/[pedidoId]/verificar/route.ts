import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/reparaciones/[id]/pedidos-pieza/[pedidoId]/verificar
 * El técnico verifica la pieza recibida:
 *   - llegoBien: true  → estado "instalada" + INSERT reparacion_piezas + stock lógica
 *   - llegoBien: false → estado "defectuosa" + motivo + congela monto en bolsa (en_disputa)
 * Body: { llegoBien: boolean; motivo?: string }
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
    const { llegoBien, motivo } = body as { llegoBien?: boolean; motivo?: string };

    if (llegoBien === undefined) {
      return NextResponse.json({ success: false, error: "Falta campo 'llegoBien'" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch pedido con acceso a distribuidor
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

    if (pedido.estado !== "recibida") {
      return NextResponse.json(
        { success: false, error: `Solo se puede verificar una pieza en estado 'recibida'. Estado actual: '${pedido.estado}'` },
        { status: 409 }
      );
    }

    const ahora = new Date().toISOString();

    if (llegoBien) {
      // ── Pieza OK: marcar instalada + agregar a reparacion_piezas ──────────
      const { error: updateError } = await supabase
        .from("pedidos_pieza_reparacion")
        .update({
          estado: "instalada",
          verificado_por: userId,
          fecha_verificacion: ahora,
          instalado_por: userId,
          fecha_instalacion: ahora,
        })
        .eq("id", pedidoId);

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      await supabase.from("reparacion_piezas").insert({
        orden_id: ordenId,
        nombre_pieza: pedido.nombre_pieza,
        cantidad: 1,
        costo_unitario: Number(pedido.costo_estimado || 0),
        producto_id: pedido.producto_id || null,
      });

      // Si tiene producto_id y llegó de proveedor (no de inventario), incrementar stock sería incorrecto.
      // El stock ya se decrementó al crear la orden (si era de inventario). Para piezas pedidas
      // externamente, el stock no se afecta — la pieza va directo a la reparación.

      return NextResponse.json({ success: true, message: "Pieza verificada e instalada correctamente" });
    } else {
      // ── Pieza defectuosa: congelar monto en bolsa ──────────────────────────
      const { error: updateError } = await supabase
        .from("pedidos_pieza_reparacion")
        .update({
          estado: "defectuosa",
          verificado_por: userId,
          fecha_verificacion: ahora,
          motivo_defecto: motivo?.trim() || "Sin especificar",
          intentos_reemplazo: (pedido.intentos_reemplazo ?? 0) + 1,
        })
        .eq("id", pedidoId);

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      // Marcar el movimiento de bolsa correspondiente como "en_disputa"
      await supabase
        .from("movimientos_bolsa_virtual")
        .update({ en_disputa: true })
        .eq("pedido_pieza_id", pedidoId)
        .eq("tipo", "gasto_pieza");

      return NextResponse.json({
        success: true,
        message: "Pieza marcada como defectuosa. El monto queda en disputa hasta recibir reemplazo.",
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
