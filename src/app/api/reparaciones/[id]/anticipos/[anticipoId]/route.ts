import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/reparaciones/[id]/anticipos/[anticipoId]
 *
 * Elimina un anticipo individual. Restringido a super_admin.
 * Condiciones:
 *   - El anticipo debe estar en estado "pendiente" (no "aplicado")
 *   - La orden no debe estar en estado "entregado"
 *
 * Acciones:
 *   - Elimina el registro de anticipos_reparacion
 *   - Revierte el movimiento de caja si existía sesión vinculada
 *   - Registra en historial_estado_orden
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; anticipoId: string }> }
) {
  try {
    const { userId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Solo super_admin puede eliminar anticipos individuales" }, { status: 403 });
    }

    const { id, anticipoId } = await params;

    if (!UUID_REGEX.test(id) || !UUID_REGEX.test(anticipoId)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Verificar que la orden existe y no está entregada
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("id, folio, estado, distribuidor_id")
      .eq("id", id)
      .single();

    if (!orden) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (orden.estado === "entregado") {
      return NextResponse.json({
        success: false,
        error: "No se puede eliminar un anticipo de una orden ya entregada",
      }, { status: 400 });
    }

    // 2. Obtener el anticipo
    const { data: anticipo } = await supabase
      .from("anticipos_reparacion")
      .select("id, monto, estado, sesion_caja_id, tipo_pago")
      .eq("id", anticipoId)
      .eq("orden_id", id)
      .single();

    if (!anticipo) {
      return NextResponse.json({ success: false, error: "Anticipo no encontrado" }, { status: 404 });
    }
    if (anticipo.estado === "aplicado") {
      return NextResponse.json({
        success: false,
        error: "No se puede eliminar un anticipo ya aplicado a la entrega",
      }, { status: 400 });
    }

    const monto = Number(anticipo.monto);

    // 3. Si tenía sesión de caja vinculada → revertir el movimiento
    // La tabla real es caja_movimientos y su CHECK de `tipo` solo admite valores fijos:
    // la salida de un anticipo anulado se registra como "devolucion_anticipo".
    // Antes se escribía en "movimientos_caja" (no existe) y el error se ignoraba, así que la
    // caja nunca se revertía aunque la respuesta dijera lo contrario. Ahora, si falla, NO se elimina el anticipo.
    if (anticipo.sesion_caja_id && monto > 0) {
      const { error: cajaError } = await supabase.from("caja_movimientos").insert({
        sesion_id: anticipo.sesion_caja_id,
        tipo: "devolucion_anticipo",
        monto,
        concepto: `Anulación anticipo orden ${orden.folio} (eliminado por super_admin)`,
        referencia_id: anticipoId,
        autorizado_por: userId,
        registrado_por: userId,
        distribuidor_id: orden.distribuidor_id ?? null,
      });
      if (cajaError) {
        console.error("[anticipos DELETE] No se pudo revertir la caja:", cajaError);
        return NextResponse.json(
          { success: false, error: `No se pudo revertir el movimiento de caja: ${cajaError.message}. El anticipo NO se eliminó.` },
          { status: 500 }
        );
      }
    }

    // 4. Eliminar el anticipo
    await supabase
      .from("anticipos_reparacion")
      .delete()
      .eq("id", anticipoId);

    // 5. Registrar en historial
    await supabase.from("historial_estado_orden").insert({
      orden_id: id,
      estado_anterior: orden.estado,
      estado_nuevo: orden.estado,
      comentario: `Anticipo de $${monto.toFixed(2)} (${anticipo.tipo_pago}) eliminado por super_admin.${anticipo.sesion_caja_id ? " Movimiento de caja revertido." : ""}`,
      usuario_id: userId,
    });

    return NextResponse.json({
      success: true,
      message: `Anticipo de $${monto.toFixed(2)} eliminado correctamente`,
      montoEliminado: monto,
      cajaRevertida: !!anticipo.sesion_caja_id,
    });
  } catch (error) {
    console.error("Error en DELETE /api/reparaciones/[id]/anticipos/[anticipoId]:", error);
    return NextResponse.json({
      success: false,
      error: "Error al eliminar anticipo",
      message: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 500 });
  }
}
