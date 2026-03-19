"use client";

import Image from "next/image";
import { EstadoFisicoDispositivo, EstadoFisico } from "@/types";

interface IconosEstadoFisicoProps {
  estadoFisico: EstadoFisicoDispositivo;
  onChange: (nuevoEstado: EstadoFisicoDispositivo) => void;
}

// Partes simples: un key → un campo del estado
type ParteSimple = {
  tipo: "simple";
  key: keyof EstadoFisicoDispositivo;
  imagen: string;
  emoji: string;
  nombre: string;
};

// Partes combinadas: varios keys sincronizados en un solo botón
type ParteCombinada = {
  tipo: "combinada";
  keys: (keyof EstadoFisicoDispositivo)[];
  imagen: string;
  emoji: string;
  nombre: string;
};

type ParteConfig = ParteSimple | ParteCombinada;

const PARTES_FISICAS: ParteConfig[] = [
  {
    tipo: "combinada",
    keys: ["marco", "bisel"],
    imagen: "/iconos/bisel.png",
    emoji: "🔲",
    nombre: "Marco / Bisel",
  },
  {
    tipo: "simple",
    key: "pantallaFisica",
    imagen: "/iconos/pantalla-quebrada.png",
    emoji: "💎",
    nombre: "Cristal",
  },
  {
    tipo: "simple",
    key: "camaraLente",
    imagen: "/iconos/camara.png",
    emoji: "📷",
    nombre: "Cámara",
  },
  {
    tipo: "simple",
    key: "tapaTrasera",
    imagen: "/iconos/tapa.png",
    emoji: "📱",
    nombre: "Tapa",
  },
];

const ESTADOS_CONFIG: Record<
  EstadoFisico,
  { emoji: string; label: string; bgColor: string; borderColor: string; dotColor: string }
> = {
  perfecto: {
    emoji: "🟢",
    label: "Perfecto",
    bgColor: "rgba(240,253,244,1)",
    borderColor: "rgba(74,222,128,1)",
    dotColor: "#16a34a",
  },
  rallado: {
    emoji: "🟡",
    label: "Rallado",
    bgColor: "rgba(254,252,232,1)",
    borderColor: "rgba(250,204,21,1)",
    dotColor: "#ca8a04",
  },
  golpeado: {
    emoji: "🟠",
    label: "Golpeado",
    bgColor: "rgba(255,247,237,1)",
    borderColor: "rgba(251,146,60,1)",
    dotColor: "#c2410c",
  },
  quebrado: {
    emoji: "🔴",
    label: "Quebrado",
    bgColor: "rgba(254,242,242,1)",
    borderColor: "rgba(248,113,113,1)",
    dotColor: "#b91c1c",
  },
};

const ESTADOS_ORDEN: EstadoFisico[] = ["perfecto", "rallado", "golpeado", "quebrado"];

/** Devuelve el peor estado de una lista de campos */
function peorEstado(
  estadoFisico: EstadoFisicoDispositivo,
  keys: (keyof EstadoFisicoDispositivo)[]
): EstadoFisico {
  let maxIndex = 0;
  for (const k of keys) {
    const val = estadoFisico[k] as EstadoFisico | undefined;
    if (val) {
      const idx = ESTADOS_ORDEN.indexOf(val);
      if (idx > maxIndex) maxIndex = idx;
    }
  }
  return ESTADOS_ORDEN[maxIndex];
}

