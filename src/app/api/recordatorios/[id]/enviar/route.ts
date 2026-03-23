import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { registrarNotificacion } from "@/lib/db/notificaciones";
import type { CanalNotificacion, TipoNotificacion } from "@/lib/types/notificaciones";

/**
 * POST /api/recordatorios/[id]/enviar
 * Registra el envío de un recordatorio.
 * Requiere autenticación — guarda el userId como enviadoPor.
 *
 * Body:
 * {
 *   clienteId: string;
 *   tipo: TipoNotificacion;
 *   canal: CanalNotificacion;
 *   mensaje: string;
 *   telefono?: string;
 *   email?: string;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth — capturar quién envía el recordatorio
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id: creditoId } = await params;

    // Validar que creditoId sea un UUID válido
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(creditoId)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID de crédito inválido",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { clienteId, tipo, canal, mensaje, telefono, email } = body;

    // Validaciones
    if (!clienteId || !canal || !mensaje) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos requeridos: clienteId, canal, mensaje",
        },
        { status: 400 }
      );
    }

    // Validar tipo de notificación
    const tiposValidos: TipoNotificacion[] = [
      "proximo_vencer",
      "vencido",
      "mora_alta",
      "pago_recibido",
    ];
    const tipoNotificacion: TipoNotificacion = tipo || "proximo_vencer";
    if (!tiposValidos.includes(tipoNotificacion)) {
      return NextResponse.json(
        {
          success: false,
          error: `Tipo de notificación inválido. Debe ser: ${tiposValidos.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validar canal
    const canalesValidos: CanalNotificacion[] = [
      "whatsapp",
      "email",
      "sms",
      "llamada",
      "visita",
    ];
    if (!canalesValidos.includes(canal)) {
      return NextResponse.json(
        {
          success: false,
          error: `Canal inválido. Debe ser: ${canalesValidos.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validar que se proporcione telefono si canal es whatsapp/sms/llamada
    if (["whatsapp", "sms", "llamada"].includes(canal) && !telefono) {
      return NextResponse.json(
        {
          success: false,
          error: `Se requiere teléfono para canal: ${canal}`,
        },
        { status: 400 }
      );
    }

    // Validar que se proporcione email si canal es email
    if (canal === "email" && !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere email para canal: email",
        },
        { status: 400 }
      );
    }

    // Registrar notificación en base de datos (con enviadoPor capturado del auth)
    const notificacion = await registrarNotificacion({
      creditoId,
      clienteId,
      tipo: tipoNotificacion,
      canal: canal as CanalNotificacion,
      estado: "enviado",
      mensaje,
      telefono,
      email,
      fechaEnviado: new Date().toISOString(),
      enviadoPor: userId,
    });

    return NextResponse.json({
      success: true,
      data: notificacion,
      message: "Recordatorio registrado exitosamente",
    });
  } catch (error) {
    console.error("[API] Error al enviar recordatorio:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al registrar recordatorio",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
