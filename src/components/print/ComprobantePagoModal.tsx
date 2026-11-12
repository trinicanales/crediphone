"use client";

import { useMemo } from "react";
import { CheckCircle, MessageCircle, Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ThermalPrinterButton } from "@/components/print/ThermalPrinterButton";
import { useConfig } from "@/components/ConfigProvider";
import { buildTicketAnticipo, buildTicketPagoCredito } from "@/lib/print/ticket-thermal";
import {
  mensajeComprobante,
  linkWhatsAppComprobante,
  ticketHtmlComprobante,
  type DatosComprobante,
} from "@/lib/print/comprobante";

interface ComprobantePagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  datos: Omit<DatosComprobante, "empresaNombre">;
}

const MX = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);

/**
 * Comprobante de cualquier pago o anticipo (reparaciones y créditos, desde POS o desde su pantalla).
 * Opciones: ticket térmico 58 mm, imprimir desde el navegador o enviar por WhatsApp (mensaje de texto).
 */
export function ComprobantePagoModal({ isOpen, onClose, datos }: ComprobantePagoModalProps) {
  const { config } = useConfig();

  const completo: DatosComprobante = useMemo(
    () => ({ ...datos, empresaNombre: config?.nombreEmpresa || "CREDIPHONE" }),
    [datos, config]
  );

  const escposData = useMemo(() => {
    try {
      const empresa = {
        nombre: completo.empresaNombre,
        rfc: config?.rfc || undefined,
        direccion: config?.direccionEmpresa || undefined,
        telefono: config?.telefonoEmpresa || undefined,
      };
      if (completo.tipo === "anticipo") {
        return buildTicketAnticipo(
          {
            folioRecibo: completo.folioRecibo,
            folioOrden: completo.folioReferencia,
            fecha: completo.fecha,
            clienteNombre: completo.clienteNombre,
            equipo: completo.descripcion,
            montoAnticipo: completo.monto,
            totalOrden: completo.total,
            saldoRestante: completo.saldoRestante,
            metodoPago: completo.metodoPago,
            referencia: completo.referencia,
            recibidoPor: completo.recibidoPor,
            pendienteConfirmacion: completo.pendienteConfirmacion,
          },
          empresa,
          58
        );
      }
      return buildTicketPagoCredito(
        {
          folio: completo.folioReferencia,
          fechaPago: completo.fecha,
          clienteNombre: completo.clienteNombre,
          productoNombre: completo.descripcion ?? "",
          montoPago: completo.monto,
          saldoAnterior: completo.saldoRestante + completo.monto,
          saldoRestante: completo.saldoRestante,
          metodoPago: completo.metodoPago,
          referencia: completo.referencia,
          cobradoPor: completo.recibidoPor,
        },
        empresa,
        58
      );
    } catch {
      return undefined;
    }
  }, [completo, config]);

  const html = useMemo(() => ticketHtmlComprobante(completo), [completo]);

  const imprimirNavegador = () => {
    const w = window.open("", "_blank", "width=400,height=700,scrollbars=yes");
    if (!w) {
      alert("Permite popups para imprimir. Busca el ícono de popup bloqueado en tu navegador.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.onload = () => setTimeout(() => w.print(), 300);
  };

  const enviarWhatsApp = () => {
    const url = linkWhatsAppComprobante(completo.clienteTelefono, mensajeComprobante(completo));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={completo.tipo === "anticipo" ? "Anticipo registrado" : "Pago registrado"}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 shrink-0" style={{ color: "var(--color-success)" }} />
          <div>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Recibo <span style={{ fontFamily: "var(--font-mono)" }}>{completo.folioRecibo}</span> · {completo.clienteNombre}
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
              {MX(completo.monto)}
            </p>
            {completo.total > 0 && (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Saldo restante: <span style={{ fontFamily: "var(--font-mono)" }}>{MX(completo.saldoRestante)}</span>
              </p>
            )}
            {completo.pendienteConfirmacion && (
              <p className="text-xs mt-1" style={{ color: "var(--color-warning-text)" }}>
                Pendiente de confirmar en banco: el ticket lo indica.
              </p>
            )}
          </div>
        </div>

        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          ¿Cómo entregas el comprobante al cliente?
        </p>
        <div className="flex flex-wrap gap-2">
          {escposData && (
            <ThermalPrinterButton escposData={escposData} htmlFallback={html} label="Imprimir térmica" size="sm" />
          )}
          <Button type="button" variant="secondary" size="sm" onClick={imprimirNavegador}>
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir ahora
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={enviarWhatsApp}>
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Enviar por WhatsApp
          </Button>
        </div>
        {!completo.clienteTelefono && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Este cliente no tiene teléfono registrado: WhatsApp abrirá sin número para que lo elijas.
          </p>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="primary" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
