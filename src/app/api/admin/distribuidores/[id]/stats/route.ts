import { NextResponse } from "next/server";
import { inicioDiaMX } from "@/lib/fechas";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId || role !== "super_admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id: distribuidorId } = await params;
    const supabase = createAdminClient();

    const [
      { count: totalClientes },
      { count: totalCreditos },
      { count: creditosActivos },
      { count: totalProductos },
      { count: totalEmpleados },
      { count: ventasHoy },
      { data: empleados },
      { data: creditosData },
    ] = await Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).eq("distribuidor_id", distribuidorId),
      supabase.from("creditos").select("*", { count: "exact", head: true }).eq("distribuidor_id", distribuidorId),
      supabase.from("creditos").select("*", { count: "exact", head: true }).eq("distribuidor_id", distribuidorId).eq("estado", "activo"),
      supabase.from("productos").select("*", { count: "exact", head: true }).eq("distribuidor_id", distribuidorId),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("distribuidor_id", distribuidorId).eq("activo", true),
      supabase.from("ventas").select("*", { count: "exact", head: true }).eq("distribuidor_id", distribuidorId).gte("created_at", inicioDiaMX().toISOString()),
      supabase.from("users").select("id, name, role, activo, created_at").eq("distribuidor_id", distribuidorId).order("created_at", { ascending: false }),
      supabase.from("creditos").select("monto, estado").eq("distribuidor_id", distribuidorId),
    ]);

    const montoTotalCreditos = creditosData?.reduce((sum, c) => sum + Number(c.monto || 0), 0) ?? 0;
    const montoActivosCreditos = creditosData?.filter(c => c.estado === "activo").reduce((sum, c) => sum + Number(c.monto || 0), 0) ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        totalClientes: totalClientes ?? 0,
        totalCreditos: totalCreditos ?? 0,
        creditosActivos: creditosActivos ?? 0,
        totalProductos: totalProductos ?? 0,
        totalEmpleados: totalEmpleados ?? 0,
        ventasHoy: ventasHoy ?? 0,
        montoTotalCreditos,
        montoActivosCreditos,
        empleados: empleados ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
