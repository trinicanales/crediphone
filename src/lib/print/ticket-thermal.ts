/**
 * Generador de tickets ESC/POS para CREDIPHONE.
 * Convierte los datos de tickets HTML (FASE 32) en bytes ESC/POS para
 * impresoras térmicas directas por Bluetooth / Red / App.
 *
 * Soporta 58mm (32 chars) y 80mm (48 chars).
 */

import { EscPos, PAPER_CHARS } from './escpos';
import type { VentaDetallada } from '@/types';

export type PaperWidth = 58 | 80;

/** Configuración de la empresa para el encabezado del ticket */
export interface EmpresaConfig {
  nombre: string;
  rfc?: string;
  direccion?: string;
  telefono?: string;
  sitioWeb?: string;
}

// ─── Ticket de Venta POS ──────────────────────────────────────────────────────

export interface TicketVentaPOSData {
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
  descuento?: number;
  total: number;
  metodoPago: string;
  desgloseMixto?: { efectivo?: number; transferencia?: number; tarjeta?: number };
  montoRecibido?: number;
  cambio?: number;
}

export function buildTicketVentaPOS(
  data: TicketVentaPOSData,
  empresa: EmpresaConfig,
  paperWidth: PaperWidth = 58
): Uint8Array {
  const W = PAPER_CHARS[paperWidth] as 32 | 48;
  const cmds: Uint8Array[] = [];

  // ── Inicializar ────────────────────────────────────────────────────────────
  cmds.push(EscPos.init());
  cmds.push(EscPos.charsetCP437());

  // ── Encabezado ─────────────────────────────────────────────────────────────
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.size(1, 1)); // doble ancho y alto
  cmds.push(EscPos.text(truncate(empresa.nombre, W * 2)));
  cmds.push(EscPos.sizeNormal());
  if (empresa.rfc) cmds.push(EscPos.text(`RFC: ${empresa.rfc}`));
  if (empresa.direccion) cmds.push(EscPos.text(truncate(empresa.direccion, W)));
  if (empresa.telefono) cmds.push(EscPos.text(`Tel: ${empresa.telefono}`));
  cmds.push(EscPos.feed(1));

  // ── Folio y fecha ──────────────────────────────────────────────────────────
  cmds.push(EscPos.align('left'));
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.row('Folio:', data.folio, W));
  cmds.push(EscPos.row('Fecha:', fmtFecha(data.fechaVenta), W));
  if (data.vendedorNombre) cmds.push(EscPos.row('Vendedor:', truncate(data.vendedorNombre, W - 10), W));
  if (data.clienteNombre) {
    const nombre = [data.clienteNombre, data.clienteApellido].filter(Boolean).join(' ');
    cmds.push(EscPos.row('Cliente:', truncate(nombre, W - 9), W));
  }

  // ── Artículos ──────────────────────────────────────────────────────────────
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.text(padRight('DESCRIPCION', W - 12) + padLeft('CANT', 4) + padLeft('SUBTOT', 8)));
  cmds.push(EscPos.bold(false));
  cmds.push(EscPos.divider('-', W));

  for (const item of data.items) {
    const nombre = truncate(item.productoNombre, W - 12);
    cmds.push(EscPos.text(
      padRight(nombre, W - 12) +
      padLeft(String(item.cantidad), 4) +
      padLeft(fmt(item.subtotal), 8)
    ));
    // Precio unitario en línea propia (más legible en 58mm)
    cmds.push(EscPos.text(
      `  c/u: ${fmt(item.precioUnitario)}`
    ));
    if (item.imei) {
      cmds.push(EscPos.text(`  IMEI: ${item.imei}`));
    }
  }

  // ── Totales ────────────────────────────────────────────────────────────────
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.row('Subtotal:', fmt(data.subtotal), W));

  if (data.descuento && data.descuento > 0) {
    cmds.push(EscPos.row('Descuento:', `-${fmt(data.descuento)}`, W));
  }

  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.row('TOTAL:', fmt(data.total), W));
  cmds.push(EscPos.bold(false));
  cmds.push(EscPos.divider('=', W));

  // ── Pago ───────────────────────────────────────────────────────────────────
  const mpLabel = metodoPagoLabel(data.metodoPago);
  cmds.push(EscPos.row('Metodo de pago:', mpLabel, W));

  if (data.metodoPago === 'mixto' && data.desgloseMixto) {
    if (data.desgloseMixto.efectivo)      cmds.push(EscPos.row('  Efectivo:', fmt(data.desgloseMixto.efectivo), W));
    if (data.desgloseMixto.transferencia) cmds.push(EscPos.row('  Transfer:', fmt(data.desgloseMixto.transferencia), W));
    if (data.desgloseMixto.tarjeta)       cmds.push(EscPos.row('  Tarjeta:', fmt(data.desgloseMixto.tarjeta), W));
  }

  if (data.metodoPago === 'efectivo') {
    if (data.montoRecibido !== undefined) cmds.push(EscPos.row('Recibido:', fmt(data.montoRecibido), W));
    if (data.cambio !== undefined)        cmds.push(EscPos.row('Cambio:', fmt(data.cambio), W));
  }

  // ── Pie ────────────────────────────────────────────────────────────────────
  cmds.push(EscPos.feed(1));
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.text('Gracias por tu compra!'));
  if (empresa.sitioWeb) cmds.push(EscPos.text(empresa.sitioWeb));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.cut());
  return EscPos.build(cmds);
}

