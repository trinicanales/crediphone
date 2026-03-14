"use client";

import { useState } from "react";
import { X, Download, CheckCircle, ShoppingBag, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { VentaDetallada } from "@/types";
import { generarTicketVentaPOS, abrirReporte } from "@/lib/utils/reportes";

interface ReciboModalProps {
  venta: VentaDetallada;
  isOpen: boolean;
  onClose: () => void;
  onNuevaVenta: () => void;
}

export function ReciboModal({
  venta,
  isOpen,
  onClose,
  onNuevaVenta,
}: ReciboModalProps) {
  const [downloading, setDownloading] = useState(false);

  // FASE 32: Ticket 58mm
  const handleImprimirTicket = () => {
    const html = generarTicketVentaPOS({
      folio: venta.folio,
      fechaVenta: venta.fechaVenta,
      vendedorNombre: venta.vendedorNombre,
      clienteNombre: venta.clienteNombre,
      clienteApellido: venta.clienteApellido,
      items: (venta.items || []).map(item => ({
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
    abrirReporte(html, `Ticket ${venta.folio}`);
  };

  if (!isOpen) return null;

  const handleDownloadRecibo = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/pos/ventas/${venta.id}/recibo`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Error al generar recibo");
      }

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

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[9999] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Venta Completada
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {venta.folio}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Resumen de venta */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(venta.fechaVenta).toLocaleString("es-MX")}
                </span>
              </div>

              {venta.clienteNombre && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Cliente:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {venta.clienteNombre} {venta.clienteApellido || ""}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Productos:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {venta.items?.length || 0}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${venta.subtotal.toFixed(2)}
                </span>
              </div>

              {venta.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Descuento:
                  </span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    -${venta.descuento.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    Total:
                  </span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${venta.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Método de pago:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {metodoPagoLabel}
                  </span>
                </div>

                {venta.metodoPago === "efectivo" && venta.cambio !== undefined && (
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-600 dark:text-gray-400">Cambio:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      ${venta.cambio.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Success message */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200 text-center">
                La venta se ha registrado exitosamente y el stock se ha actualizado
                automáticamente.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            {/* FASE 32: Ticket 58mm */}
            <Button
              onClick={handleImprimirTicket}
              variant="secondary"
            >
              <Printer className="w-4 h-4 mr-2" />
              Ticket 58mm
            </Button>

            <Button
              onClick={handleDownloadRecibo}
              disabled={downloading}
              variant="secondary"
            >
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
