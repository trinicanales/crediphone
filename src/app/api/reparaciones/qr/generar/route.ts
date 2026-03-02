import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";

function generarTokenQR(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
    const { ordenId } = body;

    if (!ordenId) {
      return NextResponse.json(
        { success: false, message: "ordenId es requerido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

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

    // Generar token único
    const token = generarTokenQR();

    // Crear sesión QR
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // Expira en 2 horas

    const { data: sesion, error: sesionError } = await supabase
      .from("sesiones_fotos_qr")
      .insert({
        orden_id: ordenId,
        token,
        activa: true,
        imagenes_subidas: 0,
        max_imagenes: 10,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (sesionError) {
      console.error("Error al crear sesión QR:", sesionError);
      return NextResponse.json(
        { success: false, message: "Error al crear sesión QR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sesion: {
        id: sesion.id,
        token: sesion.token,
        ordenId: sesion.orden_id,
        maxImagenes: sesion.max_imagenes,
        expiresAt: sesion.expires_at,
        url: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/fotos/${sesion.token}`,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/qr/generar:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