// ─── Ticket de Recepción de Reparación ───────────────────────────────────────

export interface TicketReparacionData {
  folio: string;
  fechaIngreso: Date | string;
  clienteNombre: string;
  clienteTelefono?: string;
  equipo: string;              // "iPhone 14 Pro Max"
  color?: string;
  imei?: string;
  problema: string;
  tecnicoNombre?: string;
  presupuesto?: number;
  anticipo?: number;
  urlTracking?: string;       // para el QR
  notas?: string;
  // Campos adicionales para el técnico
  prioridad?: string;                     // "normal" | "urgente" | "express"
  condicionFisica?: string;               // estado físico del dispositivo
  accesoriosEntregados?: string;          // cargador, funda, etc.
  patronDesbloqueo?: string;              // patrón de desbloqueo
  contrasena?: string;                    // contraseña / PIN
  garantiaDias?: number;                  // días de garantía de la reparación
  piezasCotizacion?: Array<{             // piezas cotizadas inicialmente
    nombre: string;
    cantidad?: number;
    precio?: number;
  }>;
}

export function buildTicketReparacion(
  data: TicketReparacionData,
  empresa: EmpresaConfig,
  paperWidth: PaperWidth = 58
): Uint8Array {
  const W = PAPER_CHARS[paperWidth] as 32 | 48;
  const cmds: Uint8Array[] = [];

  cmds.push(EscPos.init());
  cmds.push(EscPos.charsetCP437());

  // ── Encabezado ─────────────────────────────────────────────────────────────
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.size(1, 1));
  cmds.push(EscPos.text('ORDEN DE REPARACION'));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.text(truncate(empresa.nombre, W)));
  cmds.push(EscPos.feed(1));

  // ── Folio ──────────────────────────────────────────────────────────────────
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.size(1, 0)); // doble ancho
  cmds.push(EscPos.text(data.folio));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.text(fmtFecha(data.fechaIngreso)));
  cmds.push(EscPos.feed(1));

  // ── Datos cliente ──────────────────────────────────────────────────────────
  cmds.push(EscPos.align('left'));
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.text(`Cliente: ${truncate(data.clienteNombre, W - 9)}`));
  cmds.push(EscPos.bold(false));
  if (data.clienteTelefono) {
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.row('Tel:', data.clienteTelefono, W));
    cmds.push(EscPos.bold(false));
  }

  // ── Dispositivo ────────────────────────────────────────────────────────────
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.size(1, 0));
  cmds.push(EscPos.text(truncate(data.equipo, W * 2)));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.bold(false));
  if (data.color)         cmds.push(EscPos.row('Color:', data.color, W));
  if (data.imei) {
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.row('IMEI:', data.imei, W));
    cmds.push(EscPos.bold(false));
  }
  if (data.condicionFisica)      cmds.push(EscPos.row('Condicion:', truncate(data.condicionFisica, W - 11), W));
  if (data.accesoriosEntregados) cmds.push(EscPos.row('Accesorios:', truncate(data.accesoriosEntregados, W - 12), W));
  cmds.push(EscPos.divider('-', W));

  // ── Acceso al dispositivo ──────────────────────────────────────────────────
  if (data.patronDesbloqueo || data.contrasena) {
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text('ACCESO AL DISPOSITIVO:'));
    if (data.patronDesbloqueo) cmds.push(EscPos.row('Patron:', data.patronDesbloqueo, W));
    if (data.contrasena)       cmds.push(EscPos.row('Contrasena:', data.contrasena, W));
    cmds.push(EscPos.bold(false));
    cmds.push(EscPos.divider('-', W));
  }

  // ── Problema ───────────────────────────────────────────────────────────────
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.text('PROBLEMA:'));
  cmds.push(EscPos.bold(false));
  for (const line of wordWrap(data.problema, W)) {
    cmds.push(EscPos.text(line));
  }

  // ── Piezas cotizadas ───────────────────────────────────────────────────────
  if (data.piezasCotizacion && data.piezasCotizacion.length > 0) {
    cmds.push(EscPos.divider('-', W));
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text('PIEZAS COTIZADAS:'));
    cmds.push(EscPos.bold(false));
    for (const pieza of data.piezasCotizacion) {
      const qty = pieza.cantidad ? `x${pieza.cantidad} ` : '';
      const precio = pieza.precio ? ` ${fmt(pieza.precio)}` : '';
      cmds.push(EscPos.text(truncate(`• ${qty}${pieza.nombre}${precio}`, W)));
    }
  }

  // ── Técnico y prioridad ────────────────────────────────────────────────────
  cmds.push(EscPos.divider('-', W));
  if (data.tecnicoNombre) {
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.row('Tecnico:', truncate(data.tecnicoNombre, W - 9), W));
    cmds.push(EscPos.bold(false));
  }
  if (data.prioridad && data.prioridad !== 'normal') {
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.row('Prioridad:', data.prioridad.toUpperCase(), W));
    cmds.push(EscPos.bold(false));
  }

  if (data.presupuesto !== undefined || data.anticipo !== undefined) {
    cmds.push(EscPos.divider('-', W));
    if (data.presupuesto !== undefined) {
      cmds.push(EscPos.bold(true));
      cmds.push(EscPos.row('Presupuesto:', fmt(data.presupuesto), W));
      cmds.push(EscPos.bold(false));
    }
    if (data.anticipo !== undefined) cmds.push(EscPos.row('Anticipo:', fmt(data.anticipo), W));
  }

  if (data.notas) {
    cmds.push(EscPos.divider('-', W));
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text('Notas:'));
    cmds.push(EscPos.bold(false));
    for (const line of wordWrap(data.notas, W)) {
      cmds.push(EscPos.text(line));
    }
  }

  if (data.garantiaDias) {
    cmds.push(EscPos.divider('-', W));
    cmds.push(EscPos.align('center'));
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text(`Garantia reparacion: ${data.garantiaDias} dias`));
    cmds.push(EscPos.bold(false));
    cmds.push(EscPos.align('left'));
  }

  // ── QR de seguimiento ──────────────────────────────────────────────────────
  if (data.urlTracking) {
    cmds.push(EscPos.feed(1));
    cmds.push(EscPos.align('center'));
    cmds.push(EscPos.text('Escanea para seguimiento:'));
    cmds.push(EscPos.qrCode(data.urlTracking, paperWidth === 58 ? 4 : 6));
    cmds.push(EscPos.text(truncate(data.urlTracking, W)));
  }

  // ── Pie ────────────────────────────────────────────────────────────────────
  cmds.push(EscPos.feed(1));
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.text('Conserva este ticket'));
  if (empresa.telefono) cmds.push(EscPos.text(`Consultas: ${empresa.telefono}`));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.cut());
  return EscPos.build(cmds);
}

