"use client";

import { useState } from "react";
import { X, Download, CheckCircle, ShoppingBag, Printer, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { VentaDetallada } from "@/types";
import { generarTicketVentaPOS, abrirReporte } from "@/lib/utils/reportes";

interface ReciboModalProps {
  venta: VentaDetallada;
  isOpen: boolean;
  onClose: () => void;
  onNuevaVenta: () => void;
  /** Teléfono del cliente para el botón de WhatsApp */
  clienteTelefono?: string;
}

export function ReciboModal({
  venta,
  isOpen,
  onClose,
  onNuevaVenta,
  clienteTelefono,
}: ReciboModalProps) {
  const [downloading, setDownloading] = useState(false);

  // ── Ticket 58mm ───────────────────────────────────────
  const buildTicketHtml = () =>
    generarTicketVentaPOS({
      folio: venta.folio,
      fechaVenta: venta.fechaVenta,
      vendedorNombre: venta.vendedorNombre,
      clienteNombre: venta.clienteNombre,
      clienteApellido: venta.clienteApellido,
      items: (venta.items || []).map((item) => ({
        productoNombre: item.productoNombre || "Producto",
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        imei: (item as any).imei,
      })),
      subtotal: venta.subtotal,
      descuento: venta.descuento,
      total: venta.total,
      metodoPago: venta.metodoPago,
      desgloseMixto: venta.desgloseMixto as any,
      montoRecibido: venta.montoRecibido,
      cambio: venta.cambio,
    });

  // FASE 32: abrir ticket en ventana nueva (sin auto-print)
  const handleImprimirTicket = () => {
    abrirReporte(buildTicketHtml(), `Ticket ${venta.folio}`);
  };

  // SEGUIMIENTO: imprimir directamente (auto-dispara diálogo de impresión)
  const handleImprimirDirecto = () => {
    const html = buildTicketHtml();
    const ventana = window.open("", "_blank", "width=400,height=700,scrollbars=yes");
    if (!ventana) {
      alert("Permite popups para imprimir. Busca el ícono de popup bloqueado en tu navegador.");
      return;
    }
    ventana.document.write(html);
    ventana.document.close();
    // Esperar a que el contenido renderice antes de imprimir
    ventana.onload = () => {
      setTimeout(() => ventana.print(), 300);
    };
  };

  // SEGUIMIENTO: enviar por WhatsApp
  const handleWhatsApp = () => {
    const telefono = clienteTelefono?.replace(/\D/g, "") || "";
    const numeroWA = telefono.startsWith("52") ? telefono : `52${telefono}`;
    const total = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
      venta.total
    );
    const nombre =
      venta.clienteNombre
        ? `${venta.clienteNombre}${venta.clienteApellido ? " " + venta.clienteApellido : ""}`
        : "cliente";
    const mensaje = encodeURIComponent(
      `¡Hola ${nombre}! 🎉\n\nTu compra en CREDIPHONE ha sido registrada:\n\n📋 Folio: ${venta.folio}\n💰 Total: ${total}\n💳 Pago: ${metodoPagoLabel}\n\n¡Gracias por tu preferencia! 😊`
    );
    window.open(
      telefono ? `https://wa.me/${numeroWA}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`,
      "_blank"
    );
  };

  if (!isOpen) return null;

  const handleDownloadRecibo = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/pos/ventas/${venta.id}/recibo`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Error al generar recibo");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Recibo-${venta.folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error al descargar recibo:", error);
      alert("Error al descargar el recibo");
    } finally {
      setDownloading(false);
    }
  };

  const handleNuevaVenta = () => {
    onNuevaVenta();
    onClose();
  };

  const metodoPagoLabel =
    venta.metodoPago === "efectivo"
      ? "Efectivo"
      : venta.metodoPago === "tarjeta"
      ? "Tarjeta"
      : venta.metodoPago === "transferencia"
      ? "Transferencia"
      : "Mixto";

  const tieneCliente = !!(venta.clienteNombre || clienteTelefono);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[9999] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="rounded-lg shadow-xl max-w-md w-full pointer-events-auto animate-in zoom-in-95 duration-200"
          style={{ background: "var(--color-bg-surface)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-6"
            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-success-bg)" }}
              >
                <CheckCircle className="w-6 h-6" style={{ color: "var(--color-success)" }} />
              </div>
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Venta Completada
                </h2>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
                >
                  {venta.folio}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--color-text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-bg-elevated)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Resumen de venta */}
            <div
              className="rounded-lg p-4 space-y-3"
              style={{ background: "var(--color-bg-sunken)" }}
            >
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Fecha:</span>
                <span
                  className="font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {new Date(venta.fechaVenta).toLocaleString("es-MX")}
                </span>
              </div>

              {venta.clienteNombre && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>Cliente:</span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {venta.clienteNombre} {venta.clienteApellido || ""}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Productos:</span>
                <span
                  className="font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {venta.items?.length || 0}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Subtotal:</span>
                <span
                  className="font-medium"
                  style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
                >
                  ${venta.subtotal.toFixed(2)}
                </span>
              </div>

              {venta.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>Descuento:</span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--color-danger)", fontFamily: "var(--font-data)" }}
                  >
                    -${venta.descuento.toFixed(2)}
                  </span>
                </div>
              )}

              <div
                className="pt-2"
                style={{ borderTop: "1px solid var(--color-border-subtle)" }}
              >
                <div className="flex justify-between items-baseline">
                  <span
                    className="text-lg font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Total:
                  </span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
                  >
                    ${venta.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <div
                className="pt-2"
                style={{ borderTop: "1px solid var(--color-border-subtle)" }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>Método de pago:</span>
                  <span
                    className="font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {metodoPagoLabel}
                  </span>
                </div>

                {venta.metodoPago === "efectivo" && venta.cambio !== undefined && (
                  <div className="flex justify-between text-sm mt-2">
                    <span style={{ color: "var(--color-text-muted)" }}>Cambio:</span>
                    <span
                      className="font-medium"
                      style={{ color: "var(--color-info)", fontFamily: "var(--font-data)" }}
                    >
                      ${venta.cambio.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── SECCIÓN: ¿Compartir comprobante? ───────────────── */}
            <div
              className="rounded-lg p-4"
              style={{
                background: "var(--color-accent-light)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <p
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--color-text-primary)" }}
              >
                ¿Qué deseas hacer con el comprobante?
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Imprimir directamente */}
                <button
                  onClick={handleImprimirDirecto}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-accent)";
                    e.currentTarget.style.color = "var(--color-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                    e.currentTarget.style.color = "var(--color-text-primary)";
                  }}
                  title="Abre el ticket y lanza el diálogo de impresión automáticamente"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir ahora
                </button>

                {/* Enviar por WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  disabled={!tieneCliente}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: tieneCliente ? "#25D366" : "var(--color-bg-elevated)",
                    color: tieneCliente ? "#fff" : "var(--color-text-muted)",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (tieneCliente)
                      e.currentTarget.style.background = "#1ebe5d";
                  }}
                  onMouseLeave={(e) => {
                    if (tieneCliente)
                      e.currentTarget.style.background = "#25D366";
                  }}
                  title={
                    !tieneCliente
                      ? "Selecciona un cliente con teléfono para usar WhatsApp"
                      : clienteTelefono
                      ? `Enviar a ${clienteTelefono}`
                      : "Enviar mensaje de WhatsApp"
                  }
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                  {clienteTelefono && (
                    <span
                      className="text-xs opacity-80"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {clienteTelefono}
                    </span>
                  )}
                </button>
              </div>

              {!tieneCliente && (
                <p
                  className="text-xs mt-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Selecciona un cliente para habilitar WhatsApp
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex flex-wrap gap-3 p-6"
            style={{
              background: "var(--color-bg-sunken)",
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            {/* Ticket 58mm (ventana, sin auto-print) */}
            <Button onClick={handleImprimirTicket} variant="secondary">
              <Printer className="w-4 h-4 mr-2" />
              Ticket 58mm
            </Button>

            {/* Recibo PDF completo */}
            <Button onClick={handleDownloadRecibo} disabled={downloading} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "..." : "Recibo PDF"}
            </Button>

            <Button onClick={handleNuevaVenta} className="flex-1">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Nueva Venta
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
