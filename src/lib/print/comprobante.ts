/**
 * Comprobante de pago/anticipo para el cliente (apto para navegador: no importa nada del servidor).
 *
 * Un solo formato para todos los cobros (anticipo de reparación, abono de crédito, saldo final):
 * se imprime en térmica 58 mm o se manda por WhatsApp como mensaje de texto (modo enlace, sin costo).
 */

export type TipoComprobante = "anticipo" | "abono_credito";

export interface DatosComprobante {
  tipo: TipoComprobante;
  folioRecibo: string;
  /** Folio de la orden de reparación o del crédito */
  folioReferencia: string;
  fecha: Date | string;
  clienteNombre: string;
  clienteTelefono?: string | null;
  /** Equipo (marca/modelo) o producto del crédito */
  descripcion?: string;
  monto: number;
  /** Total del servicio / del crédito; 0 si no se conoce */
  total: number;
  saldoRestante: number;
  metodoPago: string;
  referencia?: string;
  recibidoPor?: string;
  pendienteConfirmacion?: boolean;
  /** Enlace de seguimiento del cliente (solo reparaciones, si existe) */
  enlaceSeguimiento?: string | null;
  empresaNombre: string;
}

const MX = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);

const METODOS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  deposito: "Depósito",
  mixto: "Mixto",
};

/** Mensaje de texto para el cliente (WhatsApp). */
export function mensajeComprobante(d: DatosComprobante): string {
  const fecha = new Date(d.fecha).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const titulo = d.tipo === "anticipo" ? "COMPROBANTE DE ANTICIPO" : "COMPROBANTE DE PAGO";
  const refLabel = d.tipo === "anticipo" ? "Orden" : "Crédito";

  const lineas = [
    `*${d.empresaNombre}*`,
    `*${titulo}*`,
    "",
    `Hola ${d.clienteNombre} 👋 recibimos tu pago:`,
    "",
    `Recibo: ${d.folioRecibo}`,
    `${refLabel}: ${d.folioReferencia}`,
    d.descripcion ? `Equipo: ${d.descripcion}` : null,
    `Fecha: ${fecha}`,
    `Método: ${METODOS[d.metodoPago] ?? d.metodoPago}${d.referencia ? ` (ref. ${d.referencia})` : ""}`,
    "",
    `*Monto recibido: ${MX(d.monto)}*`,
    d.total > 0 ? `Total: ${MX(d.total)}` : null,
    d.total > 0 ? `Saldo restante: ${MX(d.saldoRestante)}` : null,
    d.pendienteConfirmacion ? "\n⏳ Pendiente de confirmar en banco." : null,
    d.recibidoPor ? `Te atendió: ${d.recibidoPor}` : null,
    d.enlaceSeguimiento ? `\nSigue tu equipo aquí: ${d.enlaceSeguimiento}` : null,
    "",
    "Guarda este mensaje como comprobante. ¡Gracias!",
  ];
  return lineas.filter((l): l is string => l !== null).join("\n");
}

/** Enlace wa.me con el mensaje listo (el empleado solo da "enviar"). */
export function linkWhatsAppComprobante(telefono: string | null | undefined, mensaje: string): string {
  const limpio = (telefono ?? "").replace(/\D/g, "");
  const numero = limpio.startsWith("52") && limpio.length >= 12 ? limpio : limpio ? `52${limpio.slice(-10)}` : "";
  return numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

/** Ticket HTML 58 mm para imprimir desde el navegador (respaldo cuando no hay térmica). */
export function ticketHtmlComprobante(d: DatosComprobante): string {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const fecha = new Date(d.fecha).toLocaleString("es-MX");
  const refLabel = d.tipo === "anticipo" ? "Orden" : "Crédito";
  const fila = (a: string, b: string) => `<div class="r"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.folioRecibo)}</title>
<style>@page{size:58mm auto;margin:2mm}body{font-family:monospace;font-size:11px;width:54mm;margin:0 auto;color:#000}
h1{font-size:13px;text-align:center;margin:4px 0}.c{text-align:center}.r{display:flex;justify-content:space-between;gap:6px}
.b{font-weight:bold;font-size:14px}hr{border:0;border-top:1px dashed #000;margin:5px 0}</style></head><body>
<h1>${esc(d.empresaNombre)}</h1><div class="c b">${d.tipo === "anticipo" ? "COMPROBANTE DE ANTICIPO" : "COMPROBANTE DE PAGO"}</div><hr>
${fila("Recibo:", d.folioRecibo)}${fila(refLabel + ":", d.folioReferencia)}${fila("Fecha:", fecha)}${fila("Cliente:", d.clienteNombre)}
${d.descripcion ? fila("Equipo:", d.descripcion) : ""}<hr>
<div class="r b"><span>MONTO:</span><span>${esc(MX(d.monto))}</span></div>
${d.total > 0 ? fila("Total:", MX(d.total)) + fila("Saldo restante:", MX(d.saldoRestante)) : ""}<hr>
${fila("Método:", METODOS[d.metodoPago] ?? d.metodoPago)}${d.referencia ? fila("Ref:", d.referencia) : ""}${d.recibidoPor ? fila("Recibió:", d.recibidoPor) : ""}
${d.pendienteConfirmacion ? '<div class="c b">PENDIENTE DE CONFIRMAR EN BANCO</div>' : ""}
<hr><div class="c">Conserva este comprobante</div></body></html>`;
}
