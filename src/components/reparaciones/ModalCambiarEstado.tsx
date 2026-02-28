"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EstadoBadge } from "@/components/reparaciones/EstadoBadge";
import type { EstadoOrdenReparacion } from "@/types";
import { ArrowRight, AlertCircle } from "lucide-react";

interface ModalCambiarEstadoProps {
  isOpen: boolean;
  onClose: () => void;
  ordenId: string;
  folio: string;
  estadoActual: EstadoOrdenReparacion;
  onSuccess: () => void;
}

// Transiciones válidas según el estado actual
const transicionesValidas: Record<EstadoOrdenReparacion, EstadoOrdenReparacion[]> = {
  recibido: ["diagnostico"],
  diagnostico: ["presupuesto", "aprobado"],
  presupuesto: ["aprobado", "cancelado"],
  aprobado: ["en_reparacion"],
  en_reparacion: ["completado", "no_reparable"],
  completado: ["listo_entrega"],
  listo_entrega: ["entregado"],
  entregado: [],
  no_reparable: [],
  cancelado: [],
};

const estadosLabels: Record<EstadoOrdenReparacion, string> = {
  recibido: "Recibido",
  diagnostico: "En Diagnóstico",
  presupuesto: "Presupuesto Pendiente",
  aprobado: "Aprobado",
  en_reparacion: "En Reparación",
  completado: "Completado",
  listo_entrega: "Listo para Entrega",
  entregado: "Entregado",
  no_reparable: "No Reparable",
  cancelado: "Cancelado",
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
}: ModalCambiarEstadoProps) {
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOrdenReparacion | "">("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const estadosDisponibles = transicionesValidas[estadoActual] || [];

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

      onSuccess();
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
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cambiar Estado de Orden" size="md">
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
    </Modal>
  );
}
