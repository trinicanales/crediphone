/**
 * DELETE /api/storage/delete?path=<ruta>
 *
 * Proxy de eliminación de archivos en Cloudflare R2 desde el navegador.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { r2Delete } from "@/lib/r2";

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        { success: false, message: "Parámetro 'path' requerido" },
        { status: 400 }
      );
    }

    await r2Delete(path);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en DELETE /api/storage/delete:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
