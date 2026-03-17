"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BanknoteIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ConfirmacionDeposito } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonto(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

function fmtFecha(d: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

// ─── Estado final (confirmado / rechazado) ─────────────────────────────────

function EstadoFinal({ confirmacion }: { confirmacion: ConfirmacionDeposito }) {
  const esConfirmado = confirmacion.estado === "confirmado";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-bg-base)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center space-y-4"
        style={{
          background: "var(--color-bg-surface)",
          boxShadow: "var(--shadow-lg)",
          border: `1px solid ${esConfirmado ? "var(--color-success)" : "var(--color-danger)"}`,
        }}
      >
        {esConfirmado ? (
          <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: "var(--color-success)" }} />
        ) : (
          <XCircle className="w-14 h-14 mx-auto" style={{ color: "var(--color-danger)" }} />
        )}

        <h2
          className="text-xl font-bold"
          style={{ color: esConfirmado ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {esConfirmado ? "Depósito confirmado" : "Depósito rechazado"}
        </h2>

        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {esConfirmado
            ? `El pago de ${fmtMonto(confirmacion.monto)} fue verificado y asentado en caja.`
            : `El pago de ${fmtMonto(confirmacion.monto)} fue rechazado.`}
        </p>

        {confirmacion.razonRechazo && (
          <div
            className="rounded-lg p-3 text-sm text-left"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
          >
            <strong>Razón:</strong> {confirmacion.razonRechazo}
          </div>
        )}

        {confirmacion.confirmadoAt && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {fmtFecha(confirmacion.confirmadoAt)}
          </p>
        )}

        <a
          href="/dashboard"
          className="block mt-4 text-sm font-medium underline"
          style={{ color: "var(--color-accent)" }}
        >
          Ir al dashboard →
        </a>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfirmarDepositoPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [confirmacion, setConfirmacion] = useState<ConfirmacionDeposito | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState("");

  // Estado del formulario de acción
  const [accion, setAccion] = useState<"confirmar" | "declinar" | null>(null);
  const [razon, setRazon] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);

  // Cargar datos del token
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setErrorData("");
    try {
      const res = await fetch(`/api/confirmar-deposito/${token}`);
      const data = await res.json();
      if (data.success) {
        setConfirmacion(data.data);
      } else {
        setErrorData(data.error ?? "Token no válido o expirado");
      }
    } catch {
      setErrorData("Error de conexión");
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  const handleSubmit = async () => {
    if (!accion) return;
    if (accion === "declinar" && !razon.trim()) {
      setErrorSubmit("La razón del rechazo es requerida");
      return;
    }

    setSubmitting(true);
    setErrorSubmit("");
    setNeedsAuth(false);

    try {
      const res = await fetch(`/api/confirmar-deposito/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, razon: razon.trim() || undefined }),
      });
      const data = await res.json();

      if (data.requiresAuth) {
        setNeedsAuth(true);
        return;
      }

      if (!data.success) {
        throw new Error(data.error || "Error al procesar");
      }

      // Refrescar datos (ahora estará confirmado/rechazado)
      await fetchData();
    } catch (err) {
      setErrorSubmit(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-base)" }}>
        <div className="space-y-4 w-full max-w-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error (token inválido) ────────────────────────────────────────────────────
  if (errorData || !confirmacion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-bg-base)" }}>
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center space-y-4"
          style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <AlertCircle className="w-12 h-12 mx-auto" style={{ color: "var(--color-danger)" }} />
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
            Link inválido
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {errorData || "Este link no es válido o ya expiró."}
          </p>
          <a href="/dashboard" className="block text-sm underline" style={{ color: "var(--color-accent)" }}>
            Ir al dashboard
          </a>
        </div>
      </div>
    );
  }

  // ── Ya procesado ─────────────────────────────────────────────────────────────
  if (confirmacion.estado !== "pendiente_confirmacion") {
    return <EstadoFinal confirmacion={confirmacion} />;
  }

  // ── Necesita autenticación ────────────────────────────────────────────────────
  if (needsAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-bg-base)" }}>
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center space-y-5"
          style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-lg)" }}
        >
          <LogIn className="w-12 h-12 mx-auto" style={{ color: "var(--color-accent)" }} />
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
            Inicia sesión para confirmar
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Solo el administrador puede verificar depósitos. Inicia sesión con tu cuenta de admin y vuelve a abrir este link.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => router.push(`/auth/login?redirect=/confirmar-deposito/${token}`)}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Iniciar sesión
          </Button>
          <button
            onClick={() => setNeedsAuth(false)}
            className="text-xs underline"
            style={{ color: "var(--color-text-muted)" }}
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario principal ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "var(--color-bg-base)" }}>
      <div className="max-w-md mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--color-text-muted)" }}>
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-ui)" }}>
              Verificar depósito
            </h1>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Confirma si el pago aparece en el estado de cuenta
            </p>
          </div>
        </div>

        {/* Tarjeta de datos */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-warning)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {/* Encabezado del monto */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "var(--color-warning-bg)" }}
            >
              <BanknoteIcon className="w-6 h-6" style={{ color: "var(--color-warning)" }} />
            </div>
            <div>
              <span className="text-2xl font-bold font-mono" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                {fmtMonto(confirmacion.monto)}
              </span>
              <p className="text-sm capitalize font-medium" style={{ color: "var(--color-warning)" }}>
                {confirmacion.tipoPago}
              </p>
            </div>
          </div>

          {/* Detalles */}
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: "var(--color-bg-elevated)" }}
          >
            <Row label="Orden" value={confirmacion.folioOrden ?? "—"} mono />
            <Row label="Cliente" value={confirmacion.clienteNombre ?? "—"} />
            {confirmacion.referenciaBancaria && (
              <Row label="Referencia" value={confirmacion.referenciaBancaria} mono />
            )}
            <Row label="Registrado por" value={confirmacion.registradorNombre ?? "—"} />
            <Row label="Fecha" value={fmtFecha(confirmacion.createdAt)} />
          </div>

          {/* Indicador de espera */}
          <div
            className="flex items-center gap-2 rounded-lg p-2.5 text-xs"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Pendiente de verificación — esperando acción del admin</span>
          </div>
        </div>

        {/* Selector de acción */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            ¿Verificaste en el banco?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setAccion("confirmar"); setErrorSubmit(""); }}
              className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: accion === "confirmar" ? "var(--color-success)" : "var(--color-success-bg)",
                color: accion === "confirmar" ? "#fff" : "var(--color-success)",
                border: "1.5px solid var(--color-success)",
              }}
            >
              <CheckCircle2 className="w-5 h-5" />
              Sí, confirmar
            </button>
            <button
              onClick={() => { setAccion("declinar"); setErrorSubmit(""); }}
              className="py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: accion === "declinar" ? "var(--color-danger)" : "var(--color-danger-bg)",
                color: accion === "declinar" ? "#fff" : "var(--color-danger)",
                border: "1.5px solid var(--color-danger)",
              }}
            >
              <XCircle className="w-5 h-5" />
              Rechazar
            </button>
          </div>

          {/* Razón del rechazo */}
          {accion === "declinar" && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                Motivo del rechazo *
              </label>
              <textarea
                rows={3}
                value={razon}
                onChange={(e) => { setRazon(e.target.value); setErrorSubmit(""); }}
                placeholder="Ej: No se encontró el depósito en el estado de cuenta, la referencia no coincide..."
                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          )}

          {/* Error */}
          {errorSubmit && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorSubmit}
            </div>
          )}

          {/* Botón submit */}
          {accion && (
            <Button
              variant={accion === "confirmar" ? "primary" : "danger"}
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || (accion === "declinar" && !razon.trim())}
            >
              {submitting
                ? "Procesando..."
                : accion === "confirmar"
                ? "✅ Confirmar depósito"
                : "❌ Rechazar depósito"}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span
        className={`text-xs font-medium truncate max-w-[60%] text-right ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--color-text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}
