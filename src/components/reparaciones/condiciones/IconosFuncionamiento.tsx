"use client";

import { useState } from "react";
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
  nombre: string;       // etiqueta corta (visible)
  nombreCompleto: string; // para title tooltip y badges de falla
}[] = [
  { key: "bateria",        imagen: "/iconos/bateria.png",          nombre: "Batería",    nombreCompleto: "Batería" },
  { key: "pantallaTactil", imagen: "/iconos/pantalla-quebrada.png", nombre: "Pantalla",   nombreCompleto: "Pantalla / Táctil" },
  { key: "camaras",        imagen: "/iconos/camara.png",           nombre: "Cámara",     nombreCompleto: "Cámaras" },
  { key: "microfono",      imagen: "/iconos/microfono.png",        nombre: "Micrófono",  nombreCompleto: "Micrófono" },
  { key: "altavoz",        imagen: "/iconos/audifonos.png",        nombre: "Altavoz",    nombreCompleto: "Altavoz" },
  { key: "bluetooth",      imagen: "/iconos/bluetooth.png",        nombre: "Bluetooth",  nombreCompleto: "Bluetooth" },
  { key: "wifi",           imagen: "/iconos/wifi.png",             nombre: "WiFi",       nombreCompleto: "WiFi" },
  { key: "botonEncendido", imagen: "/iconos/boton-encendido.png",  nombre: "Encendido",  nombreCompleto: "Botón Encendido" },
  { key: "botonesVolumen", imagen: "/iconos/botones.png",          nombre: "Volumen",    nombreCompleto: "Botones Volumen" },
  { key: "sensorHuella",  imagen: "/iconos/contrasena-huella.png", nombre: "Huella",     nombreCompleto: "Sensor Huella" },
  { key: "centroCarga",   imagen: "/iconos/centro-de-carga.png",   nombre: "Carga",      nombreCompleto: "Centro de Carga" },
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

interface ComponenteBtnProps {
  imagen: string;
  nombre: string;
  nombreCompleto: string;
  esOk: boolean;
  onClick: () => void;
}

function ComponenteBtn({ imagen, nombre, nombreCompleto, esOk, onClick }: ComponenteBtnProps) {
  const [hovered, setHovered] = useState(false);

  const bg = esOk
    ? hovered ? "var(--color-success)" : "var(--color-success-bg)"
    : hovered ? "var(--color-danger)"  : "var(--color-danger-bg)";
  const border = esOk ? "2px solid var(--color-success)" : "2px solid var(--color-danger)";
  const dotBg = esOk ? "var(--color-success)" : "var(--color-danger)";

  return (
    <button
      type="button"
      title={nombreCompleto}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="p-2 rounded-lg transition-all text-center overflow-hidden flex flex-col items-center gap-0 active:scale-95"
      style={{ background: bg, border, transition: "background 0.15s" }}
    >
      <div className="relative w-7 h-7 flex-shrink-0 overflow-hidden mb-1">
        <Image
          src={imagen}
          alt={nombre}
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
      <div
        className="text-[10px] font-semibold leading-none w-full text-center"
        style={{ color: hovered ? "var(--color-text-inverted)" : esOk ? "var(--color-success)" : "var(--color-danger)" }}
      >
        {nombre}
      </div>
      <div
        className="w-2 h-2 rounded-full mx-auto mt-1 flex-shrink-0"
        style={{ background: dotBg }}
      />
    </button>
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
      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
        <span>⚡</span>
        <span>Funcionamiento de Componentes</span>
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {COMPONENTES_FUNCIONAMIENTO.map((comp) => {
          const estado = condiciones[comp.key as keyof CondicionesFuncionamiento];
          const esOk = estado === "ok";

          return (
            <ComponenteBtn
              key={comp.key}
              imagen={comp.imagen}
              nombre={comp.nombre}
              nombreCompleto={comp.nombreCompleto}
              esOk={esOk}
              onClick={() => toggle(comp.key as keyof CondicionesFuncionamiento)}
            />
          );
        })}
      </div>

      {/* Condiciones especiales */}
      <div
        className="rounded-lg p-3"
        style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-border-subtle)" }}
      >
        <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-warning)" }}>
          ⚠️ Condiciones Especiales
        </div>
        <div className="flex flex-wrap gap-4 text-xs">

          <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
            <input
              type="checkbox"
              checked={condiciones.llegaApagado || false}
              onChange={() => toggleCheckbox("llegaApagado")}
              className="w-4 h-4 rounded"
            />
            <IconoEspecial src={ICONOS_ESPECIALES.apagado} alt="Apagado" />
            <span className="font-medium">Llega apagado</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
            <input
              type="checkbox"
              checked={condiciones.estaMojado || false}
              onChange={() => toggleCheckbox("estaMojado")}
              className="w-4 h-4 rounded"
            />
            <IconoEspecial src={ICONOS_ESPECIALES.mojado} alt="Mojado" />
            <span className="font-medium">Mojado / Líquido</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
            <input
              type="checkbox"
              checked={condiciones.bateriaHinchada || false}
              onChange={() => toggleCheckbox("bateriaHinchada")}
              className="w-4 h-4 rounded"
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
            <div
              className="text-xs rounded p-2 text-center"
              style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-border-subtle)", color: "var(--color-success)" }}
            >
              ✓ Todos los componentes funcionan correctamente
            </div>
          );
        }

        return (
          <div
            className="text-xs rounded p-2"
            style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-border-subtle)", color: "var(--color-warning)" }}
          >
            <div className="font-semibold mb-1">Componentes con problemas:</div>
            <div className="flex flex-wrap gap-1">
              {fallas.map((comp) => (
                <span
                  key={comp.key}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
                >
                  {comp.nombreCompleto}
                </span>
              ))}
              {condicionesEspeciales.map((cond, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}
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
