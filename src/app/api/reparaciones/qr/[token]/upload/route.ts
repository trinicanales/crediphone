import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { subirImagenReparacion } from "@/lib/storage-reparaciones";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente anónimo para acceso público
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

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

    // Subir imagen al storage
    const resultado = await subirImagenReparacion(
      archivo,
      sesion.orden_id,
      tipoImagen as any
    );

    if (!resultado) {
      return NextResponse.json(
        { success: false, message: "Error al subir imagen" },
        { status: 500 }
      );
    }

    // Usar cliente admin para insertar en la BD
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
