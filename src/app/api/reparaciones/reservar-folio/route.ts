import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/reparaciones/reservar-folio
 * Genera un folio y lo registra como "reservado" en folios_reparacion.
 * Llamado cuando el modal de nueva orden se abre, para mostrar el folio antes de guardar.
 */
export async function POST() {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Generar folio único mediante la función RPC
    const { data: folioData, error: folioError } = await supabase.rpc("generar_folio_orden");

    if (folioError || !folioData) {
      throw new Error(`Error al generar folio: ${folioError?.message}`);
    }

    const folio = folioData as string;
    const filterDistribuidorId = isSuperAdmin ? null : (distribuidorId || null);

    // Registrar en la tabla de seguimiento de folios
    // Usamos upsert con ignoreDuplicates para evitar error si el folio ya existe
    // (puede pasar si el usuario abre/cierra el modal sin crear la orden)
    const { error: insertError } = await supabase
      .from("folios_reparacion")
      .upsert(
        {
          folio,
          estado: "reservado",
          distribuidor_id: filterDistribuidorId,
          creado_por: userId,
        },
        { onConflict: "folio", ignoreDuplicates: true }
      );

    if (insertError) {
      console.error("Error al registrar folio:", insertError);
      // No es crítico — el folio ya fue generado correctamente
    }

    return NextResponse.json({ success: true, folio });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/reservar-folio:", error);
    return NextResponse.json(
      { success: false, error: "Error al reservar folio" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reparaciones/reservar-folio
 * Marca un folio reservado como cancelado.
 * Llamado cuando el modal se cierra sin guardar la orden.
 */
export async function PATCH(request: Request) {
  try {
    const { userId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { folio } = await request.json();

    if (!folio) {
      return NextResponse.json({ success: false, error: "Folio requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    await supabase
      .from("folios_reparacion")
      .update({
        estado: "cancelado",
        cancelado_at: new Date().toISOString(),
      })
      .eq("folio", folio)
      .eq("estado", "reservado"); // Solo cancelar si aún está reservado

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en PATCH /api/reparaciones/reservar-folio:", error);
    return NextResponse.json(
      { success: false, error: "Error al cancelar folio" },
      { status: 500 }
    );
  }
}
