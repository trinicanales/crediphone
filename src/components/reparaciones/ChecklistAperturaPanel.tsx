"use client";

/**
 * ChecklistAperturaPanel
 *
 * Sección colapsable que el técnico llena al abrir físicamente el equipo
 * para documentar el estado interno antes de tocar nada.
 *
 * - Completamente opcional (no bloquea el formulario de diagnóstico)
 * - Si se detecta humedad / batería / reparación previa → alerta roja visible
 * - El resultado se serializa como texto y se incluye en notasInternas
 * - Valor legal: si el cliente reclama daño posterior, el registro prueba
 *   el estado original del equipo al momento de apertura
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type EstadoItem = "ok" | "problema" | "na";

interface ItemChecklist {
  id: string;
  label: string;
  descripcion?: string;
  esCritico: boolean; // si "problema" → banner de alerta roja
}

// ── Definición de ítems ───────────────────────────────────────────────────────

const ITEMS: ItemChecklist[] = [
  {
    id: "humedad",
    label: "Indicios de humedad / líquido",
    descripcion: "Corrosión, manchas blancas, vapor interno",
    esCritico: true,
  },
  {
    id: "reparacion_previa",
    label: "Evidencia de reparación previa",
    descripcion: "Pegamento, tornillos cambiados, sellos rotos anteriormente",
    esCritico: true,
  },
  {
    id: "bateria",
    label: "Batería hinchada o dañada",
    descripcion: "Deformación, inflado, electrolito visible",
    esCritico: true,
  },
  {
    id: "placa",
    label: "Daño visible en placa base",
    descripcion: "Quemaduras, corrosión, componentes desprendidos",
    esCritico: true,
  },
  {
    id: "tornillos",
    label: "Tornillos faltantes o dañados",
    descripcion: "Tornillos oxidados, cabeza dañada o ausentes",
    esCritico: false,
  },
  {
    id: "conector_carga",
    label: "Conector de carga",
    descripcion: "Doblado, corroído, suelto o roto",
    esCritico: false,
  },
  {
    id: "pantalla_interna",
    label: "Conexión de pantalla / flex",
    descripcion: "Cables flex doblados, conector suelto",
    esCritico: false,
  },
  {
    id: "camaras",
    label: "Módulo de cámara",
    descripcion: "Vidrio roto, polvo interno, conector suelto",
    esCritico: false,
  },
];

// ── Sub-componente: fila de ítem ──────────────────────────────────────────────

function ItemRow({
  item,
  estado,
  onChange,
}: {
  item: ItemChecklist;
  estado: EstadoItem;
  onChange: (v: EstadoItem) => void;
}) {
  const btnBase: React.CSSProperties = {
    padding: "3px 10px",
    borderRadius: "9999px",
    fontSize: "0.72rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "1.5px solid transparent",
    transition: "all 100ms",
  };

  const estilos: Record<EstadoItem, React.CSSProperties> = {
    ok: {
      ...btnBase,
      background: estado === "ok" ? "var(--color-success)" : "transparent",
      color: estado === "ok" ? "#fff" : "var(--color-text-muted)",
      borderColor: estado === "ok" ? "var(--color-success)" : "var(--color-border)",
    },
    problema: {
      ...btnBase,
      background: estado === "problema" ? "var(--color-danger)" : "transparent",
      color: estado === "problema" ? "#fff" : "var(--color-text-muted)",
      borderColor: estado === "problema" ? "var(--color-danger)" : "var(--color-border)",
    },
    na: {
      ...btnBase,
      background: estado === "na" ? "var(--color-bg-sunken)" : "transparent",
      color: estado === "na" ? "var(--color-text-secondary)" : "var(--color-text-muted)",
      borderColor: estado === "na" ? "var(--color-border)" : "var(--color-border-subtle)",
    },
  };

  return (
    <div
      className="flex items-start justify-between gap-3 py-2"
      style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-tight"
          style={{
            color:
              estado === "problema" && item.esCritico
                ? "var(--color-danger-text)"
                : "var(--color-text-primary)",
          }}
        >
          {item.esCritico && (
            <span className="mr-1" style={{ color: "var(--color-danger)", fontSize: "0.7rem" }}>
              ●
            </span>
          )}
          {item.label}
        </p>
        {item.descripcion && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {item.descripcion}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button type="button" style={estilos.ok} onClick={() => onChange(estado === "ok" ? "na" : "ok")}>
          OK
        </button>
        <button
          type="button"
          style={estilos.problema}
          onClick={() => onChange(estado === "problema" ? "na" : "problema")}
        >
          Problema
        </button>
        <button type="button" style={estilos.na} onClick={() => onChange(estado === "na" ? "na" : "na")}>
          —
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  /** Callback cuando cambia el estado del checklist.
   *  resumen: texto formateado para incluir en notasInternas.
   *  tieneAlertas: true si hay al menos un ítem crítico marcado como "problema". */
  onChange: (resumen: string, tieneAlertas: boolean) => void;
}

