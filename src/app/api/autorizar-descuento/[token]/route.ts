import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getSolicitudByToken,
  aprobarSolicitud,
  declinarSolicitud,
} from "@/lib/db/autorizaciones";

/**
 * GET /api/autorizar-descuento/[token]
 * Endpoint público (sin auth obligatoria) para previsualizar la solicitud.
 * Devuelve los datos visibles en la página pública de autorización.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const solicitud = await getSolicitudByToken(token);

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: "Token inválido o expirado" },
        { status: 404 }
      );
    }

    // Verificar si expiró
    const ahora = new Date();
    if (solicitud.estado === "pendiente" && solicitud.expiresAt < ahora) {
      return NextResponse.json(
        { success: false, error: "Esta solicitud ha expirado" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: solicitud.id,
        estado: solicitud.estado,
        empleadoNombre: solicitud.empleadoNombre,
        montoVenta: solicitud.montoVenta,
        montoDescuento: solicitud.montoDescuento,
        porcentajeCalculado: solicitud.porcentajeCalculado,
        esMontFijo: solicitud.esMontFijo,
        razon: solicitud.razon,
        contexto: solicitud.contexto,
        autorizadorNombre: solicitud.autorizadorNombre,
        comentarioAutorizador: solicitud.comentarioAutorizador,
        respondidoAt: solicitud.respondidoAt,
        expiresAt: solicitud.expiresAt,
        createdAt: solicitud.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/autorizar-descuento/[token]
 * El admin abre el link de WhatsApp y aprueba o declina.
 * Requiere sesión activa de admin/super_admin.
 * Si no hay sesión → devuelve { requiresAuth: true }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Intentar obtener contexto de auth (puede fallar si no hay sesión)
    const authCtx = await getAuthContext().catch(() => null);

    if (!authCtx?.userId) {
      // SEGURIDAD: retornar 401 con requiresAuth para que el frontend muestre login
      return NextResponse.json(
        { success: false, requiresAuth: true, error: "Se requiere iniciar sesión" },
        { status: 401 }
      );
    }
    if (!["admin", "super_admin"].includes(authCtx.role ?? "")) {
      return NextResponse.json(
        { success: false, error: "Solo administradores pueden autorizar descuentos" },
        { status: 403 }
      );
    }

    const { token } = await params;
    const solicitud = await getSolicitudByToken(token);

    if (!solicitud) {
      return NextResponse.json(
        { success: false, error: "Token inválido o expirado" },
        { status: 404 }
      );
    }

    if (solicitud.estado !== "pendiente") {
      return NextResponse.json(
        { success: false, error: `La solicitud ya fue ${solicitud.estado}` },
        { status: 409 }
      );
    }

    const ahora = new Date();
    if (solicitud.expiresAt < ahora) {
      return NextResponse.json(
        { success: false, error: "La solicitud ha expirado" },
        { status: 410 }
      );
    }

    // Verificar que el admin pertenece al mismo distribuidor
    if (
      authCtx.role !== "super_admin" &&
      solicitud.distribuidorId &&
      solicitud.distribuidorId !== authCtx.distribuidorId
    ) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const accion = body.accion as "aprobar" | "declinar";
    const comentario = typeof body.comentario === "string" ? body.comentario.trim() : "";
    const autorizadorNombre = typeof body.autorizadorNombre === "string"
      ? body.autorizadorNombre
      : "Administrador";

    if (!["aprobar", "declinar"].includes(accion)) {
      return NextResponse.json(
        { success: false, error: "Acción inválida" },
        { status: 400 }
      );
    }

    if (accion === "declinar" && !comentario) {
      return NextResponse.json(
        { success: false, error: "Se requiere un comentario para declinar" },
        { status: 400 }
      );
    }

    let resultado;
    if (accion === "aprobar") {
      resultado = await aprobarSolicitud(
        solicitud.id,
        authCtx.userId,
        autorizadorNombre,
        comentario || undefined
      );
    } else {
      resultado = await declinarSolicitud(
        solicitud.id,
        authCtx.userId,
        autorizadorNombre,
        comentario
      );
    }

    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
