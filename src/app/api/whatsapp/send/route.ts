/**
 * FASE 55: POST /api/whatsapp/send
 * Envía un mensaje de WhatsApp via API o retorna link wa.me
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { sendWhatsApp } from "@/lib/whatsapp-api";

export async function POST(request: Request) {
  try {
    const { userId, distribuidorId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { telefono, mensaje, entidadTipo, entidadId, forceLinkMode } = body;

    if (!telefono || !mensaje) {
      return NextResponse.json(
        { success: false, error: "telefono y mensaje son requeridos" },
        { status: 400 }
      );
    }

    // super_admin puede especificar distribuidorId manualmente
    const targetDistribuidorId =
      role === "super_admin"
        ? (body.distribuidorId ?? distribuidorId ?? undefined)
        : (distribuidorId ?? undefined);

    const result = await sendWhatsApp({
      telefono,
      mensaje,
      distribuidorId: targetDistribuidorId,
      entidadTipo,
      entidadId,
      enviadoPorId: userId,
      forceLinkMode: forceLinkMode ?? false,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[POST /api/whatsapp/send]", error);
    return NextResponse.json(
      { success: false, error: "Error al enviar mensaje" },
      { status: 500 }
    );
  }
}
