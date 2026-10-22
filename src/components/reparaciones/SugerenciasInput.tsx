"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { marcaCanonica } from "@/lib/reparaciones/marcas";

/**
 * Campo de texto con sugerencias del historial de la tienda (K3a, 2026-10-21).
 * El empleado puede escribir libremente; las sugerencias solo ayudan a escribir menos y a
 * repetir exactamente lo ya usado ("Samsung", "Galaxy A54", "Pantalla"…).
 */
interface Props {
  value: string;
  onChange: (valor: string) => void;
  campo: "marca" | "modelo" | "problema" | "pieza";
  /** Para el campo modelo: solo modelos de esta marca */
  marca?: string;
  /** Super admin: tienda de la que salen las sugerencias */
  distribuidorId?: string;
  multiline?: boolean;
  rows?: number;
  name?: string;
  placeholder?: string;
  required?: boolean;
  style?: CSSProperties;
  autoFocus?: boolean;
}

interface Sugerencia {
  texto: string;
  veces: number;
}

export function SugerenciasInput({
  value,
  onChange,
  campo,
  marca,
  distribuidorId,
  multiline = false,
  rows = 3,
  name,
  placeholder,
  required,
  style,
  autoFocus,
}: Props) {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaConsulta = useRef(0);

  function consultar(texto: string) {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      const id = ++ultimaConsulta.current;
      try {
        const params = new URLSearchParams({ campo, q: texto });
        if (marca) params.set("marca", marca);
        if (distribuidorId) params.set("distribuidorId", distribuidorId);
        const res = await fetch(`/api/reparaciones/sugerencias?${params.toString()}`);
        const json = await res.json();
        if (id !== ultimaConsulta.current) return; // llegó una respuesta más nueva
        if (json.success) {
          setSugerencias(json.data as Sugerencia[]);
          setActivo(-1);
        }
      } catch {
        // sin sugerencias; el campo sigue funcionando
      }
    }, 150);
  }

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  function elegir(texto: string) {
    onChange(texto);
    setAbierto(false);
    setSugerencias([]);
  }

  function alCambiar(texto: string) {
    onChange(texto);
    setAbierto(true);
    consultar(texto);
  }

  function alSalir() {
    // Marca: "ip", "iphone" o "apple" se guardan como "Apple"
    if (campo === "marca") {
      const canonica = marcaCanonica(value);
      if (canonica && canonica !== value) onChange(canonica);
    }
  }

  function alTeclear(e: React.KeyboardEvent) {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter" && activo >= 0) {
      e.preventDefault();
      elegir(sugerencias[activo].texto);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const propsComunes = {
    name,
    value,
    placeholder,
    required,
    autoFocus,
    autoComplete: "off",
    style,
    onFocus: () => {
      setAbierto(true);
      consultar(value);
    },
    onBlur: alSalir,
    onKeyDown: alTeclear,
  };

  return (
    <div ref={contenedor} style={{ position: "relative", width: "100%" }}>
      {multiline ? (
        <textarea
          {...propsComunes}
          rows={rows}
          onChange={(e) => alCambiar(e.target.value)}
        />
      ) : (
        <input type="text" {...propsComunes} onChange={(e) => alCambiar(e.target.value)} />
      )}

      {abierto && sugerencias.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 60,
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 4,
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            boxShadow: "var(--shadow-md)",
            padding: 4,
            listStyle: "none",
          }}
        >
          {sugerencias.map((s, i) => (
            <li
              key={s.texto}
              role="option"
              aria-selected={i === activo}
              onMouseDown={(e) => {
                e.preventDefault(); // evita que el campo pierda el foco antes de elegir
                elegir(s.texto);
              }}
              onMouseEnter={() => setActivo(i)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 10px",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                cursor: "pointer",
                background: i === activo ? "var(--color-bg-elevated)" : "transparent",
                color: "var(--color-text-primary)",
              }}
            >
              <span>{s.texto}</span>
              {s.veces > 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{s.veces}×</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
