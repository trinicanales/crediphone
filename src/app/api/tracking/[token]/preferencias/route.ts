import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/tracking/[token]/preferencias
 * Guarda las preferencias de promociones del cliente desde la página de tracking pública.
 * NO requiere autenticación — usa el token de tracking para identificar al cliente.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { success: false, error: "Token inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { aceptaPromociones, preferencias } = body;

    if (typeof aceptaPromociones !== "boolean") {
      return NextResponse.json(
        { success: false, error: "aceptaPromociones debe ser boolean" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validar token y obtener orden_id
    const { data: trackingData, error: trackingError } = await supabase
      .from("tracking_tokens")
      .select("orden_id, expires_at")
      .eq("token", token)
      .single();

    if (trackingError || !trackingData) {
      return NextResponse.json(
        { success: false, error: "Token inválido o expirado" },
        { status: 404 }
      );
    }

    // Verificar expiración
    if (trackingData.expires_at && new Date(trackingData.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Token expirado" },
        { status: 410 }
      );
    }

    // Obtener cliente_id desde la orden
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("cliente_id")
      .eq("id", trackingData.orden_id)
      .single();

    if (ordenError || !orden?.cliente_id) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Actualizar preferencias del cliente
    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        acepta_promociones_whatsapp: aceptaPromociones,
        preferencias_promociones: preferencias || {},
        fecha_consentimiento: new Date().toISOString(),
      })
      .eq("id", orden.cliente_id);

    if (updateError) {
      console.error("Error al actualizar preferencias:", updateError);
      return NextResponse.json(
        { success: false, error: "Error al guardar preferencias" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: aceptaPromociones
        ? "Preferencias guardadas. ¡Gracias! Te enviaremos información relevante."
        : "Preferencias guardadas. No recibirás mensajes promocionales.",
    });
  } catch (error) {
    console.error("Error en POST /api/tracking/[token]/preferencias:", error);
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
