"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Check, X } from "lucide-react";
import { formatMXN } from "@/lib/format";
import { PanelAutorizacionesPendientes } from "@/components/autorizaciones/PanelAutorizacionesPendientes";
import { PanelConfirmacionesDeposito } from "@/components/reparaciones/confirmaciones/PanelConfirmacionesDeposito";

interface SolicitudPrecio {
  id: string;
  ordenId: string;
  folio: string;
  estadoOrden: string;
  cliente: string;
  solicitante: string;
  precioActual: number;
  precioPropuesto: number;
  precioHoyEnOrden: number;
  yaAplicada: boolean;
  motivo: string;
  diasEspera: number;
}

interface PorAprobarData {
  precios: SolicitudPrecio[];
  depositos: number;
  descuentos: number;
  total: number;
}

/**
 * "Por aprobar": cambios de precio, depósitos por confirmar y descuentos por autorizar.
 * Se oculta solo cuando no hay nada pendiente. Repuesto 2026-10-21 (desaparecieron del
 * dashboard con FASE 53). Solo admin / super_admin.
 */
export function PorAprobar() {
  const [data, setData] = useState<PorAprobarData | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/por-aprobar");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silencioso: el dashboard sigue funcionando sin este panel
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    const iv = setInterval(() => { void cargar(); }, 3 * 60 * 1000);
    return () => clearInterval(iv);
  }, [cargar]);

  async function revisar(s: SolicitudPrecio, accion: "aprobar" | "rechazar") {
    const texto =
      accion === "aprobar"
        ? s.yaAplicada
          ? `El precio de ${s.folio} ya es ${formatMXN(s.precioPropuesto)}. ¿Cerrar la solicitud?`
          : `¿Aprobar ${formatMXN(s.precioPropuesto)} para ${s.folio}? Se aplicará a la orden.`
        : `¿Rechazar el cambio de precio de ${s.folio}? El precio no cambia.`;
    if (!window.confirm(texto)) return;
    setTrabajando(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/reparaciones/${s.ordenId}/solicitudes-precio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudId: s.id, accion }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error || "No se pudo procesar la solicitud");
      await cargar();
    } catch {
      setError("Error de conexión");
    } finally {
      setTrabajando(null);
    }
  }

  if (!data || data.total === 0) return null;

  return (
    <section
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-warning)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Por aprobar
        </h3>
        <span
          className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-bold px-1.5"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
        >
          {data.total}
        </span>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>
      )}

      {data.precios.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Cambios de precio ({data.precios.length})
          </p>
          {data.precios.map((s) => (
            <div
              key={s.id}
              className="rounded-lg p-3 flex flex-wrap items-center gap-3"
              style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/dashboard/reparaciones?orden=${s.ordenId}`}
                    className="text-sm font-semibold underline"
                    style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
                  >
                    {s.folio}
                  </Link>
                  {s.cliente && (
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{s.cliente}</span>
                  )}
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    · pide {s.solicitante} · hace {s.diasEspera} {s.diasEspera === 1 ? "día" : "días"}
                  </span>
                </div>
                <p className="text-sm mt-0.5" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                  {formatMXN(s.precioActual)} → <strong>{formatMXN(s.precioPropuesto)}</strong>
                </p>
                {s.yaAplicada && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    El precio de la orden ya es {formatMXN(s.precioHoyEnOrden)}: solo falta cerrar la solicitud.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={trabajando === s.id}
                  onClick={() => revisar(s, "aprobar")}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--color-success)", color: "var(--color-success-text-on, #fff)", opacity: trabajando === s.id ? 0.5 : 1 }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {s.yaAplicada ? "Cerrar" : "Aprobar"}
                </button>
                <button
                  disabled={trabajando === s.id}
                  onClick={() => revisar(s, "rechazar")}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: "var(--color-bg-surface)", color: "var(--color-danger)", border: "1px solid var(--color-danger)", opacity: trabajando === s.id ? 0.5 : 1 }}
                >
                  <X className="w-3.5 h-3.5" />
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.depositos > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Depósitos por confirmar ({data.depositos})
          </p>
          <PanelConfirmacionesDeposito compact />
        </div>
      )}

      {data.descuentos > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Descuentos por autorizar ({data.descuentos})
          </p>
          <PanelAutorizacionesPendientes />
        </div>
      )}
    </section>
  );
}
