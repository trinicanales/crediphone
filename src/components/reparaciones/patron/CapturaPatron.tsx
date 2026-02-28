"use client";

import { useState, useRef, useEffect } from "react";

interface CapturaPatronProps {
  onPatronCapturado: (patron: { puntos: number[]; codificado: string }) => void;
  patronActual?: string;
}

export function CapturaPatron({
  onPatronCapturado,
  patronActual,
}: CapturaPatronProps) {
  const [puntos, setPuntos] = useState<number[]>([]);
  const [dibujando, setDibujando] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posicionesPuntos] = useState<{ x: number; y: number }[]>([]);

  const FILAS = 3;
  const COLUMNAS = 3;
  const TAMANO_PUNTO = 20;
  const CANVAS_SIZE = 300;
  const ESPACIADO = CANVAS_SIZE / (COLUMNAS + 1);

  // Inicializar posiciones de los puntos
  useEffect(() => {
    const nuevasPosiciones: { x: number; y: number }[] = [];
    for (let fila = 0; fila < FILAS; fila++) {
      for (let col = 0; col < COLUMNAS; col++) {
        nuevasPosiciones.push({
          x: ESPACIADO * (col + 1),
          y: ESPACIADO * (fila + 1),
        });
      }
    }
    posicionesPuntos.length = 0;
    posicionesPuntos.push(...nuevasPosiciones);
  }, []);

  // Dibujar el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpiar canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Dibujar líneas de conexión
    if (puntos.length > 1) {
      ctx.strokeStyle = "#0099B8";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(posicionesPuntos[puntos[0]].x, posicionesPuntos[puntos[0]].y);

      for (let i = 1; i < puntos.length; i++) {
        ctx.lineTo(
          posicionesPuntos[puntos[i]].x,
          posicionesPuntos[puntos[i]].y
        );
      }

      ctx.stroke();
    }

    // Dibujar puntos
    posicionesPuntos.forEach((pos, index) => {
      const seleccionado = puntos.includes(index);
      const orden = puntos.indexOf(index);

      // Círculo exterior
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, TAMANO_PUNTO, 0, 2 * Math.PI);
      ctx.fillStyle = seleccionado ? "#0099B8" : "#DAE5EE";
      ctx.fill();
      ctx.strokeStyle = seleccionado ? "#09244A" : "#5A7A90";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Círculo interior
      if (seleccionado) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TAMANO_PUNTO / 2, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Mostrar orden
        ctx.fillStyle = "#09244A";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((orden + 1).toString(), pos.x, pos.y);
      }
    });
  }, [puntos, posicionesPuntos]);

  const obtenerPuntoMasCercano = (
    x: number,
    y: number
  ): number | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    for (let i = 0; i < posicionesPuntos.length; i++) {
      const pos = posicionesPuntos[i];
      const distancia = Math.sqrt(
        Math.pow(canvasX - pos.x, 2) + Math.pow(canvasY - pos.y, 2)
      );

      if (distancia <= TAMANO_PUNTO * 1.5) {
        return i;
      }
    }

    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDibujando(true);
    const punto = obtenerPuntoMasCercano(e.clientX, e.clientY);
    if (punto !== null && !puntos.includes(punto)) {
      setPuntos([punto]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dibujando) return;

    const punto = obtenerPuntoMasCercano(e.clientX, e.clientY);
    if (punto !== null && !puntos.includes(punto)) {
      setPuntos((prev) => [...prev, punto]);
    }
  };

  const handleMouseUp = () => {
    setDibujando(false);
    if (puntos.length >= 4) {
      setMostrarConfirm(true);
    } else {
      alert("El patrón debe tener al menos 4 puntos");
      limpiar();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    setDibujando(true);
    const punto = obtenerPuntoMasCercano(touch.clientX, touch.clientY);
    if (punto !== null && !puntos.includes(punto)) {
      setPuntos([punto]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!dibujando) return;

    const touch = e.touches[0];
    const punto = obtenerPuntoMasCercano(touch.clientX, touch.clientY);
    if (punto !== null && !puntos.includes(punto)) {
      setPuntos((prev) => [...prev, punto]);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setDibujando(false);
    if (puntos.length >= 4) {
      setMostrarConfirm(true);
    } else {
      alert("El patrón debe tener al menos 4 puntos");
      limpiar();
    }
  };

  const confirmar = () => {
    const codificado = puntos.join("-");
    onPatronCapturado({ puntos, codificado });
    setMostrarConfirm(false);
  };

  const limpiar = () => {
    setPuntos([]);
    setMostrarConfirm(false);
    setDibujando(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
        <span>🔐</span>
        <span>Patrón de Desbloqueo</span>
      </h3>

      <div className="rounded p-2 text-xs" style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}>
        ℹ️ <strong>Dibuja el patrón de desbloqueo del dispositivo.</strong>{" "}
        Conecta al menos 4 puntos arrastrando el mouse o el dedo.
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--color-border)", background: "var(--color-bg-surface)", boxShadow: "var(--shadow-sm)" }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="cursor-pointer"
            style={{ touchAction: "none" }}
          />
        </div>

        {patronActual && (
          <div className="text-xs rounded p-2" style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)", color: "var(--color-success-text)" }}>
            ✓ Patrón guardado: <code className="font-mono">{patronActual}</code>
          </div>
        )}

        {puntos.length > 0 && !mostrarConfirm && (
          <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Puntos seleccionados: {puntos.length} / 9
          </div>
        )}

        {mostrarConfirm && (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <div className="text-xs rounded p-2 w-full" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)", color: "var(--color-warning-text)" }}>
              ⚠️ <strong>Verifica que el patrón sea correcto.</strong> Has
              conectado {puntos.length} puntos.
            </div>
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={limpiar}
                className="flex-1 px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="flex-1 px-4 py-2 text-sm text-white rounded-lg transition-colors"
                style={{ background: "var(--color-accent)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-accent-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--color-accent)")}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}

        {!mostrarConfirm && puntos.length === 0 && (
          <button
            type="button"
            onClick={limpiar}
            className="text-xs hover:underline"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
          >
            Limpiar patrón
          </button>
        )}
      </div>

      <div className="text-xs rounded p-2" style={{ color: "var(--color-text-muted)", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
        <strong>💡 Tip:</strong> El patrón se guarda codificado para seguridad.
        Solo el personal autorizado puede verlo en el sistema.
      </div>
    </div>
  );
}
