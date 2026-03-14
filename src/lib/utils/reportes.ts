/**
 * FASE 31: Utilidades para generar Reporte X y Reporte Z
 * Abre una ventana nueva con HTML para imprimir
 */

// =====================================================
// TIPOS INTERNOS DE REPORTE
// =====================================================

export interface ReporteSesionData {
  sesion: {
    id: string;
    folio: string;
    estado: string;
    monto_inicial: number;
    monto_final?: number;
    monto_esperado?: number;
    diferencia?: number;
    fecha_apertura: string;
    fecha_cierre?: string;
    notas_apertura?: string;
    notas_cierre?: string;
    total_ventas_efectivo?: number;
    total_ventas_transferencia?: number;
    total_ventas_tarjeta?: number;
    total_retiros?: number;
    total_depositos?: number;
    numero_ventas?: number;
    users?: { name?: string };
  };
  movimientos: Array<{
    id: string;
    tipo: string;
    monto: number;
    concepto: string;
    createdAt: Date | string;
  }>;
  ventas: Array<{
    id: string;
    folio: string;
    total: number;
    subtotal: number;
    descuento: number;
    metodoPago: string;
    desgloseMixto?: { efectivo?: number; transferencia?: number; tarjeta?: number };
    estado: string;
    fechaVenta: Date | string;
    vendedorNombre?: string;
    clienteNombre?: string;
    items?: Array<{
      productoNombre: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
      imei?: string;
    }>;
  }>;
  distribuidorNombre: string;
}

// =====================================================
// HELPERS DE FORMATO
// =====================================================

