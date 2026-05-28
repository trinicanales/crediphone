import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSolicitudesPieza,
  crearSolicitudPieza,
  actualizarEstadoSolicitud,
  eliminarSolicitudPieza,
} from "@/lib/db/reparaciones";

/**
 * GET /api/reparaciones/[id]/solicitudes-piezas
 * Lista las solicitudes de piezas al distribuidor para una orden
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    if (!isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: ordenCheck } = await supabase
        .from("ordenes_reparacion")
        .select("distribuidor_id")
        .eq("id", id)
        .single();
      if (ordenCheck?.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const solicitudes = await getSolicitudesPieza(id);

    return NextResponse.json({ success: true, data: solicitudes });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/[id]/solicitudes-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al obtener solicitudes",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reparaciones/[id]/solicitudes-piezas
 * Crea una solicitud de pieza al distribuidor
 * Body: { productoId?, nombrePieza, descripcion?, cantidad, notas?, fechaEstimadaLlegada? }
 * Acceso: admin, tecnico, super_admin
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "tecnico", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Solo técnicos y administradores pueden crear solicitudes" },
        { status: 403 }
      );
    }

    const { id: ordenId } = await params;

    if (!isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: ordenCheck } = await supabase
        .from("ordenes_reparacion")
        .select("distribuidor_id")
        .eq("id", ordenId)
        .single();
      if (ordenCheck?.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }
    const body = await request.json();
    const { productoId, nombrePieza, descripcion, cantidad, notas, fechaEstimadaLlegada } = body;

    if (!nombrePieza?.trim()) {
      return NextResponse.json(
        { success: false, error: "El nombre de la pieza es requerido" },
        { status: 400 }
      );
    }

    if (!cantidad || typeof cantidad !== "number" || cantidad < 1) {
      return NextResponse.json(
        { success: false, error: "La cantidad debe ser un número mayor a 0" },
        { status: 400 }
      );
    }

    const solicitud = await crearSolicitudPieza(
      ordenId,
      { productoId, nombrePieza: nombrePieza.trim(), descripcion, cantidad, notas, fechaEstimadaLlegada },
      userId
    );

    return NextResponse.json(
      { success: true, data: solicitud, message: "Solicitud creada exitosamente" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/solicitudes-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al crear solicitud",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reparaciones/[id]/solicitudes-piezas
 * Actualiza el estado de una solicitud
 * Body: { solicitudId, estado, notas? }
 * Acceso: admin, tecnico, super_admin
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "tecnico", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const { id: ordenId } = await params;

    if (!isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: ordenCheck } = await supabase
        .from("ordenes_reparacion")
        .select("distribuidor_id")
        .eq("id", ordenId)
        .single();
      if (ordenCheck?.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { solicitudId, estado, notas } = body;

    if (!solicitudId) {
      return NextResponse.json(
        { success: false, error: "solicitudId es requerido" },
        { status: 400 }
      );
    }

    if (!estado || !["pendiente", "enviada", "recibida", "cancelada"].includes(estado)) {
      return NextResponse.json(
        { success: false, error: "Estado no válido" },
        { status: 400 }
      );
    }

    const solicitud = await actualizarEstadoSolicitud(solicitudId, estado, notas);

    return NextResponse.json({
      success: true,
      data: solicitud,
      message: `Solicitud actualizada a: ${estado}`,
    });
  } catch (error) {
    console.error("Error en PATCH /api/reparaciones/[id]/solicitudes-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al actualizar solicitud",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reparaciones/[id]/solicitudes-piezas
 * Elimina una solicitud pendiente
 * Body: { solicitudId }
 * Acceso: admin, super_admin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "tecnico", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const { id: ordenId } = await params;

    if (!isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: ordenCheck } = await supabase
        .from("ordenes_reparacion")
        .select("distribuidor_id")
        .eq("id", ordenId)
        .single();
      if (ordenCheck?.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { solicitudId } = body;

    if (!solicitudId) {
      return NextResponse.json(
        { success: false, error: "solicitudId es requerido" },
        { status: 400 }
      );
    }

    await eliminarSolicitudPieza(solicitudId);

    return NextResponse.json({
      success: true,
      message: "Solicitud eliminada",
    });
  } catch (error) {
    console.error("Error en DELETE /api/reparaciones/[id]/solicitudes-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al eliminar solicitud",
      },
      { status: 500 }
    );
  }
}
