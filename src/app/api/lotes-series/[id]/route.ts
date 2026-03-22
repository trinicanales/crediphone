import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getLoteSerieById, procesarLote, cancelarLote } from "@/lib/db/lotesSeries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    const { id } = await params;
    const lote = await getLoteSerieById(id);
    if (!lote) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: lote });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const rolesPermitidos = ["admin", "super_admin"];
    if (!rolesPermitidos.includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.accion === "procesar") {
      await procesarLote(id);
    } else if (body.accion === "cancelar") {
      await cancelarLote(id);
    } else {
      return NextResponse.json({ success: false, error: "Acción no válida" }, { status: 400 });
    }

    const lote = await getLoteSerieById(id);
    return NextResponse.json({ success: true, data: lote });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
