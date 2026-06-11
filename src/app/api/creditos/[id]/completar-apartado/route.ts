import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { completarApartado } from "@/lib/db/creditos";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!isSuperAdmin && !distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin franquicia asignada" }, { status: 403 });
    }

    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Verificar que el crédito es un apartado activo de esta franquicia
    const supabase = createAdminClient();
    let checkQ = supabase
      .from("creditos")
      .select("id, tipo, estado, distribuidor_id")
      .eq("id", id)
      .eq("tipo", "apartado")
      .single();

    const { data: apartado, error: checkErr } = await checkQ;
    if (checkErr || !apartado) {
      return NextResponse.json({ success: false, error: "Apartado no encontrado" }, { status: 404 });
    }
    if (!isSuperAdmin && apartado.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }
    if (apartado.estado !== "activo") {
      return NextResponse.json({ success: false, error: "El apartado ya no está activo" }, { status: 400 });
    }

    await completarApartado(id, filterDist ?? apartado.distribuidor_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("completar-apartado error:", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
