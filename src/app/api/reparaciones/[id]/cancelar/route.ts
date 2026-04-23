import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrdenReparacionById,
  cambiarEstadoOrden,
  devolverTodasLasPiezas,
  devolverAnticiposOrden,
} from "@/lib/db/reparaciones";

/**
 * POST /api/reparaciones/[id]/cancelar
 *
 * Cancela una orden de reparación con flujo completo:
 * 1. Cambia estado a "cancelado"
 * 2. Devuelve todas las piezas reservadas al inventario
 * 3. Opcionalmente marca los anticipos como "devuelto"
 *
 * Body:
 *   - motivo: string (requerido)
 *   - devolverAnticipos: boolean (default true)
 *   - sesionCajaId?: string (para registrar la devolución de efectivo en caja activa)
 *
 * Roles: admin, super_admin
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // vendedor puede cancelar desde POS (con cargo de cancelación)
    if (!role || !["admin", "super_admin", "vendedor"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Solo admin o vendedor puede cancelar órdenes" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const motivo: string = body.motivo?.trim() || "Sin motivo especificado";
    const devolverAnticipos: boolean = body.devolverAnticipos ?? true;
    const sesionCajaId: string | undefined = body.sesionCajaId || undefined;

    // Obtener la orden PRIMERO para leer su cargoCancelacion
    const orden = await getOrdenReparacionById(id);
    if (!orden) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Cargo de cancelación: usa el de la orden si no viene en el body
    // Así no depende de que el frontend lo envíe correctamente
    const cargoCancelacion: number = typeof body.cargoCancelacion === "number"
      ? Math.max(0, body.cargoCancelacion)
      : Math.max(0, orden.cargoCancelacion ?? 100);

    if (orden.estado === "cancelado") {
      return NextResponse.json(
        { success: false, error: "La orden ya está cancelada" },
        { status: 409 }
      );
    }

    if (orden.estado === "entregado") {
      return NextResponse.json(
        { success: false, error: "No se puede cancelar una orden ya entregada" },
        { status: 409 }
      );
    }

    const supabase = createAdminClient();

    // ── 1. Analizar piezas pedidas para la bolsa virtual ────────────────
    // - Piezas que YA LLEGARON (estado='recibida'): entran al inventario, NO se devuelve su costo
    // - Piezas que NO HAN LLEGADO (estado='pendiente'/'en_camino'): se devuelve su costo al cliente
    const { data: pedidosPieza } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("id, nombre_pieza, costo_estimado, costo_envio, estado, monto_de_caja")
      .eq("orden_id", id);

    const piezasLlegadas = (pedidosPieza ?? []).filter((p: any) => p.estado === "recibida");
    const costoPiezasLlegadas = piezasLlegadas.reduce(
      (sum: number, p: any) => sum + Number(p.costo_estimado || 0) + Number(p.costo_envio || 0),
      0
    );

    // ── 2. Cambiar estado a cancelado ────────────────────────────────────
    await cambiarEstadoOrden(id, "cancelado", `Cancelado: ${motivo}`);

    // ── 3. Devolver piezas reservadas al inventario ──────────────────────
    await devolverTodasLasPiezas(id);

    // ── 4. Calcular devolución considerando cargo y piezas llegadas ──────
    let totalDevuelto = 0;
    let cargoAplicado = 0;

    if (devolverAnticipos) {
      const ahora = new Date().toISOString();

      const { data: anticiposPendientes } = await supabase
        .from("anticipos_reparacion")
        .select("id, monto")
        .eq("orden_id", id)
        .eq("estado", "pendiente");

      const totalAnticipos = (anticiposPendientes ?? []).reduce(
        (sum: number, a: any) => sum + parseFloat(a.monto),
        0
      );

      if (totalAnticipos > 0) {
        // Retenciones:
        // 1. Cargo de cancelación (siempre, si aplica)
        // 2. Costo de piezas que YA LLEGARON (quedan en inventario)
        const totalRetenciones = Math.min(
          cargoCancelacion + costoPiezasLlegadas,
          totalAnticipos
        );
        cargoAplicado = Math.min(cargoCancelacion, totalAnticipos);
        totalDevuelto = Math.max(0, totalAnticipos - totalRetenciones);

        // Marcar anticipos como devueltos
        await supabase
          .from("anticipos_reparacion")
          .update({ estado: "devuelto", fecha_devuelto: ahora, motivo_devolucion: motivo })
          .eq("orden_id", id)
          .eq("estado", "pendiente");

        // Registrar devolución en caja
        if (sesionCajaId && totalDevuelto > 0) {
          await supabase.from("caja_movimientos").insert({
            sesion_id: sesionCajaId,
            tipo: "devolucion_anticipo",
            monto: totalDevuelto,
            concepto: `Devolución anticipo ${orden.folio}. Cargo: $${cargoAplicado.toFixed(2)}${costoPiezasLlegadas > 0 ? `, Piezas llegadas: $${costoPiezasLlegadas.toFixed(2)}` : ""}. Motivo: ${motivo}`,
            autorizado_por: userId,
          });
        }

        // Cargo de cancelación → ingreso en caja
        if (sesionCajaId && cargoAplicado > 0) {
          await supabase.from("caja_movimientos").insert({
            sesion_id: sesionCajaId,
            tipo: "entrada_efectivo",
            monto: cargoAplicado,
            concepto: `Cargo cancelación reparación ${orden.folio}`,
            autorizado_por: userId,
          });
        }

        // Registrar en bolsa virtual: devolución al cliente
        await supabase.from("movimientos_bolsa_virtual").insert({
          orden_id: id,
          distribuidor_id: orden.distribuidorId ?? null,
          tipo: "devolucion_cliente",
          monto: totalDevuelto,
          concepto: `Cancelación ${orden.folio}: devuelto $${totalDevuelto.toFixed(2)} (retención cargo: $${cargoAplicado.toFixed(2)}, piezas llegadas: $${costoPiezasLlegadas.toFixed(2)})`,
          sesion_caja_id: sesionCajaId || null,
          registrado_por: userId,
        });
      } else if (totalAnticipos === 0) {
        // Sin anticipos — nada que devolver; solo el cargo si aplica
        cargoAplicado = 0;
        totalDevuelto = 0;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Orden ${orden.folio} cancelada`,
      folio: orden.folio,
      piezasDevueltas: true,
      anticiposDevueltos: devolverAnticipos,
      totalAnticipoDevuelto: totalDevuelto,
      cargoAplicado,
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/cancelar:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al cancelar la orden",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
