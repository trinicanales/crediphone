import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reparaciones/tecnicos?distribuidorId=<uuid>
 * Técnicos y administradores que pueden trabajar una orden: SOLO usuarios activos de la tienda
 * indicada y solo si la tienda está activa. (El listado general de empleados mostraba al
 * super_admin los usuarios de todas las tiendas, incluidas las desactivadas.)
 *  - admin / vendedor / tecnico: siempre su propia tienda.
 *  - super_admin: la tienda indicada en ?distribuidorId (obligatoria).
 */
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin", "vendedor", "tecnico"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tienda = isSuperAdmin ? searchParams.get("distribuidorId") : distribuidorId;
    if (!tienda) {
      return NextResponse.json({ success: true, data: [] });
    }

    const supabase = createAdminClient();

    const { data: dist } = await supabase
      .from("distribuidores")
      .select("id, activo")
      .eq("id", tienda)
      .single();
    if (!dist || dist.activo === false) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("distribuidor_id", tienda)
      .eq("activo", true)
      .in("role", ["tecnico", "admin"])
      .order("name");
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((u) => ({ id: u.id, nombre: u.name ?? u.id, role: u.role })),
    });
  } catch (error) {
    console.error("[reparaciones/tecnicos] Error:", error);
    return NextResponse.json({ success: false, error: "Error al cargar técnicos" }, { status: 500 });
  }
}
