import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const supabase = createAdminClient();

    // Buscar sesión
    const { data: sesion, error: sesionError } = await supabase
      .from("sesiones_fotos_qr")
      .select("orden_id")
      .eq("token", token)
      .single();

    if (sesionError || !sesion) {
      return NextResponse.json(
        { success: false, message: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    // Obtener imágenes subidas vía QR
    // Si hay orden_id real → filtrar por orden_id
    // Si orden_id es null (modo creación) → filtrar por path_storage "temp/{token}/..."
    let query = supabase
      .from("imagenes_reparacion")
      .select("*")
      .eq("subido_desde", "qr")
      .order("created_at", { ascending: true });

    if (sesion.orden_id) {
      query = query.eq("orden_id", sesion.orden_id);
    } else {
      query = query.like("path_storage", `temp/${token}/%`);
    }

    const { data: imagenes, error: imagenesError } = await query;

    if (imagenesError) {
      console.error("Error al obtener imágenes:", imagenesError);
      return NextResponse.json(
        { success: false, message: "Error al obtener imágenes" },
        { status: 500 }
      );
    }

    // Mapear snake_case → camelCase para que el componente pueda renderizar las fotos
    const imagenesMapeadas = (imagenes || []).map((img) => ({
      id: img.id,
      ordenId: img.orden_id,
      tipoImagen: img.tipo_imagen,
      urlImagen: img.url_imagen,
      pathStorage: img.path_storage,
      ordenVisualizacion: img.orden_visualizacion,
      descripcion: img.descripcion,
      subidoDesde: img.subido_desde,
      createdAt: img.created_at,
    }));

    return NextResponse.json({
      success: true,
      imagenes: imagenesMapeadas,
      total: imagenesMapeadas.length,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/qr/[token]/fotos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
