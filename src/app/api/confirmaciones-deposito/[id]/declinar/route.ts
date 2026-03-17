import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { rechazarDeposito } from "@/lib/db/confirmaciones";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/confirmaciones-deposito/[id]/declinar
 * El admin rechaza el depósito — el anticipo queda registrado pero sin caja.
 * Body: { razon: string }
 * Roles: admin, super_admin
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Solo el administrador puede rechazar depósitos" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const razon = (body.razon as string)?.trim();
    if (!razon) {
      return NextResponse.json({ success: false, error: "La razón del rechazo es requerida" }, { status: 400 });
    }

    const confirmacion = await rechazarDeposito(id, userId, razon);

    return NextResponse.json({
      success: true,
      data: confirmacion,
      message: "Depósito rechazado. El anticipo queda en el historial sin afectar caja.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al rechazar depósito", message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
