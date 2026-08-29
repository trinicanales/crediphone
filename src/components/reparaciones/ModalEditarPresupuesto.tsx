"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OrdenReparacionDetallada, PiezaCotizacion } from "@/types";
import { AlertCircle, MessageCircle } from "lucide-react";
import { generarMensajePresupuesto, generarLinkWhatsApp } from "@/lib/whatsapp-reparaciones";
import { SelectorPiezasCotizacion } from "./presupuesto/SelectorPiezasCotizacion";

interface ModalEditarPresupuestoProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenReparacionDetallada;
  onSuccess: () => void;
}

/** Convierte piezasCotizacion en filas editables. Si no hay, retorna vacío. */
function initPiezas(orden: OrdenReparacionDetallada): PiezaCotizacion[] {
  if (orden.piezasCotizacion && orden.piezasCotizacion.length > 0) {
    return orden.piezasCotizacion.map((p) => ({ ...p }));
  }
  return [];
}

export function ModalEditarPresupuesto({
  isOpen,
  onClose,
  orden,
  onSuccess,
}: ModalEditarPresupuestoProps) {
  const [precioManoObra, setPrecioManoObra] = useState(orden.costoReparacion || 0);
  const [piezas, setPiezas] = useState<PiezaCotizacion[]>(() => initPiezas(orden));
  const [anticipoTotal, setAnticipoTotal] = useState(0);
  const [loadingAnticipos, setLoadingAnticipos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedTotal, setSavedTotal] = useState<number | null>(null);
  const [showWA, setShowWA] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrecioManoObra(orden.costoReparacion || 0);
      setPiezas(initPiezas(orden));
      setSavedTotal(null);
      setShowWA(false);
      setErrors({});
      fetchAnticipos();
    }
  }, [isOpen, orden]);

  async function fetchAnticipos() {
    try {
      setLoadingAnticipos(true);
      const res = await fetch(`/api/reparaciones/${orden.id}/anticipos`);
      const result = await res.json();
      if (result.success) {
        const total = (result.data || []).reduce((s: number, a: { monto: number }) => s + a.monto, 0);
        setAnticipoTotal(total);
      }
    } catch {
      setAnticipoTotal(0);
    } finally {
      setLoadingAnticipos(false);
    }
  }

  // Cálculos
  const totalPiezas = piezas.reduce((s, p) => s + p.precioTotal, 0);
  const totalGeneral = precioManoObra + totalPiezas;
  const saldoPendiente = totalGeneral - anticipoTotal;

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (precioManoObra < 0) errs.manoObra = "No puede ser negativo";
    if (totalGeneral < anticipoTotal) {
      errs.total = `Total (${fmt(totalGeneral)}) no puede ser menor que anticipos pagados (${fmt(anticipoTotal)})`;
    }
    return errs;
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

      const totalAntes = orden.costoTotal || 0;

      const payload: { precioManoObra: number; piezasCotizacion?: PiezaCotizacion[] } = {
        precioManoObra,
      };

      if (piezas.length > 0) {
        payload.piezasCotizacion = piezas;
      }

      const res = await fetch(`/api/reparaciones/${orden.id}/presupuesto`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Error al actualizar");

      setSavedTotal(totalGeneral);

      // Si el cliente ya aprobó y el total cambió → ofrecer WA
      if (orden.aprobadoPorCliente && Math.abs(totalGeneral - totalAntes) > 0.01) {
        setShowWA(true);
      } else {
        onSuccess();
        onClose();
      }
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : "Error al actualizar presupuesto",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleEnviarWA() {
    if (!orden.clienteTelefono) return;
    const mensaje = generarMensajePresupuesto(orden);
    const link = generarLinkWhatsApp(orden.clienteTelefono, mensaje);
    window.open(link, "_blank");
    onSuccess();
    onClose();
  }

  // Pantalla post-guardado con opción WA
  if (showWA) {
    return (
      <Modal isOpen={isOpen} onClose={() => { onSuccess(); onClose(); }} title="Presupuesto Actualizado" size="md">
        <div className="space-y-6">
          <div className="rounded-lg p-4" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-warning-text)" }}>
                  El cliente ya había aprobado este presupuesto
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--color-warning-text)" }}>
                  El total cambió a <strong>{savedTotal !== null ? fmt(savedTotal) : ""}</strong>. ¿Deseas notificar al cliente por WhatsApp?
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { onSuccess(); onClose(); }}
              className="flex-1"
            >
              No, cerrar
            </Button>
            {orden.clienteTelefono && (
              <Button
                type="button"
                variant="primary"
                onClick={handleEnviarWA}
                className="flex-1"
                style={{ background: "#25D366", color: "#fff" }}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Notificar por WhatsApp
              </Button>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Presupuesto — ${orden.folio}`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mano de obra */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
            Precio de Mano de Obra
          </label>
          <Input
            type="number"
            value={precioManoObra}
            onChange={(e) => setPrecioManoObra(Number(e.target.value))}
            placeholder="0.00"
            min="0"
            step="0.01"
            error={errors.manoObra}
          />
        </div>

        {/* Piezas cotizadas — mismo buscador de inventario que en la creación de la orden */}
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
          <SelectorPiezasCotizacion
            piezas={piezas}
            onChange={setPiezas}
            marcaDispositivo={orden.marcaDispositivo}
            modeloDispositivo={orden.modeloDispositivo}
          />
        </div>

        {/* Resumen */}
        <div className="rounded-lg p-4 space-y-2" style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)" }}>
          <h3 className="font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Resumen</h3>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--color-text-secondary)" }}>Mano de obra:</span>
            <span className="font-medium font-mono" style={{ color: "var(--color-text-primary)" }}>{fmt(precioManoObra)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--color-text-secondary)" }}>Piezas ({piezas.length}):</span>
            <span className="font-medium font-mono" style={{ color: "var(--color-text-primary)" }}>{fmt(totalPiezas)}</span>
          </div>
          <div className="pt-2 mt-2 flex justify-between text-base font-semibold" style={{ borderTop: "1px solid var(--color-accent)" }}>
            <span style={{ color: "var(--color-text-primary)" }}>Total al cliente:</span>
            <span className="font-mono" style={{ color: "var(--color-accent)" }}>{fmt(totalGeneral)}</span>
          </div>
          {!loadingAnticipos && anticipoTotal > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-secondary)" }}>Anticipos:</span>
                <span className="font-medium font-mono" style={{ color: "var(--color-success)" }}>-{fmt(anticipoTotal)}</span>
              </div>
              <div className="pt-2 mt-2 flex justify-between text-base font-semibold" style={{ borderTop: "1px solid var(--color-accent)" }}>
                <span style={{ color: "var(--color-text-primary)" }}>Saldo pendiente:</span>
                <span className="font-mono" style={{ color: saldoPendiente > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                  {fmt(saldoPendiente)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Advertencia aprobado */}
        {orden.aprobadoPorCliente && (
          <div className="rounded-lg p-4" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
              <p className="text-sm" style={{ color: "var(--color-warning-text)" }}>
                Este presupuesto ya fue aprobado por el cliente. Al guardar, se te ofrecerá notificarlo si el total cambió.
              </p>
            </div>
          </div>
        )}

        {errors.total && (
          <div className="rounded-lg p-3" style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}>
            <p className="text-sm" style={{ color: "var(--color-danger-text)" }}>{errors.total}</p>
          </div>
        )}
        {errors.submit && (
          <div className="rounded-lg p-3" style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}>
            <p className="text-sm" style={{ color: "var(--color-danger-text)" }}>{errors.submit}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting} className="flex-1">
            {submitting ? "Guardando..." : "Guardar Presupuesto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
