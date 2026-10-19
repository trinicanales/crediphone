"use client";

/**
 * FASE 56: Stepper horizontal de progreso para órdenes de reparación.
 * Muestra el flujo completo de estados con el paso actual resaltado.
 * Los pasos completados aparecen con checkmark; el actual en accent; los futuros en muted.
 */

import { Check, AlertCircle } from "lucide-react";
import type { EstadoOrdenReparacion } from "@/types";
import {
  PASOS_PROGRESO as PASOS,
  indicePasoProgreso,
  esEstadoEspera,
  destinoDePaso,
} from "@/lib/reparaciones/estados";

// Los pasos vienen del catálogo único (lib/reparaciones/estados.ts), el mismo que usa el
// seguimiento del cliente. Cancelado / no_reparable tienen tratamiento especial.

interface StepperReparacionProps {
  estado: EstadoOrdenReparacion;
  compact?: boolean; // modo compacto para la card (sin labels)
  /** Si se pasa, los pasos futuros/anteriores son clickeables para cambiar estado */
  onCambiarEstado?: (nuevoEstado: EstadoOrdenReparacion) => void;
}

export function StepperReparacion({ estado, compact = false, onCambiarEstado }: StepperReparacionProps) {
  const isTerminal = estado === "cancelado" || estado === "no_reparable";
  const pasoActual = indicePasoProgreso(estado);
  const enEspera = esEstadoEspera(estado);

  if (isTerminal) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{
          background: estado === "cancelado" ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
          border: `1px solid ${estado === "cancelado" ? "var(--color-danger)" : "var(--color-warning)"}`,
        }}
      >
        <AlertCircle
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: estado === "cancelado" ? "var(--color-danger)" : "var(--color-warning-text)" }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: estado === "cancelado" ? "var(--color-danger-text)" : "var(--color-warning-text)" }}
        >
          {estado === "cancelado" ? "Cancelada" : "No reparable"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full">
      {PASOS.map((paso, idx) => {
        const completado = idx < pasoActual;
        const activo = idx === pasoActual;
        const futuro = idx > pasoActual;
        // Solo es clickeable un paso al que el flujo permite saltar desde el estado actual
        const estadoDestino = destinoDePaso(estado, paso);
        const clickeable = !!onCambiarEstado && !!estadoDestino && !activo;

        return (
          <div key={paso.key} className="flex items-center flex-1 min-w-0">
            {/* Nodo del paso */}
            <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: compact ? 24 : 32 }}>
              <div
                className="flex items-center justify-center rounded-full transition-all"
                title={clickeable ? `Cambiar a: ${paso.label}` : activo && enEspera ? "Esperando piezas" : paso.label}
                onClick={clickeable ? (e) => { e.stopPropagation(); onCambiarEstado!(estadoDestino!); } : undefined}
                style={{
                  width: compact ? 22 : 28,
                  height: compact ? 22 : 28,
                  background: completado
                    ? "var(--color-success)"
                    : activo
                    ? "var(--color-accent)"
                    : "var(--color-bg-elevated)",
                  border: futuro
                    ? "2px solid var(--color-border)"
                    : activo
                    ? "2px solid var(--color-accent)"
                    : "none",
                  boxShadow: activo ? "0 0 0 3px rgba(0,153,184,0.2)" : "none",
                  cursor: clickeable ? "pointer" : "default",
                }}
              >
                {activo && enEspera ? (
                  <span style={{ fontSize: compact ? 9 : 11, lineHeight: 1 }}>⏳</span>
                ) : completado ? (
                  <Check
                    style={{
                      width: compact ? 10 : 13,
                      height: compact ? 10 : 13,
                      color: "#fff",
                      strokeWidth: 3,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: compact ? 9 : 11, lineHeight: 1 }}>
                    {paso.icon}
                  </span>
                )}
              </div>
              {!compact && (
                <span
                  className="mt-1 text-center leading-tight"
                  style={{
                    fontSize: 9,
                    color: completado
                      ? "var(--color-success)"
                      : activo
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                    fontWeight: activo ? 600 : 400,
                    maxWidth: 44,
                    wordBreak: "break-word",
                  }}
                >
                  {paso.label}
                </span>
              )}
            </div>

            {/* Línea conectora (no dibujar después del último paso) */}
            {idx < PASOS.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 rounded-full transition-all"
                style={{
                  background: completado
                    ? "var(--color-success)"
                    : activo
                    ? `linear-gradient(to right, var(--color-accent), var(--color-border))`
                    : "var(--color-border)",
                  minWidth: 4,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
