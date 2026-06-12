import { NextRequest, NextResponse } from "next/server";
import { searchOrdenes } from "@/lib/db/reparaciones";
import { getAuthContext } from "@/lib/auth/server";

/**
 * GET /api/reparaciones/buscar?q=...
 * Búsqueda global de órdenes incluyendo archivadas (entregado, cancelado, no_reparable).
 * Útil para búsqueda por IMEI con 500+ órdenes donde el filtro client-side no alcanza.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.length < 3) {
      return NextResponse.json({ success: true, data: [] });
    }

    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);
    const results = await searchOrdenes(q, filterDist);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("[buscar] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
