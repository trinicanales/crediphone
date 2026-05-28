import { createAdminClient } from "@/lib/supabase/admin";
import jsPDF from "jspdf";
import QRCode from "qrcode";

/* ──────────────────────────────────────────────────────────────────────────
   ORDEN DE REPARACIÓN / CONTRATO DE SERVICIO — CREDIPHONE
   Formato: Carta (216 × 279 mm) · Una o dos páginas según contenido
   ────────────────────────────────────────────────────────────────────────── */

const PW = 216;
const PH = 279;
const ML = 5;
const MR = 5;
const CW = PW - ML - MR; // 206 mm
const CONTENT_MAX = PH - 5; // ≈ 274 mm

function maybeBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > CONTENT_MAX) {
    doc.addPage("letter");
    return 12;
  }
  return y;
}

const C = {
  brandDark : [9,  36,  74],
  brandMid  : [14, 53, 112],
  accent    : [0, 153, 184],
  gray      : [55, 55, 55],
  grayLight : [130,130,130],
  grayLine  : [200,200,200],
  red       : [180, 30, 30],
  green     : [22, 128, 62],
  amber     : [155, 95, 0],
  blue      : [0,  80, 180],
  white     : [255,255,255],
  bgLight   : [247,249,252],
  bgRed     : [254,242,242],
  bgGreen   : [240,253,244],
  bgAmber   : [255,251,235],
};

