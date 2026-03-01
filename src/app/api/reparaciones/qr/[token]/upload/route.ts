import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente anónimo solo para validar la sesión QR pública
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET_NAME = "reparaciones";

async function subirArchivoQR(
  archivo: File,
  ordenId: string,
  tipoImagen: string
): Promise<{ url: string; path: string } | null> {
  try {
    const tiposPermitidos = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(archivo.type)) return null;
    if (archivo.size > 10 * 1024 * 1024) return null;

    const supabase = createAdminClient();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = archivo.name.split(".").pop() || "jpg";
    const nombreArchivo = `${ordenId}/${tipoImagen}/${timestamp}-${random}.${extension}`;
    const buffer = Buffer.from(await archivo.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(nombreArchivo, buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: archivo.type,
      });

    if (error) {
      console.error("Error al subir imagen QR al storage:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(nombreArchivo);
    return { url: urlData.publicUrl, path: nombreArchivo };
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

    // Validar sesión
    const { data: sesion, error: sesionError } = await supabaseAnon
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

    // Subir imagen al storage usando admin client (server-side, sin browser APIs)
    const resultado = await subirArchivoQR(archivo, sesion.orden_id, tipoImagen);

    if (!resultado) {
      return NextResponse.json(
        { success: false, message: "Error al subir imagen" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Guardar registro en la base de datos
    const { data: imagenGuardada, error: imagenError } = await supabaseAdmin
      .from("imagenes_reparacion")
      .insert({
        orden_id: sesion.orden_id,
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
    await supabaseAdmin
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