// ─── Ticket de Pago de Crédito ────────────────────────────────────────────────

export interface TicketPagoCreditoData {
  folio: string;             // folio del crédito
  fechaPago: Date | string;
  clienteNombre: string;
  productoNombre: string;
  montoPago: number;
  saldoAnterior: number;
  saldoRestante: number;
  metodoPago: string;
  referencia?: string;
  cobradoPor?: string;
}

export function buildTicketPagoCredito(
  data: TicketPagoCreditoData,
  empresa: EmpresaConfig,
  paperWidth: PaperWidth = 58
): Uint8Array {
  const W = PAPER_CHARS[paperWidth] as 32 | 48;
  const cmds: Uint8Array[] = [];

  cmds.push(EscPos.init());
  cmds.push(EscPos.charsetCP437());

  // ── Encabezado ─────────────────────────────────────────────────────────────
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.size(1, 1));
  cmds.push(EscPos.text('RECIBO DE PAGO'));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.text(truncate(empresa.nombre, W)));
  if (empresa.rfc) cmds.push(EscPos.text(`RFC: ${empresa.rfc}`));
  cmds.push(EscPos.feed(1));

  // ── Datos ──────────────────────────────────────────────────────────────────
  cmds.push(EscPos.align('left'));
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.row('Credito:', data.folio, W));
  cmds.push(EscPos.row('Fecha:', fmtFecha(data.fechaPago), W));
  cmds.push(EscPos.row('Cliente:', truncate(data.clienteNombre, W - 9), W));
  cmds.push(EscPos.row('Equipo:', truncate(data.productoNombre, W - 8), W));
  cmds.push(EscPos.divider('-', W));

  // ── Montos ─────────────────────────────────────────────────────────────────
  cmds.push(EscPos.row('Saldo anterior:', fmt(data.saldoAnterior), W));
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.size(1, 0));
  cmds.push(EscPos.row('ABONO:', fmt(data.montoPago), Math.floor(W / 2) as 32 | 48));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.bold(false));
  cmds.push(EscPos.row('Saldo restante:', fmt(data.saldoRestante), W));
  cmds.push(EscPos.divider('=', W));
  cmds.push(EscPos.row('Metodo:', metodoPagoLabel(data.metodoPago), W));
  if (data.referencia) cmds.push(EscPos.row('Ref:', truncate(data.referencia, W - 5), W));
  if (data.cobradoPor) cmds.push(EscPos.row('Cobrado por:', truncate(data.cobradoPor, W - 12), W));

  // ── Estado del crédito ─────────────────────────────────────────────────────
  if (data.saldoRestante <= 0) {
    cmds.push(EscPos.feed(1));
    cmds.push(EscPos.align('center'));
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text('*** CREDITO LIQUIDADO ***'));
    cmds.push(EscPos.bold(false));
  }

  // ── Pie ────────────────────────────────────────────────────────────────────
  cmds.push(EscPos.feed(1));
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.text('Gracias por tu pago!'));
  if (empresa.telefono) cmds.push(EscPos.text(`Tel: ${empresa.telefono}`));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.cut());
  return EscPos.build(cmds);
}

