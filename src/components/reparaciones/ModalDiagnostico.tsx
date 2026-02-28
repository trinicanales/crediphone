"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EnvioPresupuesto } from "./EnvioPresupuesto";
import type { ParteReemplazada, OrdenReparacionDetallada } from "@/types";

interface ModalDiagnosticoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ordenId: string;
  ordenFolio: string;
  dispositivo: string;
  orden?: OrdenReparacionDetallada; // Orden completa (opcional, para EnvioPresupuesto)
}

export function ModalDiagnostico({
  isOpen,
  onClose,
  onSuccess,
  ordenId,
  ordenFolio,
  dispositivo,
  orden,
}: ModalDiagnosticoProps) {
  const [submitting, setSubmitting] = useState(false);
  const [diagnosticoGuardado, setDiagnosticoGuardado] = useState(false);
  const [ordenActualizada, setOrdenActualizada] = useState<OrdenReparacionDetallada | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    diagnosticoTecnico: "",
    costoReparacion: 0,
    costoPartes: 0,
    fechaEstimadaEntrega: "",
    notasTecnico: "",
    requiereAprobacion: true,
  });

  const [partes, setPartes] = useState<ParteReemplazada[]>([
    { parte: "", costo: 0, cantidad: 1 },
  ]);

  // Calcular costo total de partes
  const costoTotalPartes = partes.reduce(
    (sum, parte) => sum + parte.costo * parte.cantidad,
    0
  );

  // Calcular costo total
  const costoTotal = formData.costoReparacion + costoTotalPartes;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === "number") {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }

  function handleParteChange(
    index: number,
    field: keyof ParteReemplazada,
    value: string | number
  ) {
    const newPartes = [...partes];
    if (field === "costo" || field === "cantidad") {
      newPartes[index][field] = parseFloat(value as string) || 0;
    } else {
      newPartes[index][field] = value as string;
    }
    setPartes(newPartes);
  }

  function agregarParte() {
    setPartes([...partes, { parte: "", costo: 0, cantidad: 1 }]);
  }

  function eliminarParte(index: number) {
    if (partes.length > 1) {
      setPartes(partes.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validaciones
    if (!formData.diagnosticoTecnico.trim()) {
      alert("Por favor ingresa el diagnóstico técnico");
      return;
    }

    // Validar que las partes tengan datos completos
    const partesValidas = partes.filter(
      (p) => p.parte.trim() !== "" && p.costo > 0
    );

    try {
      setSubmitting(true);

      // Actualizar costo de partes automáticamente
      const payload = {
        diagnostico: {
          ...formData,
          costoPartes: costoTotalPartes,
          partesReemplazadas: partesValidas,
        },
      };

      const response = await fetch(`/api/reparaciones/${ordenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        const nuevoEstado = formData.requiereAprobacion
          ? "presupuesto"
          : "aprobado";

        // Si requiere aprobación, mostrar componente de envío
        if (formData.requiereAprobacion) {
          // Cargar orden actualizada para EnvioPresupuesto
          const ordenResponse = await fetch(`/api/reparaciones/${ordenId}`);
          const ordenData = await ordenResponse.json();

          if (ordenData.success) {
            setOrdenActualizada(ordenData.data);
            setDiagnosticoGuardado(true);
            alert(
              `✓ Diagnóstico actualizado exitosamente!\nEstado: ${nuevoEstado}\nCosto total: $${costoTotal.toFixed(2)}\n\nAhora puedes enviar el presupuesto al cliente por WhatsApp.`
            );
          }
        } else {
          // Si no requiere aprobación, cerrar normalmente
          alert(
            `✓ Diagnóstico actualizado exitosamente!\nEstado: ${nuevoEstado}\nCosto total: $${costoTotal.toFixed(2)}`
          );
          onSuccess();
          onClose();
          resetForm();
        }
      } else {
        alert(`Error: ${data.message || "No se pudo actualizar el diagnóstico"}`);
      }
    } catch (error) {
      console.error("Error al actualizar diagnóstico:", error);
      alert("Error al actualizar el diagnóstico");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({
      diagnosticoTecnico: "",
      costoReparacion: 0,
      costoPartes: 0,
      fechaEstimadaEntrega: "",
      notasTecnico: "",
      requiereAprobacion: true,
    });
    setPartes([{ parte: "", costo: 0, cantidad: 1 }]);
    setDiagnosticoGuardado(false);
    setOrdenActualizada(null);
  }

  function handleCerrarDespuesDeEnvio() {
    onSuccess();
    onClose();
    resetForm();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Diagnóstico - ${ordenFolio}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información de la orden */}
        <div className="rounded-lg p-4" style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)" }}>
          <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
            <strong>Dispositivo:</strong> {dispositivo}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-primary)" }}>
            <strong>Folio:</strong> {ordenFolio}
          </p>
        </div>

        {/* Diagnóstico Técnico */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Diagnóstico Técnico <span style={{ color: "var(--color-danger)" }}>*</span>
          </label>
          <textarea
            name="diagnosticoTecnico"
            value={formData.diagnosticoTecnico}
            onChange={handleChange}
            required
            rows={4}
            placeholder="Describe detalladamente el problema encontrado y la solución propuesta"
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
          />
        </div>

        {/* Costo de Mano de Obra */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Costo de Mano de Obra
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2" style={{ color: "var(--color-text-muted)" }}>$</span>
            <input
              type="number"
              name="costoReparacion"
              value={formData.costoReparacion}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-2 rounded-lg focus:outline-none"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
            />
          </div>
        </div>

        {/* Lista de Partes */}
        <div className="pt-4" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
              🔧 Partes a Reemplazar
            </h3>
            <Button
              type="button"
              variant="secondary"
              onClick={agregarParte}
              className="text-sm"
            >
              + Agregar Parte
            </Button>
          </div>

          <div className="space-y-3">
            {partes.map((parte, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {/* Nombre de la parte */}
                <div className="col-span-5">
                  <input
                    type="text"
                    value={parte.parte}
                    onChange={(e) =>
                      handleParteChange(index, "parte", e.target.value)
                    }
                    placeholder="Ej: Pantalla LCD, Batería"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                  />
                </div>

                {/* Costo unitario */}
                <div className="col-span-3">
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                      $
                    </span>
                    <input
                      type="number"
                      value={parte.costo}
                      onChange={(e) =>
                        handleParteChange(index, "costo", e.target.value)
                      }
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>

                {/* Cantidad */}
                <div className="col-span-2">
                  <input
                    type="number"
                    value={parte.cantidad}
                    onChange={(e) =>
                      handleParteChange(index, "cantidad", e.target.value)
                    }
                    min="1"
                    placeholder="1"
                    className="w-full px-2 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
                  />
                </div>

                {/* Subtotal y botón eliminar */}
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    ${(parte.costo * parte.cantidad).toFixed(2)}
                  </span>
                  {partes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarParte(index)}
                      className="ml-2"
                      style={{ color: "var(--color-danger)" }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total de partes */}
          <div className="mt-3 flex justify-end">
            <div className="px-4 py-2 rounded-lg" style={{ background: "var(--color-accent-light)" }}>
              <span className="text-sm" style={{ color: "var(--color-accent)" }}>Total partes: </span>
              <span className="text-lg font-bold" style={{ color: "var(--color-accent)" }}>
                ${costoTotalPartes.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Fecha Estimada */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Fecha Estimada de Entrega
          </label>
          <input
            type="date"
            name="fechaEstimadaEntrega"
            value={formData.fechaEstimadaEntrega}
            onChange={handleChange}
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
          />
        </div>

        {/* Notas del Técnico */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Notas del Técnico (Internas)
          </label>
          <textarea
            name="notasTecnico"
            value={formData.notasTecnico}
            onChange={handleChange}
            rows={2}
            placeholder="Observaciones adicionales, recomendaciones, etc."
            className="w-full px-4 py-2 rounded-lg focus:outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }}
          />
        </div>

        {/* Requiere Aprobación */}
        <div className="rounded-lg p-4" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              name="requiereAprobacion"
              checked={formData.requiereAprobacion}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded"
            />
            <div className="ml-3">
              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Requiere aprobación del cliente
              </span>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                {formData.requiereAprobacion ? (
                  <>
                    El presupuesto será enviado al cliente para aprobación
                    (estado: <strong>presupuesto</strong>)
                  </>
                ) : (
                  <>
                    La reparación se aprobará automáticamente (estado:{" "}
                    <strong>aprobado</strong>)
                  </>
                )}
              </p>
            </div>
          </label>
        </div>

        {/* Resumen de Costos */}
        <div className="rounded-lg p-4" style={{ background: "var(--color-accent-light)", border: "2px solid var(--color-accent)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            💰 Resumen de Costos
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "var(--color-text-secondary)" }}>Mano de obra:</span>
              <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                ${formData.costoReparacion.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--color-text-secondary)" }}>Partes:</span>
              <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>${costoTotalPartes.toFixed(2)}</span>
            </div>
            <div className="pt-2 flex justify-between" style={{ borderTop: "2px solid var(--color-accent)" }}>
              <span className="font-bold" style={{ color: "var(--color-text-primary)" }}>TOTAL:</span>
              <span className="font-bold text-2xl" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${costoTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Botones */}
        {!diagnosticoGuardado && (
          <div className="flex gap-3 pt-4" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
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
              {submitting ? "Guardando..." : "Guardar Diagnóstico"}
            </Button>
          </div>
        )}

        {/* Sección de Envío de Presupuesto (solo si requiere aprobación) */}
        {diagnosticoGuardado && ordenActualizada && (
          <div className="pt-6 mt-6" style={{ borderTop: "2px solid var(--color-success)" }}>
            <div className="mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                <span>📱</span>
                <span>Enviar Presupuesto al Cliente</span>
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                El diagnóstico se guardó exitosamente. Ahora puedes enviar el
                presupuesto al cliente por WhatsApp.
              </p>
            </div>

            <EnvioPresupuesto
              orden={ordenActualizada}
              onEnviado={handleCerrarDespuesDeEnvio}
            />

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCerrarDespuesDeEnvio}
              >
                Cerrar sin Enviar
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
