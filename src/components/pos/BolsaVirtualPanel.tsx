"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag, RefreshCw, AlertCircle, DollarSign, User, Clock,
  ChevronDown, ChevronRight, Banknote, CreditCard, ArrowUpDown,
} from "lucide-react";
import type { TipoPago } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnticipoResumen {
  id: string;
  monto: number;
  tipoPago: string;
  fechaAnticipo: string;
  recibidoPorNombre: string | null;
}

interface OrdenBolsa {
  ordenId: string;
  folio: string;
  estado: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  marcaDispositivo: string;
  modeloDispositivo: string;
  presupuestoTotal: number;
  totalAnticipos: number;
  costosPiezas: number;
  saldoPendiente: number;
  saldoDisponibleBolsa: number;
  ingresoNetoEstimado: number;
  anticipos: AnticipoResumen[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtFechaHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transf.",
  deposito: "Depósito",
  mixto: "Mixto",
};

const METODO_ICON: Record<string, React.ReactNode> = {
  efectivo: <Banknote className="w-3.5 h-3.5" />,
  tarjeta: <CreditCard className="w-3.5 h-3.5" />,
  transferencia: <ArrowUpDown className="w-3.5 h-3.5" />,
  deposito: <ArrowUpDown className="w-3.5 h-3.5" />,
};

const ESTADO_LABEL: Record<string, string> = {
  recibido: "Recibido",
  diagnostico: "Diagnóstico",
  presupuesto: "Presupuesto",
  aprobado: "Aprobado",
  en_reparacion: "En reparación",
  esperando_piezas: "Esp. piezas",
  listo_entrega: "Listo",
  entregado: "Entregado",
};

const ESTADO_COLOR: Record<string, string> = {
  recibido: "var(--color-text-muted)",
  diagnostico: "var(--color-accent)",
  presupuesto: "var(--color-warning, #d97706)",
  aprobado: "var(--color-success)",
  en_reparacion: "var(--color-accent)",
  esperando_piezas: "var(--color-warning, #d97706)",
  listo_entrega: "var(--color-success)",
  entregado: "var(--color-text-muted)",
};

// ─── Modal Anticipo ───────────────────────────────────────────────────────────

interface ModalAnticipoProps {
  folio: string;
  montoSugerido?: number;
  onConfirm: (monto: number, metodo: TipoPago) => Promise<void>;
  onCancel: () => void;
}

function ModalAnticipo({ folio, montoSugerido, onConfirm, onCancel }: ModalAnticipoProps) {
  const [monto, setMonto] = useState(montoSugerido ? String(montoSugerido) : "");
  const [metodo, setMetodo] = useState<TipoPago>("efectivo");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    setGuardando(true);
    try {
      await onConfirm(montoNum, metodo);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrar");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-xl)" }}>
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {montoSugerido ? "Cobrar saldo" : "Agregar anticipo"}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>Orden {folio}</p>
        </div>

        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="number" min="0" step="50"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError(""); }}
            onFocus={(e) => e.target.select()}
            placeholder="0.00"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") onCancel(); }}
            className="w-full rounded-xl pl-9 pr-4 py-3 text-xl font-bold text-right"
            style={{ background: "var(--color-bg-sunken)", border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`, color: "var(--color-text-primary)", outline: "none", fontFamily: "var(--font-data)" }}
          />
        </div>

        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value as TipoPago)}
          className="w-full rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", outline: "none" }}
        >
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
          <option value="deposito">Depósito</option>
        </select>

        {error && (
          <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={guardando} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--color-accent)", color: "#fff", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Registrando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Orden Card ───────────────────────────────────────────────────────────────

interface OrdenCardProps {
  orden: OrdenBolsa;
  onAnticipoAgregado: () => void;
}

function OrdenCard({ orden, onAnticipoAgregado }: OrdenCardProps) {
  const [expandido, setExpandido] = useState(false);
  const [modalAnticipo, setModalAnticipo] = useState<"anticipo" | "cobro" | null>(null);
  const [hovered, setHovered] = useState(false);

  const porcentaje = orden.presupuestoTotal > 0
    ? Math.min(100, (orden.totalAnticipos / orden.presupuestoTotal) * 100)
    : 0;

  const handleRegistrarAnticipo = async (monto: number, metodo: TipoPago) => {
    const res = await fetch(`/api/reparaciones/${orden.ordenId}/anticipos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto, tipoPago: metodo }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error al registrar");
    setModalAnticipo(null);
    onAnticipoAgregado();
  };

  return (
    <>
      {modalAnticipo && (
        <ModalAnticipo
          folio={orden.folio}
          montoSugerido={modalAnticipo === "cobro" ? orden.saldoPendiente : undefined}
          onConfirm={handleRegistrarAnticipo}
          onCancel={() => setModalAnticipo(null)}
        />
      )}

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          transition: "background 0.15s",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header de la orden */}
        <div
          className="flex items-start gap-3 p-3 cursor-pointer"
          onClick={() => setExpandido((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                {orden.folio}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: "var(--color-bg-elevated)",
                  color: ESTADO_COLOR[orden.estado] || "var(--color-text-muted)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                {ESTADO_LABEL[orden.estado] || orden.estado}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
              <span className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
                {orden.clienteNombre}
              </span>
              {(orden.marcaDispositivo || orden.modeloDispositivo) && (
                <span className="text-xs ml-1" style={{ color: "var(--color-text-muted)" }}>
                  · {[orden.marcaDispositivo, orden.modeloDispositivo].filter(Boolean).join(" ")}
                </span>
              )}
            </div>

            {/* Barra de progreso */}
            {orden.presupuestoTotal > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                  <span>Pagado: {fmtPrecio(orden.totalAnticipos)}</span>
                  <span>Total: {fmtPrecio(orden.presupuestoTotal)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border-subtle)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${porcentaje}%`,
                      background: porcentaje >= 100 ? "var(--color-success)" : "var(--color-accent)",
                    }}
                  />
                </div>
                {orden.saldoPendiente > 0 && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: "var(--color-danger, #dc2626)" }}>
                    Saldo: {fmtPrecio(orden.saldoPendiente)}
                  </p>
                )}
                {/* Costos de piezas y margen */}
                {orden.costosPiezas > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Costo piezas: <span style={{ fontFamily: "var(--font-data)", color: "var(--color-warning, #d97706)" }}>{fmtPrecio(orden.costosPiezas)}</span>
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Ingreso neto est.: <span style={{ fontFamily: "var(--font-data)", color: "var(--color-success)" }}>{fmtPrecio(orden.ingresoNetoEstimado)}</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {expandido
              ? <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
            }
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          {orden.saldoPendiente > 0 && (
            <button
              onClick={() => setModalAnticipo("cobro")}
              className="flex-1 text-xs py-1.5 px-3 rounded-lg font-semibold"
              style={{ background: "var(--color-success)", color: "#fff" }}
            >
              Cobrar {fmtPrecio(orden.saldoPendiente)}
            </button>
          )}
          <button
            onClick={() => setModalAnticipo("anticipo")}
            className="flex-1 text-xs py-1.5 px-3 rounded-lg font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >
            + Anticipo
          </button>
        </div>

        {/* Detalle de anticipos */}
        {expandido && orden.anticipos.length > 0 && (
          <div className="border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
            <div className="px-3 py-2 space-y-2">
              {orden.anticipos.map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "var(--color-bg-elevated)" }}>
                    {METODO_ICON[a.tipoPago] ?? <DollarSign className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                        {fmtPrecio(a.monto)}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {METODO_LABEL[a.tipoPago] || a.tipoPago}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {fmtFechaHora(a.fechaAnticipo)}
                      </span>
                      {a.recibidoPorNombre && (
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          · {a.recibidoPorNombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {expandido && orden.anticipos.length === 0 && (
          <div className="border-t px-3 py-2" style={{ borderColor: "var(--color-border-subtle)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin anticipos registrados</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Panel Principal ──────────────────────────────────────────────────────────

interface BolsaVirtualPanelProps {
  onClose: () => void;
}

export function BolsaVirtualPanel({ onClose }: BolsaVirtualPanelProps) {
  const [ordenes, setOrdenes] = useState<OrdenBolsa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/reparaciones-activas");
      const data = await res.json();
      if (data.success) {
        setOrdenes(data.data);
      } else {
        setError(data.error || "Error al cargar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const totalBolsa = ordenes.reduce((s, o) => s + o.totalAnticipos, 0);
  const totalSaldoPendiente = ordenes.reduce((s, o) => s + o.saldoPendiente, 0);
  const totalCostosPiezas = ordenes.reduce((s, o) => s + o.costosPiezas, 0);
  const totalSaldoDisponible = ordenes.reduce((s, o) => s + o.saldoDisponibleBolsa, 0);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--color-bg-surface)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
          <span className="font-semibold text-base" style={{ color: "var(--color-text-primary)" }}>
            Bolsa Virtual
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarDatos}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--color-text-muted)" }}
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-lg leading-none"
            style={{ color: "var(--color-text-muted)" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Totales — para cuadre de caja */}
      <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex justify-between items-center">
          <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            💰 Total en bolsa
          </span>
          <span className="text-lg font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
            {fmtPrecio(totalBolsa)}
          </span>
        </div>
        {totalCostosPiezas > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              − Costo piezas pedidas
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--color-warning, #d97706)", fontFamily: "var(--font-data)" }}>
              − {fmtPrecio(totalCostosPiezas)}
            </span>
          </div>
        )}
        {totalCostosPiezas > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Saldo disponible real
            </span>
            <span className="text-sm font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
              {fmtPrecio(totalSaldoDisponible)}
            </span>
          </div>
        )}
        {totalSaldoPendiente > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Saldo pendiente (clientes deben)
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--color-danger, #dc2626)", fontFamily: "var(--font-data)" }}>
              {fmtPrecio(totalSaldoPendiente)}
            </span>
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Efectivo físico − ventas caja = {fmtPrecio(totalBolsa)}
        </p>
      </div>

      {/* Lista de órdenes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {cargando && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {!cargando && error && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!cargando && !error && ordenes.length === 0 && (
          <div className="text-center py-8">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin reparaciones activas con anticipos
            </p>
          </div>
        )}

        {!cargando && !error && ordenes.map((o) => (
          <OrdenCard key={o.ordenId} orden={o} onAnticipoAgregado={cargarDatos} />
        ))}
      </div>
    </div>
  );
}
