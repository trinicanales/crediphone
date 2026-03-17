import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getConfirmacionesPendientes,
  getConfirmaciones,
  countConfirmacionesPendientes,
} from "@/lib/db/confirmaciones";

/**
 * GET /api/confirmaciones-deposito
 * Lista confirmaciones pendientes (o todas con ?todas=true).
 * Roles: admin, super_admin
 *
 * Query params:
 *   ?estado=pendiente_confirmacion  (default) | confirmado | rechazado | todas
 *   ?count=true   → solo devuelve el conteo
 */
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const soloConteo = searchParams.get("count") === "true";
    const estado = searchParams.get("estado") ?? "pendiente_confirmacion";

    const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    if (soloConteo) {
      const count = await countConfirmacionesPendientes(filterDistribuidorId);
      return NextResponse.json({ success: true, count });
    }

    const data =
      estado === "pendiente_confirmacion"
        ? await getConfirmacionesPendientes(filterDistribuidorId)
        : await getConfirmaciones(filterDistribuidorId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al obtener confirmaciones", message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