const tc = (doc: jsPDF, c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
const fc = (doc: jsPDF, c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
const dc = (doc: jsPDF, c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

function hLine(doc: jsPDF, y: number, thick = false): number {
  dc(doc, C.grayLine);
  doc.setLineWidth(thick ? 0.4 : 0.18);
  doc.line(ML, y, PW - MR, y);
  return y + 2.5;
}

function sectionLabel(doc: jsPDF, txt: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  tc(doc, C.brandMid);
  doc.text(txt.toUpperCase(), x, y);
  tc(doc, C.gray);
  return y + 4.2;
}

function dataRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number
): number {
  const v = (value || "").trim();
  if (!v || v === "—") return y;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  tc(doc, C.grayLight);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  tc(doc, C.gray);
  const lines = doc.splitTextToSize(v, maxW - 23);
  doc.text(lines, x + 21, y);
  return y + Math.max(lines.length * 3.8, 4.2);
}

function renderEstadoFisico(ef: unknown): string {
  if (!ef || typeof ef !== "object" || Array.isArray(ef)) return "";
  const obj = ef as Record<string, unknown>;
  const campos: Record<string, string> = {
    marco: "Marco", bisel: "Bisel/Cristal", pantallaFisica: "Pantalla física",
    camaraLente: "Lente cámara", tapaTrasera: "Tapa trasera",
  };
  const estados: Record<string, string> = {
    perfecto: "Perfecto", rallado: "Rallado", golpeado: "Golpeado", quebrado: "Quebrado",
    buen_estado: "Bueno", rayada: "Rayada", rota: "Rota",
    manchas: "Manchas", ok: "OK", danado: "Dañado", sucio: "Sucio",
  };
  const parts: string[] = [];
  Object.entries(campos).forEach(([k, label]) => {
    if (obj[k] !== undefined) {
      const val = estados[String(obj[k])] || String(obj[k]);
      parts.push(`${label}: ${val}`);
    }
  });
  if (obj.tieneSIM)       parts.push("Con SIM");
  if (obj.tieneMemoriaSD) parts.push("Con SD");
  if (typeof obj.observacionesFisicas === "string" && obj.observacionesFisicas.trim()) {
    parts.push(`Obs: ${obj.observacionesFisicas.trim()}`);
  }
  return parts.join("  ·  ");
}

function parseCondiciones(cond: unknown): {
  oks: string[];
  fallas: string[];
  alertas: { text: string; color: number[] }[];
  extras: string[];
} {
  const oks: string[] = [], fallas: string[] = [];
  const alertas: { text: string; color: number[] }[] = [];
  const extras: string[] = [];
  if (!cond || typeof cond !== "object" || Array.isArray(cond)) {
    return { oks, fallas, alertas, extras };
  }
  const obj = cond as Record<string, unknown>;
  const nombres: Record<string, string> = {
    bateria: "Batería", pantallaTactil: "Pantalla/Táctil", camaras: "Cámaras",
    microfono: "Micrófono", altavoz: "Altavoz", bluetooth: "Bluetooth",
    wifi: "WiFi", botonEncendido: "Encendido", botonesVolumen: "Volumen",
    sensorHuella: "Huella",
  };
  Object.entries(nombres).forEach(([k, v]) => {
    if (obj[k] === "ok")    oks.push(v);
    if (obj[k] === "falla") fallas.push(v);
  });
  if (obj.llegaApagado)    alertas.push({ text: "⚠ Llega apagado",     color: C.amber });
  if (obj.estaMojado)      alertas.push({ text: "⚠ Daño por líquido",  color: C.blue  });
  if (obj.bateriaHinchada) alertas.push({ text: "⚠ Batería hinchada",  color: C.red   });
  return { oks, fallas, alertas, extras };
}

function buildTerms(cond: unknown, imei?: string, empresa = "CREDIPHONE"): string[] {
  const obj = (cond && typeof cond === "object" && !Array.isArray(cond))
    ? cond as Record<string, unknown>
    : null;

  const compNombres: Record<string, string> = {
    bateria: "batería", pantallaTactil: "pantalla/táctil", camaras: "cámaras",
    microfono: "micrófono", altavoz: "altavoz", bluetooth: "Bluetooth",
    wifi: "WiFi", botonEncendido: "botón de encendido", botonesVolumen: "botones de volumen",
    sensorHuella: "sensor de huella",
  };

  const terms: string[] = [
    `Propiedad y datos: El cliente declara ser propietario legítimo del equipo. ${empresa} no se responsabiliza por pérdida de datos; se recomienda respaldo previo.`,
    `Garantía: 90 días naturales sobre mano de obra (LFPC Art. 76 bis). No aplica por golpes, líquidos ni mal uso posteriores al servicio.`,
    "Diagnóstico: Si el cliente rechaza el presupuesto, el equipo se devuelve en el estado recibido. Al aprobar, autoriza expresamente los trabajos y el costo indicado.",
    `Resguardo y recolección (LFPC Art. 63): El cliente tiene 30 días naturales a partir de la notificación de equipo listo para recogerlo sin cargo adicional. Transcurrido dicho plazo se aplicará una tarifa de almacenaje diaria. A los 90 días sin reclamación, ${empresa} podrá disponer del equipo para recuperar costos. El cliente acepta estas condiciones al firmar.`,
    "T&C completos disponibles en el código QR de este documento.",
  ];

  const extras: string[] = [];
  if (obj?.estaMojado)      extras.push("humedad preexistente");
  if (obj?.bateriaHinchada) extras.push("batería deformada");
  if (obj?.llegaApagado)    extras.push("ingresa sin encender");

  const fallas: string[] = [];
  if (obj) {
    Object.entries(compNombres).forEach(([k, v]) => {
      if (obj[k] === "falla") fallas.push(v);
    });
  }

  const notas: string[] = [];
  if (extras.length > 0) notas.push(`Condiciones documentadas: ${extras.join(", ")}`);
  if (fallas.length > 0)  notas.push(`Fallas preexistentes: ${fallas.join(", ")}`);
  if (notas.length > 0) {
    terms.splice(terms.length - 1, 0, `${notas.join(". ")}. ${empresa} no responde por estas condiciones ni su agravamiento.`);
  }

  const imeiVacio = !imei || !imei.trim() ||
    imei.trim().toLowerCase() === "na" ||
    imei.trim().toLowerCase() === "n/a";
  if (imeiVacio) {
    terms.splice(terms.length - 1, 0,
      "Sin IMEI verificable: el cliente asume plena responsabilidad por la legitimidad del equipo."
    );
  }

  return terms;
}

/**
 * Genera el PDF de una orden de reparación y lo devuelve como Buffer.
 * No requiere autenticación — el caller debe verificar acceso antes de invocar.
 */
export async function generarOrdenPDF(
  ordenId: string,
  host: string,
  proto: string
): Promise<Buffer> {
  const supabase = createAdminClient();

  const { data: orden, error } = await supabase
    .from("ordenes_reparacion")
    .select("*, clientes:cliente_id (nombre, apellido, telefono, direccion), tecnico:tecnico_id (name)")
    .eq("id", ordenId)
    .single();

  if (error || !orden) {
    throw new Error("Orden no encontrada");
  }

  // Datos del negocio — uno por distribuidor (multi-tenant)
  const { data: config } = await supabase
    .from("configuracion")
    .select("nombre_empresa, rfc, direccion_empresa, telefono_empresa, regimen_fiscal")
    .eq("distribuidor_id", orden.distribuidor_id)
    .maybeSingle();

  const nombreEmpresa    = config?.nombre_empresa     || "Servicio Técnico";
  const rfcEmpresa       = config?.rfc                || "";
  const direccionEmpresa = config?.direccion_empresa  || "";
  const telefonoEmpresa  = config?.telefono_empresa   || "";
  const regimenFiscal    = config?.regimen_fiscal      || "";

  const lineaFiscal = [
    nombreEmpresa,
    direccionEmpresa && `· ${direccionEmpresa}`,
    telefonoEmpresa  && `· Tel: ${telefonoEmpresa}`,
    rfcEmpresa       && `· RFC: ${rfcEmpresa}`,
    regimenFiscal    && `· ${regimenFiscal}`,
  ].filter(Boolean).join("  ");

  const { data: anticipos } = await supabase
    .from("anticipos_reparacion")
    .select("fecha_anticipo, monto, tipo_pago, estado")
    .eq("orden_id", ordenId)
    .neq("estado", "devuelto")
    .order("fecha_anticipo", { ascending: true });

  const { data: piezas } = await supabase
    .from("reparacion_piezas")
    .select("nombre_pieza, cantidad, costo_unitario, producto_id, productos(nombre)")
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: true });

  // Calidad de piezas: viene de pedidos_pieza_reparacion (confirmada al recibir)
  const { data: pedidosCalidad } = await supabase
    .from("pedidos_pieza_reparacion")
    .select("nombre_pieza, producto_id, calidad")
    .eq("orden_id", ordenId)
    .not("calidad", "is", null);

  const { data: garantiaRecord } = await supabase
    .from("garantias_reparacion")
    .select("dias_garantia, tipo_garantia, fecha_vencimiento")
    .eq("orden_id", ordenId)
    .maybeSingle();

  const totalAnticipos = (anticipos || []).reduce(
    (s: number, a: { monto?: unknown }) => s + Number(a.monto || 0), 0
  );
  const precioTotal = Number(orden.precio_total || orden.presupuesto_total || orden.costo_total || 0);
  const piezasCotizacion: Array<{ nombre: string; cantidad: number; precioUnitario: number; precioTotal: number }> =
    Array.isArray(orden.piezas_cotizacion) ? orden.piezas_cotizacion : [];
  const precioManoObra = Number(orden.precio_mano_obra || orden.costo_reparacion || 0);
  const precioPiezas  = Number(orden.precio_piezas  || orden.costo_partes || 0);
  const cargoCancelacion = Number(orden.cargo_cancelacion ?? 100);

  const trackingUrl = `${proto}://${host}/reparacion/${orden.folio}`;
  const terminosUrl = `${proto}://${host}/terminos`;

  let qrTrackData = "";
  let qrTermsData = "";
  try {
    qrTrackData = await QRCode.toDataURL(trackingUrl, { width: 140, margin: 3, errorCorrectionLevel: "M" });
    qrTermsData = await QRCode.toDataURL(terminosUrl,  { width: 70,  margin: 3, errorCorrectionLevel: "M" });
  } catch { /* continuar sin QR */ }

  const doc = new jsPDF({ format: "letter", unit: "mm" });
  let y = 8;

  /* ── 1. ENCABEZADO ────────────────────────────────────────────────────── */
  const QR_BIG   = 30;
  const QR_SMALL = 20;
  const QR_GAP   = 10;
  const qrBigX   = PW - MR - QR_BIG;
  const qrSmallX = qrBigX - QR_SMALL - QR_GAP;
  const hdrContentW = qrSmallX - 4 - ML;

  if (qrTrackData) {
    fc(doc, C.white);
    dc(doc, C.brandMid);
    doc.setLineWidth(0.4);
    doc.roundedRect(qrBigX - 1.5, y - 1, QR_BIG + 3, QR_BIG + 8.5, 1.5, 1.5, "FD");
    doc.addImage(qrTrackData, "PNG", qrBigX, y, QR_BIG, QR_BIG);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    tc(doc, C.brandMid);
    doc.text("SEGUIMIENTO",  qrBigX + QR_BIG / 2, y + QR_BIG + 3,   { align: "center" });
    doc.text("EN LÍNEA",     qrBigX + QR_BIG / 2, y + QR_BIG + 6.5, { align: "center" });
  }

  const qrSmallTopOffset = (QR_BIG - QR_SMALL) / 2;
  if (qrTermsData) {
    fc(doc, C.white);
    dc(doc, C.grayLine);
    doc.setLineWidth(0.25);
    doc.roundedRect(qrSmallX - 1, y + qrSmallTopOffset - 1, QR_SMALL + 2, QR_SMALL + 8.5, 1, 1, "FD");
    doc.addImage(qrTermsData, "PNG", qrSmallX, y + qrSmallTopOffset, QR_SMALL, QR_SMALL);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    tc(doc, C.grayLight);
    doc.text("TÉRMINOS Y",  qrSmallX + QR_SMALL / 2, y + qrSmallTopOffset + QR_SMALL + 3,   { align: "center" });
    doc.text("CONDICIONES", qrSmallX + QR_SMALL / 2, y + qrSmallTopOffset + QR_SMALL + 6.5, { align: "center" });
  }

  fc(doc, C.brandDark);
  doc.rect(ML, y, 1.8, 25, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  tc(doc, C.brandDark);
  doc.text(nombreEmpresa.toUpperCase(), ML + 5, y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  tc(doc, C.gray);
  const subtitleLines = doc.splitTextToSize(
    "ORDEN DE REPARACIÓN / CONTRATO DE SERVICIO", hdrContentW
  );
  doc.text(subtitleLines, ML + 5, y + 16.5);

  const fechaStr = new Date(orden.created_at).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const prioLabel = (orden.prioridad || "Normal").toUpperCase();
  const prioColor =
    orden.prioridad === "urgente" ? C.red :
    orden.prioridad === "alta"    ? C.amber : C.grayLight;

  let infoX = ML + 5;
  const infoY = y + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  tc(doc, C.brandDark);
  doc.text(`Folio: ${orden.folio}`, infoX, infoY);
  infoX += doc.getTextWidth(`Folio: ${orden.folio}`) + 2;

  doc.setFont("helvetica", "normal");
  tc(doc, C.grayLight);
  doc.text(` · ${fechaStr}`, infoX, infoY);
  infoX += doc.getTextWidth(` · ${fechaStr}`) + 2;

  tc(doc, prioColor);
  doc.text(` · ${prioLabel}`, infoX, infoY);
  infoX += doc.getTextWidth(` · ${prioLabel}`) + 3;

  if (orden.es_garantia) {
    doc.setFont("helvetica", "bold");
    tc(doc, C.green);
    doc.text("★ EN GARANTÍA", infoX, infoY);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  tc(doc, C.grayLight);
  doc.text(lineaFiscal, ML + 5, infoY + 5, { maxWidth: hdrContentW });

  tc(doc, C.gray);
  y += 44;

  /* ── 2. CLIENTE | DISPOSITIVO ─────────────────────────────────────────── */
  const colW = CW / 2 - 2;
  const c1 = ML, c2 = ML + CW / 2 + 2;
  let y1 = y + 1, y2 = y + 1;

  y1 = sectionLabel(doc, "Datos del Cliente", c1, y1);
  const cli = orden.clientes as Record<string, string> | null;
  if (cli) {
    const nombre = `${cli.nombre || ""} ${cli.apellido || ""}`.trim();
    y1 = dataRow(doc, "Nombre:",    nombre,              c1, y1, colW);
    y1 = dataRow(doc, "Teléfono:", cli.telefono || "",  c1, y1, colW);
    if (cli.direccion) y1 = dataRow(doc, "Dirección:", cli.direccion, c1, y1, colW);
  }

  y2 = sectionLabel(doc, "Dispositivo", c2, y2);
  y2 = dataRow(doc, "Marca:",    orden.marca_dispositivo  || "", c2, y2, colW);
  y2 = dataRow(doc, "Modelo:",   orden.modelo_dispositivo || "", c2, y2, colW);
  if (orden.imei)                  y2 = dataRow(doc, "IMEI:",      orden.imei,                  c2, y2, colW);
  if (orden.numero_serie)          y2 = dataRow(doc, "N° Serie:",  orden.numero_serie,          c2, y2, colW);
  if (orden.accesorios_incluidos) y2 = dataRow(doc, "Accesorios:", orden.accesorios_incluidos, c2, y2, colW);

  y = Math.max(y1, y2) + 1;
  y = hLine(doc, y);

  /* ── 3. PROBLEMA | CONDICIONES AL RECIBIR ────────────────────────────── */
  y1 = y + 1; y2 = y + 1;

  y1 = sectionLabel(doc, "Problema Reportado", c1, y1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  tc(doc, C.gray);
  const probLines = doc.splitTextToSize(orden.problema_reportado || "—", colW);
  doc.text(probLines, c1, y1);
  y1 += probLines.length * 4 + 1;

  if (orden.notas_internas) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    tc(doc, C.grayLight);
    const nLines = doc.splitTextToSize(`Nota interna: ${orden.notas_internas}`, colW);
    doc.text(nLines, c1, y1);
    y1 += nLines.length * 3.5 + 1;
  }
  tc(doc, C.gray);

  y2 = sectionLabel(doc, "Condiciones al Recibir", c2, y2);
  const { oks, fallas, alertas: alts, extras } =
    parseCondiciones(orden.condiciones_funcionamiento);

  const efObj = (orden.estado_fisico_dispositivo && typeof orden.estado_fisico_dispositivo === "object" && !Array.isArray(orden.estado_fisico_dispositivo))
    ? orden.estado_fisico_dispositivo as Record<string, unknown>
    : null;
  if (efObj?.tieneSIM)       extras.push("SIM incluida");
  if (efObj?.tieneMemoriaSD) extras.push("MicroSD incluida");

  doc.setFontSize(7);

  alts.forEach(({ text, color }) => {
    doc.setFont("helvetica", "bold");
    tc(doc, color);
    doc.text(text, c2, y2);
    y2 += 3.8;
  });

  if (fallas.length > 0) {
    doc.setFont("helvetica", "bold");
    tc(doc, C.red);
    const fallaStr = `✗ Fallas: ${fallas.join(", ")}`;
    const fLines = doc.splitTextToSize(fallaStr, colW);
    doc.text(fLines, c2, y2);
    y2 += fLines.length * 3.8;
  }

  if (extras.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    tc(doc, C.grayLight);
    doc.text(extras.join("  ·  "), c2, y2);
    y2 += 3.5;
  }

  if (alts.length === 0 && fallas.length === 0 && oks.length === 0) {
    doc.setFont("helvetica", "normal");
    tc(doc, C.grayLight);
    doc.text("Sin condiciones especiales registradas", c2, y2);
    y2 += 4;
  }

  tc(doc, C.gray);
  doc.setFont("helvetica", "normal");
  y = Math.max(y1, y2) + 1;
  y = hLine(doc, y);

  /* ── 3B+4. TÉCNICO · DIAGNÓSTICO · ESTADO FÍSICO | PRESUPUESTO ────────── */
  {
    const tec = orden.tecnico as Record<string, string> | null;
    const tecNombre = tec ? (tec.name || "").trim() : "";
    const diagTexto = (orden.diagnostico_tecnico || "").trim();
    const efTexto = renderEstadoFisico(orden.estado_fisico_dispositivo);

    y = maybeBreak(doc, y, 22);
    y1 = y + 1; y2 = y + 1;

    if (tecNombre) {
      y1 = sectionLabel(doc, "Técnico Responsable", c1, y1);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      tc(doc, C.gray);
      doc.text(tecNombre, c1, y1);
      y1 += 5;

      if (garantiaRecord) {
        const gVenc = garantiaRecord.fecha_vencimiento
          ? new Date(garantiaRecord.fecha_vencimiento).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
          : "";
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        tc(doc, C.green);
        doc.text(`Garantía ${garantiaRecord.dias_garantia ?? 90} días — vence: ${gVenc}`, c1, y1);
        y1 += 4;
      }
    }

    if (diagTexto) {
      y1 = sectionLabel(doc, "Diagnóstico Técnico", c1, y1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      tc(doc, C.gray);
      const diagLines = doc.splitTextToSize(diagTexto, colW);
      doc.text(diagLines, c1, y1);
      y1 += diagLines.length * 4 + 1;
    }

    if (efTexto) {
      y1 = sectionLabel(doc, "Estado Físico del Dispositivo", c1, y1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      tc(doc, C.gray);
      const efLines = doc.splitTextToSize(efTexto, colW);
      doc.text(efLines, c1, y1);
      y1 += efLines.length * 3.8 + 1;
    }

    if (orden.patron_desbloqueo || orden.password_dispositivo) {
      y1 = sectionLabel(doc, "Acceso al Dispositivo", c1, y1);
      if (orden.patron_desbloqueo)    y1 = dataRow(doc, "Patrón:",     orden.patron_desbloqueo,    c1, y1, colW);
      if (orden.password_dispositivo) y1 = dataRow(doc, "Contraseña:", orden.password_dispositivo, c1, y1, colW);
    }

    // Presupuesto (derecha)
    const tienepiézasReales = piezas && piezas.length > 0;
    const labelPresupuesto = tienepiézasReales ? "Presupuesto / Anticipos" : "Cotización Estimada / Anticipos";
    y2 = sectionLabel(doc, labelPresupuesto, c2, y2);

    if (!tienepiézasReales && precioTotal > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      tc(doc, C.amber);
      doc.text("* Presupuesto estimado — sujeto a cambio al confirmar piezas", c2, y2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      tc(doc, C.gray);
      y2 += 4.5;
    }

    if (!tienepiézasReales && piezasCotizacion.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      tc(doc, C.brandMid);
      doc.text("PIEZAS COTIZADAS:", c2, y2);
      y2 += 4;

      piezasCotizacion.forEach((p) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        tc(doc, C.grayLight);
        const nombreLines = doc.splitTextToSize(`${p.nombre}${p.cantidad > 1 ? ` ×${p.cantidad}` : ""}`, colW - 22);
        doc.text(nombreLines, c2, y2);
        tc(doc, C.gray);
        doc.text(`$${Number(p.precioTotal || 0).toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
        y2 += nombreLines.length * 3.5;
      });

      dc(doc, C.grayLine);
      doc.setLineWidth(0.12);
      doc.line(c2, y2, c2 + colW, y2);
      y2 += 3;
    }

    doc.setFontSize(7.5);

    const metodoPagoLabel: Record<string, string> = {
      efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transf.",
      deposito: "Depósito", mixto: "Mixto",
    };

    if (precioTotal > 0) {
      if (precioManoObra > 0) {
        doc.setFont("helvetica", "normal");
        tc(doc, C.grayLight);
        doc.text("Mano de obra:", c2, y2);
        tc(doc, C.gray);
        doc.text(`$${precioManoObra.toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
        y2 += 4;
      }
      if (precioPiezas > 0) {
        doc.setFont("helvetica", "normal");
        tc(doc, C.grayLight);
        doc.text(tienepiézasReales ? "Piezas:" : "Piezas (est.):", c2, y2);
        tc(doc, C.gray);
        doc.text(`$${precioPiezas.toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
        y2 += 4;
      }
      if (precioManoObra > 0 || precioPiezas > 0) {
        dc(doc, C.grayLine);
        doc.setLineWidth(0.15);
        doc.line(c2, y2 - 3, c2 + colW, y2 - 3);
      }
      doc.setFont("helvetica", "bold");
      tc(doc, C.grayLight);
      doc.text(tienepiézasReales ? "Total reparación:" : "Total estimado:", c2, y2);
      tc(doc, C.gray);
      doc.text(`$${precioTotal.toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
      doc.setFont("helvetica", "normal");
      y2 += 4.5;
    }

    if (anticipos && anticipos.length > 0) {
      (anticipos as Array<{ fecha_anticipo: string; monto: unknown; tipo_pago?: string }>).forEach((a) => {
        const fd = new Date(a.fecha_anticipo).toLocaleDateString("es-MX", {
          day: "2-digit", month: "short",
        });
        const metodo = metodoPagoLabel[a.tipo_pago || ""] || (a.tipo_pago || "");
        tc(doc, C.grayLight);
        doc.text(`Anticipo ${fd}${metodo ? ` (${metodo})` : ""}:`, c2, y2);
        doc.setFont("helvetica", "bold");
        tc(doc, C.gray);
        doc.text(`-$${Number(a.monto).toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
        doc.setFont("helvetica", "normal");
        y2 += 4;
      });
      dc(doc, C.grayLine);
      doc.setLineWidth(0.15);
      doc.line(c2, y2 - 3, c2 + colW, y2 - 3);
    }

    if (cargoCancelacion > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      tc(doc, C.grayLight);
      doc.text(`Cargo cancelación: $${cargoCancelacion.toFixed(2)}`, c2, y2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      y2 += 4;
    }

    if (precioTotal > 0) {
      const saldo = precioTotal - totalAnticipos;
      if (saldo > 0.01) {
        fc(doc, C.bgRed);
        dc(doc, C.red);
        doc.setLineWidth(0.3);
        doc.roundedRect(c2 - 1, y2 - 0.5, colW + 2, 7.5, 0.6, 0.6, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        tc(doc, C.red);
        doc.text("SALDO AL RECOGER:", c2 + 1, y2 + 4.5);
        doc.text(`$${saldo.toFixed(2)}`, c2 + colW - 2, y2 + 4.5, { align: "right" });
        y2 += 9;
      } else {
        fc(doc, C.bgGreen);
        dc(doc, C.green);
        doc.setLineWidth(0.3);
        doc.roundedRect(c2 - 1, y2 - 0.5, colW + 2, 7.5, 0.6, 0.6, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        tc(doc, C.green);
        doc.text("✓ PAGADO COMPLETO", c2 + colW / 2, y2 + 4.5, { align: "center" });
        y2 += 9;
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      tc(doc, C.grayLight);
      doc.text("Presupuesto pendiente de diagnóstico", c2, y2);
      y2 += 4;
    }

    tc(doc, C.gray);
    doc.setFont("helvetica", "normal");
    y = Math.max(y1, y2) + 1;
    y = hLine(doc, y, true);
  }

  /* ── 4B. PIEZAS UTILIZADAS ───────────────────────────────────────────── */
  if (piezas && piezas.length > 0) {
    y = maybeBreak(doc, y, 20 + piezas.length * 5);

    fc(doc, C.bgLight);
    dc(doc, C.grayLine);
    doc.setLineWidth(0.18);
    doc.rect(ML, y, CW, 5.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    tc(doc, C.brandMid);
    doc.text("PIEZAS Y REFACCIONES UTILIZADAS", ML + 2, y + 3.8);

    const pzX = [ML, ML + 100, ML + 130, ML + 165];
    y += 7;
    doc.setFontSize(6.2);
    tc(doc, C.grayLight);
    doc.text("Descripción",    pzX[0], y);
    doc.text("Cant.",          pzX[1], y);
    doc.text("P. Unit.",       pzX[2], y);
    doc.text("Subtotal",       pzX[3], y);
    y += 3.5;

    dc(doc, C.grayLine);
    doc.setLineWidth(0.12);
    doc.line(ML, y, PW - MR, y);
    y += 3;

    const CALIDAD_LABEL: Record<string, string> = {
      original:    "Original",
      generica:    "Genérica",
      premium:     "Premium",
      oem:         "OEM",
      refurbished: "Reacondicionada",
    };

    // Índice de calidad por producto_id o nombre_pieza
    const calidadMap = new Map<string, string>();
    (pedidosCalidad || []).forEach((p: any) => {
      if (p.calidad) {
        if (p.producto_id) calidadMap.set(p.producto_id, p.calidad);
        if (p.nombre_pieza) calidadMap.set(p.nombre_pieza.trim().toLowerCase(), p.calidad);
      }
    });

    let totalPiezasReal = 0;
    (piezas as Array<{ nombre_pieza?: string; cantidad?: number; costo_unitario?: unknown; producto_id?: string | null; productos?: { nombre?: string } | null }>)
      .forEach((p) => {
        const nombre = p.nombre_pieza || (p.productos?.nombre ?? "Pieza sin nombre");
        const cant = p.cantidad ?? 1;
        const cu = Number(p.costo_unitario || 0);
        const subtotal = cant * cu;
        totalPiezasReal += subtotal;

        // Buscar calidad: primero por producto_id, luego por nombre
        const calidadKey = p.producto_id
          ? calidadMap.get(p.producto_id)
          : calidadMap.get(nombre.trim().toLowerCase());
        const calidadLabel = calidadKey ? CALIDAD_LABEL[calidadKey] ?? calidadKey : null;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        tc(doc, C.gray);
        const nomLines = doc.splitTextToSize(nombre, 94);
        doc.text(nomLines, pzX[0], y);
        doc.text(String(cant),                pzX[1], y);
        doc.text(`$${cu.toFixed(2)}`,         pzX[2], y);
        doc.text(`$${subtotal.toFixed(2)}`,   pzX[3], y);
        y += Math.max(nomLines.length * 4, 4.5);

        // Nota discreta de calidad (solo si está confirmada)
        if (calidadLabel) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(6);
          tc(doc, C.grayLight);
          doc.text(`  tipo: ${calidadLabel}`, pzX[0], y - 1.5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          tc(doc, C.gray);
          y += 1.5;
        }
      });

    dc(doc, C.grayLine);
    doc.setLineWidth(0.15);
    doc.line(ML + 100, y - 0.5, PW - MR, y - 0.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    tc(doc, C.gray);
    doc.text("Total piezas:", pzX[2], y + 3.5);
    doc.text(`$${totalPiezasReal.toFixed(2)}`, pzX[3], y + 3.5);
    y += 7;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    tc(doc, C.grayLight);
    doc.text("* Los precios de piezas incluyen costo de instalación y envío.", ML, y);
    y += 4;

    y = hLine(doc, y, false);
  }

  /* ── 5. TÉRMINOS IMPORTANTES ─────────────────────────────────────────── */
  y = maybeBreak(doc, y, 30);

  fc(doc, C.bgLight);
  dc(doc, C.grayLine);
  doc.setLineWidth(0.18);
  doc.rect(ML, y, CW, 6.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  tc(doc, C.brandDark);
  doc.text(
    "TÉRMINOS IMPORTANTES — Al entregar el equipo el cliente acepta las siguientes condiciones:",
    ML + 2, y + 4.5
  );
  y += 9;

  const terms = buildTerms(orden.condiciones_funcionamiento, orden.imei ?? "", nombreEmpresa);
  const LINE_H = 3.8;
  doc.setFontSize(8);

  terms.forEach((term, i) => {
    const lines = doc.splitTextToSize(term, CW - 6);
    const blockH = lines.length * LINE_H + 2.5;

    y = maybeBreak(doc, y, blockH + 2);

    doc.setFont("helvetica", "bold");
    tc(doc, C.brandMid);
    doc.text(`${i + 1}.`, ML, y);

    doc.setFont("helvetica", "normal");
    tc(doc, C.gray);
    doc.text(lines, ML + 6, y);
    y += blockH;
  });

  tc(doc, C.gray);
  y = maybeBreak(doc, y, 5);
  y = hLine(doc, y, true);

  /* ── 6. FIRMAS ───────────────────────────────────────────────────────── */
  y = maybeBreak(doc, y, 38);
  y += 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  tc(doc, C.brandDark);
  doc.text("FIRMA DEL CLIENTE:", ML, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  tc(doc, C.grayLight);
  doc.text(
    "Al firmar, el cliente declara haber leído y aceptado los términos del presente contrato de servicio.",
    ML, y + 3.5
  );
  y += 6;

  if (orden.firma_cliente) {
    if (orden.tipo_firma === "digital") {
      doc.setFont("times", "italic");
      doc.setFontSize(15);
      tc(doc, [20, 20, 80]);
      doc.text(orden.firma_cliente, ML + 5, y + 11);
      doc.setFont("helvetica", "normal");
    } else {
      try {
        doc.addImage(orden.firma_cliente, "PNG", ML, y, 62, 21);
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        tc(doc, C.grayLight);
        doc.text("[Firma capturada]", ML + 10, y + 11);
      }
    }
  }

  dc(doc, [100, 100, 100]);
  doc.setLineWidth(0.25);
  doc.line(ML, y + 21, ML + 78, y + 21);
  doc.setFontSize(6);
  tc(doc, C.grayLight);
  doc.text("Nombre y firma del cliente", ML + 9, y + 24.5);

  const sx = PW - MR - 62, sy = y;
  fc(doc, [245, 248, 252]);
  dc(doc, C.brandDark);
  doc.setLineWidth(0.5);
  doc.roundedRect(sx, sy, 62, 24, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  tc(doc, C.brandDark);
  doc.text(nombreEmpresa.toUpperCase(), sx + 31, sy + 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  tc(doc, C.grayLight);
  doc.text("Sello del Establecimiento", sx + 31, sy + 15, { align: "center" });
  doc.text(`Folio: ${orden.folio}`, sx + 31, sy + 20, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}
