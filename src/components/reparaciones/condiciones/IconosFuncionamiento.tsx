"use client";

import Image from "next/image";
import { CondicionesFuncionamiento } from "@/types";

interface IconosFuncionamientoProps {
  condiciones: CondicionesFuncionamiento;
  onChange: (nuevasCondiciones: CondicionesFuncionamiento) => void;
}

/**
 * nombre: máximo ~8 caracteres para caber en grid-cols-4 sin truncar.
 * nombre completo se muestra en el tooltip (title).
 */
const COMPONENTES_FUNCIONAMIENTO: {
  key: string;
  imagen: string;
  emoji: string;
  nombre: string;       // etiqueta corta (visible)
  nombreCompleto: string; // para title tooltip y badges de falla
}[] = [
  { key: "bateria",        imagen: "/iconos/bateria.png",          emoji: "🔋", nombre: "Batería",    nombreCompleto: "Batería" },
  { key: "pantallaTactil", imagen: "/iconos/pantalla-quebrada.png", emoji: "📱", nombre: "Pantalla",   nombreCompleto: "Pantalla / Táctil" },
  { key: "camaras",        imagen: "/iconos/camara.png",           emoji: "📷", nombre: "Cámara",     nombreCompleto: "Cámaras" },
  { key: "microfono",      imagen: "/iconos/microfono.png",        emoji: "🎤", nombre: "Micrófono",  nombreCompleto: "Micrófono" },
  { key: "altavoz",        imagen: "/iconos/audifonos.png",        emoji: "🔊", nombre: "Altavoz",    nombreCompleto: "Altavoz" },
  { key: "bluetooth",      imagen: "/iconos/bluetooth.png",        emoji: "📡", nombre: "Bluetooth",  nombreCompleto: "Bluetooth" },
  { key: "wifi",           imagen: "/iconos/wifi.png",             emoji: "📶", nombre: "WiFi",       nombreCompleto: "WiFi" },
  { key: "botonEncendido", imagen: "/iconos/boton-encendido.png",  emoji: "⏻",  nombre: "Encendido",  nombreCompleto: "Botón Encendido" },
  { key: "botonesVolumen", imagen: "/iconos/botones.png",          emoji: "🔉", nombre: "Volumen",    nombreCompleto: "Botones Volumen" },
  { key: "sensorHuella",  imagen: "/iconos/contrasena-huella.png", emoji: "👤", nombre: "Huella",     nombreCompleto: "Sensor Huella" },
  { key: "centroCarga",   imagen: "/iconos/centro-de-carga.png",   emoji: "🔌", nombre: "Carga",      nombreCompleto: "Centro de Carga" },
];

/** Iconos para las condiciones especiales (checkboxes) */
const ICONOS_ESPECIALES = {
  apagado:  "/iconos/equipo-apagado.png",
  mojado:   "/iconos/mojado.png",
  bateria:  "/iconos/bateria-hinchada.png",
};

function IconoEspecial({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="relative inline-block w-4 h-4 flex-shrink-0 align-middle">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="16px"
        className="object-contain"
      />
    </span>
  );
}

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

  const isCheckboxKey = (key: string): boolean =>
    ["llegaApagado", "estaMojado", "bateriaHinchada"].includes(key);

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
              title={comp.nombreCompleto}
              onClick={() => toggle(comp.key as keyof CondicionesFuncionamiento)}
              className={`
                p-2 rounded-lg border-2 transition-all text-center
                overflow-hidden flex flex-col items-center gap-0
                hover:shadow-md active:scale-95
                ${esOk
                  ? "bg-green-50 border-green-500 hover:bg-green-100"
                  : "bg-red-50 border-red-500 hover:bg-red-100"
                }
              `}
            >
              {/* Contenedor de ícono: overflow-hidden propio + position:relative para fill */}
              <div className="relative w-7 h-7 flex-shrink-0 overflow-hidden mb-1">
                <Image
                  src={comp.imagen}
                  alt={comp.nombre}
                  fill
                  sizes="28px"
                  className="object-contain"
                  style={{
                    filter: esOk
                      ? "none"
                      : "sepia(1) saturate(5) hue-rotate(-10deg) brightness(0.8)",
                  }}
                />
              </div>

              {/* Nombre corto — nunca rebasa el botón */}
              <div className="text-[10px] font-semibold text-gray-700 leading-none w-full text-center">
                {comp.nombre}
              </div>

              {/* Punto de estado */}
              <div
                className={`w-2 h-2 rounded-full mx-auto mt-1 flex-shrink-0 ${
                  esOk ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Condiciones especiales */}
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
            <IconoEspecial src={ICONOS_ESPECIALES.apagado} alt="Apagado" />
            <span className="font-medium">Llega apagado</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-yellow-900">
            <input
              type="checkbox"
              checked={condiciones.estaMojado || false}
              onChange={() => toggleCheckbox("estaMojado")}
              className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
            />
            <IconoEspecial src={ICONOS_ESPECIALES.mojado} alt="Mojado" />
            <span className="font-medium">Mojado / Líquido</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-yellow-900">
            <input
              type="checkbox"
              checked={condiciones.bateriaHinchada || false}
              onChange={() => toggleCheckbox("bateriaHinchada")}
              className="w-4 h-4 rounded border-yellow-300 text-yellow-600 focus:ring-yellow-500"
            />
            <IconoEspecial src={ICONOS_ESPECIALES.bateria} alt="Batería hinchada" />
            <span className="font-medium">Batería hinchada</span>
          </label>

        </div>
      </div>

      {/* Resumen de fallas */}
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
                <span key={comp.key} className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                  {comp.nombreCompleto}
                </span>
              ))}
              {condicionesEspeciales.map((cond, idx) => (
                <span key={idx} className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
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
