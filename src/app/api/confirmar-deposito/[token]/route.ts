import { NextResponse } from "next/server";
import { getConfirmacionByToken } from "@/lib/db/confirmaciones";
import { confirmarDeposito, rechazarDeposito } from "@/lib/db/confirmaciones";
import { getAuthContext } from "@/lib/auth/server";
import { getSesionActiva } from "@/lib/db/caja";

/**
 * GET /api/confirmar-deposito/[token]
 * Obtiene los datos de la confirmación por token (para la página pública).
 * No requiere auth — el token es suficiente para leer el registro.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 32) {
      return NextResponse.json({ success: false, error: "Token inválido" }, { status: 400 });
    }

    const confirmacion = await getConfirmacionByToken(token);
    if (!confirmacion) {
      return NextResponse.json({ success: false, error: "Token no encontrado o expirado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: confirmacion });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al obtener confirmación", message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/confirmar-deposito/[token]
 * Acción desde el link de WhatsApp (admin autenticado en la misma sesión de navegador).
 * Body: { accion: "confirmar" | "declinar", razon?: string }
 *
 * El admin debe estar autenticado — este endpoint verifica el rol y procede.
 * Es el mismo admin que recibe el link y abre el sistema con sesión activa.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Debes iniciar sesión para confirmar", requiresAuth: true },
        { status: 401 }
      );
    }
    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Solo el administrador puede realizar esta acción" }, { status: 403 });
    }

    const { token } = await params;
    const confirmacion = await getConfirmacionByToken(token);
    if (!confirmacion) {
      return NextResponse.json({ success: false, error: "Token no encontrado o expirado" }, { status: 404 });
    }

    // SEGURIDAD: verificar que la confirmación pertenece al distribuidor del admin
    if (!isSuperAdmin && confirmacion.distribuidorId && confirmacion.distribuidorId !== distribuidorId) {
      return NextResponse.json(
        { success: false, error: "No autorizado para confirmar este depósito" },
        { status: 403 }
      );
    }

    if (confirmacion.estado !== "pendiente_confirmacion") {
      return NextResponse.json({
        success: false,
        error: `Este depósito ya fue ${confirmacion.estado === "confirmado" ? "confirmado" : "rechazado"}.`,
        estado: confirmacion.estado,
      }, { status: 409 });
    }

    const body = await request.json();
    const accion = body.accion as "confirmar" | "declinar";

    if (!["confirmar", "declinar"].includes(accion)) {
      return NextResponse.json({ success: false, error: "Acción inválida" }, { status: 400 });
    }

    if (accion === "confirmar") {
      let sesionCajaId: string | undefined;
      try {
        const sesion = await getSesionActiva(userId);
        sesionCajaId = sesion?.id;
      } catch {
        // silencioso
      }

      const updated = await confirmarDeposito(confirmacion.id, userId, sesionCajaId);
      return NextResponse.json({
        success: true,
        data: updated,
        registradoEnCaja: !!sesionCajaId,
        message: sesionCajaId
          ? "✅ Depósito confirmado y asentado en caja."
          : "✅ Depósito confirmado. Abre una sesión de caja para asentarlo.",
      });
    }

    // Declinar
    const razon = (body.razon as string)?.trim();
    if (!razon) {
      return NextResponse.json({ success: false, error: "La razón del rechazo es requerida" }, { status: 400 });
    }

    const updated = await rechazarDeposito(confirmacion.id, userId, razon);
    return NextResponse.json({
      success: true,
      data: updated,
      message: "❌ Depósito rechazado y registrado en historial.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error al procesar acción", message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
