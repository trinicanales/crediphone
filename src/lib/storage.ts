/**
 * Storage de imágenes de productos — Cloudflare R2
 *
 * Las operaciones de subida/eliminación se delegan a API routes
 * (server-side → R2 binding). Las URLs usan NEXT_PUBLIC_R2_PUBLIC_URL.
 */

const R2_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""
).replace(/\/$/, "");

// ─── Helpers ────────────────────────────────────────────────────────────────

function generarNombreArchivo(
  nombreOriginal: string,
  categoria: string = "otros"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = nombreOriginal.split(".").pop()?.toLowerCase() ?? "jpg";
  const nombreLimpio = nombreOriginal
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.[^/.]+$/, "");
  return `productos/${categoria}/${nombreLimpio}-${timestamp}-${random}.${extension}`;
}

// ─── Funciones públicas ──────────────────────────────────────────────────────

/**
 * Sube una imagen de producto a R2 vía API route
 */
export async function subirImagen(
  archivo: File,
  categoria: string = "otros"
): Promise<{ url: string; path: string } | null> {
  try {
    const tiposPermitidos = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!tiposPermitidos.includes(archivo.type)) {
      throw new Error(
        "Tipo de archivo no permitido. Solo se aceptan imágenes JPEG, PNG, WebP y GIF."
      );
    }
    if (archivo.size > 5 * 1024 * 1024) {
      throw new Error("El archivo es demasiado grande. Máximo 5MB.");
    }

    const form = new FormData();
    form.append("archivo", archivo);
    form.append("carpeta", `productos/${categoria}`);

    const resp = await fetch("/api/storage/upload", {
      method: "POST",
      body: form,
    });
    const json = (await resp.json()) as { success: boolean; url?: string; path?: string; message?: string };

    if (!resp.ok || !json.success) {
      throw new Error(json.message ?? "Error al subir imagen");
    }

    return { url: json.url!, path: json.path! };
  } catch (error) {
    console.error("Error en subirImagen:", error);
    return null;
  }
}

/**
 * Elimina una imagen de R2 vía API route
 */
export async function eliminarImagen(path: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `/api/storage/delete?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
    const json = (await resp.json()) as { success: boolean };
    return resp.ok && json.success;
  } catch (error) {
    console.error("Error en eliminarImagen:", error);
    return false;
  }
}

/**
 * Devuelve la URL pública de una imagen dado su path.
 *
 * Casos:
 *  1. URL completa (nuevas subidas a R2)  → devolver tal cual
 *  2. Path relativo (imágenes antiguas en Supabase Storage) → construir URL de Supabase
 *     El bucket "productos" en Supabase guarda los objetos con el path tal cual está en BD.
 *     Ej. path="productos/crop-abc.jpg" → .../public/productos/productos/crop-abc.jpg
 */
const SUPABASE_STORAGE_URL =
  "https://ihvjjfsefnvcrczrcmhp.supabase.co/storage/v1/object/public/productos";

export function obtenerUrlImagen(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  // Nuevas subidas a R2 → URL completa almacenada directamente en BD
  if (path.startsWith("http")) return path;
  // Imágenes antiguas en Supabase Storage
  return `${SUPABASE_STORAGE_URL}/${path}`;
}

/**
 * Lista imágenes de una categoría (no disponible directamente con R2 binding;
 * se mantiene por compatibilidad — devuelve vacío)
 */
export async function listarImagenes(
  _categoria?: string
): Promise<string[]> {
  return [];
}

/**
 * Actualiza la imagen de un producto: elimina la anterior y sube la nueva
 */
export async function actualizarImagenProducto(
  imagenAnterior: string | null,
  nuevaImagen: File,
  categoria: string = "otros"
): Promise<{ url: string; path: string } | null> {
  try {
    if (imagenAnterior) {
      await eliminarImagen(imagenAnterior);
    }
    return await subirImagen(nuevaImagen, categoria);
  } catch (error) {
    console.error("Error en actualizarImagenProducto:", error);
    return null;
  }
}

// ─── Constantes ─────────────────────────────────────────────────────────────

export const CATEGORIAS_IMAGENES = {
  PRODUCTOS: "productos",
  CELULARES: "celulares",
  ACCESORIOS: "accesorios",
  LAPTOPS: "laptops",
  TABLETS: "tablets",
  SMARTWATCHES: "smartwatches",
  AUDIFONOS: "audifonos",
  OTROS: "otros",
} as const;

export type CategoriaImagen =
  (typeof CATEGORIAS_IMAGENES)[keyof typeof CATEGORIAS_IMAGENES];
