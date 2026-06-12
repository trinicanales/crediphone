"use client";

import { useState } from "react";
import { X, Package, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CartItem } from "@/components/pos/ShoppingCart";
import type { Cliente } from "@/types";

interface ApartadoModalProps {
  cartItems: CartItem[];
  total: number;
  cliente: Cliente;
  onClose: () => void;
  onSuccess: (apartadoId: string, folio: string) => void;
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  background: "var(--color-bg-sunken)",
  color: "var(--color-text-primary)",
  outline: "none",
  fontFamily: "var(--font-ui)",
  fontSize: "0.875rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  marginBottom: "0.25rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const DIAS_OPCIONES = [7, 15, 30, 45];

export function ApartadoModal({ cartItems, total, cliente, onClose, onSuccess }: ApartadoModalProps) {
  const [depositoPct, setDepositoPct] = useState(30);
  const [diasParaRecoger, setDiasParaRecoger] = useState(15);
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "tarjeta">("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposito = total * (depositoPct / 100);
  const saldoPendiente = total - deposito;
  const montoRecibidoNum = parseFloat(montoRecibido) || 0;
  const cambio = metodoPago === "efectivo" ? Math.max(0, montoRecibidoNum - deposito) : 0;
  const montoInsuficiente = metodoPago === "efectivo" && montoRecibido !== "" && montoRecibidoNum < deposito;
  const isValid = !montoInsuficiente && (metodoPago !== "efectivo" || montoRecibidoNum >= deposito);

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + diasParaRecoger);
  const fechaLimiteStr = fechaLimite.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  const handleSubmit = async () => {
    if (!isValid) return;
    setProcessing(true);
    setError(null);
    try {
      const productosIds = cartItems
        .filter((i) => !i.esServicio && i.producto?.id)
        .map((i) => i.producto!.id);

      const res = await fetch("/api/apartados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.id,
          productosIds,
          montoTotal: total,
          depositoPorcentaje: depositoPct,
          metodoPagoDeposito: metodoPago,
          montoRecibido: metodoPago === "efectivo" ? montoRecibidoNum : undefined,
          referenciaPago: referencia || undefined,
          diasParaRecoger,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data.apartadoId, data.data.folio);
      } else {
        setError(data.error || "Error al crear el apartado");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col"
        style={{
          background: "var(--color-bg-surface)",
          boxShadow: "var(--shadow-xl)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Apartar artículos
              </h2>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {cliente.nombre} {cliente.apellido}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--color-text-muted)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4">

          {/* Precio total */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--color-bg-sunken)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Total a apartar
            </span>
            <span className="text-xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
              ${total.toFixed(2)}
            </span>
          </div>

          {/* Depósito % */}
          <div>
            <label style={labelStyle}>Depósito (% del total)</label>
            <div className="flex gap-2 flex-wrap">
              {[20, 30, 40, 50, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDepositoPct(pct)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: depositoPct === pct ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    color: depositoPct === pct ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${depositoPct === pct ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {pct === 100 ? "Todo" : `${pct}%`}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span>Depósito hoy: <strong style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>${deposito.toFixed(2)}</strong></span>
              <span>Saldo al recoger: <strong style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>${saldoPendiente.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* Días para recoger */}
          <div>
            <label style={labelStyle}>Plazo para recoger</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS_OPCIONES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDiasParaRecoger(d)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: diasParaRecoger === d ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    color: diasParaRecoger === d ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${diasParaRecoger === d ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {d === 7 ? "1 sem" : d === 15 ? "15 días" : d === 30 ? "1 mes" : "45 días"}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              Fecha límite: <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{fechaLimiteStr}</span>
            </div>
          </div>

          {/* Método de pago del depósito */}
          <div>
            <label style={labelStyle}>Método de pago del depósito</label>
            <div className="flex gap-2">
              {(["efectivo", "transferencia", "tarjeta"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMetodoPago(m); setMontoRecibido(""); setReferencia(""); }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{
                    background: metodoPago === m ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    color: metodoPago === m ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${metodoPago === m ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {m === "efectivo" ? "Efectivo" : m === "transferencia" ? "Transferencia" : "Tarjeta"}
                </button>
              ))}
            </div>
          </div>

          {/* Monto recibido (efectivo) */}
          {metodoPago === "efectivo" && (
            <div>
              <label style={labelStyle}>Monto recibido (depósito: ${deposito.toFixed(2)})</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
                <input
                  type="number"
                  step="0.01"
                  min={deposito}
                  placeholder={deposito.toFixed(2)}
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "2rem" }}
                />
              </div>
              {cambio > 0 && (
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--color-success)" }}>
                  Cambio: ${cambio.toFixed(2)}
                </p>
              )}
              {montoInsuficiente && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                  Monto insuficiente — mínimo ${deposito.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Referencia (transferencia / tarjeta) */}
          {(metodoPago === "transferencia" || metodoPago === "tarjeta") && (
            <div>
              <label style={labelStyle}>
                {metodoPago === "tarjeta" ? "Últimos 4 dígitos (opcional)" : "Referencia (opcional)"}
              </label>
              <input
                type="text"
                maxLength={metodoPago === "tarjeta" ? 4 : 50}
                placeholder={metodoPago === "tarjeta" ? "1234" : "REF123456"}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Aviso informativo */}
          <div
            className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
            <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>
              El cliente no lleva el producto hoy. Regresa antes del {fechaLimiteStr} para pagar el saldo y recogerlo.
            </p>
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-3 shrink-0"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processing || !isValid}
            className="flex-1 flex-col items-center gap-0.5 py-2"
          >
            {processing ? (
              "Guardando..."
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Package className="w-4 h-4" />
                  Apartar artículos
                </span>
                <span className="text-xs opacity-80" style={{ fontFamily: "var(--font-data)" }}>
                  depósito ${deposito.toFixed(2)}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
