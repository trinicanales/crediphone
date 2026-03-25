/**
 * POST /api/storage/upload
 *
 * Proxy de subida de archivos desde el navegador a Cloudflare R2.
 * Reemplaza la subida directa al storage de Supabase.
 *
 * FormData params:
 *   archivo  — File a subir
 *   carpeta  — Prefijo de carpeta en R2 (ej. "productos/celulares")
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { r2Upload, r2GetPublicUrl } from "@/lib/r2";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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
    const archivo = formData.get("archivo") as File | null;
    const carpeta = ((formData.get("carpeta") as string) || "general")
      .replace(/^\/|\/$/g, ""); // trim slashes

    if (!archivo) {
      return NextResponse.json(
        { success: false, message: "No se proporcionó archivo" },
        { status: 400 }
      );
    }

    const tipoNormalizado = archivo.type.toLowerCase();
    if (!TIPOS_PERMITIDOS.includes(tipoNormalizado)) {
      return NextResponse.json(
        {
          success: false,
          message: `Tipo "${archivo.type}" no permitido. Solo JPEG, PNG, WebP y GIF.`,
        },
        { status: 422 }
      );
    }

    if (archivo.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB. Máximo 10 MB.`,
        },
        { status: 422 }
      );
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const nombreLimpio = archivo.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/\.[^/.]+$/, "");

    const path = `${carpeta}/${nombreLimpio}-${timestamp}-${random}.${extension}`;
    const arrayBuffer = await archivo.arrayBuffer();

    await r2Upload(path, arrayBuffer, archivo.type);
    const url = r2GetPublicUrl(path);

    return NextResponse.json({ success: true, url, path });
  } catch (error) {
    console.error("Error en POST /api/storage/upload:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
