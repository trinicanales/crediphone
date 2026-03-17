import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { confirmarDeposito } from "@/lib/db/confirmaciones";
import { getSesionActiva } from "@/lib/db/caja";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/confirmaciones-deposito/[id]/confirmar
 * El admin confirma que el depósito/transferencia fue verificado.
 * → El anticipo entra a la caja activa del admin.
 * Roles: admin, super_admin
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Solo el administrador puede confirmar depósitos" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    // Buscar sesión activa del admin (para asentar en caja)
    let sesionCajaId: string | undefined;
    try {
      const sesion = await getSesionActiva(userId);
      sesionCajaId = sesion?.id;
    } catch {
      // Sin sesión — se confirma igual, solo no entra a caja
    }

    const confirmacion = await confirmarDeposito(id, userId, sesionCajaId);

    return NextResponse.json({
      success: true,
      data: confirmacion,
      registradoEnCaja: !!sesionCajaId,
      message: sesionCajaId
        ? "Depósito confirmado y asentado en caja."
        : "Depósito confirmado (sin sesión de caja activa — registra manualmente si es necesario).",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al confirmar depósito", message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
