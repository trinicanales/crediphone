/**
 * Sistema de versiones de PDF para órdenes de reparación.
 *
 * Genera y persiste PDFs en R2 + registra en versiones_pdf_reparacion.
 * Fire-and-forget: las funciones no lanzan errores — fallan silenciosamente
 * para no bloquear el flujo principal.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { generarOrdenPDF } from "@/lib/pdf/orden-pdf";
import { r2Upload } from "@/lib/r2";

// URL pública del bucket R2
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "https://pub-89451411d31c49d9959b166475cda47a.r2.dev";

// Host de producción para los QR del PDF
const PDF_HOST = "crediphone.com.mx";
const PDF_PROTO = "https";

export type MotivoPDF =
  | "cotizacion_inicial"
  | "aprobacion_cliente"
  | "reaprobacion_presencial"
  | "cambio_presupuesto"
  | "entrega";

/**
 * Genera el PDF de la orden, lo sube a R2 y registra la versión en BD.
 * Retorna la URL pública del PDF o null si falló.
 */
export async function guardarVersionPDF(
  ordenId: string,
  folio: string,
  motivo: MotivoPDF,
  descripcion?: string,
  creadoPor?: string
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    // Obtener el siguiente número de versión para esta orden
    const { data: versiones } = await supabase
      .from("versiones_pdf_reparacion")
      .select("version")
      .eq("orden_id", ordenId)
      .order("version", { ascending: false })
      .limit(1);

    const siguienteVersion = versiones && versiones.length > 0
      ? (versiones[0].version + 1)
      : 1;

    // Generar el PDF
    const pdfBuffer = await generarOrdenPDF(ordenId, PDF_HOST, PDF_PROTO);

    // Construir la clave en R2
    const r2Key = `reparaciones/pdf/${ordenId}/v${siguienteVersion}-${motivo}-${folio}.pdf`;

    // Subir a R2
    await r2Upload(r2Key, pdfBuffer, "application/pdf");

    const urlPdf = `${R2_PUBLIC_URL}/${r2Key}`;

    // Registrar en BD
    await supabase.from("versiones_pdf_reparacion").insert({
      orden_id: ordenId,
      version: siguienteVersion,
      motivo,
      descripcion: descripcion ?? null,
      url_pdf: urlPdf,
      creado_por: creadoPor ?? null,
    });

    return urlPdf;
  } catch (err) {
    // No lanzar — el PDF versionado es complementario, no bloquea el flujo
    console.error("[versiones-pdf] Error al guardar versión PDF:", err);
    return null;
  }
}

/**
 * Obtiene todas las versiones PDF de una orden, ordenadas de más reciente a más antigua.
 */
export async function getVersionesPDF(ordenId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("versiones_pdf_reparacion")
    .select("id, version, motivo, descripcion, url_pdf, created_at, creado_por")
    .eq("orden_id", ordenId)
    .order("version", { ascending: false });

  if (error) return [];
  return (data ?? []).map((v: any) => ({
    id: v.id,
    version: v.version,
    motivo: v.motivo,
    descripcion: v.descripcion,
    urlPdf: v.url_pdf,
    createdAt: v.created_at,
  }));
}
