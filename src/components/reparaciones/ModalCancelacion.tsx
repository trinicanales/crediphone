"use client";

import { useState, useEffect } from "react";
import { XCircle, Package, Wallet, AlertTriangle, Loader2 } from "lucide-react";
import type { AnticipoReparacion, PiezaReparacion } from "@/types";

interface ModalCancelacionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  folio: string;
  ordenId: string;
  /** Opcional: si no se pasan, el modal los carga internamente */
  anticipos?: AnticipoReparacion[];
  piezas?: PiezaReparacion[];
}

const formatMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);

export function ModalCancelacion({
  isOpen,
  onClose,
  onConfirm,
  folio,
  ordenId,
  anticipos: anticiposProp,
  piezas: piezasProp,
}: ModalCancelacionProps) {
  const [motivo, setMotivo] = useState("");
  const [devolverAnticipos, setDevolverAnticipos] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos cargados internamente si no vienen como prop
  const [anticiposCargados, setAnticiposCargados] = useState<AnticipoReparacion[]>([]);
  const [piezasCargadas, setPiezasCargadas] = useState<PiezaReparacion[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // Si no vienen props, cargamos al abrir
  useEffect(() => {
    if (!isOpen) return;
    if (anticiposProp !== undefined && piezasProp !== undefined) {
      setAnticiposCargados(anticiposProp);
      setPiezasCargadas(piezasProp);
      return;
    }
    const fetchDatos = async () => {
      setCargandoDatos(true);
      try {
        const [resAnt, resPiezas] = await Promise.all([
          fetch(`/api/reparaciones/${ordenId}/anticipos`),
          fetch(`/api/reparaciones/${ordenId}/piezas`),
        ]);
        const dataAnt = await resAnt.json();
        const dataPiezas = await resPiezas.json();
        if (dataAnt.success) setAnticiposCargados(dataAnt.data ?? []);
        if (dataPiezas.success) setPiezasCargadas(dataPiezas.data ?? []);
      } catch {
        // No bloqueamos el modal si falla la carga
      } finally {
        setCargandoDatos(false);
      }
    };
    fetchDatos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ordenId]);

  const anticipos = anticiposProp ?? anticiposCargados;
  const piezas = piezasProp ?? piezasCargadas;

  const anticiposPendientes = anticipos.filter((a) => a.estado === "pendiente");
  const totalAnticipos = anticiposPendientes.reduce((s, a) => s + a.monto, 0);
  const hayPiezas = piezas.length > 0;
  const hayAnticipos = anticiposPendientes.length > 0;

  const handleConfirmar = async () => {
    if (!motivo.trim()) {
      setError("Escribe el motivo de cancelación");
      return;
    }
    setError(null);
    setCargando(true);

    try {
      const res = await fetch(`/api/reparaciones/${ordenId}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: motivo.trim(),
          devolverAnticipos,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || data.message || "Error al cancelar");
        return;
      }

      onConfirm();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && !cargando && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-bg-surface)",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--color-danger)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: "var(--color-danger-bg)", borderBottom: "1px solid var(--color-danger)" }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-danger-bg)", border: "2px solid var(--color-danger)" }}
          >
            <XCircle className="w-5 h-5" style={{ color: "var(--color-danger)" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--color-danger-text)" }}>
              Cancelar Orden {folio}
            </h2>
            <p className="text-xs" style={{ color: "var(--color-danger)" }}>
              Esta acción no se puede deshacer
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-4">
          {/* Skeleton mientras cargan los datos */}
          {cargandoDatos && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 rounded-lg w-1/3" style={{ background: "var(--color-bg-elevated)" }} />
              <div className="h-12 rounded-xl" style={{ background: "var(--color-bg-elevated)" }} />
            </div>
          )}

          {/* Resumen de impacto */}
          {(hayPiezas || hayAnticipos) && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-xs font-bold" style={{ color: "var(--color-text-secondary)" }}>
                Al cancelar esta orden:
              </p>

              {/* Piezas */}
              {hayPiezas && (
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "var(--color-success-bg)" }}
                  >
                    <Package className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {piezas.length} pieza{piezas.length !== 1 ? "s" : ""} regresan al inventario
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {piezas.slice(0, 4).map((p) => (
                        <li
                          key={p.id}
                          className="text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          • {p.nombrePieza} ×{p.cantidad}
                        </li>
                      ))}
                      {piezas.length > 4 && (
                        <li className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          • …y {piezas.length - 4} más
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Anticipos */}
              {hayAnticipos && (
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "var(--color-warning-bg)" }}
                  >
                    <Wallet className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {anticiposPendientes.length} anticipo{anticiposPendientes.length !== 1 ? "s" : ""} pendiente{anticiposPendientes.length !== 1 ? "s" : ""} —{" "}
                      <span style={{ fontFamily: "var(--font-data)", color: "var(--color-warning-text)" }}>
                        {formatMXN(totalAnticipos)}
                      </span>
                    </p>

                    {/* Toggle devolver anticipo */}
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <div
                        className="relative w-9 h-5 rounded-full transition-colors"
                        style={{
                          background: devolverAnticipos
                            ? "var(--color-success)"
                            : "var(--color-bg-sunken)",
                          border: "1px solid var(--color-border)",
                        }}
                        onClick={() => setDevolverAnticipos(!devolverAnticipos)}
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                          style={{
                            left: devolverAnticipos ? "calc(100% - 18px)" : "2px",
                            background: "white",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                        {devolverAnticipos
                          ? `Marcar ${formatMXN(totalAnticipos)} como devuelto al cliente`
                          : "No registrar devolución de anticipo"}
                      </span>
                    </label>

                    {devolverAnticipos && (
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        Se marcarán como &ldquo;devuelto&rdquo; en el historial. Asegúrate de entregar el efectivo al cliente.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Motivo */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: "var(--color-text-primary)" }}
            >
              Motivo de cancelación <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ej: Cliente canceló la reparación, equipo no tiene solución, falta de piezas..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
              style={{
                border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
                background: "var(--color-bg-sunken)",
                color: "var(--color-text-primary)",
              }}
            />
            {error && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--color-danger)" }}>
                <AlertTriangle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>

          {/* Aviso final */}
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
            style={{
              background: "var(--color-warning-bg)",
              border: "1px solid var(--color-warning)",
              color: "var(--color-warning-text)",
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
            <span>
              Esta acción cambiará el estado a <strong>Cancelado</strong> y no podrá revertirse desde el sistema.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-secondary)",
              opacity: cargando ? 0.5 : 1,
            }}
          >
            No cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={cargando || !motivo.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{
              background:
                cargando || !motivo.trim()
                  ? "var(--color-bg-elevated)"
                  : "var(--color-danger)",
              color:
                cargando || !motivo.trim() ? "var(--color-text-muted)" : "white",
              cursor: cargando || !motivo.trim() ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Confirmar cancelación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
