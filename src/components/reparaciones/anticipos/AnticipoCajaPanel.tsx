"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ModalAgregarAnticipo } from "./ModalAgregarAnticipo";
import { PanelTraspasosPendientes } from "@/components/reparaciones/traspasos/PanelTraspasosPendientes";
import { useAuth } from "@/components/AuthProvider";
import type { AnticipoReparacion, OrdenReparacionDetallada, TipoPago } from "@/types";
import {
  DollarSign, CheckCircle2, Clock, RotateCcw,
  Banknote, ArrowUpRight, AlertTriangle, Package,
  Loader2, CreditCard, Trash2,
} from "lucide-react";

interface AnticipoCajaPanelProps {
  orden: OrdenReparacionDetallada;
  onOrdenUpdated: () => void;
}

const MXN = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pendiente: { label: "Pendiente",  color: "var(--color-warning)",  bg: "var(--color-warning-bg)",  icon: Clock },
  aplicado:  { label: "Aplicado",   color: "var(--color-success)",  bg: "var(--color-success-bg)",  icon: CheckCircle2 },
  devuelto:  { label: "Devuelto",   color: "var(--color-text-muted)", bg: "var(--color-bg-elevated)", icon: RotateCcw },
};

const METODO_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia",
  tarjeta: "Tarjeta", mixto: "Mixto", payjoy: "Payjoy",
};

