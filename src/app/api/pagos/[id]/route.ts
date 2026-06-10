import { NextResponse } from "next/server";
import { getPagoById, updatePago, deletePago } from "@/lib/db/pagos";
import { requireAuth } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

async function validarPagoPertenece(creditoId: string, distribuidorId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("creditos")
    .select("distribuidor_id")
    .eq("id", creditoId)
    .single();
  return !!data && data.distribuidor_id === distribuidorId;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "vendedor", "cobrador", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const pago = await getPagoById(id);

    if (!pago) {
      return NextResponse.json({ success: false, error: "Pago no encontrado" }, { status: 404 });
    }

    if (!auth.isSuperAdmin && auth.distribuidorId) {
      const pertenece = await validarPagoPertenece(pago.creditoId, auth.distribuidorId);
      if (!pertenece) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: pago });
  } catch (error) {
    console.error("Error al obtener pago:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener pago", message: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "cobrador", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const pago = await getPagoById(id);
    if (!pago) return NextResponse.json({ success: false, error: "Pago no encontrado" }, { status: 404 });

    if (!auth.isSuperAdmin && auth.distribuidorId) {
      const pertenece = await validarPagoPertenece(pago.creditoId, auth.distribuidorId);
      if (!pertenece) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const pagoActualizado = await updatePago(id, body);

    return NextResponse.json({ success: true, data: pagoActualizado });
  } catch (error) {
    console.error("Error al actualizar pago:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar pago", message: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const pago = await getPagoById(id);
    if (!pago) return NextResponse.json({ success: false, error: "Pago no encontrado" }, { status: 404 });

    if (!auth.isSuperAdmin && auth.distribuidorId) {
      const pertenece = await validarPagoPertenece(pago.creditoId, auth.distribuidorId);
      if (!pertenece) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    await deletePago(id);

    return NextResponse.json({ success: true, message: "Pago eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar pago:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar pago", message: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
