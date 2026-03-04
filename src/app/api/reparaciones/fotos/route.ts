import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "reparaciones";

// Tipos aceptados por el bucket (debe coincidir con la configuración de Supabase)
const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
// Tipos comunes de iPhone/HEIC que el bucket NO acepta — avisar al usuario
const TIPOS_NO_SOPORTADOS = ["image/heic", "image/heif", "image/tiff", "image/avif"];

function generarNombreArchivo(ordenId: string, tipoImagen: string, extension: string = "jpg"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${ordenId}/${tipoImagen}/${timestamp}-${random}.${extension}`;
}

type ResultadoSubida =
  | { ok: true; url: string; path: string }
  | { ok: false; razon: string };

async function subirArchivoAlStorage(
  supabase: ReturnType<typeof createAdminClient>,
  archivo: File,
  ordenId: string,
  tipoImagen: string
): Promise<ResultadoSubida> {
  try {
    const tipoNormalizado = archivo.type.toLowerCase();

    // Detectar formatos no soportados (ej: HEIC de iPhone)
    if (TIPOS_NO_SOPORTADOS.includes(tipoNormalizado)) {
      return {
        ok: false,
        razon: `Formato "${archivo.type}" no soportado. Convierte a JPEG, PNG o WebP antes de subir. En iPhone: ve a Ajustes > Cámara > Formatos y selecciona "Más compatible".`,
      };
    }

    // Verificar tipo permitido
    if (!TIPOS_PERMITIDOS.includes(tipoNormalizado)) {
      return {
        ok: false,
        razon: `Formato "${archivo.type}" no aceptado. Solo se permiten: JPEG, PNG y WebP.`,
      };
    }

    // Verificar tamaño (10MB máximo)
    if (archivo.size > 10 * 1024 * 1024) {
      return {
        ok: false,
        razon: `El archivo "${archivo.name}" pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB. El límite es 10 MB.`,
      };
    }

    const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
    const nombreArchivo = generarNombreArchivo(ordenId, tipoImagen, extension);
    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(nombreArchivo, buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: archivo.type,
      });

    if (storageError) {
      console.error(`[fotos] Error al subir "${archivo.name}" al storage:`, storageError);
      return {
        ok: false,
        razon: `Error de almacenamiento: ${storageError.message}`,
      };
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(nombreArchivo);
    return { ok: true, url: urlData.publicUrl, path: nombreArchivo };
  } catch (error) {
    console.error(`[fotos] Excepción al subir "${archivo.name}":`, error);
    return {
      ok: false,
      razon: `Error inesperado al procesar "${archivo.name}"`,
    };
  }
}

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
      console.error("[fotos] Orden no encontrada:", ordenId, ordenError?.message);
      return NextResponse.json(
        { success: false, message: `Orden no encontrada (ID: ${ordenId})` },
        { status: 404 }
      );
    }

    // Obtener el orden de visualización actual (usar maybeSingle para evitar error si no hay imágenes)
    const { data: ultimaImagen } = await supabase
      .from("imagenes_reparacion")
      .select("orden_visualizacion")
      .eq("orden_id", ordenId)
      .order("orden_visualizacion", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ordenVisualizacion = ultimaImagen
      ? (ultimaImagen.orden_visualizacion ?? 0) + 1
      : 0;

    // Subir todas las imágenes y recolectar errores para reporte
    const imagenesSubidas = [];
    const errores: string[] = [];

    for (const archivo of archivos) {
      const resultado = await subirArchivoAlStorage(supabase, archivo, ordenId, tipoImagen);

      if (!resultado.ok) {
        console.error(`[fotos] Fallo en "${archivo.name}": ${resultado.razon}`);
        errores.push(`${archivo.name}: ${resultado.razon}`);
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
        console.error("[fotos] Error al guardar imagen en BD:", imagenError);
        errores.push(`${archivo.name}: Error al guardar en base de datos (${imagenError.message})`);
        continue;
      }

      imagenesSubidas.push(imagenGuardada);
      ordenVisualizacion++;
    }

    if (imagenesSubidas.length === 0) {
      const mensajeError = errores.length > 0
        ? errores[0]  // Mostrar el primer error específico
        : "No se pudieron subir las imágenes";
      return NextResponse.json(
        {
          success: false,
          message: mensajeError,
          errores,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      imagenes: imagenesSubidas,
      total: imagenesSubidas.length,
      advertencias: errores.length > 0 ? errores : undefined,
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
