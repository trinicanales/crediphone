import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkYTransicionarEsperandoPiezas } from "@/lib/db/reparaciones";

/**
 * PATCH /api/reparaciones/[id]/pedidos-pieza/[pedidoId]
 * Actualiza fecha estimada, motivo de retraso, o nombre de una pieza pedida.
 * Edición de nombre: solo admin/super_admin, cualquier estado.
 * Retraso: solo en estados pendiente/en_camino.
 * Body: { fechaEstimadaLlegada?: string; motivoRetraso?: string; nombrePieza?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pedidoId: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { id: ordenId, pedidoId } = await params;
    const body = await request.json().catch(() => ({}));
    const { fechaEstimadaLlegada, motivoRetraso, nombrePieza, productoId, accion } = body as {
      fechaEstimadaLlegada?: string;
      motivoRetraso?: string;
      nombrePieza?: string;
      productoId?: string;
      accion?: "bloquear" | "desbloquear";
    };

    if (!fechaEstimadaLlegada && !motivoRetraso && !nombrePieza && productoId === undefined && !accion) {
      return NextResponse.json(
        { success: false, error: "Se requiere al menos un campo a actualizar" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: pedido } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("id, estado, notas, nombre_pieza, bloqueado_por, bloqueado_at, ordenes_reparacion!inner(distribuidor_id)")
      .eq("id", pedidoId)
      .eq("orden_id", ordenId)
      .single();

    if (!pedido) return NextResponse.json({ success: false, error: "Pedido no encontrado" }, { status: 404 });

    const distId = (pedido as any).ordenes_reparacion?.distribuidor_id;
    if (!isSuperAdmin && distribuidorId && distId !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    // Edición de nombre: requiere admin/super_admin
    if (nombrePieza && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Sin permisos para editar el nombre" }, { status: 403 });
    }

    // Retraso: solo en estados pendiente/en_camino
    if ((fechaEstimadaLlegada || motivoRetraso) && !["pendiente", "en_camino"].includes(pedido.estado)) {
      return NextResponse.json(
        { success: false, error: "Solo se puede reportar retraso en piezas pendiente o en_camino" },
        { status: 409 }
      );
    }

    // G2-G5: Soft lock — bloquear/desbloquear edición colaborativa
    if (accion === "bloquear") {
      const LOCK_TTL_MIN = 5;
      const ahora = new Date();
      const bloqueadoAt = pedido.bloqueado_at ? new Date(pedido.bloqueado_at) : null;
      const lockExpirado = !bloqueadoAt || (ahora.getTime() - bloqueadoAt.getTime()) > LOCK_TTL_MIN * 60 * 1000;

      if (pedido.bloqueado_por && pedido.bloqueado_por !== userId && !lockExpirado) {
        return NextResponse.json({ success: false, error: "bloqueado", code: "LOCKED" }, { status: 409 });
      }
      const { error: lockErr } = await supabase
        .from("pedidos_pieza_reparacion")
        .update({ bloqueado_por: userId, bloqueado_at: ahora.toISOString() })
        .eq("id", pedidoId);
      if (lockErr) return NextResponse.json({ success: false, error: lockErr.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Bloque adquirido" });
    }

    if (accion === "desbloquear") {
      // Solo puede desbloquear quien lo bloqueó (o admin)
      if (pedido.bloqueado_por && pedido.bloqueado_por !== userId && role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ success: false, error: "Sin permiso para desbloquear" }, { status: 403 });
      }
      const { error: unlockErr } = await supabase
        .from("pedidos_pieza_reparacion")
        .update({ bloqueado_por: null, bloqueado_at: null })
        .eq("id", pedidoId);
      if (unlockErr) return NextResponse.json({ success: false, error: unlockErr.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Bloque liberado" });
    }

    const updateData: Record<string, unknown> = {};

    if (nombrePieza?.trim()) {
      updateData.nombre_pieza = nombrePieza.trim();
    }

    if (productoId !== undefined) {
      updateData.producto_id = productoId || null;
    }

    if (fechaEstimadaLlegada) {
      updateData.fecha_estimada_llegada = fechaEstimadaLlegada;
    }

    if (motivoRetraso?.trim()) {
      const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
      const sufijo = `[${fecha}] Retraso: ${motivoRetraso.trim()}`;
      const notasActuales = pedido.notas ?? "";
      updateData.notas = notasActuales ? `${notasActuales}\n${sufijo}` : sufijo;
    }

    const { error } = await supabase
      .from("pedidos_pieza_reparacion")
      .update(updateData)
      .eq("id", pedidoId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Pieza actualizada" });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/reparaciones/[id]/pedidos-pieza/[pedidoId]
 * Cancela UN pedido de pieza individual (no cancela toda la orden).
 * Solo permitido en estados "pendiente" o "en_camino" — piezas que aún no llegaron
 * físicamente. Revierte el gasto que se registró en bolsa virtual al crear el pedido
 * y, si la orden estaba "esperando_piezas" y ya no quedan piezas sin resolver,
 * la reanuda automáticamente a "en_reparacion".
 * Roles: admin, super_admin, vendedor (mismos roles que la cancelación de orden completa)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pedidoId: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    if (!role || !["admin", "super_admin", "vendedor"].includes(role)) {
      return NextResponse.json({ success: false, error: "Sin permisos para cancelar piezas" }, { status: 403 });
    }

    const { id: ordenId, pedidoId } = await params;
    const supabase = createAdminClient();

    const { data: pedido } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("id, estado, nombre_pieza, costo_estimado, costo_envio, ordenes_reparacion!inner(distribuidor_id)")
      .eq("id", pedidoId)
      .eq("orden_id", ordenId)
      .single();

    if (!pedido) return NextResponse.json({ success: false, error: "Pedido no encontrado" }, { status: 404 });

    const distId = (pedido as any).ordenes_reparacion?.distribuidor_id;
    if (!isSuperAdmin && distribuidorId && distId !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    if (!["pendiente", "en_camino"].includes(pedido.estado)) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede cancelar una pieza en estado "${pedido.estado}". Solo aplica a piezas pendientes o en camino.`,
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("pedidos_pieza_reparacion")
      .update({ estado: "cancelada" })
      .eq("id", pedidoId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Revertir el gasto registrado en bolsa virtual al crear el pedido (insertando el
    // monto en negativo, misma lógica que usa el cálculo de saldoDisponible en el POST)
    const costoTotal = Number(pedido.costo_estimado || 0) + Number(pedido.costo_envio || 0);
    if (costoTotal > 0) {
      await supabase.from("movimientos_bolsa_virtual").insert({
        orden_id: ordenId,
        distribuidor_id: distId,
        tipo: "gasto_pieza",
        monto: -costoTotal,
        concepto: `Pieza cancelada: ${pedido.nombre_pieza} (revierte gasto de $${costoTotal.toFixed(2)})`,
        pedido_pieza_id: pedido.id,
        registrado_por: userId,
      });
    }

    // Auto-transición: si ya no quedan piezas pendientes, reanudar la reparación
    checkYTransicionarEsperandoPiezas(ordenId).catch((e) =>
      console.error("[pedidos-pieza/cancelar-individual] auto-transición falló:", e)
    );

    return NextResponse.json({ success: true, message: "Pieza cancelada" });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
