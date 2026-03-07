import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";

/**
 * POST /api/reparaciones/fotos/ligar-sesion-qr
 *
 * Liga las fotos subidas por QR (antes de crear la orden) a la orden recién creada.
 * Esto pasa cuando el empleado usa el QR durante la creación de la orden:
 *   1. Se genera el QR sin orden_id (null)
 *   2. El cliente sube fotos desde su celular → quedan con orden_id = null
 *   3. Al guardar la orden, se llama este endpoint para asignarles el orden_id real
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionToken, ordenId } = body;

    if (!sessionToken || !ordenId) {
      return NextResponse.json(
        { success: false, message: "sessionToken y ordenId son requeridos" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Buscar la sesión QR por token para obtener su ID
    const { data: sesion, error: sesionError } = await supabase
      .from("sesiones_fotos_qr")
      .select("id, orden_id")
      .eq("token", sessionToken)
      .single();

    if (sesionError || !sesion) {
      return NextResponse.json(
        { success: false, message: "Sesión QR no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que la orden existe
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("id")
      .eq("id", ordenId)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json(
        { success: false, message: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Las fotos subidas en modo creación se guardan en "temp/{sessionToken}/..."
    // Actualizar todas las que tengan ese path para asignarles la orden real
    const { data: imagenesActualizadas } = await supabase
      .from("imagenes_reparacion")
      .update({ orden_id: ordenId })
      .is("orden_id", null)
      .like("path_storage", `temp/${sessionToken}/%`)
      .select("id");

    const totalLigadas = imagenesActualizadas?.length ?? 0;

    // Actualizar la sesión QR para que también apunte a la orden real
    await supabase
      .from("sesiones_fotos_qr")
      .update({ orden_id: ordenId })
      .eq("token", sessionToken);

    return NextResponse.json({
      success: true,
      fotosLigadas: totalLigadas,
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/fotos/ligar-sesion-qr:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