// ─── Ticket de Anticipo de Reparación (comprobante para el cliente) ─────────

export interface TicketAnticipoData {
  folioRecibo: string;       // ej. ANT-1A2B3C4D
  folioOrden: string;
  fecha: Date | string;
  clienteNombre: string;
  equipo?: string;
  montoAnticipo: number;
  totalOrden: number;        // 0 si aun no hay presupuesto
  saldoRestante: number;
  metodoPago: string;
  referencia?: string;
  recibidoPor?: string;
  pendienteConfirmacion?: boolean; // transferencia / deposito por confirmar
}

export function buildTicketAnticipo(
  data: TicketAnticipoData,
  empresa: EmpresaConfig,
  paperWidth: PaperWidth = 58
): Uint8Array {
  const W = PAPER_CHARS[paperWidth] as 32 | 48;
  const cmds: Uint8Array[] = [];

  cmds.push(EscPos.init());
  cmds.push(EscPos.charsetCP437());

  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.size(1, 1));
  cmds.push(EscPos.text('COMPROBANTE DE ANTICIPO'));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.text(truncate(empresa.nombre, W)));
  if (empresa.rfc) cmds.push(EscPos.text(`RFC: ${empresa.rfc}`));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.align('left'));
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.row('Recibo:', data.folioRecibo, W));
  cmds.push(EscPos.row('Orden:', data.folioOrden, W));
  cmds.push(EscPos.row('Fecha:', fmtFecha(data.fecha), W));
  cmds.push(EscPos.row('Cliente:', truncate(data.clienteNombre, W - 9), W));
  if (data.equipo) cmds.push(EscPos.row('Equipo:', truncate(data.equipo, W - 8), W));
  cmds.push(EscPos.divider('-', W));

  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.size(1, 0));
  cmds.push(EscPos.row('ANTICIPO:', fmt(data.montoAnticipo), Math.floor(W / 2) as 32 | 48));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.bold(false));
  if (data.totalOrden > 0) {
    cmds.push(EscPos.row('Total servicio:', fmt(data.totalOrden), W));
    cmds.push(EscPos.row('Saldo restante:', fmt(data.saldoRestante), W));
  }
  cmds.push(EscPos.divider('=', W));
  cmds.push(EscPos.row('Metodo:', metodoPagoLabel(data.metodoPago), W));
  if (data.referencia) cmds.push(EscPos.row('Ref:', truncate(data.referencia, W - 5), W));
  if (data.recibidoPor) cmds.push(EscPos.row('Recibio:', truncate(data.recibidoPor, W - 9), W));

  if (data.pendienteConfirmacion) {
    cmds.push(EscPos.feed(1));
    cmds.push(EscPos.align('center'));
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text('PENDIENTE DE CONFIRMAR'));
    cmds.push(EscPos.bold(false));
    cmds.push(EscPos.text('en banco'));
  }

  cmds.push(EscPos.feed(1));
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.text('Conserva este comprobante'));
  cmds.push(EscPos.text('para recoger tu equipo.'));
  if (empresa.telefono) cmds.push(EscPos.text(`Tel: ${empresa.telefono}`));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.cut());
  return EscPos.build(cmds);
}

