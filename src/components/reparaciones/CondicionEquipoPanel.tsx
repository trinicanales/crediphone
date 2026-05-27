"use client";

/**
 * CondicionEquipoPanel
 *
 * Panel colapsable que muestra la condición física del equipo al llegar.
 * Reutilizable en: ModalDiagnostico, ModalQAEntrega, OrdenDrawer tab Equipo.
 * Solo lectura — referencia visual para el técnico.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CondicionesFuncionamiento, EstadoFisicoDispositivo } from "@/types";

export const CAMPOS_FUNCIONALES: [keyof CondicionesFuncionamiento, string][] = [
  ["bateria", "Batería"],
  ["pantallaTactil", "Pantalla / Táctil"],
  ["camaras", "Cámaras"],
  ["microfono", "Micrófono"],
  ["altavoz", "Altavoz"],
  ["bluetooth", "Bluetooth"],
  ["wifi", "Wi-Fi"],
  ["botonEncendido", "Botón encendido"],
  ["botonesVolumen", "Botones volumen"],
  ["sensorHuella", "Sensor huella"],
  ["centroCarga", "Puerto de carga"],
];

export const CAMPOS_FISICOS: [keyof EstadoFisicoDispositivo, string][] = [
  ["marco", "Marco"],
  ["bisel", "Bisel"],
  ["pantallaFisica", "Cristal pantalla"],
  ["camaraLente", "Lente cámara"],
  ["tapaTrasera", "Tapa trasera"],
];

interface CondicionEquipoPanelProps {
  condiciones?: CondicionesFuncionamiento;
  estadoFisico?: EstadoFisicoDispositivo;
  /** Si true, el panel inicia expandido */
  defaultExpanded?: boolean;
}

export function CondicionEquipoPanel({
  condiciones,
  estadoFisico,
  defaultExpanded = false,
}: CondicionEquipoPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!condiciones && !estadoFisico) return null;

  const numFallas = condiciones
    ? CAMPOS_FUNCIONALES.filter(([k]) => condiciones[k] === "falla").length
    : 0;
  const tieneAlertas =
    condiciones?.llegaApagado || condiciones?.estaMojado || condiciones?.bateriaHinchada || numFallas > 0;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${tieneAlertas ? "var(--color-danger)" : "var(--color-border)"}`,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
        style={{
          background: tieneAlertas ? "var(--color-danger-bg)" : "var(--color-bg-elevated)",
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: tieneAlertas ? "var(--color-danger-text)" : "var(--color-text-muted)" }}
          >
            Condición al llegar
          </span>
          {tieneAlertas && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ background: "var(--color-danger)", color: "white" }}
            >
              ⚠ {numFallas > 0 ? `${numFallas} falla${numFallas > 1 ? "s" : ""}` : "alertas"}
            </span>
          )}
          <span
            className="text-xs px-1 py-0.5 rounded"
            style={{
              background: "var(--color-bg-surface)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            Solo lectura
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          style={{ color: "var(--color-text-muted)" }}
        />
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Alertas especiales */}
          {(condiciones?.llegaApagado || condiciones?.estaMojado || condiciones?.bateriaHinchada) && (
            <div className="flex flex-wrap gap-1.5">
              {condiciones?.llegaApagado && (
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger-text)",
                    border: "1px solid var(--color-danger)",
                  }}
                >
                  Llegó apagado
                </span>
              )}
              {condiciones?.estaMojado && (
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger-text)",
                    border: "1px solid var(--color-danger)",
                  }}
                >
                  Daño por líquido
                </span>
              )}
              {condiciones?.bateriaHinchada && (
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger-text)",
                    border: "1px solid var(--color-danger)",
                  }}
                >
                  Batería hinchada
                </span>
              )}
            </div>
          )}

          {/* Funcionamiento de componentes */}
          {condiciones && (
            <div>
              <p
                className="text-xs font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Funcionamiento de componentes:
              </p>
              <div className="grid grid-cols-2 gap-1">
                {CAMPOS_FUNCIONALES.map(([key, label]) => {
                  const valor = condiciones[key];
                  if (valor !== "ok" && valor !== "falla") return null;
                  return (
                    <div key={key as string} className="flex items-center gap-1.5 text-xs">
                      <span
                        style={{
                          color: valor === "ok" ? "var(--color-success)" : "var(--color-danger)",
                          fontWeight: 700,
                        }}
                      >
                        {valor === "ok" ? "✓" : "✗"}
                      </span>
                      <span
                        style={{
                          color:
                            valor === "falla"
                              ? "var(--color-danger-text)"
                              : "var(--color-text-primary)",
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Estado físico */}
          {estadoFisico && (
            <div>
              <p
                className="text-xs font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Estado físico:
              </p>
              <div className="grid grid-cols-2 gap-1">
                {CAMPOS_FISICOS.map(([key, label]) => {
                  const valor = estadoFisico[key] as string;
                  if (!valor || typeof valor !== "string") return null;
                  const esProblema = valor !== "perfecto";
                  return (
                    <div key={key as string} className="flex items-center gap-1.5 text-xs">
                      <span
                        style={{
                          color: esProblema ? "var(--color-warning)" : "var(--color-success)",
                          fontWeight: 700,
                        }}
                      >
                        {esProblema ? "△" : "✓"}
                      </span>
                      <span style={{ color: "var(--color-text-primary)" }}>
                        {label}:{" "}
                        <strong
                          style={{
                            color: esProblema
                              ? "var(--color-warning-text, #92400e)"
                              : "inherit",
                          }}
                        >
                          {valor}
                        </strong>
                      </span>
                    </div>
                  );
                })}
              </div>
              {estadoFisico.observacionesFisicas && (
                <p
                  className="mt-1.5 text-xs italic"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Obs: {estadoFisico.observacionesFisicas}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
