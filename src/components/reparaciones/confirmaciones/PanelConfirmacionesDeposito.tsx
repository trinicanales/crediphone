"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BanknoteIcon, Clock, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, ExternalLink, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { ConfirmacionDeposito } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonto(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtFecha(d: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

function BadgeEstado({ estado }: { estado: ConfirmacionDeposito["estado"] }) {
  if (estado === "pendiente_confirmacion") return <Badge variant="warning">Pendiente</Badge>;
  if (estado === "confirmado") return <Badge variant="success">Confirmado</Badge>;
  return <Badge variant="danger">Rechazado</Badge>;
}

// ─── Modal de acción (confirmar / declinar) ────────────────────────────────────

interface ModalAccionProps {
  isOpen: boolean;
  onClose: () => void;
  confirmacion: ConfirmacionDeposito;
  onConfirmar: (id: string) => Promise<void>;
  onDeclinar: (id: string, razon: string) => Promise<void>;
}

function ModalAccion({ isOpen, onClose, confirmacion, onConfirmar, onDeclinar }: ModalAccionProps) {
  const [accion, setAccion] = useState<"confirmar" | "declinar" | null>(null);
  const [razon, setRazon] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAccion(null);
      setRazon("");
      setError("");
    }
  }, [isOpen, confirmacion.id]);

  const linkWhatsApp =
    typeof window !== "undefined"
      ? `${window.location.origin}/confirmar-deposito/${confirmacion.linkToken}`
      : `/confirmar-deposito/${confirmacion.linkToken}`;

  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkWhatsApp);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      // silencioso
    }
  };

  const handleSubmit = async () => {
    if (!accion) return;
    if (accion === "declinar" && !razon.trim()) {
      setError("La razón del rechazo es requerida");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (accion === "confirmar") {
        await onConfirmar(confirmacion.id);
      } else {
        await onDeclinar(confirmacion.id, razon.trim());
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verificar depósito / transferencia"
      size="md"
    >
      <div className="space-y-4">
        {/* Resumen del depósito */}
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Monto a verificar
            </span>
            <span className="text-xl font-mono font-bold" style={{ color: "var(--color-text-primary)" }}>
              {fmtMonto(confirmacion.monto)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Tipo</span>
            <span className="text-xs font-medium capitalize" style={{ color: "var(--color-text-secondary)" }}>
              {confirmacion.tipoPago}
            </span>
          </div>
          {confirmacion.referenciaBancaria && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Referencia</span>
              <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>
                {confirmacion.referenciaBancaria}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Orden</span>
            <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>
              {confirmacion.folioOrden}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Cliente</span>
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {confirmacion.clienteNombre}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Registrado por</span>
            <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              {confirmacion.registradorNombre} · {fmtFecha(confirmacion.createdAt)}
            </span>
          </div>
        </div>

        {/* Link de WhatsApp */}
        <div
          className="rounded-lg p-3 flex items-center gap-2"
          style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
        >
          <ExternalLink className="w-4 h-4 shrink-0" style={{ color: "var(--color-info)" }} />
          <span className="text-xs flex-1 font-mono truncate" style={{ color: "var(--color-info-text)" }}>
            {linkWhatsApp}
          </span>
          <button
            onClick={handleCopiarLink}
            className="shrink-0 p-1 rounded transition-opacity hover:opacity-70"
            title="Copiar link"
          >
            {linkCopiado ? (
              <Check className="w-4 h-4" style={{ color: "var(--color-success)" }} />
            ) : (
              <Copy className="w-4 h-4" style={{ color: "var(--color-info)" }} />
            )}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Comparte este link por WhatsApp para que el admin confirme desde cualquier dispositivo.
        </p>

        {/* Acción inmediata */}
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            ¿Ya verificaste en el banco?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setAccion("confirmar"); setError(""); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                background: accion === "confirmar" ? "var(--color-success)" : "var(--color-success-bg)",
                color: accion === "confirmar" ? "#fff" : "var(--color-success)",
                border: `1px solid var(--color-success)`,
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar
            </button>
            <button
              onClick={() => { setAccion("declinar"); setError(""); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                background: accion === "declinar" ? "var(--color-danger)" : "var(--color-danger-bg)",
                color: accion === "declinar" ? "#fff" : "var(--color-danger)",
                border: `1px solid var(--color-danger)`,
              }}
            >
              <XCircle className="w-4 h-4" />
              Rechazar
            </button>
          </div>
        </div>

        {/* Razón del rechazo */}
        {accion === "declinar" && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Razón del rechazo *
            </label>
            <textarea
              rows={2}
              value={razon}
              onChange={(e) => { setRazon(e.target.value); setError(""); }}
              placeholder="Ej: No se encontró el depósito en el estado de cuenta, referencia no coincide..."
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Botones */}
        {accion && (
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setAccion(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant={accion === "confirmar" ? "primary" : "danger"}
              onClick={handleSubmit}
              disabled={loading || (accion === "declinar" && !razon.trim())}
            >
              {loading
                ? "Procesando..."
                : accion === "confirmar"
                ? "Confirmar pago"
                : "Rechazar pago"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Badge de conteo (para dashboard y topbar) ────────────────────────────────

export function BadgeConfirmacionesPendientes() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/confirmaciones-deposito?count=true");
      const data = await res.json();
      if (data.success) setCount(data.count ?? 0);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const iv = setInterval(fetchCount, 60_000);
    return () => clearInterval(iv);
  }, [fetchCount]);

  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1"
      style={{ background: "var(--color-warning)", color: "var(--color-warning-text)" }}
    >
      {count}
    </span>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

interface PanelConfirmacionesDepositoProps {
  /** Solo mostrar confirmaciones de una reparación específica */
  reparacionId?: string;
  /** Vista compacta para dashboard */
  compact?: boolean;
}

export function PanelConfirmacionesDeposito({
  reparacionId,
  compact = false,
}: PanelConfirmacionesDepositoProps) {
  const [confirmaciones, setConfirmaciones] = useState<ConfirmacionDeposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionada, setSeleccionada] = useState<ConfirmacionDeposito | null>(null);
  const [error, setError] = useState("");

  const fetchConfirmaciones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = "/api/confirmaciones-deposito?estado=pendiente_confirmacion";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        const all = data.data as ConfirmacionDeposito[];
        setConfirmaciones(
          reparacionId ? all.filter((c) => c.reparacionId === reparacionId) : all
        );
      } else {
        setError(data.error ?? "Error al cargar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [reparacionId]);

  useEffect(() => { fetchConfirmaciones(); }, [fetchConfirmaciones]);

  const handleConfirmar = async (id: string) => {
    const res = await fetch(`/api/confirmaciones-deposito/${id}/confirmar`, { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error al confirmar");
    await fetchConfirmaciones();
  };

  const handleDeclinar = async (id: string, razon: string) => {
    const res = await fetch(`/api/confirmaciones-deposito/${id}/declinar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razon }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error al rechazar");
    await fetchConfirmaciones();
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-3 flex items-center gap-2 text-sm"
        style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
        <AlertCircle className="w-4 h-4" />
        {error}
        <button onClick={fetchConfirmaciones} className="ml-auto underline text-xs">Reintentar</button>
      </div>
    );
  }

  if (confirmaciones.length === 0) {
    if (compact) return null;
    return (
      <div className="rounded-xl p-6 text-center" style={{ border: "2px dashed var(--color-border)", background: "var(--color-bg-surface)" }}>
        <BanknoteIcon className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-border-strong)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          No hay depósitos pendientes de verificar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BanknoteIcon className="w-5 h-5" style={{ color: "var(--color-warning)" }} />
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Depósitos pendientes de verificación
            </h3>
            <span
              className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-bold"
              style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
            >
              {confirmaciones.length}
            </span>
          </div>
          <button
            onClick={fetchConfirmaciones}
            className="p-1.5 rounded-md transition-opacity hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {confirmaciones.map((c) => (
          <div
            key={c.id}
            className="rounded-xl p-3 flex items-center gap-3"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-warning)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            {/* Ícono tipo */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--color-warning-bg)" }}
            >
              <BanknoteIcon className="w-5 h-5" style={{ color: "var(--color-warning)" }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold font-mono" style={{ color: "var(--color-text-primary)" }}>
                  {fmtMonto(c.monto)}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded capitalize"
                  style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                >
                  {c.tipoPago}
                </span>
                {c.folioOrden && (
                  <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {c.folioOrden}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                {c.clienteNombre}
                {c.referenciaBancaria ? ` · Ref: ${c.referenciaBancaria}` : ""}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {fmtFecha(c.createdAt)} · {c.registradorNombre}
                </span>
              </div>
            </div>

            {/* Botón acción */}
            <Button
              variant="secondary"
              onClick={() => setSeleccionada(c)}
              className="shrink-0 text-xs"
            >
              Verificar
            </Button>
          </div>
        ))}
      </div>

      {/* Modal de acción */}
      {seleccionada && (
        <ModalAccion
          isOpen={!!seleccionada}
          onClose={() => setSeleccionada(null)}
          confirmacion={seleccionada}
          onConfirmar={handleConfirmar}
          onDeclinar={handleDeclinar}
        />
      )}
    </div>
  );
}
