import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente anónimo para acceso público
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token no proporcionado" },
        { status: 400 }
      );
    }

    // Buscar sesión activa
    const { data: sesion, error } = await supabaseAnon
      .from("sesiones_fotos_qr")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !sesion) {
      return NextResponse.json(
        { success: false, message: "Sesión no encontrada o expirada" },
        { status: 404 }
      );
    }

    // Verificar si está activa y no expiró
    const ahora = new Date();
    const expiracion = new Date(sesion.expires_at);

    if (!sesion.activa || expiracion < ahora) {
      // Si expiró pero activa=true, corregir el flag en BD
      if (sesion.activa && expiracion < ahora) {
        await createAdminClient()
          .from("sesiones_fotos_qr")
          .update({ activa: false })
          .eq("id", sesion.id);
      }
      return NextResponse.json(
        { success: false, message: "Sesión expirada" },
        { status: 403 }
      );
    }

    // Obtener información de la orden
    const { data: orden, error: ordenError } = await supabaseAnon
      .from("ordenes_reparacion")
      .select("folio, marca_dispositivo, modelo_dispositivo")
      .eq("id", sesion.orden_id)
      .single();

    if (ordenError) {
      console.error("Error al obtener orden:", ordenError);
    }

    return NextResponse.json({
      success: true,
      sesion: {
        id: sesion.id,
        ordenId: sesion.orden_id,
        imagenesSubidas: sesion.imagenes_subidas,
        maxImagenes: sesion.max_imagenes,
        expiresAt: sesion.expires_at,
        activa: sesion.activa,
        orden: orden || null,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/qr/[token]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
