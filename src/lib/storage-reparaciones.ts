/**
 * Storage de imágenes de reparaciones — Cloudflare R2
 *
 * Las operaciones de subida/eliminación se delegan a API routes
 * (server-side → R2 binding). Las URLs son públicas.
 */
import imageCompression from "browser-image-compression";

const R2_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""
).replace(/\/$/, "");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Comprime una imagen antes de subirla (solo browser)
 */
export async function comprimirImagen(archivo: File): Promise<File> {
  const opciones = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
  };
  try {
    return await imageCompression(archivo, opciones);
  } catch (error) {
    console.error("Error al comprimir imagen:", error);
    return archivo;
  }
}

// ─── Funciones públicas ──────────────────────────────────────────────────────

/**
 * Sube una imagen de reparación a R2 vía API route
 */
export async function subirImagenReparacion(
  archivo: File,
  ordenId: string,
  tipoImagen:
    | "dispositivo"
    | "dano"
    | "accesorio"
    | "diagnostico"
    | "finalizado"
): Promise<{ url: string; path: string } | null> {
  try {
    const tiposPermitidos = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!tiposPermitidos.includes(archivo.type)) {
      throw new Error(
        "Tipo de archivo no permitido. Solo se aceptan imágenes JPEG, PNG y WebP."
      );
    }
    if (archivo.size > 10 * 1024 * 1024) {
      throw new Error("El archivo es demasiado grande. Máximo 10MB.");
    }

    // Comprimir si supera 2 MB
    let archivoFinal = archivo;
    if (archivo.size > 2 * 1024 * 1024) {
      archivoFinal = await comprimirImagen(archivo);
    }

    const form = new FormData();
    form.append("archivo", archivoFinal);
    form.append("carpeta", `reparaciones/${ordenId}/${tipoImagen}`);

    const resp = await fetch("/api/storage/upload", {
      method: "POST",
      body: form,
    });
    const json = (await resp.json()) as {
      success: boolean;
      url?: string;
      path?: string;
      message?: string;
    };

    if (!resp.ok || !json.success) {
      throw new Error(json.message ?? "Error al subir imagen");
    }

    return { url: json.url!, path: json.path! };
  } catch (error) {
    console.error("Error en subirImagenReparacion:", error);
    return null;
  }
}

/**
 * Sube múltiples imágenes en paralelo
 */
export async function subirMultiplesImagenes(
  archivos: File[],
  ordenId: string,
  tipoImagen:
    | "dispositivo"
    | "dano"
    | "accesorio"
    | "diagnostico"
    | "finalizado"
): Promise<Array<{ url: string; path: string } | null>> {
  return Promise.all(
    archivos.map((archivo) =>
      subirImagenReparacion(archivo, ordenId, tipoImagen)
    )
  );
}

/**
 * Elimina una imagen de reparación de R2 vía API route
 */
export async function eliminarImagenReparacion(
  path: string
): Promise<boolean> {
  try {
    const resp = await fetch(
      `/api/storage/delete?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
    const json = (await resp.json()) as { success: boolean };
    return resp.ok && json.success;
  } catch (error) {
    console.error("Error en eliminarImagenReparacion:", error);
    return false;
  }
}

/**
 * Con R2 público no se necesitan URLs firmadas.
 * Devuelve la URL pública directamente para mantener compatibilidad.
 */
export async function obtenerUrlFirmadaImagen(
  path: string,
  _duracionSegundos: number = 3600
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${R2_PUBLIC_URL}/${path}`;
}

/**
 * Lista imágenes de una orden (no disponible directo con R2;
 * usar la tabla imagenes_reparacion en BD en su lugar)
 */
export async function listarImagenesOrden(
  _ordenId: string
): Promise<
  Array<{ name: string; path: string; created_at: string; size: number }>
> {
  return [];
}

/**
 * Genera un token único de 64 caracteres para sesiones QR
 */
export function generarTokenQR(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/**
 * Valida que una URL de imagen sea del bucket R2 o de Supabase
 * (compatibilidad con fotos antiguas migradas)
 */
export function esImagenReparacionValida(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Acepta URLs de R2 configurado
    const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
    if (r2Base && url.startsWith(r2Base)) return true;
    // Compatibilidad con URLs antiguas de Supabase
    return (
      urlObj.hostname.includes("supabase.co") &&
      urlObj.pathname.includes("/reparaciones/")
    );
  } catch {
    return false;
  }
}
