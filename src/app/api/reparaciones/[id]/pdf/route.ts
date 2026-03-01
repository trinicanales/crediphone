import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import jsPDF from "jspdf";
import QRCode from "qrcode";

/* ──────────────────────────────────────────────────────────────────────────
   ORDEN DE REPARACIÓN / CONTRATO DE SERVICIO — CREDIPHONE
   Formato: Carta (216 × 279 mm) · Una sola página
   Sistema visual: tokens de color de CREDIPHONE ERP
   ────────────────────────────────────────────────────────────────────────── */

const PW = 216;
const PH = 279;
const ML = 11;
const MR = 11;
const CW = PW - ML - MR; // 194 mm

// ── Paleta de colores (alineada con globals.css tokens) ──────────────────
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

// ── Helpers de color ──────────────────────────────────────────────────────
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

// ── Fix [object Object]: convierte estado físico a texto legible ──────────
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

// ── Parsea condiciones al recibir ─────────────────────────────────────────
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

// ── Términos legales condensados (sin títulos grandes) ────────────────────
function buildTerms(cond: unknown, imei?: string): string[] {
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
    "El cliente declara ser propietario legítimo del equipo entregado —o contar con autorización expresa del propietario— y asume plena responsabilidad legal por dicha declaración (Art. 1794, Código Civil Federal).",
    "CREDIPHONE no se hace responsable por pérdida de datos, archivos, aplicaciones o configuraciones durante el diagnóstico o la reparación. Se recomienda realizar un respaldo completo antes de entregar el equipo.",
    `La reparación cuenta con garantía de 90 días naturales sobre la mano de obra realizada, conforme al Art. 76 bis de la Ley Federal de Protección al Consumidor (LFPC, vigente ${new Date().getFullYear()}). La garantía no aplica a daños posteriores por golpes, mal uso, contacto con líquidos u otras causas ajenas al servicio prestado.`,
  ];

  // Condiciones especiales (un solo ítem agrupado)
  const condExtras: string[] = [];
  if (obj?.estaMojado)      condExtras.push("daño por humedad preexistente (NOM-024-SCFI-2013)");
  if (obj?.bateriaHinchada) condExtras.push("batería con deformación física que representa riesgo potencial");
  if (obj?.llegaApagado)    condExtras.push("equipo recibido sin encender, sin posibilidad de verificar funcionamiento previo");
  if (condExtras.length > 0) {
    terms.push(
      `El equipo ingresa con las siguientes condiciones documentadas: ${condExtras.join("; ")}. Dichas condiciones son progresivas e impredecibles; CREDIPHONE no responde por fallas adicionales derivadas de ellas.`
    );
  }

  // Preexistencias de componentes
  const fallas: string[] = [];
  if (obj) {
    Object.entries(compNombres).forEach(([k, v]) => {
      if (obj[k] === "falla") fallas.push(v);
    });
  }
  if (fallas.length > 0) {
    terms.push(
      `El cliente declara conocer las siguientes fallas preexistentes al ingreso: ${fallas.join(", ")}. CREDIPHONE no es responsable por dichas preexistencias ni por su agravamiento durante la reparación de otro componente.`
    );
  }

  terms.push(
    "El diagnóstico tiene un costo de revisión. Si el cliente rechaza el presupuesto, el equipo se devuelve en el estado en que fue recibido, sin garantía de restitución al estado original. Al aprobar el presupuesto, el cliente autoriza expresamente los trabajos descritos.",
    "El cliente acepta íntegramente los presentes términos al entregar el equipo. Para consultar los términos y condiciones completos, escanee el código QR ubicado al pie de este documento."
  );

  // Cláusula especial si no hay IMEI verificable
  const imeiVacio = !imei || !imei.trim() ||
    imei.trim().toLowerCase() === "na" ||
    imei.trim().toLowerCase() === "n/a";

  if (imeiVacio) {
    terms.push(
      "El equipo ingresa sin número IMEI verificable. CREDIPHONE no puede certificar la identidad única del dispositivo ni garantizar que no haya sido reportado como robado. El cliente asume plena responsabilidad por la legitimidad del equipo (Art. 1794, Código Civil Federal)."
    );
  }

  return terms;
}

