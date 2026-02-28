import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subirImagenReparacion } from "@/lib/storage-reparaciones";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const ordenId = formData.get("ordenId") as string;
    const tipoImagen = (formData.get("tipoImagen") as string) || "dispositivo";
    const descripcion = formData.get("descripcion") as string;
    const subidoDesde = (formData.get("subidoDesde") as string) || "web";

    // Obtener todas las imágenes (puede ser múltiple)
    const archivos: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("imagen") && value instanceof File) {
        archivos.push(value);
      }
    }

    if (!ordenId) {
      return NextResponse.json(
        { success: false, message: "ordenId es requerido" },
        { status: 400 }
      );
    }

    if (archivos.length === 0) {
      return NextResponse.json(
        { success: false, message: "No se proporcionaron imágenes" },
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

    // Obtener el orden de visualización actual
    const { data: ultimaImagen } = await supabase
      .from("imagenes_reparacion")
      .select("orden_visualizacion")
      .eq("orden_id", ordenId)
      .order("orden_visualizacion", { ascending: false })
      .limit(1)
      .single();

    let ordenVisualizacion = ultimaImagen
      ? ultimaImagen.orden_visualizacion + 1
      : 0;

    // Subir todas las imágenes
    const imagenesSubidas = [];

    for (const archivo of archivos) {
      // Subir al storage
      const resultado = await subirImagenReparacion(
        archivo,
        ordenId,
        tipoImagen as any
      );

      if (!resultado) {
        console.error("Error al subir imagen:", archivo.name);
        continue;
      }

      // Guardar en BD
      const { data: imagenGuardada, error: imagenError } = await supabase
        .from("imagenes_reparacion")
        .insert({
          orden_id: ordenId,
          tipo_imagen: tipoImagen,
          url_imagen: resultado.url,
          path_storage: resultado.path,
          orden_visualizacion: ordenVisualizacion,
          descripcion: descripcion || null,
          subido_desde: subidoDesde,
        })
        .select()
        .single();

      if (imagenError) {
        console.error("Error al guardar imagen en BD:", imagenError);
        continue;
      }

      imagenesSubidas.push(imagenGuardada);
      ordenVisualizacion++;
    }

    if (imagenesSubidas.length === 0) {
      return NextResponse.json(
        { success: false, message: "No se pudieron subir las imágenes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imagenes: imagenesSubidas,
      total: imagenesSubidas.length,
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/fotos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Listar fotos de una orden
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ordenId = searchParams.get("ordenId");

    if (!ordenId) {
      return NextResponse.json(
        { success: false, message: "ordenId es requerido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: imagenes, error } = await supabase
      .from("imagenes_reparacion")
      .select("*")
      .eq("orden_id", ordenId)
      .order("orden_visualizacion", { ascending: true });

    if (error) {
      console.error("Error al obtener imágenes:", error);
      return NextResponse.json(
        { success: false, message: "Error al obtener imágenes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imagenes: imagenes || [],
      total: imagenes?.length || 0,
    });
  } catch (error) {
    console.error("Error en GET /api/reparaciones/fotos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
