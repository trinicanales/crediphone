"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OrdenReparacionDetallada, PrioridadOrden } from "@/types";
import { Loader2 } from "lucide-react";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
}

interface ModalEditarOrdenProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenReparacionDetallada;
  onSuccess: () => void;
}

export function ModalEditarOrden({
  isOpen,
  onClose,
  orden,
  onSuccess,
}: ModalEditarOrdenProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    clienteId: orden.clienteId || "",
    marcaDispositivo: orden.marcaDispositivo || "",
    modeloDispositivo: orden.modeloDispositivo || "",
    imei: orden.imei || "",
    numeroSerie: orden.numeroSerie || "",
    problemaReportado: orden.problemaReportado || "",
    prioridad: orden.prioridad || "normal",
    fechaEstimadaEntrega: orden.fechaEstimadaEntrega
      ? new Date(orden.fechaEstimadaEntrega).toISOString().split("T")[0]
      : "",
    notasInternas: orden.notasInternas || "",
    condicionDispositivo: orden.condicionDispositivo || "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchClientes();
    }
  }, [isOpen]);

  async function fetchClientes() {
    try {
      setLoadingClientes(true);
      const response = await fetch("/api/clientes");
      const data = await response.json();

      if (data.success) {
        setClientes(data.data);
      }
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    } finally {
      setLoadingClientes(false);
    }
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!formData.clienteId) errors.clienteId = "Debe seleccionar un cliente";
    if (!formData.marcaDispositivo)
      errors.marcaDispositivo = "La marca es requerida";
    if (!formData.modeloDispositivo)
      errors.modeloDispositivo = "El modelo es requerido";
    if (!formData.problemaReportado)
      errors.problemaReportado = "El problema reportado es requerido";

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSubmitting(true);
      setErrors({});

      const payload = {
        clienteId: formData.clienteId,
        marcaDispositivo: formData.marcaDispositivo,
        modeloDispositivo: formData.modeloDispositivo,
        imei: formData.imei || null,
        numeroSerie: formData.numeroSerie || null,
        problemaReportado: formData.problemaReportado,
        prioridad: formData.prioridad as PrioridadOrden,
        fechaEstimadaEntrega: formData.fechaEstimadaEntrega
          ? new Date(formData.fechaEstimadaEntrega)
          : null,
        notasInternas: formData.notasInternas || null,
        condicionDispositivo: formData.condicionDispositivo || null,
      };

      const response = await fetch(`/api/reparaciones/${orden.id}/editar-info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al actualizar la orden");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al actualizar orden:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Error al actualizar la orden",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Orden: ${orden.folio}`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Cliente *
          </label>
          {loadingClientes ? (
            <div className="flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando clientes...
            </div>
          ) : (
            <select
              value={formData.clienteId}
              onChange={(e) =>
                setFormData({ ...formData, clienteId: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg focus:outline-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
              required
            >
              <option value="">-- Seleccione un cliente --</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} {cliente.apellido} - {cliente.telefono}
                </option>
              ))}
            </select>
          )}
          {errors.clienteId && (
            <p className="mt-1 text-sm" style={{ color: "var(--color-danger)" }}>{errors.clienteId}</p>
          )}
        </div>

        {/* Información del Dispositivo */}
        <div className="p-4 rounded-lg space-y-4" style={{ background: "var(--color-bg-elevated)" }}>
          <h3 className="font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            Información del Dispositivo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Marca *
              </label>
              <Input
                type="text"
                value={formData.marcaDispositivo}
                onChange={(e) =>
                  setFormData({ ...formData, marcaDispositivo: e.target.value })
                }
                placeholder="Ej: Apple, Samsung, Xiaomi"
                error={errors.marcaDispositivo}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Modelo *
              </label>
              <Input
                type="text"
                value={formData.modeloDispositivo}
                onChange={(e) =>
                  setFormData({ ...formData, modeloDispositivo: e.target.value })
                }
                placeholder="Ej: iPhone 13 Pro, Galaxy S21"
                error={errors.modeloDispositivo}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                IMEI
              </label>
              <Input
                type="text"
                value={formData.imei}
                onChange={(e) =>
                  setFormData({ ...formData, imei: e.target.value })
                }
                placeholder="15 dígitos (opcional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Número de Serie
              </label>
              <Input
                type="text"
                value={formData.numeroSerie}
                onChange={(e) =>
                  setFormData({ ...formData, numeroSerie: e.target.value })
                }
                placeholder="Número de serie (opcional)"
              />
            </div>
          </div>
        </div>

        {/* Problema Reportado */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Problema Reportado *
          </label>
          <textarea
            value={formData.problemaReportado}
            onChange={(e) =>
              setFormData({ ...formData, problemaReportado: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
            rows={4}
            placeholder="Descripción del problema reportado por el cliente"
            required
          />
          {errors.problemaReportado && (
            <p className="mt-1 text-sm" style={{ color: "var(--color-danger)" }}>
              {errors.problemaReportado}
            </p>
          )}
        </div>

        {/* Condición del Dispositivo */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Condición del Dispositivo
          </label>
          <textarea
            value={formData.condicionDispositivo}
            onChange={(e) =>
              setFormData({ ...formData, condicionDispositivo: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
            rows={3}
            placeholder="Estado físico, rayones, golpes, etc."
          />
        </div>

        {/* Prioridad y Fecha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Prioridad
            </label>
            <select
              value={formData.prioridad}
              onChange={(e) =>
                setFormData({ ...formData, prioridad: e.target.value as PrioridadOrden })
              }
              className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
            >
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Fecha Estimada de Entrega
            </label>
            <Input
              type="date"
              value={formData.fechaEstimadaEntrega}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  fechaEstimadaEntrega: e.target.value,
                })
              }
            />
          </div>
        </div>

        {/* Notas Internas */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Notas Internas
          </label>
          <textarea
            value={formData.notasInternas}
            onChange={(e) =>
              setFormData({ ...formData, notasInternas: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
            rows={3}
            placeholder="Notas internas (no visibles para el cliente)"
          />
        </div>

        {/* Campos NO Editables - Info */}
        <div className="rounded-lg p-4" style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)" }}>
          <p className="text-sm font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
            Campos no editables desde este formulario:
          </p>
          <ul className="text-sm space-y-1" style={{ color: "var(--color-text-secondary)" }}>
            <li>• Folio (generado automáticamente)</li>
            <li>• Estado (usar botón "Cambiar Estado")</li>
            <li>• Técnico Asignado (requiere función específica)</li>
            <li>• Diagnóstico y Costos (usar modal de Diagnóstico)</li>
            <li>• Firma del Cliente (inmutable)</li>
          </ul>
        </div>

        {/* Error General */}
        {errors.submit && (
          <div className="rounded-lg p-4" style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}>
            <p className="text-sm" style={{ color: "var(--color-danger-text)" }}>{errors.submit}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
