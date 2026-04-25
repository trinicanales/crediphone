"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EstadoBadge } from "@/components/reparaciones/EstadoBadge";
import type { EstadoOrdenReparacion } from "@/types";
import { ArrowRight, AlertCircle, Package, PackageSearch } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { encolarOperacion } from "@/lib/offline/queue";

interface ModalCambiarEstadoProps {
  isOpen: boolean;
  onClose: () => void;
  ordenId: string;
  folio: string;
  estadoActual: EstadoOrdenReparacion;
  onSuccess: () => void;
  /** Pre-selecciona un estado destino al abrir el modal (ej: "completado" desde botón rápido) */
  estadoInicial?: EstadoOrdenReparacion;
}

// Transiciones válidas según el estado actual
// cancelado siempre disponible desde estados activos (con confirmación)
const transicionesValidas: Record<EstadoOrdenReparacion, EstadoOrdenReparacion[]> = {
  recibido:          ["diagnostico", "cancelado"],
  diagnostico:       ["esperando_piezas", "presupuesto", "aprobado", "no_reparable", "cancelado"],
  esperando_piezas:  ["en_reparacion", "aprobado", "cancelado"],
  presupuesto:       ["aprobado", "cancelado"],
  aprobado:          ["en_reparacion", "cancelado"],
  en_reparacion:     ["completado", "esperando_piezas", "no_reparable", "cancelado"],
  completado:        ["listo_entrega", "cancelado"],
  listo_entrega:     ["entregado", "cancelado"],
  entregado:         [],
  no_reparable:      [],
  cancelado:         [],
};

const estadosLabels: Record<EstadoOrdenReparacion, string> = {
  recibido:         "Recibido",
  diagnostico:      "En Diagnóstico",
  esperando_piezas: "Esperando Piezas",
  presupuesto:      "Presupuesto Pendiente",
  aprobado:         "Aprobado",
  en_reparacion:    "En Reparación",
  completado:       "Completado",
  listo_entrega:    "Listo para Entrega",
  entregado:        "Entregado",
  no_reparable:     "No Reparable",
  cancelado:        "Cancelado",
};

// Estados que requieren confirmación
const estadosCriticos: EstadoOrdenReparacion[] = ["cancelado", "no_reparable"];

