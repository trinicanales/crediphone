import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eliminarImagenReparacion } from "@/lib/storage-reparaciones";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ imagenId: string }> }
) {
  try {
    const { imagenId } = await params;

    if (!imagenId) {
      return NextResponse.json(
        { success: false, message: "imagenId es requerido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Obtener información de la imagen
    const { data: imagen, error: imagenError } = await supabase
      .from("imagenes_reparacion")
      .select("*")
      .eq("id", imagenId)
      .single();

    if (imagenError || !imagen) {
      return NextResponse.json(
        { success: false, message: "Imagen no encontrada" },
        { status: 404 }
      );
    }

    // Eliminar del storage
    const eliminadoStorage = await eliminarImagenReparacion(imagen.path_storage);

    if (!eliminadoStorage) {
      console.warn("No se pudo eliminar la imagen del storage");
      // Continuar de todas formas para eliminar de la BD
    }

    // Eliminar de la base de datos
    const { error: deleteError } = await supabase
      .from("imagenes_reparacion")
      .delete()
      .eq("id", imagenId);

    if (deleteError) {
      console.error("Error al eliminar imagen de BD:", deleteError);
      return NextResponse.json(
        { success: false, message: "Error al eliminar imagen de base de datos" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Imagen eliminada correctamente",
    });
  } catch (error) {
    console.error("Error en DELETE /api/reparaciones/fotos/[imagenId]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
