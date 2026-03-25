import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";
import { r2Upload, r2GetPublicUrl } from "@/lib/r2";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TIPOS_NO_SOPORTADOS = ["image/heic", "image/heif", "image/tiff", "image/avif"];

function generarPath(
  ordenId: string,
  tipoImagen: string,
  extension: string = "jpg"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `reparaciones/${ordenId}/${tipoImagen}/${timestamp}-${random}.${extension}`;
}

type ResultadoSubida =
  | { ok: true; url: string; path: string }
  | { ok: false; razon: string };

async function subirArchivoAR2(
  archivo: File,
  ordenId: string,
  tipoImagen: string
): Promise<ResultadoSubida> {
  try {
    const tipoNormalizado = archivo.type.toLowerCase();

    if (TIPOS_NO_SOPORTADOS.includes(tipoNormalizado)) {
      return {
        ok: false,
        razon: `Formato "${archivo.type}" no soportado. Convierte a JPEG, PNG o WebP. En iPhone: Ajustes > Cámara > Formatos > "Más compatible".`,
      };
    }

    if (!TIPOS_PERMITIDOS.includes(tipoNormalizado)) {
      return {
        ok: false,
        razon: `Formato "${archivo.type}" no aceptado. Solo JPEG, PNG y WebP.`,
      };
    }

    if (archivo.size > 10 * 1024 * 1024) {
      return {
        ok: false,
        razon: `"${archivo.name}" pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB. Límite: 10 MB.`,
      };
    }

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = generarPath(ordenId, tipoImagen, extension);
    const arrayBuffer = await archivo.arrayBuffer();

    await r2Upload(path, arrayBuffer, archivo.type);
    const url = r2GetPublicUrl(path);

    return { ok: true, url, path };
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
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

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
      const resultado = await subirArchivoAR2(archivo, ordenId, tipoImagen);

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
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

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
