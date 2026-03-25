/**
 * Cloudflare R2 Storage — operaciones server-side
 *
 * Requiere binding R2_BUCKET en wrangler.jsonc.
 * Las URLs públicas usan NEXT_PUBLIC_R2_PUBLIC_URL.
 *
 * Para habilitar la URL pública del bucket:
 *   1. Cloudflare Dashboard → R2 → crediphone-storage
 *   2. Settings → Public Access → Allow Access
 *   3. Copia la URL (ej. https://pub-xxxx.r2.dev) y agrégala como
 *      NEXT_PUBLIC_R2_PUBLIC_URL en las variables del Worker
 *
 * Opcionalmente configura subdominio propio:
 *   storage.crediphone.com.mx → R2 bucket (Custom Domain en Dashboard)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBucket(): any {
  const { env } = getCloudflareContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bucket = (env as any).R2_BUCKET;
  if (!bucket) {
    throw new Error(
      "[R2] Binding R2_BUCKET no encontrado. Verifica wrangler.jsonc y que el Worker esté desplegado."
    );
  }
  return bucket;
}

/**
 * Sube un archivo a R2
 */
export async function r2Upload(
  path: string,
  data: ArrayBuffer | Buffer,
  contentType: string
): Promise<void> {
  const bucket = getBucket();
  await bucket.put(path, data, {
    httpMetadata: { contentType },
  });
}

/**
 * Elimina un archivo de R2 (no lanza error si no existe)
 */
export async function r2Delete(path: string): Promise<void> {
  try {
    const bucket = getBucket();
    await bucket.delete(path);
  } catch (error) {
    console.warn("[R2] Error al eliminar archivo:", path, error);
  }
}

/**
 * Construye la URL pública de un archivo en R2.
 * Requiere NEXT_PUBLIC_R2_PUBLIC_URL en las variables de entorno del Worker.
 */
export function r2GetPublicUrl(path: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) {
    console.warn("[R2] NEXT_PUBLIC_R2_PUBLIC_URL no configurada — las URLs de imágenes no funcionarán.");
  }
  return `${baseUrl}/${path}`;
}

/**
 * Verifica si una URL pertenece al bucket R2 configurado
 */
export function esUrlR2(url: string): boolean {
  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return baseUrl !== "" && url.startsWith(baseUrl);
}