export function ModalCambiarEstado({
  isOpen,
  onClose,
  ordenId,
  folio,
  estadoActual,
  onSuccess,
  estadoInicial,
}: ModalCambiarEstadoProps) {
  const isOnline = useOnlineStatus();
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOrdenReparacion | "">(estadoInicial ?? "");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // Paso post-cambio: piezas pendientes al marcar no_reparable
  const [piezasPendientes, setPiezasPendientes] = useState<{ id: string; nombre: string; estado: string }[]>([]);
  // Paso post-cambio: piezas sin catálogo al cancelar
  const [piezasSinCatalogo, setPiezasSinCatalogo] = useState<{ id: string; nombre: string; costoEstimado: number }[]>([]);
  const [mostrarResolucion, setMostrarResolucion] = useState(false);

  const estadosDisponibles = transicionesValidas[estadoActual] || [];

  // Sincroniza la pre-selección cada vez que el modal se abre con un estadoInicial
  useEffect(() => {
    if (isOpen) {
      setNuevoEstado(estadoInicial ?? "");
      setShowConfirmation(false);
      setError(null);
      setPiezasPendientes([]);
      setPiezasSinCatalogo([]);
      setMostrarResolucion(false);
    }
  }, [isOpen, estadoInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nuevoEstado) {
      setError("Debe seleccionar un nuevo estado");
      return;
    }

    // Si es un estado crítico, mostrar confirmación
    if (estadosCriticos.includes(nuevoEstado) && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    try {
      setLoading(true);

      if (!isOnline) {
        await encolarOperacion({
          tipo: "reparacion_estado",
          payload: { id: ordenId, estado: nuevoEstado, notas: notas || undefined },
        });
        onSuccess();
        handleClose();
        return;
      }

      const response = await fetch(`/api/reparaciones/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: nuevoEstado,
          notas: notas || undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al cambiar estado");
      }

      // Notificar al padre para que refresque la lista
      onSuccess();

      // Si hay piezas que requieren atención, mostrar paso de resolución
      if (result.piezasPendientesResolucion?.length > 0) {
        setPiezasPendientes(result.piezasPendientesResolucion);
        setMostrarResolucion(true);
        return; // No cerrar aún
      }
      if (result.piezasSinCatalogo?.length > 0) {
        setPiezasSinCatalogo(result.piezasSinCatalogo);
        setMostrarResolucion(true);
        return; // No cerrar aún
      }

      handleClose();
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNuevoEstado("");
    setNotas("");
    setError(null);
    setShowConfirmation(false);
    setPiezasPendientes([]);
    setPiezasSinCatalogo([]);
    setMostrarResolucion(false);
    onClose();
  };

  // ── Etiqueta de estado de pieza para el panel de resolución
  const estadoPiezaLabel: Record<string, string> = {
    pendiente: "⏳ Pendiente de envío",
    en_camino: "🚚 En camino",
    recibida: "📦 Recibida — verificar",
    defectuosa: "❌ Defectuosa",
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cambiar Estado de Orden" size="md">

      {/* ── Paso de resolución de piezas (post-cambio) ── */}
      {mostrarResolucion && (
        <div className="space-y-4">
          {piezasPendientes.length > 0 && (
            <>
              <div className="rounded-lg p-4" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
                <div className="flex gap-2 mb-3">
                  <Package className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning-text)" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>
                      La orden se marcó como No Reparable
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)" }}>
                      Hay {piezasPendientes.length} pieza(s) pendientes de resolución. Ve al drawer → tab Piezas para resolverlas.
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {piezasPendientes.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded px-3 py-2" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <span className="text-sm font-medium" style={{ color: "var(--color-warning-text)" }}>{p.nombre}</span>
                      <span className="text-xs" style={{ color: "var(--color-warning-text)" }}>{estadoPiezaLabel[p.estado] ?? p.estado}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Opciones posibles: pasar a inventario (piezas con flujo) o pedir devolución al distribuidor (piezas especiales).
              </p>
            </>
          )}

          {piezasSinCatalogo.length > 0 && (
            <>
              <div className="rounded-lg p-4" style={{ background: "var(--color-info-bg, #e0f2fe)", border: "1px solid var(--color-info, #0ea5e9)" }}>
                <div className="flex gap-2 mb-3">
                  <PackageSearch className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-info, #0369a1)" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-info, #0369a1)" }}>
                      Piezas físicas sin catálogo
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-info, #0369a1)" }}>
                      Estas piezas llegaron pero no tienen producto en inventario. Agrégalas desde Inventario → Productos.
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {piezasSinCatalogo.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded px-3 py-2" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <span className="text-sm font-medium" style={{ color: "var(--color-info, #0369a1)" }}>{p.nombre}</span>
                      {p.costoEstimado > 0 && (
                        <span className="text-xs font-semibold" style={{ color: "var(--color-info, #0369a1)", fontFamily: "var(--font-data)" }}>
                          ${p.costoEstimado.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button variant="primary" onClick={handleClose} className="w-full">
            Entendido — cerrar
          </Button>
        </div>
      )}

      {/* ── Formulario principal ── */}
      {!mostrarResolucion && (
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Orden Info */}
        <div className="p-4 rounded-lg" style={{ background: "var(--color-bg-elevated)" }}>
          <p className="text-sm mb-1" style={{ color: "var(--color-text-secondary)" }}>Orden</p>
          <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{folio}</p>
        </div>

        {/* Estado Actual → Nuevo */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm mb-2" style={{ color: "var(--color-text-secondary)" }}>Estado Actual</p>
            <EstadoBadge estado={estadoActual} />
          </div>

          <ArrowRight className="w-6 h-6 mt-6" style={{ color: "var(--color-text-muted)" }} />

          <div className="flex-1">
            <p className="text-sm mb-2" style={{ color: "var(--color-text-secondary)" }}>Nuevo Estado</p>
            {nuevoEstado && <EstadoBadge estado={nuevoEstado} />}
          </div>
        </div>

        {/* Selector de Estado */}
        {estadosDisponibles.length === 0 ? (
          <div className="rounded-lg p-4" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
            <p className="text-sm" style={{ color: "var(--color-warning-text)" }}>
              No hay transiciones disponibles desde el estado actual.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Seleccionar Nuevo Estado
            </label>
            <select
              value={nuevoEstado}
              onChange={(e) => {
                setNuevoEstado(e.target.value as EstadoOrdenReparacion);
                setShowConfirmation(false);
              }}
              className="w-full px-4 py-2 rounded-lg focus:outline-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
              required
            >
              <option value="">-- Seleccione un estado --</option>
              {estadosDisponibles.map((estado) => (
                <option key={estado} value={estado}>
                  {estadosLabels[estado]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Razón del cambio de estado, observaciones, etc."
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
            rows={3}
          />
        </div>

        {/* Confirmación para estados críticos */}
        {showConfirmation && nuevoEstado && (
          <div className="rounded-lg p-4" style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }} />
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--color-danger-text)" }}>
                  ¿Está seguro de cambiar al estado "{estadosLabels[nuevoEstado as EstadoOrdenReparacion]}"?
                </p>
                <p className="text-sm" style={{ color: "var(--color-danger-text)" }}>
                  Esta acción es irreversible y marcará la orden como finalizada sin completar
                  la reparación.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg p-4" style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}>
            <p className="text-sm" style={{ color: "var(--color-danger-text)" }}>{error}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant={showConfirmation ? "danger" : "primary"}
            disabled={loading || estadosDisponibles.length === 0}
            className="flex-1"
          >
            {loading ? "Procesando..." : showConfirmation ? "Confirmar Cambio" : "Cambiar Estado"}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
