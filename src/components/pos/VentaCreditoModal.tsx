"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { calcularCredito, calcularTasaAjustada } from "@/lib/calculosCredito";
import type { CartItem } from "@/components/pos/ShoppingCart";
import type { Cliente } from "@/types";

interface VentaCreditoModalProps {
  cartItems: CartItem[];
  total: number;
  cliente: Cliente;
  onClose: () => void;
  onSuccess: (creditoId: string) => void;
}

const PLAZOS = [3, 6, 8, 10, 12, 18, 24];
const TASA_BASE_DEFAULT = 20;

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

export function VentaCreditoModal({ cartItems, total, cliente, onClose, onSuccess }: VentaCreditoModalProps) {
  const [enganchePct, setEnganchePct] = useState(20);
  const [plazo, setPlazo] = useState(12);
  const [frecuencia, setFrecuencia] = useState<"semanal" | "quincenal" | "mensual">("quincenal");
  const [metodoPagoEnganche, setMetodoPagoEnganche] = useState<"efectivo" | "transferencia" | "tarjeta">("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar que el carrito tiene al menos un equipo con IMEI
  const tieneImei = cartItems.some(i => i.imei);

  const resultado = calcularCredito({
    montoOriginal: total,
    enganchePorcentaje: enganchePct,
    plazo,
    tasaInteresBase: TASA_BASE_DEFAULT,
    frecuenciaPago: frecuencia,
  });

  const tasaAjustada = calcularTasaAjustada(TASA_BASE_DEFAULT, plazo);
  const engancheMin = total * (enganchePct / 100);
  const montoRecibidoNum = parseFloat(montoRecibido) || 0;
  const cambio = metodoPagoEnganche === "efectivo" ? Math.max(0, montoRecibidoNum - engancheMin) : 0;
  const montoInsuficiente = metodoPagoEnganche === "efectivo" && montoRecibido !== "" && montoRecibidoNum < engancheMin;

  const isValid = !montoInsuficiente && (metodoPagoEnganche !== "efectivo" || montoRecibidoNum >= engancheMin);

  const handleSubmit = async () => {
    if (!isValid) return;
    if (!tieneImei) {
      setError("El carrito debe tener al menos un equipo con IMEI para venta a crédito.");
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/venta-credito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.id,
          items: cartItems.map(i => ({
            productoId: i.esServicio ? undefined : i.producto?.id,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            imei: i.imei,
          })),
          montoTotal: total,
          enganchePorcentaje: enganchePct,
          plazo,
          frecuenciaPago: frecuencia,
          tasaInteresBase: TASA_BASE_DEFAULT,
          metodoPagoEnganche,
          montoRecibido: metodoPagoEnganche === "efectivo" ? montoRecibidoNum : undefined,
          referenciaPago: referencia || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data.creditoId);
      } else {
        setError(data.error || "Error al crear la venta a crédito");
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
            <CreditCard className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Venta a Crédito
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
              Precio del equipo
            </span>
            <span className="text-xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
              ${total.toFixed(2)}
            </span>
          </div>

          {/* Enganche % */}
          <div>
            <label style={labelStyle}>Enganche</label>
            <div className="flex gap-2 flex-wrap">
              {[10, 20, 30, 40, 50].map(pct => (
                <button
                  key={pct}
                  onClick={() => setEnganchePct(pct)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: enganchePct === pct ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    color: enganchePct === pct ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${enganchePct === pct ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
              Enganche: <span style={{ color: "var(--color-text-primary)", fontWeight: 600, fontFamily: "var(--font-data)" }}>
                ${resultado.montoEnganche.toFixed(2)}
              </span>
              {" · "}A financiar: <span style={{ color: "var(--color-text-primary)", fontWeight: 600, fontFamily: "var(--font-data)" }}>
                ${resultado.montoFinanciar.toFixed(2)}
              </span>
            </p>
          </div>

          {/* Plazo */}
          <div>
            <label style={labelStyle}>Plazo</label>
            <div className="flex gap-2 flex-wrap">
              {PLAZOS.map(m => (
                <button
                  key={m}
                  onClick={() => setPlazo(m)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: plazo === m ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    color: plazo === m ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${plazo === m ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Frecuencia */}
          <div>
            <label style={labelStyle}>Frecuencia de pago</label>
            <select
              value={frecuencia}
              onChange={(e) => setFrecuencia(e.target.value as typeof frecuencia)}
              style={inputStyle}
            >
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>

          {/* Resumen financiero */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)" }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-text-secondary)" }}>Tasa interés ({plazo}m)</span>
              <span style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)", fontWeight: 600 }}>
                {tasaAjustada}% anual
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-text-secondary)" }}>Número de pagos</span>
              <span style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)", fontWeight: 600 }}>
                {resultado.numeroPagos} {frecuencia === "semanal" ? "semanas" : frecuencia === "quincenal" ? "quincenas" : "meses"}
              </span>
            </div>
            <div
              className="flex justify-between pt-2"
              style={{ borderTop: "1px solid var(--color-accent)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Pago {frecuencia}
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${resultado.montoPorPago.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span>Total a pagar (con interés)</span>
              <span style={{ fontFamily: "var(--font-data)" }}>${resultado.montoTotalPagar.toFixed(2)}</span>
            </div>
          </div>

          {/* Método de pago del enganche */}
          <div>
            <label style={labelStyle}>Método de pago del enganche</label>
            <div className="flex gap-2">
              {(["efectivo", "transferencia", "tarjeta"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMetodoPagoEnganche(m); setMontoRecibido(""); setReferencia(""); }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={{
                    background: metodoPagoEnganche === m ? "var(--color-accent)" : "var(--color-bg-elevated)",
                    color: metodoPagoEnganche === m ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${metodoPagoEnganche === m ? "var(--color-accent)" : "var(--color-border)"}`,
                  }}
                >
                  {m === "efectivo" ? "Efectivo" : m === "transferencia" ? "Transferencia" : "Tarjeta"}
                </button>
              ))}
            </div>
          </div>

          {/* Monto recibido (efectivo) */}
          {metodoPagoEnganche === "efectivo" && (
            <div>
              <label style={labelStyle}>Monto recibido (enganche: ${engancheMin.toFixed(2)})</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
                <input
                  type="number"
                  step="0.01"
                  min={engancheMin}
                  placeholder={engancheMin.toFixed(2)}
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
                  Monto insuficiente — mínimo ${engancheMin.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Referencia (transferencia / tarjeta) */}
          {(metodoPagoEnganche === "transferencia" || metodoPagoEnganche === "tarjeta") && (
            <div>
              <label style={labelStyle}>
                {metodoPagoEnganche === "tarjeta" ? "Últimos 4 dígitos (opcional)" : "Referencia (opcional)"}
              </label>
              <input
                type="text"
                maxLength={metodoPagoEnganche === "tarjeta" ? 4 : 50}
                placeholder={metodoPagoEnganche === "tarjeta" ? "1234" : "REF123456"}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {!tieneImei && (
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
              <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>
                Agrega un equipo con IMEI al carrito para habilitar la venta a crédito.
              </p>
            </div>
          )}

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
            disabled={processing || !isValid || !tieneImei}
            className="flex-1 flex-col items-center gap-0.5 py-2"
          >
            {processing ? (
              "Procesando..."
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <CreditCard className="w-4 h-4" />
                  Crear crédito
                </span>
                <span className="text-xs opacity-80" style={{ fontFamily: "var(--font-data)" }}>
                  enganche ${engancheMin.toFixed(2)}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
