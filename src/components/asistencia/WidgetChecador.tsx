"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { LogIn, LogOut, Clock, Loader2 } from "lucide-react";
import type { AsistenciaSesion } from "@/types";

/** Formatea minutos como "Xh Ym" o "Zm" */
function formatDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos}m`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Minutos transcurridos desde una fecha hasta ahora */
function minutosDesde(fecha: Date): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
}

// ─── Modal de confirmación ────────────────────────────────────────────────────
function ModalConfirmar({
  isOpen,
  onClose,
  titulo,
  descripcion,
  colorBoton,
  etiquetaBoton,
  icono: Icono,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  descripcion: string;
  colorBoton: string;
  etiquetaBoton: string;
  icono: typeof LogIn;
  onConfirm: (notas: string) => Promise<void>;
}) {
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(notas);
      setNotas("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} size="sm">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{descripcion}</p>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Ej: Llegué tarde por tráfico..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: colorBoton, color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icono className="w-4 h-4" />}
            {submitting ? "Procesando..." : etiquetaBoton}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Widget principal ─────────────────────────────────────────────────────────
export function WidgetChecador() {
  const [sesion, setSesion] = useState<AsistenciaSesion | null>(null);
  const [loading, setLoading] = useState(true);
  const [minutosActivos, setMinutosActivos] = useState(0);
  const [modalCheckin, setModalCheckin] = useState(false);
  const [modalCheckout, setModalCheckout] = useState(false);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carga la sesión activa del usuario
  const cargarSesion = useCallback(async () => {
    try {
      const res = await fetch("/api/asistencia/activa");
      const data = await res.json();
      if (data.success) {
        setSesion(data.data);
        if (data.data) {
          setMinutosActivos(minutosDesde(data.data.fechaEntrada));
        }
      }
    } catch (e) {
      console.error("Error cargando sesión de asistencia:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarSesion();
  }, [cargarSesion]);

  // Actualizar el contador de tiempo cada 60 segundos si hay sesión activa
  useEffect(() => {
    if (sesion) {
      intervaloRef.current = setInterval(() => {
        setMinutosActivos(minutosDesde(sesion.fechaEntrada));
      }, 60000);
    }
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [sesion]);

  // ─── CHECK-IN ───────────────────────────────────────────────────────────────
  async function handleCheckin(notas: string) {
    const res = await fetch("/api/asistencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas: notas || undefined }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error al registrar entrada");
    setSesion(data.data);
    setMinutosActivos(0);
  }

  // ─── CHECK-OUT ──────────────────────────────────────────────────────────────
  async function handleCheckout(notas: string) {
    const res = await fetch("/api/asistencia/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas: notas || undefined }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error al registrar salida");
    setSesion(null);
    setMinutosActivos(0);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: "var(--color-sidebar-surface)", opacity: 0.6 }}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-sidebar-text-dim)" }} />
        <span className="text-xs" style={{ color: "var(--color-sidebar-text-dim)" }}>Cargando...</span>
      </div>
    );
  }

  // ─── Sin turno activo ───────────────────────────────────────────────────────
  if (!sesion) {
    return (
      <>
        <button
          onClick={() => setModalCheckin(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: "var(--color-success-bg)",
            color: "var(--color-success-text)",
            border: "1px solid var(--color-success)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          <LogIn className="w-3.5 h-3.5 shrink-0" />
          <span>Registrar Entrada</span>
        </button>

        <ModalConfirmar
          isOpen={modalCheckin}
          onClose={() => setModalCheckin(false)}
          titulo="Registrar Entrada"
          descripcion="¿Confirmás que estás iniciando tu turno ahora?"
          colorBoton="var(--color-success)"
          etiquetaBoton="Confirmar Entrada"
          icono={LogIn}
          onConfirm={handleCheckin}
        />
      </>
    );
  }

  // ─── Con turno activo ───────────────────────────────────────────────────────
  const horaEntrada = new Date(sesion.fechaEntrada).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--color-sidebar-surface)", border: "1px solid var(--color-sidebar-border)" }}
      >
        {/* Encabezado */}
        <div className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
        >
          <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: "var(--color-success)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--color-success)" }}>EN TURNO</span>
        </div>

        {/* Info del turno */}
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs" style={{ color: "var(--color-sidebar-text-dim)" }}>Desde las {horaEntrada}</p>
            <p className="text-sm font-bold" style={{ color: "var(--color-sidebar-text)", fontFamily: "var(--font-data)" }}>
              <Clock className="w-3.5 h-3.5 inline mr-1" style={{ color: "var(--color-sidebar-text-dim)" }} />
              {formatDuracion(minutosActivos)}
            </p>
          </div>
          <button
            onClick={() => setModalCheckout(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: "var(--color-danger-bg)",
              color: "var(--color-danger-text)",
              border: "1px solid var(--color-danger)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <LogOut className="w-3 h-3" />
            Salida
          </button>
        </div>
      </div>

      <ModalConfirmar
        isOpen={modalCheckout}
        onClose={() => setModalCheckout(false)}
        titulo="Registrar Salida"
        descripcion={`Tu turno comenzó a las ${horaEntrada}. Tiempo trabajado: ${formatDuracion(minutosActivos)}`}
        colorBoton="var(--color-danger)"
        etiquetaBoton="Confirmar Salida"
        icono={LogOut}
        onConfirm={handleCheckout}
      />
    </>
  );
}