// ─── Ticket de Entrega de Reparación ─────────────────────────────────────────

export interface TicketEntregaData {
  folio: string;
  fechaEntrega: Date | string;
  clienteNombre: string;
  equipo: string;
  trabajoRealizado: string;
  totalServicio: number;
  anticipoPagado?: number;
  saldoFinal?: number;
  metodoPago?: string;
  garantiaDias?: number;        // días de garantía en el trabajo
  tecnicoNombre?: string;
}

export function buildTicketEntrega(
  data: TicketEntregaData,
  empresa: EmpresaConfig,
  paperWidth: PaperWidth = 58
): Uint8Array {
  const W = PAPER_CHARS[paperWidth] as 32 | 48;
  const cmds: Uint8Array[] = [];

  cmds.push(EscPos.init());
  cmds.push(EscPos.charsetCP437());

  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.size(1, 1));
  cmds.push(EscPos.text('ENTREGA DE EQUIPO'));
  cmds.push(EscPos.sizeNormal());
  cmds.push(EscPos.text(truncate(empresa.nombre, W)));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.align('left'));
  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.row('Orden:', data.folio, W));
  cmds.push(EscPos.row('Fecha:', fmtFecha(data.fechaEntrega), W));
  cmds.push(EscPos.row('Cliente:', truncate(data.clienteNombre, W - 9), W));
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.text(`Equipo: ${truncate(data.equipo, W - 8)}`));
  cmds.push(EscPos.bold(false));

  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.bold(true));
  cmds.push(EscPos.text('Trabajo realizado:'));
  cmds.push(EscPos.bold(false));
  for (const line of wordWrap(data.trabajoRealizado, W)) {
    cmds.push(EscPos.text(line));
  }

  cmds.push(EscPos.divider('-', W));
  cmds.push(EscPos.row('Total servicio:', fmt(data.totalServicio), W));
  if (data.anticipoPagado) cmds.push(EscPos.row('Anticipo pagado:', fmt(data.anticipoPagado), W));
  if (data.saldoFinal !== undefined) {
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.row('SALDO A PAGAR:', fmt(data.saldoFinal), W));
    cmds.push(EscPos.bold(false));
  }
  if (data.metodoPago) cmds.push(EscPos.row('Forma de pago:', metodoPagoLabel(data.metodoPago), W));
  if (data.tecnicoNombre) cmds.push(EscPos.row('Tecnico:', truncate(data.tecnicoNombre, W - 9), W));

  if (data.garantiaDias) {
    cmds.push(EscPos.divider('-', W));
    cmds.push(EscPos.align('center'));
    cmds.push(EscPos.bold(true));
    cmds.push(EscPos.text(`Garantia: ${data.garantiaDias} dias`));
    cmds.push(EscPos.bold(false));
  }

  cmds.push(EscPos.feed(1));
  cmds.push(EscPos.align('center'));
  cmds.push(EscPos.text('Gracias por tu preferencia!'));
  cmds.push(EscPos.feed(1));

  cmds.push(EscPos.cut());
  return EscPos.build(cmds);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(num: number): string {
  return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFecha(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function metodoPagoLabel(mp: string): string {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    deposito: 'Deposito',
    mixto: 'Mixto',
    payjoy: 'Payjoy',
  };
  return map[mp] ?? mp;
}

/** Trunca texto si supera la longitud máxima */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '~';
}

