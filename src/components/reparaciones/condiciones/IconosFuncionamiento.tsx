"use client";

import Image from "next/image";
import { CondicionesFuncionamiento } from "@/types";

interface IconosFuncionamientoProps {
  condiciones: CondicionesFuncionamiento;
  onChange: (nuevasCondiciones: CondicionesFuncionamiento) => void;
}

/**
 * Componentes del checklist de funcionamiento.
 * - imagen: ruta relativa a /public (se sirve estáticamente por Next.js)
 * - emoji: fallback si no hay imagen propia
 */
const COMPONENTES_FUNCIONAMIENTO: {
  key: string;
  imagen?: string;
  emoji: string;
  nombre: string;
}[] = [
  { key: "bateria",        imagen: "/iconos/bateria.png",          emoji: "🔋", nombre: "Batería" },
  { key: "pantallaTactil", imagen: "/iconos/pantalla-quebrada.png", emoji: "📱", nombre: "Pantalla/Táctil" },
  { key: "camaras",        imagen: "/iconos/camara.png",           emoji: "📷", nombre: "Cámaras" },
  { key: "microfono",      imagen: "/iconos/microfono.png",        emoji: "🎤", nombre: "Micrófono" },
  { key: "altavoz",        imagen: "/iconos/audifonos.png",        emoji: "🔊", nombre: "Altavoz" },
  { key: "bluetooth",      imagen: "/iconos/bluetooth.png",        emoji: "📡", nombre: "Bluetooth" },
  { key: "wifi",           imagen: "/iconos/wifi.png",             emoji: "📶", nombre: "WiFi" },
  { key: "botonEncendido", imagen: "/iconos/boton-encendido.png",  emoji: "⏻",  nombre: "Power" },
  { key: "botonesVolumen", imagen: "/iconos/botones.png",          emoji: "🔉", nombre: "Volumen" },
  { key: "sensorHuella",  imagen: "/iconos/contrasena-huella.png", emoji: "👤", nombre: "Huella" },
  { key: "centroCarga",   imagen: "/iconos/centro-de-carga.png",   emoji: "🔌", nombre: "Centro de Carga" },
];

export function IconosFuncionamiento({
  condiciones,
  onChange,
}: IconosFuncionamientoProps) {
  const toggle = (key: keyof CondicionesFuncionamiento) => {
    if (isCheckboxKey(key)) return;
    const nuevoEstado = condiciones[key] === "ok" ? "falla" : "ok";
    onChange({ ...condiciones, [key]: nuevoEstado });
  };

  const toggleCheckbox = (key: keyof CondicionesFuncionamiento) => {
    onChange({ ...condiciones, [key]: !condiciones[key] });
  };

  const isCheckboxKey = (key: string): boolean => {
    return ["llegaApagado", "estaMojado", "bateriaHinchada"].includes(key);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
        <span>⚡</span>
        <span>Funcionamiento de Componentes</span>
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {COMPONENTES_FUNCIONAMIENTO.map((comp) => {
          const estado = condiciones[comp.key as keyof CondicionesFuncionamiento];
          const esOk = estado === "ok";

          return (
            <button
              key={comp.key}
              type="button"
              onClick={() => toggle(comp.key as keyof CondicionesFuncionamiento)}
              className={`
                p-2 rounded-lg border-2 transition-all text-center
                hover:shadow-md active:scale-95
                ${esOk
                  ? "bg-green-50 border-green-500 hover:bg-green-100"
                  : "bg-red-50 border-red-500 hover:bg-red-100"
                }
              `}
            >
              {/* Icono: imagen propia o emoji fallback */}
              <div className="flex items-center justify-center h-8 mb-1">
                {comp.imagen ? (
                  <Image
                    src={comp.imagen}
                    alt={comp.nombre}
                    width={32}
                    height={32}
                    className="object-contain"
                    style={{
                      filter: esOk
                        ? "none"
                        : "sepia(1) saturate(5) hue-rotate(-10deg) brightness(0.8)",
                    }}
                  />
                ) : (
                  <span className="text-2xl">{comp.emoji}</span>
                )}
              </div>

              <div className="text-[10px] font-semibold text-gray-700 leading-tight">
                {comp.nombre}
              </div>

              {/* Punto indicador de estado */}
              <div
                className={`
                  w-2 h-2 rounded-full mx-auto mt-1.5
                  ${esOk ? "bg-green-500" : "bg-red-500"}
                `}
              />
            </button>
          );
        })}
      </div>

      {/* Checkboxes especiales - condiciones críticas */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-yellow-800 mb-2">
          ⚠️ Condiciones Especiales
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer hover:text-yellow-900">
            <input
              type="checkbox"
              checked={condiciones.llegaApagado || false}
              onChange={() => toggleCheckbox("llegaApagado")}
              className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="font-medium">🔌 Llega apagado</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-yellow-900">
            <input
              type="checkbox"
              checked={condiciones.estaMojado || false}
              onChange={() => toggleCheckbox("estaMojado")}
              className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="font-medium">
              {/* Icono mojado */}
              <Image
                src="/iconos/mojado.png"
                alt="Mojado"
                width={16}
                height={16}
                className="inline object-contain mr-1 align-text-bottom"
              />
              Mojado / Líquido
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-yellow-900">
            <input
              type="checkbox"
              checked={condiciones.bateriaHinchada || false}
              onChange={() => toggleCheckbox("bateriaHinchada")}
              className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="font-medium">⚠️ Batería hinchada</span>
          </label>
        </div>
      </div>

      {/* Indicador de fallas */}
      {(() => {
        const fallas = COMPONENTES_FUNCIONAMIENTO.filter(
          (comp) =>
            condiciones[comp.key as keyof CondicionesFuncionamiento] === "falla"
        );
        const condicionesEspeciales = [
          condiciones.llegaApagado && "Apagado",
          condiciones.estaMojado && "Mojado",
          condiciones.bateriaHinchada && "Batería hinchada",
        ].filter(Boolean);

        if (fallas.length === 0 && condicionesEspeciales.length === 0) {
          return (
            <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2 text-center">
              ✓ Todos los componentes funcionan correctamente
            </div>
          );
        }

        return (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
            <div className="font-semibold mb-1">Componentes con problemas:</div>
            <div className="flex flex-wrap gap-1">
              {fallas.map((comp) => (
                <span
                  key={comp.key}
                  className="bg-red-100 text-red-700 px-2 py-0.5 rounded"
                >
                  {comp.nombre}
                </span>
              ))}
              {condicionesEspeciales.map((cond, idx) => (
                <span
                  key={idx}
                  className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded"
                >
                  {cond}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
