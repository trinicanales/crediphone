import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGarantiasPieza,
  crearGarantiaPieza,
  resolverGarantiaPieza,
  actualizarEstadoGarantia,
} from "@/lib/db/reparaciones";
import type { TipoResolucionGarantiaPieza, EstadoGarantiaPieza } from "@/types";

/**
 * GET /api/reparaciones/[id]/garantias-piezas
 * Lista las garantías de piezas para una orden
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

    const garantias = await getGarantiasPieza(id);

    return NextResponse.json({ success: true, data: garantias });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/[id]/garantias-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al obtener garantías",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reparaciones/[id]/garantias-piezas
 * Solicita garantía para una pieza que falló o estaba dañada
 * Body: { piezaReparacionId, motivoGarantia }
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
        { success: false, error: "Solo técnicos y administradores pueden solicitar garantías" },
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
    const { piezaReparacionId, motivoGarantia } = body;

    if (!piezaReparacionId) {
      return NextResponse.json(
        { success: false, error: "piezaReparacionId es requerido" },
        { status: 400 }
      );
    }

    if (!motivoGarantia?.trim()) {
      return NextResponse.json(
        { success: false, error: "El motivo de garantía es requerido" },
        { status: 400 }
      );
    }

    const garantia = await crearGarantiaPieza(
      ordenId,
      piezaReparacionId,
      motivoGarantia.trim(),
      userId
    );

    return NextResponse.json(
      { success: true, data: garantia, message: "Garantía solicitada exitosamente" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/garantias-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al solicitar garantía",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reparaciones/[id]/garantias-piezas
 * Actualiza estado o resuelve una garantía
 * Body para resolver: { garantiaId, action: "resolver", tipoResolucion, notasResolucion }
 * Body para cambiar estado: { garantiaId, action: "estado", estado }
 * Acceso: admin, super_admin (para resolver); tecnico puede cambiar a "enviada"
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
    const { garantiaId, action } = body;

    if (!garantiaId) {
      return NextResponse.json(
        { success: false, error: "garantiaId es requerido" },
        { status: 400 }
      );
    }

    if (action === "resolver") {
      // Solo admin/super_admin puede resolver
      if (!["admin", "super_admin"].includes(role)) {
        return NextResponse.json(
          { success: false, error: "Solo administradores pueden resolver garantías" },
          { status: 403 }
        );
      }

      const { tipoResolucion, notasResolucion } = body;
      const tiposValidos: TipoResolucionGarantiaPieza[] = [
        "reemplazo", "reembolso", "reparacion", "sin_resolucion",
      ];

      if (!tipoResolucion || !tiposValidos.includes(tipoResolucion)) {
        return NextResponse.json(
          { success: false, error: "Tipo de resolución no válido" },
          { status: 400 }
        );
      }

      const garantia = await resolverGarantiaPieza(
        garantiaId,
        tipoResolucion as TipoResolucionGarantiaPieza,
        notasResolucion || "",
        userId
      );

      return NextResponse.json({
        success: true,
        data: garantia,
        message: "Garantía resuelta exitosamente",
      });
    }

    if (action === "estado") {
      const { estado } = body;
      const estadosValidos: EstadoGarantiaPieza[] = [
        "pendiente", "enviada", "aprobada", "rechazada", "resuelta",
      ];

      if (!estado || !estadosValidos.includes(estado)) {
        return NextResponse.json(
          { success: false, error: "Estado no válido" },
          { status: 400 }
        );
      }

      const garantia = await actualizarEstadoGarantia(garantiaId, estado);

      return NextResponse.json({
        success: true,
        data: garantia,
        message: `Garantía actualizada a: ${estado}`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Acción no válida. Use 'resolver' o 'estado'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en PATCH /api/reparaciones/[id]/garantias-piezas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al actualizar garantía",
      },
      { status: 500 }
    );
  }
}