/** Rellena con espacios a la derecha */
function padRight(text: string, width: number): string {
  return text.padEnd(width, ' ').slice(0, width);
}

/** Rellena con espacios a la izquierda */
function padLeft(text: string, width: number): string {
  return text.padStart(width, ' ').slice(-width);
}

/** Word-wrap: divide texto largo en líneas de ancho máximo */
function wordWrap(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];
  const lines: string[] = [];
  const words = text.split(' ');
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Re-export del tipo VentaDetallada para uso externo ──────────────────────

/** Helper: convierte VentaDetallada (tipo del sistema) a TicketVentaPOSData */
export function fromVentaDetallada(venta: VentaDetallada): TicketVentaPOSData {
  return {
    folio: venta.folio,
    fechaVenta: venta.fechaVenta,
    vendedorNombre: venta.vendedorNombre,
    clienteNombre: venta.clienteNombre,
    clienteApellido: venta.clienteApellido,
    items: (venta.items ?? []).map(item => ({
      productoNombre: (item as { productoNombre?: string }).productoNombre ?? 'Producto',
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal,
      imei: (item as { imei?: string }).imei,
    })),
    subtotal: venta.subtotal,
    descuento: venta.descuento,
    total: venta.total,
    metodoPago: venta.metodoPago,
    desgloseMixto: venta.desgloseMixto as TicketVentaPOSData['desgloseMixto'],
    montoRecibido: venta.montoRecibido,
    cambio: venta.cambio,
  };
}
