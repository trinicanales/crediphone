"use client";

import { useState, useRef, useEffect } from "react";
import {
  Phone, MessageCircle, Copy, ChevronDown, MoreVertical,
  Wrench, Clock, Image as ImageIcon, DollarSign, Shield, Circle,
} from "lucide-react";
import { EstadoBadge, PrioridadBadge } from "@/components/reparaciones/EstadoBadge";
import { StepperReparacion } from "@/components/reparaciones/StepperReparacion";
import { ModalWhatsAppEstado } from "@/components/reparaciones/ModalWhatsAppEstado";
import { AccionesOrdenPanel } from "@/components/reparaciones/AccionesOrdenPanel";
import { ModalSegundoDiagnostico } from "@/components/reparaciones/ModalSegundoDiagnostico";
import type { OrdenReparacionDetallada, EstadoOrdenReparacion } from "@/types";

// ─── Mapa de transiciones válidas (espejo de ModalCambiarEstado) ──────────────
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

const estadoLabels: Record<EstadoOrdenReparacion, string> = {
  recibido:         "Recibido",
  diagnostico:      "En Diagnóstico",
  esperando_piezas: "Esp. Piezas",
  presupuesto:      "Pres. Pendiente",
  aprobado:         "Aprobado",
  en_reparacion:    "En Reparación",
  completado:       "Completado",
  listo_entrega:    "Listo Entrega",
  entregado:        "Entregado",
  no_reparable:     "No Reparable",
  cancelado:        "Cancelado",
};

