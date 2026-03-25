import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2Upload, r2GetPublicUrl } from "@/lib/r2";

async function subirArchivoQR(
  archivo: File,
  ordenId: string | null,
  tipoImagen: string,
  sessionToken: string
): Promise<{ url: string; path: string } | null> {
  try {
    const tiposPermitidos = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(archivo.type)) return null;
    if (archivo.size > 10 * 1024 * 1024) return null;

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";

    // Si hay orden: guardar bajo el ID de la orden
    // Si no hay orden (creación): guardar bajo "temp/{token}" para poder ligar después
    const carpeta = ordenId
      ? `reparaciones/${ordenId}`
      : `reparaciones/temp/${sessionToken}`;
    const path = `${carpeta}/${tipoImagen}/${timestamp}-${random}.${extension}`;
    const arrayBuffer = await archivo.arrayBuffer();

    await r2Upload(path, arrayBuffer, archivo.type);
    const url = r2GetPublicUrl(path);

    return { url, path };
  } catch (error) {
    console.error("Error en subirArchivoQR:", error);
    return null;
  }
}

export async function POST(
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

    // Validar sesión
    const { data: sesion, error: sesionError } = await supabase
      .from("sesiones_fotos_qr")
      .select("*")
      .eq("token", token)
      .single();

    if (sesionError || !sesion) {
      return NextResponse.json(
        { success: false, message: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    // Verificar si está activa y no expiró
    const ahora = new Date();
    const expiracion = new Date(sesion.expires_at);

    if (!sesion.activa || expiracion < ahora) {
      if (sesion.activa && expiracion < ahora) {
        await supabase
          .from("sesiones_fotos_qr")
          .update({ activa: false })
          .eq("id", sesion.id);
      }
      return NextResponse.json(
        { success: false, message: "Sesión expirada" },
        { status: 403 }
      );
    }

    // Verificar si ya alcanzó el límite de imágenes
    if (sesion.imagenes_subidas >= sesion.max_imagenes) {
      return NextResponse.json(
        { success: false, message: "Límite de imágenes alcanzado" },
        { status: 400 }
      );
    }

    // Obtener archivo del form-data
    const formData = await request.formData();
    const archivo = formData.get("imagen") as File;
    const tipoImagen = (formData.get("tipoImagen") as string) || "dispositivo";
    const descripcion = formData.get("descripcion") as string;

    if (!archivo) {
      return NextResponse.json(
        { success: false, message: "No se proporcionó imagen" },
        { status: 400 }
      );
    }

    // Subir imagen al storage; si orden_id es null (creación), usa el token como carpeta temp
    const resultado = await subirArchivoQR(archivo, sesion.orden_id, tipoImagen, token);

    if (!resultado) {
      return NextResponse.json(
        { success: false, message: "Error al subir imagen" },
        { status: 500 }
      );
    }

    // Guardar registro en la base de datos
    // orden_id puede ser null si la foto se subió durante la creación de la orden;
    // en ese caso se liga a la orden real después de crearla
    const { data: imagenGuardada, error: imagenError } = await supabase
      .from("imagenes_reparacion")
      .insert({
        orden_id: sesion.orden_id || null,
        tipo_imagen: tipoImagen,
        url_imagen: resultado.url,
        path_storage: resultado.path,
        orden_visualizacion: sesion.imagenes_subidas,
        descripcion: descripcion || null,
        subido_desde: "qr",
      })
      .select()
      .single();

    if (imagenError) {
      console.error("Error al guardar imagen en BD:", imagenError);
      return NextResponse.json(
        { success: false, message: "Error al guardar imagen en base de datos" },
        { status: 500 }
      );
    }

    // Actualizar contador de imágenes subidas en la sesión
    await supabase
      .from("sesiones_fotos_qr")
      .update({
        imagenes_subidas: sesion.imagenes_subidas + 1,
      })
      .eq("id", sesion.id);

    return NextResponse.json({
      success: true,
      imagen: imagenGuardada,
      imagenesRestantes: sesion.max_imagenes - sesion.imagenes_subidas - 1,
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/qr/[token]/upload:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
