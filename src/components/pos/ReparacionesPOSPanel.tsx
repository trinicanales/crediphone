"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Search, AlertCircle, DollarSign, CheckCircle, Phone, Wrench, XCircle, Package,
} from "lucide-react";
import type { OrdenReparacionDetallada, TipoPago } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

// ─── Modal Anticipo ──────────────────────────────────────────────────────────

interface ModalAnticipoProps {
  onConfirm: (monto: number, metodoPago: TipoPago) => void;
  onCancel: () => void;
  ordenFolio: string;
}

function ModalAnticipo({ onConfirm, onCancel, ordenFolio }: ModalAnticipoProps) {
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState<TipoPago>("efectivo");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    onConfirm(montoNum, metodoPago);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Registrar Anticipo
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Orden {ordenFolio}
          </p>
        </div>

        {/* Input de monto */}
        <div className="relative">
          <DollarSign
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="number"
            min="0"
            step="50"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError(""); }}
            placeholder="0.00"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") onCancel(); }}
            className="w-full rounded-xl pl-9 pr-4 py-3 text-xl font-mono font-bold text-right"
            style={{
              background: "var(--color-bg-sunken)",
              border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </div>

        {/* Método de pago */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Método de pago
          </label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as TipoPago)}
            className="w-full rounded-xl px-4 py-3 text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="deposito">Depósito</option>
          </select>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
          >
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Cobro Saldo ──────────────────────────────────────────────────────

interface ModalCobroSaldoProps {
  onConfirm: (metodoPago: TipoPago) => void;
  onCancel: () => void;
  ordenFolio: string;
  saldoPendiente: number;
}

function ModalCobroSaldo({ onConfirm, onCancel, ordenFolio, saldoPendiente }: ModalCobroSaldoProps) {
  const [metodoPago, setMetodoPago] = useState<TipoPago>("efectivo");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Cobrar Saldo Completo
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Orden {ordenFolio}
          </p>
        </div>

        {/* Monto a cobrar */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--color-accent-light)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Saldo pendiente
          </p>
          <p className="text-2xl font-mono font-bold" style={{ color: "var(--color-accent)" }}>
            {fmtPrecio(saldoPendiente)}
          </p>
        </div>

        {/* Método de pago */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Método de pago
          </label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as TipoPago)}
            className="w-full rounded-xl px-4 py-3 text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="deposito">Depósito</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(metodoPago)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Cancelar Reparación ───────────────────────────────────────────────

interface ModalCancelarProps {
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  ordenFolio: string;
  totalAnticipos: number;
  cargoCancelacion: number;
}

function ModalCancelarReparacion({
  onConfirm,
  onCancel,
  ordenFolio,
  totalAnticipos,
  cargoCancelacion,
}: ModalCancelarProps) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  const cargoEfectivo = Math.min(cargoCancelacion, totalAnticipos);
  const devolucionAlCliente = Math.max(0, totalAnticipos - cargoEfectivo);

  const handleConfirm = () => {
    if (!motivo.trim()) {
      setError("Indica el motivo de cancelación");
      return;
    }
    onConfirm(motivo.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Título */}
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-danger)" }}>
            Cancelar Reparación
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Orden {ordenFolio}
          </p>
        </div>

        {/* Resumen financiero */}
        <div
          className="rounded-xl p-4 space-y-2 text-sm"
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--color-text-secondary)" }}>Anticipos pagados:</span>
            <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {fmtPrecio(totalAnticipos)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--color-danger)" }}>Cargo de cancelación:</span>
            <span className="font-mono font-semibold" style={{ color: "var(--color-danger)" }}>
              −{fmtPrecio(cargoEfectivo)}
            </span>
          </div>
          <div
            className="pt-2 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
          >
            <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
              A devolver al cliente:
            </span>
            <span
              className="font-mono font-bold text-lg"
              style={{ color: devolucionAlCliente > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}
            >
              {fmtPrecio(devolucionAlCliente)}
            </span>
          </div>
        </div>

        {/* Motivo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Motivo de cancelación
          </label>
          <textarea
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setError(""); }}
            placeholder="Cliente ya no quiere reparar, se fue a otro servicio..."
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
            style={{
              background: "var(--color-bg-sunken)",
              border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Volver
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: "var(--color-danger)",
              color: "#fff",
            }}
          >
            Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

interface ReparacionesPOSPanelProps {
  onCobroCompleto?: (ordenId: string) => void;
}

export function ReparacionesPOSPanel({ onCobroCompleto }: ReparacionesPOSPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [totalAnticipos, setTotalAnticipos] = useState(0);

  // C3: Lista de órdenes listas para cobrar (listo_entrega)
  const [listasParaCobrar, setListasParaCobrar] = useState<OrdenReparacionDetallada[]>([]);
  const [loadingListos, setLoadingListos] = useState(false);

  const fetchListosParaCobrar = useCallback(async () => {
    setLoadingListos(true);
    try {
      const res = await fetch("/api/reparaciones?estado=listo_entrega&detalladas=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setListasParaCobrar(data.data);
      }
    } catch {
      // silencioso — no bloquear el panel
    } finally {
      setLoadingListos(false);
    }
  }, []);

  useEffect(() => {
    void fetchListosParaCobrar();
  }, [fetchListosParaCobrar]);

  // Modales
  const [showModalAnticipo, setShowModalAnticipo] = useState(false);
  const [showModalCobroSaldo, setShowModalCobroSaldo] = useState(false);
  const [showModalCancelar, setShowModalCancelar] = useState(false);
  const [procesandoCobroSaldo, setProcesandoCobroSaldo] = useState(false);
  const [procesandoAnticipo, setProcesandoAnticipo] = useState(false);
  const [procesandoCancelacion, setProcesandoCancelacion] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  const handleBuscar = useCallback(async (query: string) => {
    if (!query.trim()) {
      setOrden(null);
      setTotalAnticipos(0);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setMensajeExito("");
    try {
      const res = await fetch(`/api/pos/reparacion-buscar?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Error al buscar orden");
        setOrden(null);
        setTotalAnticipos(0);
        return;
      }

      if (data.data.length === 0) {
        setError("No se encontró orden con ese folio o cliente");
        setOrden(null);
        setTotalAnticipos(0);
        return;
      }

      // Mostrar primera resultado
      const ordenEncontrada = data.data[0] as OrdenReparacionDetallada & { totalAnticipos: number };
      setOrden(ordenEncontrada);
      setTotalAnticipos(ordenEncontrada.totalAnticipos ?? 0);
    } catch (err) {
      setError("Error de conexión");
      setOrden(null);
      setTotalAnticipos(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const saldoPendiente = orden ? (orden.costoTotal - totalAnticipos) : 0;
  const hayDeuda = saldoPendiente > 0;

  const handleRegistrarAnticipo = async (monto: number, metodoPago: TipoPago) => {
    if (!orden) return;

    setProcesandoAnticipo(true);
    try {
      const res = await fetch("/api/pos/reparacion-cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId: orden.id,
          tipo: "anticipo",
          monto,
          metodoPago,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Error al registrar anticipo");
        return;
      }

      // Actualizar saldo
      setTotalAnticipos(totalAnticipos + monto);
      setMensajeExito(`✅ Anticipo de ${fmtPrecio(monto)} registrado`);
      setShowModalAnticipo(false);
      setTimeout(() => setMensajeExito(""), 3000);
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setProcesandoAnticipo(false);
    }
  };

  const handleCobroSaldoFinal = async (metodoPago: TipoPago) => {
    if (!orden || saldoPendiente <= 0) return;

    setProcesandoCobroSaldo(true);
    try {
      const res = await fetch("/api/pos/reparacion-cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenId: orden.id,
          tipo: "saldo_final",
          monto: saldoPendiente,
          metodoPago,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Error al cobrar saldo");
        return;
      }

      // Actualizar estado
      setMensajeExito("✅ Saldo cobrado. Orden marcada como entregada.");
      setShowModalCobroSaldo(false);
      setOrden(null);
      setTotalAnticipos(0);
      setSearchQuery("");
      void fetchListosParaCobrar(); // refrescar lista C3

      // Callback opcional para actualizar carrito si es necesario
      if (onCobroCompleto) {
        onCobroCompleto(orden.id);
      }

      setTimeout(() => setMensajeExito(""), 4000);
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setProcesandoCobroSaldo(false);
    }
  };

  const handleCancelarReparacion = async (motivo: string) => {
    if (!orden) return;

    setProcesandoCancelacion(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo,
          devolverAnticipos: true,
          cargoCancelacion: (orden as any).cargoCancelacion ?? 100,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Error al cancelar la orden");
        setShowModalCancelar(false);
        return;
      }

      const devuelto = data.totalAnticipoDevuelto ?? 0;
      const cargo = data.cargoAplicado ?? 0;
      setMensajeExito(
        devuelto > 0
          ? `✅ Orden cancelada. Devolver ${fmtPrecio(devuelto)} al cliente (cargo: ${fmtPrecio(cargo)})`
          : `✅ Orden ${orden.folio} cancelada`
      );
      setShowModalCancelar(false);
      setOrden(null);
      setTotalAnticipos(0);
      setSearchQuery("");
      setTimeout(() => setMensajeExito(""), 6000);
    } catch (err) {
      setError("Error de conexión al cancelar");
    } finally {
      setProcesandoCancelacion(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Búsqueda */}
        <div className="p-3 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar(searchQuery)}
              placeholder="Folio, cliente o teléfono..."
              className="w-full rounded-lg pl-9 pr-9 py-2 text-sm"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => handleBuscar(searchQuery)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-all"
                style={{ color: "var(--color-accent)" }}
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mensaje de éxito */}
        {mensajeExito && (
          <div
            className="mx-3 mt-2 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            {mensajeExito}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="mx-3 mt-2 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mx-3 mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-xl animate-pulse"
                style={{ background: "var(--color-bg-elevated)" }}
              />
            ))}
          </div>
        )}

        {/* Orden encontrada */}
        {!loading && orden && (
          <div className="flex-1 overflow-y-auto px-3 pb-3 mt-3 space-y-3">
            {/* Card de orden */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    Folio
                  </p>
                  <p className="text-base font-mono font-bold" style={{ color: "var(--color-text-primary)" }}>
                    {orden.folio}
                  </p>
                </div>
                <div
                  className="text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{
                    background: "var(--color-info-bg)",
                    color: "var(--color-info)",
                  }}
                >
                  {orden.estado === "listo_entrega" ? "Listo entrega" : orden.estado}
                </div>
              </div>

              {/* Cliente y dispositivo */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    Cliente
                  </p>
                  <p style={{ color: "var(--color-text-primary)" }}>
                    {orden.clienteNombre}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    Dispositivo
                  </p>
                  <p style={{ color: "var(--color-text-primary)" }}>
                    {orden.marcaDispositivo} {orden.modeloDispositivo}
                  </p>
                </div>
              </div>

              {/* Divisor */}
              <div style={{ borderTop: "1px solid var(--color-border-subtle)" }} />

              {/* Costos */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Costo total:</span>
                  <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {fmtPrecio(orden.costoTotal)}
                  </span>
                </div>
                {totalAnticipos > 0 && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--color-success)" }}>Anticipos confirmados:</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--color-success)" }}>
                      −{fmtPrecio(totalAnticipos)}
                    </span>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div style={{ borderTop: "1px solid var(--color-border-subtle)" }} />

              {/* Saldo pendiente */}
              <div
                className="rounded-lg p-3"
                style={{
                  background: hayDeuda ? "var(--color-warning-bg)" : "var(--color-success-bg)",
                }}
              >
                <p className="text-xs font-medium" style={{ color: hayDeuda ? "var(--color-warning)" : "var(--color-success)" }}>
                  {hayDeuda ? "SALDO PENDIENTE" : "PAGADO"}
                </p>
                <p className="text-2xl font-mono font-bold" style={{ color: hayDeuda ? "var(--color-warning)" : "var(--color-success)" }}>
                  {fmtPrecio(Math.max(0, saldoPendiente))}
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            {/* "Registrar anticipo" siempre visible en órdenes activas (costo_total puede ser 0 en diagnóstico) */}
            {orden.estado !== "entregado" && orden.estado !== "cancelado" ? (
              <div className="flex flex-col gap-2">
                <div className={hayDeuda ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
                  <button
                    onClick={() => setShowModalAnticipo(true)}
                    disabled={procesandoAnticipo || procesandoCobroSaldo || procesandoCancelacion}
                    className="py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    style={{
                      background: "var(--color-bg-elevated)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Registrar anticipo
                  </button>
                  {hayDeuda && (
                    <button
                      onClick={() => setShowModalCobroSaldo(true)}
                      disabled={procesandoCobroSaldo || procesandoAnticipo || procesandoCancelacion}
                      className="py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                      style={{
                        background: "var(--color-accent)",
                        color: "#fff",
                      }}
                    >
                      Cobrar saldo
                    </button>
                  )}
                </div>
                {/* Botón de cancelación — solo en estados donde todavía no hay reparación activa */}
                {["recibido", "diagnostico", "presupuesto", "aprobado", "esperando_piezas"].includes(orden.estado) && (
                  <button
                    onClick={() => setShowModalCancelar(true)}
                    disabled={procesandoCancelacion || procesandoAnticipo || procesandoCobroSaldo}
                    className="w-full py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{
                      background: "var(--color-danger-bg)",
                      color: "var(--color-danger)",
                      border: "1px solid var(--color-danger)",
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    {procesandoCancelacion ? "Cancelando..." : "Cancelar reparación"}
                  </button>
                )}
              </div>
            ) : (
              <div
                className="rounded-lg p-3 text-center text-sm"
                style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
              >
                <CheckCircle className="w-4 h-4 mx-auto mb-1" />
                Orden completamente pagada
              </div>
            )}

            {/* Nota informativa */}
            <p className="text-xs text-center mt-4" style={{ color: "var(--color-text-muted)" }}>
              Solo se muestran órdenes con saldo pendiente o en estado activo
            </p>
          </div>
        )}

        {/* C3: Lista de "Listos para cobrar" — visible cuando no hay búsqueda activa */}
        {!loading && !orden && !error && !searchQuery && (
          <div className="flex-1 overflow-y-auto px-3 pb-3 mt-2">
            {/* Header sección */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Listos para cobrar
                </p>
              </div>
              {listasParaCobrar.length > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
                >
                  {listasParaCobrar.length}
                </span>
              )}
            </div>

            {loadingListos && (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
                ))}
              </div>
            )}

            {!loadingListos && listasParaCobrar.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="w-10 h-10 mb-2" style={{ color: "var(--color-border-strong)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Sin equipos listos por cobrar
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  O usa la búsqueda para encontrar una orden
                </p>
              </div>
            )}

            {!loadingListos && listasParaCobrar.map((o) => {
              const anticipos = (o as any).totalAnticipos ?? 0;
              const saldo = Math.max(0, o.costoTotal - anticipos);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setOrden(o);
                    setTotalAnticipos(anticipos);
                    setError("");
                  }}
                  className="w-full text-left rounded-xl px-3 py-2.5 mb-2 flex items-center justify-between gap-2 transition-all"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-success)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border-subtle)")}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                      {o.folio}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {o.clienteNombre}{o.clienteApellido ? ` ${o.clienteApellido}` : ""} · {o.marcaDispositivo} {o.modeloDispositivo}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-sm font-mono font-bold"
                      style={{ color: saldo > 0 ? "var(--color-warning)" : "var(--color-success)" }}
                    >
                      {fmtPrecio(saldo)}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {saldo > 0 ? "pendiente" : "pagado"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modales */}
      {showModalAnticipo && orden && (
        <ModalAnticipo
          ordenFolio={orden.folio}
          onConfirm={handleRegistrarAnticipo}
          onCancel={() => setShowModalAnticipo(false)}
        />
      )}

      {showModalCobroSaldo && orden && (
        <ModalCobroSaldo
          ordenFolio={orden.folio}
          saldoPendiente={saldoPendiente}
          onConfirm={handleCobroSaldoFinal}
          onCancel={() => setShowModalCobroSaldo(false)}
        />
      )}

      {showModalCancelar && orden && (
        <ModalCancelarReparacion
          ordenFolio={orden.folio}
          totalAnticipos={totalAnticipos}
          cargoCancelacion={(orden as any).cargoCancelacion ?? 100}
          onConfirm={handleCancelarReparacion}
          onCancel={() => setShowModalCancelar(false)}
        />
      )}
    </>
  );
}