export function IconosEstadoFisico({
  estadoFisico,
  onChange,
}: IconosEstadoFisicoProps) {
  /** Toggle para parte simple: avanza al siguiente estado */
  const toggleSimple = (key: keyof EstadoFisicoDispositivo) => {
    const estadoActual = estadoFisico[key] as EstadoFisico;
    const idx = ESTADOS_ORDEN.indexOf(estadoActual);
    const siguiente = ESTADOS_ORDEN[(idx + 1) % ESTADOS_ORDEN.length];
    onChange({ ...estadoFisico, [key]: siguiente });
  };

  /** Toggle para parte combinada: avanza todos los keys al mismo estado */
  const toggleCombinada = (keys: (keyof EstadoFisicoDispositivo)[]) => {
    const actual = peorEstado(estadoFisico, keys);
    const idx = ESTADOS_ORDEN.indexOf(actual);
    const siguiente = ESTADOS_ORDEN[(idx + 1) % ESTADOS_ORDEN.length];
    const updates = Object.fromEntries(keys.map((k) => [k, siguiente]));
    onChange({ ...estadoFisico, ...updates });
  };

  const toggleCheckbox = (key: "tieneSIM" | "tieneMemoriaSD") => {
    onChange({ ...estadoFisico, [key]: !estadoFisico[key] });
  };

  const tieneProblemasFisicos = (): boolean => {
    return PARTES_FISICAS.some((parte) => {
      const keys = parte.tipo === "combinada" ? parte.keys : [parte.key];
      return peorEstado(estadoFisico, keys) !== "perfecto";
    });
  };

  return (
    <div className="space-y-3">
      <h3
        className="text-sm font-bold flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <span>📦</span>
        <span>Cómo Llega el Equipo (Estado Físico)</span>
      </h3>

      <div
        className="rounded-lg p-2 text-xs"
        style={{
          background: "var(--color-info-bg)",
          border: "1px solid var(--color-info)",
          color: "var(--color-info-text)",
        }}
      >
        ℹ️ Click en cada parte para cambiar el estado:{" "}
        <span className="font-semibold">
          Perfecto → Rallado → Golpeado → Quebrado → Perfecto
        </span>
      </div>

      {/* Grid de 4 partes (Marco+Bisel combinados = 1 botón) */}
      <div className="grid grid-cols-4 gap-2">
        {PARTES_FISICAS.map((parte) => {
          const keys = parte.tipo === "combinada" ? parte.keys : [parte.key];
          const estado = peorEstado(estadoFisico, keys);
          const estadoInfo = ESTADOS_CONFIG[estado];
          const esPerfecto = estado === "perfecto";

          return (
            <button
              key={parte.tipo === "combinada" ? parte.keys.join("-") : parte.key}
              type="button"
              onClick={() =>
                parte.tipo === "combinada"
                  ? toggleCombinada(parte.keys)
                  : toggleSimple(parte.key)
              }
              className="p-2 rounded-lg border-2 transition-all hover:shadow-md active:scale-95 flex flex-col items-center overflow-hidden"
              style={{
                background: estadoInfo.bgColor,
                borderColor: estadoInfo.borderColor,
              }}
            >
              {/* Ícono: contenedor fijo, imagen nunca rebasa */}
              <div className="relative w-8 h-8 flex-shrink-0 mb-1">
                <Image
                  src={parte.imagen}
                  alt={parte.nombre}
                  fill
                  sizes="32px"
                  className="object-contain"
                  style={
                    !esPerfecto
                      ? { filter: "sepia(1) saturate(4) hue-rotate(-10deg) brightness(0.75)" }
                      : {}
                  }
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>

              {/* Nombre truncado para no rebasar */}
              <div
                className="text-[10px] font-semibold leading-tight mb-1 text-center w-full truncate px-0.5"
                style={{ color: "var(--color-text-primary)" }}
              >
                {parte.nombre}
              </div>

              {/* Dot de estado + label */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm leading-none">{estadoInfo.emoji}</span>
                <span
                  className="text-[9px] font-medium leading-tight"
                  style={{ color: estadoInfo.dotColor }}
                >
                  {estadoInfo.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* SIM y SD con iconos PNG */}
      <div className="grid grid-cols-2 gap-3">
        <label
          className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors"
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--color-bg-elevated)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--color-bg-surface)")
          }
        >
          <input
            type="checkbox"
            checked={estadoFisico.tieneSIM}
            onChange={() => toggleCheckbox("tieneSIM")}
            className="w-4 h-4 rounded"
            style={{ accentColor: "var(--color-accent)" }}
          />
          <Image
            src="/iconos/sim.png"
            alt="SIM"
            width={20}
            height={20}
            className="object-contain opacity-70"
          />
          <span
            className="font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Entrega SIM
          </span>
        </label>

        <label
          className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors"
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--color-bg-elevated)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--color-bg-surface)")
          }
        >
          <input
            type="checkbox"
            checked={estadoFisico.tieneMemoriaSD}
            onChange={() => toggleCheckbox("tieneMemoriaSD")}
            className="w-4 h-4 rounded"
            style={{ accentColor: "var(--color-accent)" }}
          />
          <Image
            src="/iconos/sd.png"
            alt="SD"
            width={20}
            height={20}
            className="object-contain opacity-70"
          />
          <span
            className="font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Entrega SD
          </span>
        </label>
      </div>

      {/* Campo de observaciones */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Observaciones adicionales (opcional)
        </label>
        <textarea
          value={estadoFisico.observacionesFisicas || ""}
          onChange={(e) =>
            onChange({ ...estadoFisico, observacionesFisicas: e.target.value })
          }
          placeholder="Ej: Rayón profundo en esquina superior derecha del marco..."
          rows={2}
          className="w-full text-xs px-3 py-2 rounded-lg resize-none focus:outline-none"
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-sunken)",
            color: "var(--color-text-primary)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-strong)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,153,184,0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {/* Indicador de daños */}
      {tieneProblemasFisicos() ? (
        <div
          className="text-xs rounded p-2 flex items-start gap-2"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning)",
          }}
        >
          <span className="text-base">⚠️</span>
          <div>
            <div
              className="font-semibold mb-1"
              style={{ color: "var(--color-warning-text)" }}
            >
              Daños físicos detectados
            </div>
            <div style={{ color: "var(--color-warning-text)" }}>
              Se registrará en el historial para referencia. Si los daños son
              relevantes para la reparación, se incluirán en el contrato PDF.
            </div>
          </div>
        </div>
      ) : (
        <div
          className="text-xs rounded p-2 text-center"
          style={{
            background: "var(--color-success-bg)",
            border: "1px solid var(--color-success)",
            color: "var(--color-success-text)",
          }}
        >
          ✓ El dispositivo llega en perfecto estado físico
        </div>
      )}
    </div>
  );
}