// ─── Phone Action Menu ────────────────────────────────────────────────────────
function PhoneMenu({ telefono, onClose }: { telefono: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const numeroLimpio = telefono.replace(/\D/g, "");

  return (
    <div
      ref={ref}
      className="absolute z-[200] bottom-8 left-0 rounded-xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-lg)",
        minWidth: "180px",
      }}
    >
      <a
        href={`https://wa.me/52${numeroLimpio}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
        style={{ color: "var(--color-success)", background: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-success-bg)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={onClose}
      >
        <MessageCircle className="w-4 h-4" />
        WhatsApp
      </a>
      <a
        href={`tel:${telefono}`}
        className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
        style={{ color: "var(--color-info)", background: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-info-bg)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={onClose}
      >
        <Phone className="w-4 h-4" />
        Llamar
      </a>
      <button
        className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors"
        style={{ color: "var(--color-text-secondary)", background: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => { navigator.clipboard.writeText(telefono); onClose(); }}
      >
        <Copy className="w-4 h-4" />
        Copiar número
      </button>
    </div>
  );
}

// ─── Estado Inline Selector ────────────────────────────────────────────────────
function EstadoSelector({
  orden,
  onEstadoChange,
  onClose,
}: {
  orden: OrdenReparacionDetallada;
  onEstadoChange: (nuevoEstado: EstadoOrdenReparacion) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const transiciones = transicionesValidas[orden.estado] || [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (transiciones.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute z-[200] top-8 left-0 rounded-xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-lg)",
        minWidth: "200px",
      }}
    >
      <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle)" }}>
        Cambiar a
      </p>
      {transiciones.map((estado) => (
        <button
          key={estado}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors"
          style={{ color: "var(--color-text-primary)", background: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => { onEstadoChange(estado); onClose(); }}
        >
          <Circle className="w-2 h-2 flex-shrink-0" style={{ fill: "var(--color-accent)", color: "var(--color-accent)" }} />
          {estadoLabels[estado]}
        </button>
      ))}
    </div>
  );
}

// ─── Timer Display (días desde recepción) ─────────────────────────────────────
function TimerDisplay({ orden }: { orden: OrdenReparacionDetallada }) {
  const [now] = useState(() => Date.now());
  const activa = !["entregado", "cancelado", "no_reparable"].includes(orden.estado);
  let elapsed = "--";

  if (orden.fechaRecepcion) {
    const inicio = new Date(orden.fechaRecepcion).getTime();
    const diff = Math.floor((now - inicio) / 1000);
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    elapsed = d > 0 ? `${d}d ${h}h` : `${h}h`;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" style={{ color: activa ? "var(--color-accent)" : "var(--color-text-muted)" }} />
      <span
        className="text-xs font-medium"
        style={{
          color: activa ? "var(--color-text-secondary)" : "var(--color-text-muted)",
          fontFamily: "var(--font-data)",
        }}
      >
        {elapsed}
      </span>
    </div>
  );
}

// ─── OrdenCard ────────────────────────────────────────────────────────────────
export interface OrdenCardProps {
  orden: OrdenReparacionDetallada;
  userRole: string;
  onOpenDrawer: (orden: OrdenReparacionDetallada) => void;
  onDiagnostico: (orden: OrdenReparacionDetallada) => void;
  onCambiarEstado: (orden: OrdenReparacionDetallada, nuevoEstado: EstadoOrdenReparacion) => void;
  onEliminar?: (orden: OrdenReparacionDetallada) => void;
  onRefresh: () => void;
}

export function OrdenCard({
  orden,
  userRole,
  onOpenDrawer,
  onDiagnostico,
  onCambiarEstado,
  onEliminar,
  onRefresh,
}: OrdenCardProps) {
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [estadoMenuOpen, setEstadoMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [modalWAOpen, setModalWAOpen] = useState(false);
  const [nuevoEstadoWA, setNuevoEstadoWA] = useState<EstadoOrdenReparacion>("recibido");
  const [modalSegundoDiagOpen, setModalSegundoDiagOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const canEdit = ["admin", "super_admin"].includes(userRole);
  const canDelete = userRole === "super_admin";
  const isTerminada = ["entregado", "cancelado", "no_reparable"].includes(orden.estado);

  // Llama al padre para cambiar estado Y abre modal WA de notificación
  function handleEstadoChange(nuevoEstado: EstadoOrdenReparacion) {
    onCambiarEstado(orden, nuevoEstado);
    setNuevoEstadoWA(nuevoEstado);
    setModalWAOpen(true);
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
  }

  const totalFotos = orden.imagenesIds?.length || 0;

  return (
    <div
      className="rounded-xl transition-all duration-200 cursor-pointer select-none"
      style={{
        background: orden.esGarantia ? "var(--color-warning-bg)" : "var(--color-bg-surface)",
        border: `1px solid ${orden.esGarantia ? "var(--color-warning)" : "var(--color-border-subtle)"}`,
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
      onClick={() => onOpenDrawer(orden)}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold tracking-wider"
            style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
          >
            {orden.folio}
          </span>
          {orden.esGarantia && (
            <span title="Garantía" className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)" }}>
              <Shield className="w-3 h-3" /> Garantía
            </span>
          )}
          {(orden.prioridad === "alta" || orden.prioridad === "urgente") && (
            <PrioridadBadge prioridad={orden.prioridad} />
          )}
          {/* BUG-003: badge de tienda — visible solo cuando super_admin ve múltiples distribuidores */}
          {orden.distribuidorNombre && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              title={`Tienda: ${orden.distribuidorNombre}`}
            >
              {orden.distribuidorNombre}
            </span>
          )}
        </div>

        {/* Estado con dropdown inline */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity"
            style={{ opacity: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isTerminada) setEstadoMenuOpen((v) => !v);
            }}
            title={isTerminada ? "Estado final" : "Cambiar estado"}
          >
            <EstadoBadge estado={orden.estado} />
            {!isTerminada && (
              <ChevronDown className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
            )}
          </button>
          {estadoMenuOpen && (
            <EstadoSelector
              orden={orden}
              onEstadoChange={(nuevoEstado) => handleEstadoChange(nuevoEstado)}
              onClose={() => setEstadoMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── Stepper de progreso ── */}
      <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <StepperReparacion estado={orden.estado} compact />
      </div>

      {/* ── Dispositivo ── */}
      <div className="px-4 pb-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {orden.marcaDispositivo} {orden.modeloDispositivo}
        </p>
        {orden.imei && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            {orden.imei}
          </p>
        )}
        {orden.problemaReportado && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--color-text-secondary)" }}>
            {orden.problemaReportado}
          </p>
        )}
      </div>

      {/* ── Cliente + Técnico ── */}
      <div className="px-4 pb-3 space-y-1.5">
        {/* Nombre cliente */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {orden.clienteNombre} {orden.clienteApellido || ""}
          </span>
        </div>

        {/* Teléfono con action menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
            style={{
              color: "var(--color-accent)",
              background: "var(--color-accent-light)",
              border: "1px solid transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
            onClick={(e) => {
              e.stopPropagation();
              setPhoneMenuOpen((v) => !v);
            }}
          >
            <Phone className="w-3 h-3" />
            {orden.clienteTelefono}
          </button>
          {phoneMenuOpen && (
            <PhoneMenu
              telefono={orden.clienteTelefono}
              onClose={() => setPhoneMenuOpen(false)}
            />
          )}
        </div>

        {/* Técnico asignado */}
        {orden.tecnicoNombre && (
          <div className="flex items-center gap-1.5">
            <Wrench className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {orden.tecnicoNombre}
            </span>
          </div>
        )}
      </div>

      {/* ── Separador ── */}
      <div style={{ height: "1px", background: "var(--color-border-subtle)" }} />

      {/* ── Métricas rápidas ── */}
      <div className="px-4 py-2.5 flex items-center gap-4">
        {/* Timer */}
        <TimerDisplay orden={orden} />

        {/* Fotos */}
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" style={{ color: totalFotos > 0 ? "var(--color-info)" : "var(--color-text-muted)" }} />
          <span className="text-xs" style={{ color: totalFotos > 0 ? "var(--color-text-secondary)" : "var(--color-text-muted)" }}>
            {totalFotos > 0 ? `${totalFotos} fotos` : "Sin fotos"}
          </span>
        </div>

        {/* Costo */}
        {orden.costoTotal > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <DollarSign className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
            >
              {formatCurrency(orden.costoTotal)}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer con acciones contextuales ── */}
      {!isTerminada && (
        <>
          <div style={{ height: "1px", background: "var(--color-border-subtle)" }} />
          <div className="px-4 py-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            {/* Panel de acciones por estado */}
            <AccionesOrdenPanel
              orden={orden}
              userRole={userRole}
              onCambiarEstado={handleEstadoChange}
              onAbrirDiagnostico={() => onDiagnostico(orden)}
              onAbrirDrawerTab={(_tab) => onOpenDrawer(orden)}
              onNuevoDiagnostico={() => setModalSegundoDiagOpen(true)}
              onRegistrarEntrega={() => onOpenDrawer(orden)}
            />

            {/* Menú ⋯ (admin/super_admin) */}
            {(canEdit || canDelete) && (
              <div className="flex justify-end" ref={moreRef}>
                <button
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--color-text-muted)", background: "transparent" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoreMenuOpen((v) => !v);
                  }}
                  title="Más opciones"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {moreMenuOpen && (
                  <div
                    className="absolute z-[200] bottom-10 right-4 rounded-xl overflow-hidden"
                    style={{
                      background: "var(--color-bg-surface)",
                      border: "1px solid var(--color-border)",
                      boxShadow: "var(--shadow-lg)",
                      minWidth: "160px",
                    }}
                  >
                    <button
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors"
                      style={{ color: "var(--color-text-primary)", background: "transparent" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoreMenuOpen(false);
                        onOpenDrawer(orden);
                      }}
                    >
                      <Wrench className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
                      Ver detalle completo
                    </button>

                    {canDelete && (
                      <button
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium w-full text-left transition-colors"
                        style={{ color: "var(--color-danger)", background: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-danger-bg)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoreMenuOpen(false);
                          onEliminar?.(orden);
                        }}
                      >
                        🗑️ Eliminar orden
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal WA notificación de cambio de estado ── */}
      <ModalWhatsAppEstado
        isOpen={modalWAOpen}
        onClose={() => setModalWAOpen(false)}
        orden={orden}
        nuevoEstado={nuevoEstadoWA}
      />

      {/* ── Modal segundo diagnóstico / nuevo problema ── */}
      <ModalSegundoDiagnostico
        isOpen={modalSegundoDiagOpen}
        onClose={() => setModalSegundoDiagOpen(false)}
        orden={orden}
        onCreado={() => {
          setModalSegundoDiagOpen(false);
          onRefresh();
        }}
        onCancelarTodo={() => {
          setModalSegundoDiagOpen(false);
          handleEstadoChange("cancelado");
        }}
      />
    </div>
  );
}
