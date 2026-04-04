"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Play, Square, Clock, AlertCircle, RotateCcw } from "lucide-react";
import type { TiempoLog, TiempoResumen } from "@/types";

interface Props {
  ordenId: string;
}

function formatMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function formatFechaHora(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHora(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Ticker: muestra hh:mm:ss desde `inicio` en tiempo real */
function TiempoActivo({ inicio }: { inicio: Date | string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = typeof inicio === "string" ? new Date(inicio) : inicio;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - start.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [inicio]);

  const h = Math.floor(elapsed / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");

  return (
    <span style={{ fontFamily: "var(--font-data)" }}>
      {h}:{m}:{s}
    </span>
  );
}

function LogRow({ log }: { log: TiempoLog }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--color-border-subtle)",
        transition: "background 150ms ease",
      }}
    >
      <td className="px-4 py-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {formatFechaHora(log.inicioTrabajo)}
      </td>
      <td className="px-4 py-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {log.finTrabajo ? formatHora(log.finTrabajo) : (
          <span style={{ color: "var(--color-success)", fontWeight: 500 }}>En curso</span>
        )}
      </td>
      <td
        className="px-4 py-2 text-sm text-right"
        style={{
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-data)",
          fontWeight: 600,
        }}
      >
        {log.duracionMinutos !== undefined
          ? formatMinutos(log.duracionMinutos)
          : "—"}
      </td>
      <td className="px-4 py-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {log.tecnicoNombre ?? "—"}
      </td>
      <td className="px-4 py-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {log.notas ?? "—"}
      </td>
    </tr>
  );
}

export function BitacoraTiempoPanel({ ordenId }: Props) {
  const { user } = useAuth();
  const [resumen, setResumen] = useState<TiempoResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notas, setNotas] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/tiempo`);
      const json = await res.json();
      if (json.success) setResumen(json.data);
      else throw new Error(json.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleAccion = async (action: "iniciar" | "finalizar") => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/tiempo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notas: notas.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setNotas("");
      await cargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin =
    user?.role === "admin" || user?.role === "super_admin";
  const hayActiva = !!resumen?.sesionActiva;
  const esmiSesion =
    resumen?.sesionActiva?.tecnicoId === user?.id;

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div
          className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-3 text-sm"
          style={{
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger-text)",
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Sesión activa de otro técnico (solo info para admin) */}
      {hayActiva && !esmiSesion && isAdmin && (
        <div
          className="rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-sm"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning)",
            color: "var(--color-warning-text)",
          }}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              <strong>{resumen?.sesionActiva?.tecnicoNombre ?? "Otro técnico"}</strong> tiene
              una sesión activa desde las{" "}
              {resumen?.sesionActiva?.inicioTrabajo
                ? formatHora(resumen.sesionActiva.inicioTrabajo)
                : "—"}
            </span>
          </div>
          <button
            onClick={async () => {
              if (!resumen?.sesionActiva) return;
              setActionLoading(true);
              try {
                const res = await fetch(`/api/reparaciones/${ordenId}/tiempo`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "cancelar",
                    tecnicoId: resumen.sesionActiva.tecnicoId,
                  }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                await cargar();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setActionLoading(false);
              }
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
            style={{
              background: "var(--color-warning)",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            <RotateCcw className="w-3 h-3" />
            Cancelar sesión
          </button>
        </div>
      )}

      {/* Panel de control */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Timer o estado inactivo */}
          <div className="flex-1">
            {hayActiva && esmiSesion && resumen?.sesionActiva ? (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-widest mb-1"
                  style={{ color: "var(--color-success)" }}
                >
                  ● Sesión en curso
                </div>
                <div
                  className="text-4xl font-bold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <TiempoActivo inicio={resumen.sesionActiva.inicioTrabajo} />
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  Iniciado a las {formatHora(resumen.sesionActiva.inicioTrabajo)}
                </div>
              </div>
            ) : (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-widest mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Tiempo acumulado
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {formatMinutos(resumen?.totalMinutos ?? 0)}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  en {resumen?.totalSesiones ?? 0} sesiones
                </div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Notas opcionales */}
            <input
              type="text"
              placeholder="Nota opcional..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={120}
              className="text-sm rounded-lg px-3 py-2 w-full sm:w-56"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
            {!hayActiva && (
              <button
                disabled={actionLoading}
                onClick={() => handleAccion("iniciar")}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all"
                style={{
                  background: actionLoading
                    ? "var(--color-border)"
                    : "var(--color-success)",
                  color: "#fff",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
              >
                <Play className="w-4 h-4" />
                Iniciar trabajo
              </button>
            )}
            {hayActiva && esmiSesion && (
              <button
                disabled={actionLoading}
                onClick={() => handleAccion("finalizar")}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all"
                style={{
                  background: actionLoading
                    ? "var(--color-border)"
                    : "var(--color-danger)",
                  color: "#fff",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
              >
                <Square className="w-4 h-4" />
                Detener
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Tiempo total",
            value: formatMinutos(resumen?.totalMinutos ?? 0),
            accent: false,
          },
          {
            label: "Sesiones",
            value: String(resumen?.totalSesiones ?? 0),
            accent: false,
          },
          {
            label: "Promedio/sesión",
            value:
              (resumen?.totalSesiones ?? 0) > 0
                ? formatMinutos(
                    Math.round((resumen!.totalMinutos) / resumen!.totalSesiones)
                  )
                : "—",
            accent: true,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl p-4 text-center"
            style={{
              background: "var(--color-bg-surface)",
              border: `1px solid ${k.accent ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{
                color: k.accent
                  ? "var(--color-accent)"
                  : "var(--color-text-primary)",
                fontFamily: "var(--font-data)",
              }}
            >
              {k.value}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* Historial de sesiones */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3
            className="font-semibold text-sm"
            style={{ color: "var(--color-text-primary)" }}
          >
            Historial de sesiones
          </h3>
          <button
            onClick={cargar}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--color-text-muted)" }}
            title="Recargar"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {!resumen || resumen.logs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock
              className="w-10 h-10 mx-auto mb-3 opacity-30"
              style={{ color: "var(--color-text-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin sesiones registradas
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Presiona &quot;Iniciar trabajo&quot; para comenzar a medir el tiempo
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Inicio", "Fin", "Duración", "Técnico", "Notas"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-xs font-medium uppercase tracking-wider"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
