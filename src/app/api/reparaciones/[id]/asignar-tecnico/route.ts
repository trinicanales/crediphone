import { NextResponse } from "next/server";
import { reasignarTecnico, getOrdenReparacionById } from "@/lib/db/reparaciones";
import { requireAuth } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/reparaciones/[id]/asignar-tecnico
 * Reasigna una orden de reparación a un técnico diferente
 *
 * Body:
 * - tecnicoId (required): UUID del nuevo técnico
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();

    // Validar UUID de la orden
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID de orden inválido",
          message: "El ID de orden proporcionado no es un UUID válido",
        },
        { status: 400 }
      );
    }

    // SEGURIDAD: validar que la orden pertenece al distribuidor del usuario
    if (!auth.isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: chk } = await supabase.from("ordenes_reparacion").select("distribuidor_id").eq("id", id).single();
      if (!chk || chk.distribuidor_id !== auth.distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
    }

    // Validar que se proporcione tecnicoId
    if (!body.tecnicoId) {
      return NextResponse.json(
        {
          success: false,
          error: "Técnico requerido",
          message: "Debe proporcionar el ID del técnico (tecnicoId)",
        },
        { status: 400 }
      );
    }

    // Validar UUID del técnico
    if (!uuidRegex.test(body.tecnicoId)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID de técnico inválido",
          message: "El ID de técnico proporcionado no es un UUID válido",
        },
        { status: 400 }
      );
    }

    // SEGURIDAD: validar que el técnico pertenece al mismo distribuidor
    if (!auth.isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: empTecnico } = await supabase
        .from("users")
        .select("distribuidor_id, role")
        .eq("id", body.tecnicoId)
        .single();
      if (!empTecnico || empTecnico.distribuidor_id !== auth.distribuidorId) {
        return NextResponse.json(
          { success: false, error: "El técnico no pertenece a esta tienda" },
          { status: 403 }
        );
      }
    }

    // Verificar que la orden existe
    const orden = await getOrdenReparacionById(id);
    if (!orden) {
      return NextResponse.json(
        {
          success: false,
          error: "Orden no encontrada",
          message: `No se encontró una orden con el ID ${id}`,
        },
        { status: 404 }
      );
    }

    // Reasignar técnico (la función valida que el técnico sea válido y activo)
    await reasignarTecnico(id, body.tecnicoId);

    // Obtener orden actualizada
    const ordenActualizada = await getOrdenReparacionById(id);

    return NextResponse.json({
      success: true,
      data: ordenActualizada,
      message: "Técnico reasignado exitosamente",
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/asignar-tecnico:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al reasignar técnico",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
