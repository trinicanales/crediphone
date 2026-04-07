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
    // Cargo de cancelación: monto retenido antes de devolver anticipos al cliente
    const cargoCancelacion: number =
      typeof body.cargoCancelacion === "number" ? Math.max(0, body.cargoCancelacion) : 0;

    // Obtener la orden para validar que existe y no esté ya cancelada
    const orden = await getOrdenReparacionById(id);
    if (!orden) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

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

    // ── 1. Cambiar estado a cancelado ────────────────────────────────────
    await cambiarEstadoOrden(id, "cancelado", `Cancelado: ${motivo}`);

    // ── 2. Devolver piezas al inventario ─────────────────────────────────
    // devolverTodasLasPiezas restaura el stock de cada pieza en reparacion_piezas
    // y elimina los registros de la orden
    await devolverTodasLasPiezas(id);

    // ── 3. Devolver anticipos (opcional) ─────────────────────────────────
    let totalDevuelto = 0;
    let cargoAplicado = 0;

    if (devolverAnticipos) {
      if (cargoCancelacion > 0) {
        // Devolución parcial: totalAnticipos - cargoCancelacion
        const supabase = createAdminClient();
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
          cargoAplicado = Math.min(cargoCancelacion, totalAnticipos);
          totalDevuelto = Math.max(0, totalAnticipos - cargoAplicado);

          // Marcar anticipos como devueltos
          await supabase
            .from("anticipos_reparacion")
            .update({ estado: "devuelto", fecha_devuelto: ahora, motivo_devolucion: motivo })
            .eq("orden_id", id)
            .eq("estado", "pendiente");

          // Registrar devolución neta en caja
          if (sesionCajaId && totalDevuelto > 0) {
            await supabase.from("caja_movimientos").insert({
              sesion_id: sesionCajaId,
              tipo: "devolucion_anticipo",
              monto: totalDevuelto,
              concepto: `Devolución anticipo ${orden.folio} (menos cargo $${cargoAplicado.toFixed(2)}). Motivo: ${motivo}`,
              autorizado_por: userId,
            });
          }

          // El cargo de cancelación permanece en caja como ingreso
          if (sesionCajaId && cargoAplicado > 0) {
            await supabase.from("caja_movimientos").insert({
              sesion_id: sesionCajaId,
              tipo: "entrada_efectivo",
              monto: cargoAplicado,
              concepto: `Cargo cancelación reparación ${orden.folio}`,
              autorizado_por: userId,
            });
          }
        }
      } else {
        // Devolución completa (flujo admin normal)
        totalDevuelto = await devolverAnticiposOrden(
          id,
          orden.folio,
          motivo,
          sesionCajaId,
          userId
        );
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