export function ChecklistAperturaPanel({ onChange }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [estados, setEstados] = useState<Record<string, EstadoItem>>({});

  const cambiar = (id: string, nuevoEstado: EstadoItem) => {
    const nuevo = { ...estados, [id]: nuevoEstado };
    setEstados(nuevo);

    // Generar resumen de texto para notasInternas
    const problemas = ITEMS.filter((i) => nuevo[i.id] === "problema");
    const okItems = ITEMS.filter((i) => nuevo[i.id] === "ok");
    const tieneAlertas = problemas.some((i) => i.esCritico);

    if (problemas.length === 0 && okItems.length === 0) {
      onChange("", false);
      return;
    }

    const lineas: string[] = ["📋 Checklist de apertura:"];
    if (problemas.length > 0) {
      lineas.push(`⚠️ Problemas: ${problemas.map((i) => i.label).join(", ")}.`);
    }
    if (okItems.length > 0) {
      lineas.push(`✅ Sin problemas: ${okItems.map((i) => i.label).join(", ")}.`);
    }

    onChange(lineas.join("\n"), tieneAlertas);
  };

  const alertasCriticas = ITEMS.filter(
    (i) => i.esCritico && estados[i.id] === "problema"
  );
  const totalMarcados = Object.values(estados).filter((v) => v !== "na").length;
  const hayAlertas = alertasCriticas.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${hayAlertas ? "var(--color-danger)" : "var(--color-border)"}`,
      }}
    >
      {/* ── Cabecera colapsable ── */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{
          background: hayAlertas ? "var(--color-danger-bg)" : "var(--color-bg-elevated)",
        }}
        onClick={() => setExpandido((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {hayAlertas ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-danger)" }} />
          ) : (
            <CheckCircle2
              className="w-4 h-4 flex-shrink-0"
              style={{ color: totalMarcados > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}
            />
          )}
          <span
            className="text-sm font-medium"
            style={{ color: hayAlertas ? "var(--color-danger-text)" : "var(--color-text-secondary)" }}
          >
            Checklist de apertura
            {totalMarcados > 0 && !expandido && (
              <span className="ml-2 text-xs" style={{ opacity: 0.65 }}>
                ({totalMarcados} ítem{totalMarcados !== 1 ? "s" : ""} evaluado{totalMarcados !== 1 ? "s" : ""})
              </span>
            )}
          </span>
          {hayAlertas && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "var(--color-danger)", color: "#fff" }}
            >
              {alertasCriticas.length} alerta{alertasCriticas.length !== 1 ? "s" : ""}
            </span>
          )}
          {!hayAlertas && totalMarcados === 0 && (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              (opcional)
            </span>
          )}
        </div>
        {expandido ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
        )}
      </button>

      {/* ── Contenido expandido ── */}
      {expandido && (
        <div
          style={{
            borderTop: `1px solid ${hayAlertas ? "var(--color-danger)" : "var(--color-border-subtle)"}`,
          }}
        >
          <p className="px-4 pt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Documenta el estado interno al abrir el equipo.{" "}
            <span style={{ color: "var(--color-text-secondary)" }}>
              Marca lo que aplica — el resto se omite del historial.
            </span>
          </p>

          <div className="px-4 pb-3 pt-2">
            {ITEMS.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                estado={estados[item.id] ?? "na"}
                onChange={(v) => cambiar(item.id, v)}
              />
            ))}
          </div>

          {/* Banner de alerta crítica */}
          {hayAlertas && (
            <div
              className="mx-4 mb-4 rounded-lg px-4 py-3"
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger)",
              }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--color-danger-text)" }}>
                ⚠️ Condición crítica detectada
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-danger-text)" }}>
                {alertasCriticas.map((i) => i.label).join(" · ")} — Este hallazgo quedará
                registrado en la orden. Si aplica, agrega un deslinde legal en el formulario de
                creación.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