/* ══════════════════════════════════════════════════════════════════════════
   HANDLER
══════════════════════════════════════════════════════════════════════════ */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, message: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: orden, error } = await supabase
      .from("ordenes_reparacion")
      .select("*, clientes:cliente_id (nombre, apellido, telefono, direccion)")
      .eq("id", id)
      .single();

    if (error || !orden) {
      return NextResponse.json({ success: false, message: "Orden no encontrada" }, { status: 404 });
    }

    const { data: anticipos } = await supabase
      .from("anticipos_reparacion")
      .select("*")
      .eq("orden_id", id)
      .order("fecha_anticipo", { ascending: true });

    const totalAnticipos = (anticipos || []).reduce(
      (s: number, a: { monto?: unknown }) => s + Number(a.monto || 0), 0
    );
    const precioTotal = Number(orden.precio_total || orden.presupuesto_total || 0);

    // QR URLs
    const host  = request.headers.get("host")              || "crediphone.vercel.app";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const trackingUrl = `${proto}://${host}/reparacion/${orden.folio}`;
    const terminosUrl = `${proto}://${host}/terminos`;

    let qrTrackData = "";
    let qrTermsData = "";
    try {
      qrTrackData = await QRCode.toDataURL(trackingUrl, { width: 140, margin: 1, errorCorrectionLevel: "M" });
      qrTermsData = await QRCode.toDataURL(terminosUrl,  { width: 70,  margin: 1, errorCorrectionLevel: "M" });
    } catch { /* continuar sin QR */ }

    /* ── Inicializar PDF ───────────────────────────────────────── */
    const doc = new jsPDF({ format: "letter", unit: "mm" });
    let y = 8;

    /* ╔══════════════════════════════════════════════════╗
       ║  1. ENCABEZADO                                   ║
       ╚══════════════════════════════════════════════════╝ */

    // QR grande de tracking — arriba derecha, 30 × 30 mm
    const QR_BIG = 30;
    const qrBigX = PW - MR - QR_BIG;
    if (qrTrackData) {
      fc(doc, C.white);
      dc(doc, C.brandMid);
      doc.setLineWidth(0.4);
      doc.roundedRect(qrBigX - 1.5, y - 1, QR_BIG + 3, QR_BIG + 7.5, 1.5, 1.5, "FD");
      doc.addImage(qrTrackData, "PNG", qrBigX, y, QR_BIG, QR_BIG);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      tc(doc, C.brandMid);
      doc.text("ESCANEA PARA", qrBigX + QR_BIG / 2, y + QR_BIG + 2.2, { align: "center" });
      doc.text("SEGUIMIENTO", qrBigX + QR_BIG / 2, y + QR_BIG + 5.2, { align: "center" });
    }

    // Franja azul lateral izquierda
    fc(doc, C.brandDark);
    doc.rect(ML, y, 1.8, 23, "F");

    // Nombre + subtítulo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    tc(doc, C.brandDark);
    doc.text("CREDIPHONE", ML + 5, y + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    tc(doc, C.gray);
    doc.text("ORDEN DE REPARACIÓN / CONTRATO DE SERVICIO", ML + 5, y + 15.5);

    // Folio · Fecha · Prioridad
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    tc(doc, C.brandDark);
    doc.text(`Folio: ${orden.folio}`, ML + 5, y + 22);

    doc.setFont("helvetica", "normal");
    tc(doc, C.grayLight);
    const fechaStr = new Date(orden.created_at).toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
    });
    doc.text(`Fecha: ${fechaStr}`, ML + 52, y + 22);

    const prioColor =
      orden.prioridad === "urgente" ? C.red :
      orden.prioridad === "alta"    ? C.amber : C.grayLight;
    tc(doc, prioColor);
    doc.text(`Prioridad: ${(orden.prioridad || "Normal").toUpperCase()}`, ML + 105, y + 22);

    if (orden.es_garantia) {
      doc.setFont("helvetica", "bold");
      tc(doc, C.green);
      doc.text("★ EN GARANTÍA", ML + 152, y + 22);
    }

    tc(doc, C.gray);
    y += 29;
    y = hLine(doc, y, true);

    /* ╔══════════════════════════════════════════════════╗
       ║  2. CLIENTE | DISPOSITIVO                        ║
       ╚══════════════════════════════════════════════════╝ */
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
    if (orden.accesorios_entregados) y2 = dataRow(doc, "Accesorios:", orden.accesorios_entregados, c2, y2, colW);

    y = Math.max(y1, y2) + 1;
    y = hLine(doc, y);

    /* ╔══════════════════════════════════════════════════╗
       ║  3. PROBLEMA | CONDICIONES AL RECIBIR            ║
       ╚══════════════════════════════════════════════════╝ */
    y1 = y + 1; y2 = y + 1;

    // Problema (izquierda)
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

    // Condiciones (derecha) — formato mejorado, no repetitivo
    y2 = sectionLabel(doc, "Condiciones al Recibir", c2, y2);
    const { oks, fallas, alertas: alts, extras } =
      parseCondiciones(orden.condiciones_funcionamiento);

    // SIM y SD provienen de estado_fisico_dispositivo (tieneSIM/tieneMemoriaSD)
    const efObj = (orden.estado_fisico_dispositivo && typeof orden.estado_fisico_dispositivo === "object" && !Array.isArray(orden.estado_fisico_dispositivo))
      ? orden.estado_fisico_dispositivo as Record<string, unknown>
      : null;
    if (efObj?.tieneSIM)       extras.push("SIM incluida");
    if (efObj?.tieneMemoriaSD) extras.push("MicroSD incluida");

    doc.setFontSize(7);

    // Alertas especiales primero (en color)
    alts.forEach(({ text, color }) => {
      doc.setFont("helvetica", "bold");
      tc(doc, color);
      doc.text(text, c2, y2);
      y2 += 3.8;
    });

    // Fallas en rojo — agrupadas en una línea
    if (fallas.length > 0) {
      doc.setFont("helvetica", "bold");
      tc(doc, C.red);
      const fallaStr = `✗ Fallas: ${fallas.join(", ")}`;
      const fLines = doc.splitTextToSize(fallaStr, colW);
      doc.text(fLines, c2, y2);
      y2 += fLines.length * 3.8;
    }

    // OKs omitidos intencionalmente — solo se documentan daños y alertas

    // Accesorios
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

    /* ╔══════════════════════════════════════════════════╗
       ║  4. ESTADO FÍSICO | ACCESO + PRESUPUESTO         ║
       ╚══════════════════════════════════════════════════╝ */
    y1 = y + 1; y2 = y + 1;

    // Estado físico — izquierda (fix del [object Object])
    const efTexto = renderEstadoFisico(orden.estado_fisico_dispositivo);
    if (efTexto) {
      y1 = sectionLabel(doc, "Estado Físico del Dispositivo", c1, y1);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      tc(doc, C.gray);
      const efLines = doc.splitTextToSize(efTexto, colW);
      doc.text(efLines, c1, y1);
      y1 += efLines.length * 3.8 + 1;
    }

    // Acceso al dispositivo
    if (orden.patron_desbloqueo || orden.password_dispositivo) {
      y1 = sectionLabel(doc, "Acceso al Dispositivo", c1, y1);
      if (orden.patron_desbloqueo)    y1 = dataRow(doc, "Patrón:",     orden.patron_desbloqueo,    c1, y1, colW);
      if (orden.password_dispositivo) y1 = dataRow(doc, "Contraseña:", orden.password_dispositivo, c1, y1, colW);
    }

    // Presupuesto — derecha
    y2 = sectionLabel(doc, "Presupuesto / Anticipos", c2, y2);
    doc.setFontSize(7.5);

    if (precioTotal > 0) {
      doc.setFont("helvetica", "normal");
      tc(doc, C.grayLight);
      doc.text("Total reparación:", c2, y2);
      doc.setFont("helvetica", "bold");
      tc(doc, C.gray);
      doc.text(`$${precioTotal.toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
      doc.setFont("helvetica", "normal");
      y2 += 4.5;
    }

    if (anticipos && anticipos.length > 0) {
      (anticipos as Array<{ fecha_anticipo: string; monto: unknown }>).forEach((a) => {
        const fd = new Date(a.fecha_anticipo).toLocaleDateString("es-MX", {
          day: "2-digit", month: "short",
        });
        tc(doc, C.grayLight);
        doc.text(`Anticipo (${fd}):`, c2, y2);
        doc.setFont("helvetica", "bold");
        tc(doc, C.gray);
        doc.text(`-$${Number(a.monto).toFixed(2)}`, c2 + colW - 2, y2, { align: "right" });
        doc.setFont("helvetica", "normal");
        y2 += 4;
      });
      dc(doc, C.grayLine);
      doc.setLineWidth(0.15);
      doc.line(c2, y2 - 0.5, c2 + colW, y2 - 0.5);
    }

    if (precioTotal > 0) {
      const saldo = precioTotal - totalAnticipos;
      if (saldo > 0.01) {
        // Caja roja: saldo pendiente
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
        // Caja verde: pagado
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

    /* ╔══════════════════════════════════════════════════╗
       ║  5. TÉRMINOS IMPORTANTES                         ║
       ╚══════════════════════════════════════════════════╝ */

    // Cabecera de sección con fondo sutil
    fc(doc, C.bgLight);
    dc(doc, C.grayLine);
    doc.setLineWidth(0.18);
    doc.rect(ML, y, CW, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    tc(doc, C.brandDark);
    doc.text(
      "TÉRMINOS IMPORTANTES — Al entregar el equipo el cliente acepta las siguientes condiciones:",
      ML + 2, y + 4
    );
    y += 8;

    // Ítems legales — texto continuo y fluido, sin títulos grandes
    // Font size ≥ 9.5pt según requisito del usuario
    const terms = buildTerms(orden.condiciones_funcionamiento, orden.imei ?? "");
    doc.setFontSize(9.5);
    terms.forEach((term, i) => {
      doc.setFont("helvetica", "bold");
      tc(doc, C.brandMid);
      doc.text(`${i + 1}.`, ML, y);

      doc.setFont("helvetica", "normal");
      tc(doc, C.gray);
      const lines = doc.splitTextToSize(term, CW - 6);
      doc.text(lines, ML + 6, y);
      y += lines.length * 4.5 + 2;
    });

    tc(doc, C.gray);
    y = hLine(doc, y, true);

    /* ╔══════════════════════════════════════════════════╗
       ║  6. FIRMAS                                       ║
       ╚══════════════════════════════════════════════════╝ */
    y += 1;

    // Etiqueta
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

    // Firma
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

    // Línea de firma
    dc(doc, [100, 100, 100]);
    doc.setLineWidth(0.25);
    doc.line(ML, y + 21, ML + 78, y + 21);
    doc.setFontSize(6);
    tc(doc, C.grayLight);
    doc.text("Nombre y firma del cliente", ML + 9, y + 24.5);

    // Sello CREDIPHONE (derecha)
    const sx = PW - MR - 62, sy = y;
    fc(doc, [245, 248, 252]);
    dc(doc, C.brandDark);
    doc.setLineWidth(0.5);
    doc.roundedRect(sx, sy, 62, 24, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    tc(doc, C.brandDark);
    doc.text("CREDIPHONE", sx + 31, sy + 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    tc(doc, C.grayLight);
    doc.text("Sello del Establecimiento", sx + 31, sy + 15, { align: "center" });
    doc.text(`Folio: ${orden.folio}`, sx + 31, sy + 20, { align: "center" });

    y += 28;

    /* ╔══════════════════════════════════════════════════╗
       ║  7. FOOTER                                       ║
       ╚══════════════════════════════════════════════════╝ */
    y = hLine(doc, y);

    // QR pequeño de términos (derecha del footer)
    const QR_FOOT = 16;
    const qrFX = PW - MR - QR_FOOT;
    if (qrTermsData) {
      fc(doc, C.white);
      doc.rect(qrFX - 0.5, y - 0.5, QR_FOOT + 1, QR_FOOT + 1, "F");
      doc.addImage(qrTermsData, "PNG", qrFX, y, QR_FOOT, QR_FOOT);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      tc(doc, C.grayLight);
      doc.text("Ver términos y",  qrFX + QR_FOOT / 2, y + QR_FOOT + 1.5, { align: "center" });
      doc.text("condiciones",     qrFX + QR_FOOT / 2, y + QR_FOOT + 4,   { align: "center" });
      doc.text("completos",       qrFX + QR_FOOT / 2, y + QR_FOOT + 6.5, { align: "center" });
    }

    const footMaxW = CW - QR_FOOT - 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    tc(doc, C.brandDark);
    doc.text("CREDIPHONE SOLUTIONS S.A. DE C.V.", ML, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    tc(doc, C.grayLight);
    doc.text(
      "Prol. Gral. Francisco Villa 218A, Col. 5 de Mayo, Durango, Dgo.  C.P. 34304  ·  Tel: 618 124 5391 / 618 324 0200",
      ML, y + 7.5, { maxWidth: footMaxW }
    );
    doc.text(
      "RFC: CAVT870614Q13  ·  Régimen: RESICO  ·  Conforme a LFPC Art. 76 bis  ·  NOM-024-SCFI-2013",
      ML, y + 11, { maxWidth: footMaxW }
    );
    doc.text(
      `Folio: ${orden.folio}   ·   Emisión: ${new Date().toLocaleDateString("es-MX")}${trackingUrl ? `   ·   Seguimiento: ${trackingUrl}` : ""}`,
      ML, y + 14.5, { maxWidth: footMaxW }
    );

    /* ── Generar buffer y responder ──────────────────────────── */
    const buffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Orden-${orden.folio}.pdf"`,
      },
    });

  } catch (err) {
    console.error("Error al generar PDF:", err);
    return NextResponse.json({ success: false, message: "Error al generar PDF" }, { status: 500 });
  }
}
