import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getAlertasPendientes,
  getAllAlertas,
  updateAlertaEstado,
} from "@/lib/db/verificaciones";

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "Solo administradores pueden ver alertas" },
        { status: 403 }
      );
    }

    // super_admin sin filtro ve todo; admin solo ve las de su distribuidor
    const effectiveDistId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    const searchParams = request.nextUrl.searchParams;
    const pendingOnly = searchParams.get("pending") === "true";

    if (pendingOnly) {
      const alertas = await getAlertasPendientes(effectiveDistId);
      return NextResponse.json({ success: true, data: alertas });
    }

    const alertas = await getAllAlertas(effectiveDistId);
    return NextResponse.json({ success: true, data: alertas });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/alertas:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener alertas" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "Solo administradores pueden actualizar alertas" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { alertaId, estado, notas } = body;

    if (
      !alertaId ||
      !estado ||
      !["revisado", "registrado", "descartado"].includes(estado)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "alertaId y estado válido son requeridos",
        },
        { status: 400 }
      );
    }

    const alerta = await updateAlertaEstado(alertaId, estado, userId, notas);

    return NextResponse.json({ success: true, data: alerta });
  } catch (error: any) {
    console.error("Error in PUT /api/inventario/alertas:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al actualizar alerta" },
      { status: 500 }
    );
  }
}
