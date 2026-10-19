"use client";

import {
  Package,
  Search,
  FileText,
  CheckCircle,
  Wrench,
  ShieldCheck,
  Hourglass,
} from "lucide-react";
import type { EstadoOrdenReparacion } from "@/types";
import {
  PASOS_PROGRESO,
  indicePasoProgreso,
  esEstadoEspera,
} from "@/lib/reparaciones/estados";

// Mismos pasos que el stepper del personal (catálogo único en lib/reparaciones/estados.ts).
const ICONOS: Record<string, typeof Package> = {
  recibido: Package,
  diagnostico: Search,
  presupuesto: FileText,
  aprobado: CheckCircle,
  reparacion: Wrench,
  listo: Package,
  entregado: ShieldCheck,
};

const PASOS = PASOS_PROGRESO.map((p) => ({ key: p.key, label: p.label, icon: ICONOS[p.key] ?? Package }));

export function BarraProgresoReparacion({ estado }: { estado: EstadoOrdenReparacion }) {
  // Estados terminales que no están en el flujo lineal
  const esTerminal = ["cancelado", "no_reparable"].includes(estado);
  const estadoActualOrden = indicePasoProgreso(estado) + 1; // 0 si es terminal
  const enEspera = esEstadoEspera(estado);

  return (
    <div className="px-1 py-3">
      <div className="flex items-center justify-between relative">
        {/* Línea de fondo */}
        <div
          className="absolute"
          style={{
            height: 2,
            top: 14,
            left: "calc(14px)",
            right: "calc(14px)",
            background: "var(--color-border-subtle)",
            zIndex: 0,
          }}
        />

        {PASOS.map((paso, i) => {
          const pasoOrden = i + 1;
          const completado = !esTerminal && estadoActualOrden > pasoOrden;
          const actual = !esTerminal && estadoActualOrden === pasoOrden;
          const Icon = actual && enEspera ? Hourglass : paso.icon;

          let iconBg = "var(--color-bg-elevated)";
          let iconColor = "var(--color-border-strong)";
          let textColor = "var(--color-text-muted)";
          let borderColor = "var(--color-border-subtle)";

          if (completado) {
            iconBg = "var(--color-success)";
            iconColor = "#fff";
            textColor = "var(--color-success)";
            borderColor = "var(--color-success)";
          } else if (actual) {
            iconBg = "var(--color-accent)";
            iconColor = "#fff";
            textColor = "var(--color-accent)";
            borderColor = "var(--color-accent)";
          } else if (esTerminal) {
            iconBg = "var(--color-bg-elevated)";
          }

          return (
            <div
              key={paso.key}
              className="flex flex-col items-center gap-1 z-10"
              style={{ minWidth: 0, flex: "0 0 auto" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: iconBg,
                  border: `2px solid ${borderColor}`,
                  boxShadow: actual ? "0 0 0 3px var(--color-accent-light)" : undefined,
                  transition: "all 200ms ease",
                }}
              >
                {completado ? (
                  <CheckCircle className="w-4 h-4" style={{ color: iconColor }} />
                ) : (
                  <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
                )}
              </div>
              <span
                className="text-center leading-tight"
                style={{
                  fontSize: 9,
                  color: textColor,
                  fontWeight: actual || completado ? 600 : 400,
                  maxWidth: 40,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {paso.label}
              </span>
            </div>
          );
        })}
      </div>

      {enEspera && (
        <p className="text-center text-xs mt-2 font-semibold" style={{ color: "var(--color-warning-text)" }}>
          Esperando piezas
        </p>
      )}

      {/* Estado especial — cancelado/no_reparable */}
      {esTerminal && (
        <p
          className="text-center text-xs mt-2 font-semibold"
          style={{ color: "var(--color-danger)" }}
        >
          {estado === "cancelado" ? "Orden cancelada" : "No reparable"}
        </p>
      )}
    </div>
  );
}
