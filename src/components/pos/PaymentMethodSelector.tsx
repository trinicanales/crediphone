"use client";

import { useState, useEffect } from "react";
import { DollarSign, CreditCard, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import type { MetodoPagoVenta, DesglosePagoMixtoVenta } from "@/types";

interface PaymentData {
  metodoPago: MetodoPagoVenta;
  montoRecibido?: number;
  cambio?: number;
  referenciaPago?: string;
  desgloseMixto?: DesglosePagoMixtoVenta;
  isValid: boolean;
  errorMessage?: string;
}

interface PaymentMethodSelectorProps {
  total: number;
  onChange: (paymentData: PaymentData) => void;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: "0.5rem",
};

const iconStyle: React.CSSProperties = { color: "var(--color-text-muted)" };

export function PaymentMethodSelector({
  total,
  onChange,
}: PaymentMethodSelectorProps) {
  const [metodoPago, setMetodoPago] = useState<MetodoPagoVenta>("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [referencia, setReferencia] = useState("");

  // Para pago mixto
  const [mixtoEfectivo, setMixtoEfectivo] = useState("");
  const [mixtoTransferencia, setMixtoTransferencia] = useState("");
  const [mixtoTarjeta, setMixtoTarjeta] = useState("");

  const validatePayment = (): PaymentData => {
    let isValid = false;
    let errorMessage: string | undefined;
    let montoRecibidoNum: number | undefined;
    let cambio: number | undefined;
    let desgloseMixto: DesglosePagoMixtoVenta | undefined;

    if (metodoPago === "efectivo") {
      montoRecibidoNum = parseFloat(montoRecibido) || 0;
      if (montoRecibidoNum >= total) {
        cambio = montoRecibidoNum - total;
        isValid = true;
      } else {
        errorMessage = "El monto recibido debe ser mayor o igual al total";
      }
    } else if (metodoPago === "tarjeta" || metodoPago === "transferencia") {
      isValid = true; // Referencia es opcional
    } else if (metodoPago === "mixto") {
      const efectivo = parseFloat(mixtoEfectivo) || 0;
      const transferencia = parseFloat(mixtoTransferencia) || 0;
      const tarjeta = parseFloat(mixtoTarjeta) || 0;
      const sumaMixto = efectivo + transferencia + tarjeta;

      desgloseMixto = {
        efectivo: efectivo > 0 ? efectivo : undefined,
        transferencia: transferencia > 0 ? transferencia : undefined,
        tarjeta: tarjeta > 0 ? tarjeta : undefined,
      };

      if (Math.abs(sumaMixto - total) < 0.01) {
        isValid = true;
      } else {
        errorMessage = `La suma debe ser igual al total ($${total.toFixed(2)}). Suma actual: $${sumaMixto.toFixed(2)}`;
      }
    }

    return {
      metodoPago,
      montoRecibido: montoRecibidoNum,
      cambio,
      referenciaPago: referencia || undefined,
      desgloseMixto,
      isValid,
      errorMessage,
    };
  };

  // Validar y notificar cambios
  useEffect(() => {
    const paymentData = validatePayment();
    onChange(paymentData);
  }, [
    metodoPago,
    montoRecibido,
    referencia,
    mixtoEfectivo,
    mixtoTransferencia,
    mixtoTarjeta,
    total,
  ]);

  const tabs = [
    {
      id: "efectivo",
      label: "Efectivo",
      content: (
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>
              Monto recibido *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={iconStyle} />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                placeholder="0.00"
                className="pl-10"
              />
            </div>
          </div>

          {montoRecibido && parseFloat(montoRecibido) >= total && (
            <div
              className="p-4 rounded-lg"
              style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-border-subtle)" }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                <span className="font-medium">Cambio:</span>{" "}
                <span className="text-xl font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                  ${(parseFloat(montoRecibido) - total).toFixed(2)}
                </span>
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tarjeta",
      label: "Tarjeta",
      content: (
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>
              Últimos 4 dígitos (opcional)
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={iconStyle} />
              <Input
                type="text"
                maxLength={4}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value.replace(/\D/g, ""))}
                placeholder="1234"
                className="pl-10"
              />
            </div>
          </div>

          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-border-subtle)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Total a cobrar:{" "}
              <span className="text-xl font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${total.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "transferencia",
      label: "Transferencia",
      content: (
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>
              Número de referencia (opcional)
            </label>
            <div className="relative">
              <ArrowRightLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={iconStyle} />
              <Input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="REF123456"
                className="pl-10"
              />
            </div>
          </div>

          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-border-subtle)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Total a recibir:{" "}
              <span className="text-xl font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${total.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "mixto",
      label: "Mixto",
      content: (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            La suma debe ser igual al total: ${total.toFixed(2)}
          </p>

          <div>
            <label style={labelStyle}>Efectivo</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={iconStyle} />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={mixtoEfectivo}
                onChange={(e) => setMixtoEfectivo(e.target.value)}
                placeholder="0.00"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Transferencia</label>
            <div className="relative">
              <ArrowRightLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={iconStyle} />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={mixtoTransferencia}
                onChange={(e) => setMixtoTransferencia(e.target.value)}
                placeholder="0.00"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Tarjeta</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={iconStyle} />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={mixtoTarjeta}
                onChange={(e) => setMixtoTarjeta(e.target.value)}
                placeholder="0.00"
                className="pl-10"
              />
            </div>
          </div>

          {/* Resumen de suma */}
          <div
            className="p-4 rounded-lg space-y-2"
            style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-text-muted)" }}>Suma:</span>
              <span className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                ${(
                  (parseFloat(mixtoEfectivo) || 0) +
                  (parseFloat(mixtoTransferencia) || 0) +
                  (parseFloat(mixtoTarjeta) || 0)
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span style={{ color: "var(--color-text-secondary)" }}>Total requerido:</span>
              <span style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const paymentData = validatePayment();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
        Método de Pago
      </h3>

      <Tabs
        tabs={tabs}
        defaultTab={metodoPago}
        onTabChange={(id) => {
          setMetodoPago(id as MetodoPagoVenta);
          setReferencia("");
          setMontoRecibido("");
          setMixtoEfectivo("");
          setMixtoTransferencia("");
          setMixtoTarjeta("");
        }}
      />

      {/* Error message */}
      {paymentData.errorMessage && (
        <div
          className="p-3 rounded-lg"
          style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            {paymentData.errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