/* ─── Modal Cobrar y Entregar ──────────────────────────────────────── */
function ModalCobrarEntregar({
  isOpen,
  onClose,
  orden,
  anticipos,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenReparacionDetallada;
  anticipos: AnticipoReparacion[];
  onSuccess: () => void;
}) {
  const [metodoPago, setMetodoPago] = useState<TipoPago>("efectivo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAnticipos = anticipos
    .filter((a) => a.estado === "pendiente")
    .reduce((sum, a) => sum + a.monto, 0);

  const costoTotal = orden.presupuestoTotal || 0;
  const saldo = Math.max(0, costoTotal - totalAnticipos);

  async function handleEntregar() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/entregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodoPago }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || data.message || "Error al procesar entrega");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cobro Final y Entrega del Equipo" size="md">
      <div className="space-y-5">
        {/* Resumen financiero */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-subtle)" }}>
          <div className="px-4 py-3" style={{ background: "var(--color-bg-elevated)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
              Resumen del Servicio — {orden.folio}
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Total reparación</span>
              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                {MXN(costoTotal)}
              </span>
            </div>
            {anticipos.filter((a) => a.estado === "pendiente").map((a) => (
              <div key={a.id} className="flex justify-between px-4 py-3">
                <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Anticipo {new Date(a.fechaAnticipo).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} ({METODO_LABELS[a.tipoPago] || a.tipoPago})
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                  − {MXN(a.monto)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-4" style={{ background: saldo > 0 ? "var(--color-danger-bg)" : "var(--color-success-bg)" }}>
              <span className="text-base font-bold" style={{ color: saldo > 0 ? "var(--color-danger-text)" : "var(--color-success-text)" }}>
                {saldo > 0 ? "SALDO A COBRAR" : "PAGADO COMPLETO"}
              </span>
              <span className="text-xl font-bold" style={{ color: saldo > 0 ? "var(--color-danger)" : "var(--color-success)", fontFamily: "var(--font-data)" }}>
                {MXN(saldo)}
              </span>
            </div>
          </div>
        </div>

        {/* Método de pago del saldo */}
        {saldo > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>
              Método de pago del saldo ({MXN(saldo)})
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as TipoPago)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
        )}

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
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
            onClick={handleEntregar}
            disabled={submitting}
            className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "var(--color-success)", color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? "Procesando..." : "Confirmar Entrega"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Modal Devolver Anticipo ──────────────────────────────────────── */
function ModalDevolverAnticipo({
  isOpen,
  onClose,
  orden,
  totalPendiente,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenReparacionDetallada;
  totalPendiente: number;
  onSuccess: () => void;
}) {
  const [motivo, setMotivo] = useState("Cliente canceló el servicio");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDevolver() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/anticipos/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || data.message);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Devolver Anticipo al Cliente" size="sm">
      <div className="space-y-5">
        <div className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
        >
          <RotateCcw className="w-8 h-8 shrink-0" style={{ color: "var(--color-warning)" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--color-warning-text)" }}>Total a devolver</p>
            <p className="text-2xl font-bold" style={{ color: "var(--color-warning)", fontFamily: "var(--font-data)" }}>{MXN(totalPendiente)}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-primary)" }}>Motivo de devolución</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", outline: "none", resize: "vertical" }}
          />
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}>{error}</div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >Cancelar</button>
          <button type="button" onClick={handleDevolver} disabled={submitting}
            className="flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "var(--color-warning)", color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {submitting ? "Procesando..." : "Registrar Devolución"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Panel principal ──────────────────────────────────────────────── */
export function AnticipoCajaPanel({ orden, onOrdenUpdated }: AnticipoCajaPanelProps) {
  const { user } = useAuth();
  const esTecnico = user?.role === "tecnico";
  const isSuperAdmin = user?.role === "super_admin";

  const [anticipos, setAnticipos] = useState<AnticipoReparacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAgregarOpen, setModalAgregarOpen] = useState(false);
  const [modalEntregarOpen, setModalEntregarOpen] = useState(false);
  const [modalDevolverOpen, setModalDevolverOpen] = useState(false);
  // C9: eliminar anticipo (super_admin)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const cargarAnticipos = useCallback(async () => {
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/anticipos`);
      const data = await res.json();
      if (data.success) setAnticipos(data.data);
    } catch (e) {
      console.error("Error cargando anticipos:", e);
    } finally {
      setLoading(false);
    }
  }, [orden.id]);

  useEffect(() => { cargarAnticipos(); }, [cargarAnticipos]);

  // C9: eliminar anticipo individual (super_admin only)
  const handleEliminarAnticipo = async (anticipoId: string) => {
    if (!window.confirm("¿Eliminar este anticipo? Esta acción revierte el movimiento de caja y no se puede deshacer.")) return;
    setEliminandoId(anticipoId);
    setErrorEliminar(null);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/anticipos/${anticipoId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await cargarAnticipos();
        onOrdenUpdated();
      } else {
        setErrorEliminar(data.error || "No se pudo eliminar el anticipo");
      }
    } catch {
      setErrorEliminar("Error de conexión");
    } finally {
      setEliminandoId(null);
    }
  };

  const totalAnticiposPendientes  = anticipos.filter((a) => a.estado === "pendiente").reduce((s, a) => s + a.monto, 0);
  const totalAnticiposAplicados   = anticipos.filter((a) => a.estado === "aplicado").reduce((s, a) => s + a.monto, 0);
  const totalAnticiposDevueltos   = anticipos.filter((a) => a.estado === "devuelto").reduce((s, a) => s + a.monto, 0);
  // Total a devolver = anticipos pendientes + aplicados (el backend marca ambos como 'devuelto')
  const totalAnticiposDevolvibles = totalAnticiposPendientes + totalAnticiposAplicados;
  const costoTotal = orden.presupuestoTotal || 0;
  const saldoPendiente = Math.max(0, costoTotal - totalAnticiposPendientes);

  const ESTADOS_ENTREGABLES = ["listo_entrega", "completado", "aprobado", "en_reparacion"];
  const puedeCobrarEntregar = ESTADOS_ENTREGABLES.includes(orden.estado) && costoTotal > 0;
  const puedeAgregarAnticipo = !["entregado", "cancelado"].includes(orden.estado);
  // Devolver: disponible siempre que haya anticipos pendientes o aplicados y la orden no esté ya entregada
  const puedeDevolver = totalAnticiposDevolvibles > 0 && orden.estado !== "entregado";

  return (
    <div className="space-y-4">

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total reparación", value: costoTotal, icon: CreditCard, color: "var(--color-accent)" },
          { label: "Anticipos recibidos", value: totalAnticiposPendientes + totalAnticiposAplicados, icon: ArrowUpRight, color: "var(--color-success)" },
          { label: "Saldo pendiente", value: saldoPendiente, icon: DollarSign, color: saldoPendiente > 0 ? "var(--color-warning)" : "var(--color-success)" },
          { label: "Devuelto", value: totalAnticiposDevueltos, icon: RotateCcw, color: "var(--color-text-muted)" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
              <Icon className="w-4 h-4 shrink-0" style={{ color }} />
            </div>
            <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
              {MXN(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Barra de estado pago completo */}
      {saldoPendiente === 0 && costoTotal > 0 && ESTADOS_ENTREGABLES.includes(orden.estado) && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--color-success)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--color-success-text)" }}>
            Servicio pagado completamente con anticipo(s)
          </p>
        </div>
      )}

      {/* Badge informativo: pagado pero equipo aún en diagnóstico/recepción */}
      {saldoPendiente === 0 && costoTotal > 0 && !ESTADOS_ENTREGABLES.includes(orden.estado) && !["entregado", "cancelado"].includes(orden.estado) && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "var(--color-warning)" }} />
          <p className="text-sm" style={{ color: "var(--color-warning)" }}>
            <span className="font-semibold">Servicio pagado</span> — el equipo aún no está listo para entrega. Cuando el técnico cambie el estado a &quot;Listo para entrega&quot;, podrás entregar sin cobrar nada adicional.
          </p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        {puedeAgregarAnticipo && (
          <button
            onClick={() => setModalAgregarOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-text)", border: "none", cursor: "pointer", transition: "all 200ms var(--ease-spring)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-primary-mid)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-primary)")}
          >
            <Banknote className="w-4 h-4" />
            Agregar Anticipo
          </button>
        )}

        {puedeCobrarEntregar && (
          <button
            onClick={() => setModalEntregarOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--color-success)", color: "#fff", border: "none", cursor: "pointer", transition: "all 200ms var(--ease-spring)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <Package className="w-4 h-4" />
            Cobrar y Entregar
          </button>
        )}

        {puedeDevolver && (
          <button
            onClick={() => setModalDevolverOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)", cursor: "pointer", transition: "all 200ms ease" }}
          >
            <RotateCcw className="w-4 h-4" />
            Devolver Anticipo ({MXN(totalAnticiposDevolvibles)})
          </button>
        )}
      </div>

      {/* Lista de anticipos */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            Registro de Anticipos ({anticipos.length})
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2" style={{ color: "var(--color-text-muted)" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando anticipos...</span>
          </div>
        ) : anticipos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ color: "var(--color-text-muted)" }}>
            <DollarSign className="w-10 h-10 opacity-30" />
            <p className="text-sm">No hay anticipos registrados</p>
            {puedeAgregarAnticipo && (
              <button onClick={() => setModalAgregarOpen(true)} className="text-xs underline" style={{ color: "var(--color-accent)" }}>
                Registrar primer anticipo
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            {anticipos.map((a) => {
              const est = ESTADO_LABELS[a.estado] || ESTADO_LABELS.pendiente;
              const EstIcon = est.icon;
              return (
                <div key={a.id} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: est.bg }}>
                      <EstIcon className="w-4 h-4" style={{ color: est.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                        {METODO_LABELS[a.tipoPago] || a.tipoPago}
                        {a.referenciaPago && <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>#{a.referenciaPago}</span>}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {new Date(a.fechaAnticipo).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {a.notas && <p className="text-xs italic truncate" style={{ color: "var(--color-text-muted)" }}>{a.notas}</p>}
                      {a.motivoDevolucion && <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>Motivo: {a.motivoDevolucion}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: est.bg, color: est.color }}>
                      {est.label}
                    </span>
                    <span className="text-base font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                      {MXN(a.monto)}
                    </span>
                    {/* C9: botón eliminar — solo super_admin + anticipo pendiente + orden no entregada */}
                    {isSuperAdmin && a.estado === "pendiente" && orden.estado !== "entregado" && (
                      <button
                        onClick={() => handleEliminarAnticipo(a.id)}
                        disabled={eliminandoId === a.id}
                        title="Eliminar anticipo (super_admin)"
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--color-danger)", background: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-danger-bg, #fee2e2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {eliminandoId === a.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* C9: error al eliminar */}
      {errorEliminar && (
        <div className="mx-4 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--color-danger-bg, #fee2e2)", color: "var(--color-danger)" }}>
          {errorEliminar}
        </div>
      )}

      {/* FASE 37: Panel de traspasos pendientes de confirmar (visible para vendedor/admin) */}
      {!esTecnico && (
        <PanelTraspasosPendientes
          reparacionId={orden.id}
          onTraspasoConfirmado={() => { cargarAnticipos(); onOrdenUpdated(); }}
        />
      )}

      {/* Aviso sin sesión de caja */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-xs"
        style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)", border: "1px solid var(--color-info)" }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Los anticipos y el saldo final se registran automáticamente en la <strong>caja activa</strong> del empleado que los recibe. Si no hay sesión de caja abierta, el movimiento se registra en el historial pero <strong>no en caja</strong>.</span>
      </div>

      {/* Modales */}
      <ModalAgregarAnticipo
        isOpen={modalAgregarOpen}
        onClose={() => setModalAgregarOpen(false)}
        ordenId={orden.id}
        ordenFolio={orden.folio}
        saldoPendiente={saldoPendiente}
        esTecnico={esTecnico}
        onSuccess={() => { cargarAnticipos(); onOrdenUpdated(); }}
      />

      <ModalCobrarEntregar
        isOpen={modalEntregarOpen}
        onClose={() => setModalEntregarOpen(false)}
        orden={orden}
        anticipos={anticipos}
        onSuccess={() => { cargarAnticipos(); onOrdenUpdated(); }}
      />

      <ModalDevolverAnticipo
        isOpen={modalDevolverOpen}
        onClose={() => setModalDevolverOpen(false)}
        orden={orden}
        totalPendiente={totalAnticiposDevolvibles}
        onSuccess={() => { cargarAnticipos(); onOrdenUpdated(); }}
      />
    </div>
  );
}