function fmt(num: number | undefined | null): string {
  const n = typeof num === "number" ? num : 0;
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtHora(date: Date | string): string {
  return new Date(date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function fmtFecha(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function metodoPagoLabel(metodo: string): string {
  switch (metodo) {
    case "efectivo": return "Efectivo";
    case "transferencia": return "Transferencia";
    case "tarjeta": return "Tarjeta";
    case "mixto": return "Mixto";
    default: return metodo;
  }
}

// =====================================================
// ESTILOS COMUNES DEL REPORTE (print-friendly)
// =====================================================

const CSS_COMUN = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #1a1a1a;
    background: white;
    padding: 20px;
    max-width: 600px;
    margin: 0 auto;
  }
  .header { text-align: center; margin-bottom: 16px; }
  .header h1 { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
  .header h2 { font-size: 13px; font-weight: normal; margin-top: 4px; }
  .header .folio { font-size: 14px; font-weight: bold; margin-top: 6px; letter-spacing: 1px; }
  .header .tipo-reporte {
    display: inline-block;
    border: 2px solid #1a1a1a;
    padding: 2px 12px;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 2px;
    margin-top: 6px;
  }
  .divider { border-top: 1px dashed #666; margin: 10px 0; }
  .divider-solid { border-top: 2px solid #1a1a1a; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; margin: 3px 0; }
  .row .label { color: #555; }
  .row .value { font-weight: bold; }
  .row .value.mono { font-family: 'Courier New', monospace; }
  .section-title { font-weight: bold; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin: 10px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; font-weight: bold; padding: 3px 4px; border-bottom: 1px solid #1a1a1a; }
  th.right { text-align: right; }
  td { padding: 3px 4px; vertical-align: top; border-bottom: 1px solid #e0e0e0; }
  td.right { text-align: right; }
  td.mono { font-family: 'Courier New', monospace; font-size: 10px; }
  .totales { background: #f5f5f5; }
  .totales td { font-weight: bold; border-top: 2px solid #1a1a1a; }
  .total-final { font-size: 15px; font-weight: bold; text-align: right; margin: 10px 0; }
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
  }
  .diferencia-positiva { color: #15803d; }
  .diferencia-negativa { color: #b91c1c; }
  .diferencia-cero { color: #1d4ed8; }
  .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #888; }
  .print-btn {
    display: block;
    margin: 16px auto;
    padding: 10px 32px;
    background: #09244a;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    letter-spacing: 1px;
  }
  .print-btn:hover { background: #0e3570; }
  @media print {
    .print-btn { display: none; }
    body { padding: 0; }
  }
`;

// =====================================================
// GENERADOR REPORTE X (turno abierto — sin cerrar)
// =====================================================

export function generarReporteX(data: ReporteSesionData): string {
  const { sesion, movimientos, ventas, distribuidorNombre } = data;

  const totalEfectivo = sesion.total_ventas_efectivo ?? 0;
  const totalTransferencia = sesion.total_ventas_transferencia ?? 0;
  const totalTarjeta = sesion.total_ventas_tarjeta ?? 0;
  const totalDepositos = sesion.total_depositos ?? 0;
  const totalRetiros = sesion.total_retiros ?? 0;
  const numVentas = sesion.numero_ventas ?? ventas.filter(v => v.estado === "completada").length;

  // Calcular totales en vivo desde las ventas (sesión abierta no los tiene en DB)
  let efvo = 0, transf = 0, tarj = 0, nv = 0;
  ventas.filter(v => v.estado === "completada").forEach(v => {
    nv++;
    const t = typeof v.total === "number" ? v.total : parseFloat(v.total as unknown as string || "0");
    switch (v.metodoPago) {
      case "efectivo": efvo += t; break;
      case "transferencia": transf += t; break;
      case "tarjeta": tarj += t; break;
      case "mixto":
        efvo += v.desgloseMixto?.efectivo || 0;
        transf += v.desgloseMixto?.transferencia || 0;
        tarj += v.desgloseMixto?.tarjeta || 0;
        break;
    }
  });

  const montoEsperado = sesion.monto_inicial + efvo + totalDepositos - totalRetiros;

  const ventasRows = ventas.filter(v => v.estado === "completada").map(v => {
    const t = typeof v.total === "number" ? v.total : parseFloat(v.total as unknown as string || "0");
    return `
      <tr>
        <td class="mono">${v.folio}</td>
        <td class="mono">${fmtHora(v.fechaVenta)}</td>
        <td>${metodoPagoLabel(v.metodoPago)}</td>
        <td class="right mono">${fmt(t)}</td>
      </tr>
    `;
  }).join("");

  const movRows = movimientos.map(m => `
    <tr>
      <td>${m.tipo === "deposito" ? "↑ Depósito" : "↓ Retiro"}</td>
      <td>${m.concepto}</td>
      <td class="right mono">${m.tipo === "deposito" ? "+" : "-"}${fmt(m.monto)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte X — ${sesion.folio}</title>
  <style>${CSS_COMUN}</style>
</head>
<body>
  <div class="header">
    <h1>CREDIPHONE</h1>
    ${distribuidorNombre ? `<h2>${distribuidorNombre}</h2>` : ""}
    <div class="tipo-reporte">REPORTE X — CORTE PARCIAL</div>
    <div class="folio">Turno: ${sesion.folio}</div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir Reporte X</button>

  <div class="divider-solid"></div>

  <div class="row"><span class="label">Fecha:</span><span class="value">${fmtFecha(sesion.fecha_apertura)}</span></div>
  <div class="row"><span class="label">Apertura:</span><span class="value mono">${fmtHora(sesion.fecha_apertura)}</span></div>
  <div class="row"><span class="label">Cajero:</span><span class="value">${sesion.users?.name || "—"}</span></div>
  <div class="row"><span class="label">Estado:</span><span class="value">🔓 Turno Abierto</span></div>

  <div class="divider"></div>

  <p class="section-title">Resumen de Ventas</p>
  <div class="row"><span class="label">Núm. ventas:</span><span class="value mono">${nv}</span></div>
  <div class="row"><span class="label">Efectivo:</span><span class="value mono">${fmt(efvo)}</span></div>
  <div class="row"><span class="label">Transferencia:</span><span class="value mono">${fmt(transf)}</span></div>
  <div class="row"><span class="label">Tarjeta:</span><span class="value mono">${fmt(tarj)}</span></div>
  <div class="divider"></div>
  <div class="row"><span class="label">Total Ventas:</span><span class="value mono">${fmt(efvo + transf + tarj)}</span></div>

  <div class="divider"></div>

  <p class="section-title">Flujo de Caja</p>
  <div class="row"><span class="label">Monto Inicial:</span><span class="value mono">${fmt(sesion.monto_inicial)}</span></div>
  <div class="row"><span class="label">+ Ventas Efectivo:</span><span class="value mono">${fmt(efvo)}</span></div>
  ${totalDepositos > 0 ? `<div class="row"><span class="label">+ Depósitos:</span><span class="value mono">${fmt(totalDepositos)}</span></div>` : ""}
  ${totalRetiros > 0 ? `<div class="row"><span class="label">- Retiros:</span><span class="value mono">${fmt(totalRetiros)}</span></div>` : ""}
  <div class="divider-solid"></div>
  <div class="row"><span class="label">Efectivo Esperado en Caja:</span><span class="value mono">${fmt(montoEsperado)}</span></div>

  ${ventas.filter(v => v.estado === "completada").length > 0 ? `
  <div class="divider"></div>
  <p class="section-title">Detalle de Ventas (${nv})</p>
  <table>
    <thead>
      <tr>
        <th>Folio</th>
        <th>Hora</th>
        <th>Método</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${ventasRows}</tbody>
  </table>
  ` : ""}

  ${movimientos.length > 0 ? `
  <div class="divider"></div>
  <p class="section-title">Movimientos de Caja</p>
  <table>
    <thead>
      <tr><th>Tipo</th><th>Concepto</th><th class="right">Monto</th></tr>
    </thead>
    <tbody>${movRows}</tbody>
  </table>
  ` : ""}

  <div class="divider"></div>
  <div class="footer">
    <p>⚠️ Este es un corte PARCIAL. El turno sigue abierto.</p>
    <p>Generado: ${new Date().toLocaleString("es-MX")}</p>
  </div>
</body>
</html>`;
}

// =====================================================
// GENERADOR REPORTE Z (turno cerrado — oficial)
// =====================================================

export function generarReporteZ(data: ReporteSesionData): string {
  const { sesion, movimientos, ventas, distribuidorNombre } = data;

  const efvo = sesion.total_ventas_efectivo ?? 0;
  const transf = sesion.total_ventas_transferencia ?? 0;
  const tarj = sesion.total_ventas_tarjeta ?? 0;
  const depositos = sesion.total_depositos ?? 0;
  const retiros = sesion.total_retiros ?? 0;
  const numVentas = sesion.numero_ventas ?? 0;
  const montoEsperado = sesion.monto_esperado ?? 0;
  const montoFinal = sesion.monto_final ?? 0;
  const diferencia = sesion.diferencia ?? 0;

  const duracionMs = sesion.fecha_cierre
    ? new Date(sesion.fecha_cierre).getTime() - new Date(sesion.fecha_apertura).getTime()
    : 0;
  const duracionH = Math.floor(duracionMs / (1000 * 60 * 60));
  const duracionMin = Math.floor((duracionMs % (1000 * 60 * 60)) / (1000 * 60));

  const ventasRows = ventas.filter(v => v.estado === "completada").map(v => {
    const t = typeof v.total === "number" ? v.total : parseFloat(v.total as unknown as string || "0");
    return `
      <tr>
        <td class="mono">${v.folio}</td>
        <td class="mono">${fmtHora(v.fechaVenta)}</td>
        <td>${v.clienteNombre || "—"}</td>
        <td>${metodoPagoLabel(v.metodoPago)}</td>
        <td class="right mono">${fmt(t)}</td>
      </tr>
    `;
  }).join("");

  const movRows = movimientos.map(m => `
    <tr>
      <td class="mono">${fmtHora(m.createdAt)}</td>
      <td>${m.tipo === "deposito" ? "↑ Depósito" : "↓ Retiro"}</td>
      <td>${m.concepto}</td>
      <td class="right mono">${m.tipo === "deposito" ? "+" : "-"}${fmt(m.monto)}</td>
    </tr>
  `).join("");

  const diferenciaClass = diferencia === 0
    ? "diferencia-cero"
    : diferencia > 0
    ? "diferencia-positiva"
    : "diferencia-negativa";

  const diferenciaLabel = diferencia === 0
    ? "✓ Sin diferencia"
    : diferencia > 0
    ? `+${fmt(diferencia)} (sobrante)`
    : `${fmt(diferencia)} (faltante)`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte Z — ${sesion.folio}</title>
  <style>${CSS_COMUN}</style>
</head>
<body>
  <div class="header">
    <h1>CREDIPHONE</h1>
    ${distribuidorNombre ? `<h2>${distribuidorNombre}</h2>` : ""}
    <div class="tipo-reporte">REPORTE Z — CIERRE DE TURNO</div>
    <div class="folio">Turno: ${sesion.folio}</div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir Reporte Z</button>

  <div class="divider-solid"></div>

  <div class="row"><span class="label">Fecha:</span><span class="value">${fmtFecha(sesion.fecha_apertura)}</span></div>
  <div class="row"><span class="label">Apertura:</span><span class="value mono">${fmtHora(sesion.fecha_apertura)}</span></div>
  ${sesion.fecha_cierre ? `<div class="row"><span class="label">Cierre:</span><span class="value mono">${fmtHora(sesion.fecha_cierre)}</span></div>` : ""}
  <div class="row"><span class="label">Duración:</span><span class="value mono">${duracionH}h ${duracionMin}min</span></div>
  <div class="row"><span class="label">Cajero:</span><span class="value">${sesion.users?.name || "—"}</span></div>
  ${sesion.notas_apertura ? `<div class="row"><span class="label">Notas apertura:</span><span class="value">${sesion.notas_apertura}</span></div>` : ""}
  ${sesion.notas_cierre ? `<div class="row"><span class="label">Notas cierre:</span><span class="value">${sesion.notas_cierre}</span></div>` : ""}

  <div class="divider"></div>

  <p class="section-title">Resumen de Ventas</p>
  <div class="row"><span class="label">Núm. ventas:</span><span class="value mono">${numVentas}</span></div>
  <div class="row"><span class="label">Efectivo:</span><span class="value mono">${fmt(efvo)}</span></div>
  <div class="row"><span class="label">Transferencia:</span><span class="value mono">${fmt(transf)}</span></div>
  <div class="row"><span class="label">Tarjeta:</span><span class="value mono">${fmt(tarj)}</span></div>
  <div class="divider"></div>
  <div class="row"><span class="label">Total Ventas:</span><span class="value mono">${fmt(efvo + transf + tarj)}</span></div>

  <div class="divider"></div>

  <p class="section-title">Arqueo de Caja</p>
  <div class="row"><span class="label">Monto Inicial:</span><span class="value mono">${fmt(sesion.monto_inicial)}</span></div>
  <div class="row"><span class="label">+ Ventas Efectivo:</span><span class="value mono">${fmt(efvo)}</span></div>
  ${depositos > 0 ? `<div class="row"><span class="label">+ Depósitos:</span><span class="value mono">${fmt(depositos)}</span></div>` : ""}
  ${retiros > 0 ? `<div class="row"><span class="label">- Retiros:</span><span class="value mono">${fmt(retiros)}</span></div>` : ""}
  <div class="divider"></div>
  <div class="row"><span class="label">Monto Esperado:</span><span class="value mono">${fmt(montoEsperado)}</span></div>
  <div class="row"><span class="label">Monto Contado:</span><span class="value mono">${fmt(montoFinal)}</span></div>
  <div class="divider-solid"></div>
  <div class="row">
    <span class="label">Diferencia:</span>
    <span class="value mono ${diferenciaClass}">${diferenciaLabel}</span>
  </div>

  ${ventas.filter(v => v.estado === "completada").length > 0 ? `
  <div class="divider"></div>
  <p class="section-title">Detalle de Ventas (${numVentas})</p>
  <table>
    <thead>
      <tr>
        <th>Folio</th>
        <th>Hora</th>
        <th>Cliente</th>
        <th>Método</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${ventasRows}</tbody>
  </table>
  ` : ""}

  ${movimientos.length > 0 ? `
  <div class="divider"></div>
  <p class="section-title">Movimientos de Caja</p>
  <table>
    <thead>
      <tr><th>Hora</th><th>Tipo</th><th>Concepto</th><th class="right">Monto</th></tr>
    </thead>
    <tbody>${movRows}</tbody>
  </table>
  ` : ""}

  <div class="divider-solid"></div>
  <div class="footer">
    <p>✓ TURNO CERRADO OFICIALMENTE</p>
    <p>Generado: ${new Date().toLocaleString("es-MX")}</p>
    <p style="margin-top:6px;">____________________________</p>
    <p>Firma del responsable</p>
  </div>
</body>
</html>`;
}

// =====================================================
// FUNCIÓN PARA ABRIR REPORTE EN VENTANA NUEVA
// =====================================================

export function abrirReporte(html: string, titulo: string): void {
  const ventana = window.open("", "_blank", "width=700,height=900,scrollbars=yes");
  if (!ventana) {
    alert("Permitir popups para ver el reporte. Busca el ícono de popup bloqueado en tu navegador.");
    return;
  }
  ventana.document.write(html);
  ventana.document.close();
  ventana.document.title = titulo;
}

// =====================================================
// FASE 32: TICKETS TÉRMICOS 58mm
// =====================================================

/**
 * CSS base para tickets térmicos 58mm
 * Ancho real: 58mm ≈ 220px. 48mm de área imprimible.
 */
const CSS_TICKET = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
    width: 280px;
    margin: 0 auto;
    padding: 8px 4px;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .lg { font-size: 14px; }
  .xl { font-size: 17px; }
  .sm { font-size: 9px; }
  .sep { border-top: 1px dashed #000; margin: 5px 0; }
  .sep-solid { border-top: 1px solid #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .row .lbl { color: #333; }
  .row .val { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; font-weight: bold; padding: 2px 2px; border-bottom: 1px solid #000; font-size: 10px; }
  th.r { text-align: right; }
  td { padding: 2px 2px; vertical-align: top; }
  td.r { text-align: right; }
  td.center { text-align: center; }
  .qr { display: block; margin: 8px auto; width: 110px; height: 110px; }
  .footer { text-align: center; margin-top: 8px; font-size: 9px; color: #555; }
  .estado-badge {
    display: inline-block;
    border: 1px solid #000;
    padding: 1px 4px;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 0.5px;
  }
  .print-btn {
    display: block;
    width: 100%;
    margin: 10px 0;
    padding: 8px;
    background: #09244a;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
  }
  .print-btn:hover { background: #0e3570; }
  @media print {
    .print-btn { display: none !important; }
    body { width: 58mm; padding: 2mm; }
  }
`;

function fmtTicket(num: number | undefined | null): string {
  const n = typeof num === "number" ? num : 0;
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFechaCorta(date: Date | string): string {
  return new Date(date).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function metodoPagoTicket(metodo: string): string {
  const map: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    mixto: "Mixto",
    deposito: "Depósito",
    payjoy: "Payjoy",
  };
  return map[metodo] || metodo;
}

// ── 1. TICKET VENTA POS ──────────────────────────────

export interface TicketVentaData {
  folio: string;
  fechaVenta: Date | string;
  vendedorNombre?: string;
  clienteNombre?: string;
  clienteApellido?: string;
  items: Array<{
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    imei?: string;
  }>;
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: string;
  desgloseMixto?: { efectivo?: number; transferencia?: number; tarjeta?: number };
  montoRecibido?: number;
  cambio?: number;
  distribuidorNombre?: string;
}

export function generarTicketVentaPOS(data: TicketVentaData): string {
  const itemsRows = data.items.map(item => `
    <tr>
      <td>${item.productoNombre}${item.imei ? `<br/><span class="sm">IMEI: ${item.imei}</span>` : ""}</td>
      <td class="r">${item.cantidad}</td>
      <td class="r">${fmtTicket(item.precioUnitario)}</td>
      <td class="r">${fmtTicket(item.subtotal)}</td>
    </tr>
  `).join("");

  const desglose = data.metodoPago === "mixto" && data.desgloseMixto
    ? Object.entries(data.desgloseMixto)
        .filter(([, v]) => v && v > 0)
        .map(([k, v]) => `<div class="row"><span>${metodoPagoTicket(k)}:</span><span>${fmtTicket(v)}</span></div>`)
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket ${data.folio}</title>
  <style>${CSS_TICKET}</style>
</head>
<body>
  <div class="center bold lg">CREDIPHONE</div>
  ${data.distribuidorNombre ? `<div class="center sm">${data.distribuidorNombre}</div>` : ""}
  <div class="center sm">Ticket de Venta</div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir Ticket</button>

  <div class="sep"></div>
  <div class="row"><span class="lbl">Folio:</span><span class="val bold">${data.folio}</span></div>
  <div class="row"><span class="lbl">Fecha:</span><span>${fmtFechaCorta(data.fechaVenta)}</span></div>
  ${data.clienteNombre ? `<div class="row"><span class="lbl">Cliente:</span><span>${data.clienteNombre} ${data.clienteApellido || ""}</span></div>` : ""}
  ${data.vendedorNombre ? `<div class="row"><span class="lbl">Atendió:</span><span>${data.vendedorNombre}</span></div>` : ""}

  <div class="sep"></div>
  <table>
    <thead>
      <tr><th>Artículo</th><th class="r">Cant</th><th class="r">P.U.</th><th class="r">Importe</th></tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="sep-solid"></div>
  ${data.descuento > 0 ? `
  <div class="row"><span>Subtotal:</span><span>${fmtTicket(data.subtotal)}</span></div>
  <div class="row"><span>Descuento:</span><span>-${fmtTicket(data.descuento)}</span></div>
  ` : ""}
  <div class="row bold xl"><span>TOTAL:</span><span>${fmtTicket(data.total)}</span></div>

  <div class="sep"></div>
  <div class="row"><span class="lbl">Método:</span><span>${metodoPagoTicket(data.metodoPago)}</span></div>
  ${desglose}
  ${data.montoRecibido !== undefined ? `<div class="row"><span>Efectivo recibido:</span><span>${fmtTicket(data.montoRecibido)}</span></div>` : ""}
  ${data.cambio !== undefined && data.cambio > 0 ? `<div class="row bold"><span>Cambio:</span><span>${fmtTicket(data.cambio)}</span></div>` : ""}

  <div class="sep"></div>
  <div class="footer">
    <p>¡Gracias por su compra!</p>
    <p>Conserve este ticket</p>
  </div>
</body>
</html>`;
}

// ── 2. TICKET RECEPCIÓN REPARACIÓN ───────────────────

export interface TicketRecepcionData {
  folio: string;
  fechaRecepcion: Date | string;
  fechaEstimadaEntrega?: Date | string;
  clienteNombre: string;
  clienteApellido?: string;
  clienteTelefono: string;
  marcaDispositivo: string;
  modeloDispositivo: string;
  imei?: string;
  numeroSerie?: string;
  problemaReportado: string;
  accesoriosEntregados?: string;
  condicionDispositivo?: string;
  tecnicoNombre?: string;
  distribuidorNombre?: string;
  qrDataUrl?: string; // data URL del QR generado con qrcode npm
  qrTrackingUrl?: string; // URL de seguimiento (sin QR pre-generado → se muestra textual)
}

export function generarTicketRecepcionReparacion(data: TicketRecepcionData): string {
  const qrSection = data.qrDataUrl
    ? `<div class="sep"></div>
       <div class="center sm bold">Escanea para ver el estado</div>
       <img src="${data.qrDataUrl}" class="qr" alt="QR seguimiento"/>`
    : data.qrTrackingUrl
    ? `<div class="sep"></div>
       <div class="center sm bold">Seguimiento en línea:</div>
       <div class="center sm" style="word-break:break-all">${data.qrTrackingUrl}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recepción ${data.folio}</title>
  <style>${CSS_TICKET}</style>
</head>
<body>
  <div class="center bold lg">CREDIPHONE</div>
  ${data.distribuidorNombre ? `<div class="center sm">${data.distribuidorNombre}</div>` : ""}
  <div class="center sm">Recepción de Equipo</div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir Ticket</button>

  <div class="sep"></div>
  <div class="center bold xl">${data.folio}</div>
  <div class="row"><span class="lbl">Recibido:</span><span>${fmtFechaCorta(data.fechaRecepcion)}</span></div>
  ${data.fechaEstimadaEntrega ? `<div class="row"><span class="lbl">Entrega est.:</span><span>${fmtFechaCorta(data.fechaEstimadaEntrega)}</span></div>` : ""}
  ${data.tecnicoNombre ? `<div class="row"><span class="lbl">Técnico:</span><span>${data.tecnicoNombre}</span></div>` : ""}

  <div class="sep"></div>
  <div class="bold sm">CLIENTE</div>
  <div>${data.clienteNombre} ${data.clienteApellido || ""}</div>
  <div>Tel: ${data.clienteTelefono}</div>

  <div class="sep"></div>
  <div class="bold sm">EQUIPO</div>
  <div>${data.marcaDispositivo} ${data.modeloDispositivo}</div>
  ${data.imei ? `<div class="sm">IMEI: ${data.imei}</div>` : ""}
  ${data.numeroSerie ? `<div class="sm">N/S: ${data.numeroSerie}</div>` : ""}
  ${data.condicionDispositivo ? `<div class="sm">Condición: ${data.condicionDispositivo}</div>` : ""}
  ${data.accesoriosEntregados ? `<div class="sm">Accesorios: ${data.accesoriosEntregados}</div>` : ""}

  <div class="sep"></div>
  <div class="bold sm">PROBLEMA REPORTADO</div>
  <div style="white-space:pre-wrap">${data.problemaReportado}</div>

  ${qrSection}

  <div class="sep-solid"></div>
  <div class="center sm">Al recoger su equipo presente este ticket.</div>
  <div class="center sm">Garantía sujeta a revisión técnica.</div>
  <div class="footer"><p>CREDIPHONE — Reparaciones</p></div>
</body>
</html>`;
}

// ── 3. TICKET ENTREGA REPARACIÓN ─────────────────────

export interface TicketEntregaData {
  folio: string;
  fechaEntrega: Date | string;
  clienteNombre: string;
  clienteApellido?: string;
  clienteTelefono: string;
  marcaDispositivo: string;
  modeloDispositivo: string;
  imei?: string;
  diagnostico?: string;
  notasTecnico?: string;
  costoReparacion: number;
  costoPartes: number;
  costoTotal: number;
  metodoPago?: string;
  tecnicoNombre?: string;
  distribuidorNombre?: string;
  diasGarantia?: number;
}

export function generarTicketEntregaReparacion(data: TicketEntregaData): string {
  const fechaGarantia = data.diasGarantia
    ? new Date(new Date(data.fechaEntrega).getTime() + data.diasGarantia * 24 * 60 * 60 * 1000)
    : null;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Entrega ${data.folio}</title>
  <style>${CSS_TICKET}</style>
</head>
<body>
  <div class="center bold lg">CREDIPHONE</div>
  ${data.distribuidorNombre ? `<div class="center sm">${data.distribuidorNombre}</div>` : ""}
  <div class="center sm">Entrega de Equipo</div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir Ticket</button>

  <div class="sep"></div>
  <div class="center bold xl">${data.folio}</div>
  <div class="row"><span class="lbl">Entrega:</span><span>${fmtFechaCorta(data.fechaEntrega)}</span></div>
  ${data.tecnicoNombre ? `<div class="row"><span class="lbl">Técnico:</span><span>${data.tecnicoNombre}</span></div>` : ""}

  <div class="sep"></div>
  <div class="bold sm">CLIENTE</div>
  <div>${data.clienteNombre} ${data.clienteApellido || ""}</div>
  <div>Tel: ${data.clienteTelefono}</div>

  <div class="sep"></div>
  <div class="bold sm">EQUIPO</div>
  <div>${data.marcaDispositivo} ${data.modeloDispositivo}</div>
  ${data.imei ? `<div class="sm">IMEI: ${data.imei}</div>` : ""}

  ${data.diagnostico ? `
  <div class="sep"></div>
  <div class="bold sm">DIAGNÓSTICO</div>
  <div style="white-space:pre-wrap;font-size:10px">${data.diagnostico}</div>
  ` : ""}

  ${data.notasTecnico ? `
  <div class="sep"></div>
  <div class="bold sm">TRABAJO REALIZADO</div>
  <div style="white-space:pre-wrap;font-size:10px">${data.notasTecnico}</div>
  ` : ""}

  <div class="sep-solid"></div>
  ${data.costoPartes > 0 ? `<div class="row"><span>Refacciones:</span><span>${fmtTicket(data.costoPartes)}</span></div>` : ""}
  ${data.costoReparacion > 0 ? `<div class="row"><span>Mano de obra:</span><span>${fmtTicket(data.costoReparacion)}</span></div>` : ""}
  <div class="row bold xl"><span>TOTAL:</span><span>${fmtTicket(data.costoTotal)}</span></div>
  ${data.metodoPago ? `<div class="row"><span class="lbl">Pago:</span><span>${metodoPagoTicket(data.metodoPago)}</span></div>` : ""}

  ${fechaGarantia ? `
  <div class="sep"></div>
  <div class="center bold sm">★ GARANTÍA ${data.diasGarantia} DÍAS ★</div>
  <div class="center sm">Válida hasta: ${new Date(fechaGarantia).toLocaleDateString("es-MX")}</div>
  <div class="center sm" style="font-size:9px">Aplica solo para el mismo fallo reparado.</div>
  ` : ""}

  <div class="sep-solid"></div>
  <div class="footer">
    <p>Firma de conformidad:</p>
    <p style="margin-top:20px">____________________________</p>
    <p>CREDIPHONE — Reparaciones</p>
  </div>
</body>
</html>`;
}

// ── 4. TICKET PAGO CRÉDITO ───────────────────────────

export interface TicketPagoData {
  // Pago
  pagoId: string;
  fechaPago: Date | string;
  monto: number;
  metodoPago: string;
  referencia?: string;
  // Crédito
  creditoFolio?: string;
  saldoAnterior?: number;
  saldoPendiente: number;
  proximoVencimiento?: Date | string;
  // Cliente
  clienteNombre: string;
  clienteApellido?: string;
  // Cobrador
  cobradorNombre?: string;
  distribuidorNombre?: string;
}

export function generarTicketPagoCredito(data: TicketPagoData): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Pago ${data.pagoId.slice(0, 8).toUpperCase()}</title>
  <style>${CSS_TICKET}</style>
</head>
<body>
  <div class="center bold lg">CREDIPHONE</div>
  ${data.distribuidorNombre ? `<div class="center sm">${data.distribuidorNombre}</div>` : ""}
  <div class="center sm">Comprobante de Pago</div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir Comprobante</button>

  <div class="sep"></div>
  <div class="row"><span class="lbl">Fecha:</span><span>${fmtFechaCorta(data.fechaPago)}</span></div>
  <div class="row"><span class="lbl">Ref:</span><span class="sm">${data.pagoId.slice(0, 12).toUpperCase()}</span></div>
  ${data.creditoFolio ? `<div class="row"><span class="lbl">Crédito:</span><span class="bold">${data.creditoFolio}</span></div>` : ""}

  <div class="sep"></div>
  <div class="bold sm">CLIENTE</div>
  <div class="bold">${data.clienteNombre} ${data.clienteApellido || ""}</div>

  <div class="sep-solid"></div>
  <div class="center bold xl">PAGO RECIBIDO</div>
  <div class="center xl bold">${fmtTicket(data.monto)}</div>
  <div class="row"><span class="lbl">Método:</span><span>${metodoPagoTicket(data.metodoPago)}</span></div>
  ${data.referencia ? `<div class="row"><span class="lbl">Referencia:</span><span class="sm">${data.referencia}</span></div>` : ""}
  ${data.cobradorNombre ? `<div class="row"><span class="lbl">Atendió:</span><span>${data.cobradorNombre}</span></div>` : ""}

  <div class="sep"></div>
  ${data.saldoAnterior !== undefined ? `<div class="row"><span>Saldo anterior:</span><span>${fmtTicket(data.saldoAnterior)}</span></div>` : ""}
  <div class="row"><span>Pago aplicado:</span><span>-${fmtTicket(data.monto)}</span></div>
  <div class="sep-solid"></div>
  <div class="row bold lg"><span>Saldo restante:</span><span>${fmtTicket(data.saldoPendiente)}</span></div>
  ${data.proximoVencimiento ? `<div class="row sm"><span>Próximo vence:</span><span>${new Date(data.proximoVencimiento).toLocaleDateString("es-MX")}</span></div>` : ""}

  <div class="sep"></div>
  <div class="footer">
    <p>Conserve este comprobante</p>
    <p>CREDIPHONE — Créditos</p>
  </div>
</body>
</html>`;
}
