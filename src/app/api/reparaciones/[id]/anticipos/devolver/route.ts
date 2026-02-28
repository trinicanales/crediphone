/**
 * POST /api/reparaciones/[id]/anticipos/devolver
 *
 * Devuelve todos los anticipos pendientes de una orden cancelada.
 * - Marca anticipos como "devuelto"
 * - Registra salida de caja tipo "devolucion_anticipo"
 */
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { devolverAnticiposOrden } from "@/lib/db/reparaciones";
import { getSesionActiva } from "@/lib/db/caja";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const permitidos = ["admin", "super_admin"];
    if (!permitidos.includes(role || "")) {
      return NextResponse.json({ success: false, error: "Solo admin puede registrar devoluciones" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const motivo: string = body.motivo || "Cliente canceló el servicio";

    const supabase = createAdminClient();

    // Obtener folio
    const { data: orden } = await supabase
      .from("ordenes_reparacion")
      .select("folio, estado")
      .eq("id", id)
      .single();

    if (!orden) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    // Sesión de caja activa
    let sesionCajaId: string | undefined;
    try {
      const sesion = await getSesionActiva(userId);
      sesionCajaId = sesion?.id;
    } catch { /* sin caja */ }

    const totalDevuelto = await devolverAnticiposOrden(
      id,
      orden.folio,
      motivo,
      sesionCajaId,
      userId
    );

    // Registrar en historial si hubo devolución
    if (totalDevuelto > 0) {
      await supabase.from("historial_estado_orden").insert({
        orden_id: id,
        estado_anterior: orden.estado,
        estado_nuevo: orden.estado,
        comentario: `Devolución de anticipo: $${totalDevuelto.toFixed(2)}. Motivo: ${motivo}`,
        usuario_id: userId,
      });
    }

    return NextResponse.json({
      success: true,
      message: totalDevuelto > 0
        ? `Devolución registrada: $${totalDevuelto.toFixed(2)}`
        : "No hay anticipos pendientes por devolver",
      data: {
        totalDevuelto,
        registradoEnCaja: !!sesionCajaId,
        motivo,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/anticipos/devolver:", error);
    return NextResponse.json({
      success: false,
      error: "Error al procesar devolución",
      message: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 500 });
  }
}
