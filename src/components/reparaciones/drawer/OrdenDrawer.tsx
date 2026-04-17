"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, ExternalLink, Edit, Loader2, Wrench, Clock, AlertCircle,
  MessageSquare, Package, Timer, FileText, Image as ImageIcon,
  DollarSign, Phone, CheckCircle, GitBranch, Printer
} from "lucide-react";
import { EstadoBadge, PrioridadBadge } from "@/components/reparaciones/EstadoBadge";
import { PresupuestoSummary } from "@/components/reparaciones/detail/PresupuestoSummary";
import { TimelineOrden } from "@/components/reparaciones/TimelineOrden";
import { GaleriaFotosOrden } from "@/components/reparaciones/GaleriaFotosOrden";
import { HistorialNotificaciones } from "@/components/reparaciones/HistorialNotificaciones";
import { ModalEditarOrden } from "@/components/reparaciones/ModalEditarOrden";
import { ModalEditarPresupuesto } from "@/components/reparaciones/ModalEditarPresupuesto";
import { ModalCambiarEstado } from "@/components/reparaciones/ModalCambiarEstado";
import { PiezasInventarioPanel } from "@/components/reparaciones/PiezasInventarioPanel";
import { AnticipoCajaPanel } from "@/components/reparaciones/anticipos/AnticipoCajaPanel";
import { CentroMensajesPanel } from "@/components/reparaciones/mensajeria/CentroMensajesPanel";
import { BitacoraTiempoPanel } from "@/components/reparaciones/BitacoraTiempoPanel";
import { Card } from "@/components/ui/Card";
import type { OrdenReparacionDetallada } from "@/types";

interface OrdenDrawerProps {
  ordenId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  defaultTab?: string;
}

const TABS = [
  { id: "resumen",     label: "Resumen",    icon: FileText },
  { id: "diagnostico", label: "Diagnóstico", icon: Wrench },
  { id: "presupuesto", label: "Presupuesto", icon: DollarSign },
  { id: "historial",   label: "Historial",  icon: Clock },
  { id: "fotos",       label: "Fotos",      icon: ImageIcon },
  { id: "piezas",      label: "Piezas",     icon: Package },
  { id: "mensajeria",  label: "Mensajes",   icon: MessageSquare },
  { id: "tiempo",      label: "Tiempo",     icon: Timer },
];

// ─── Hook: detect mobile viewport ──────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── Check if order is overdue ──────────────────────────────────────────────
function isOverdue(orden: OrdenReparacionDetallada): boolean {
  if (!orden.fechaEstimadaEntrega) return false;
  const terminal = ["entregado", "cancelado", "no_reparable"];
  if (terminal.includes(orden.estado)) return false;
  const estimate = new Date(orden.fechaEstimadaEntrega);
  return estimate < new Date();
}

export function OrdenDrawer({ ordenId, onClose, onRefresh, defaultTab = "resumen" }: OrdenDrawerProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerError, setDrawerError] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalPresupuestoOpen, setModalPresupuestoOpen] = useState(false);
  const [modalCambiarEstadoOpen, setModalCambiarEstadoOpen] = useState(false);
  const [estadoInicialModal, setEstadoInicialModal] = useState<import("@/types").EstadoOrdenReparacion | undefined>(undefined);

  /** Abre el modal de cambio de estado, opcionalmente pre-seleccionando un destino */
  function abrirCambiarEstado(estadoDestino?: import("@/types").EstadoOrdenReparacion) {
    setEstadoInicialModal(estadoDestino);
    setModalCambiarEstadoOpen(true);
  }

  const isOpen = !!ordenId;

  const fetchOrden = useCallback(async () => {
    if (!ordenId) return;
    try {
      setLoading(true);
      setDrawerError(false);
      const res = await fetch(`/api/reparaciones/${ordenId}`);
      const data = await res.json();
      if (data.success) {
        setOrden(data.data);
      } else {
        setDrawerError(true);
      }
    } catch (err) {
      console.error("Error cargando orden en drawer:", err);
      setDrawerError(true);
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => {
    if (ordenId) {
      fetchOrden();
      setActiveTab(defaultTab);
    } else {
      setOrden(null);
    }
  }, [ordenId, defaultTab, fetchOrden]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Bloquear scroll del body cuando drawer está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function handleSuccess() {
    fetchOrden();
    onRefresh();
  }

  const formatFecha = (fecha: Date | string | null | undefined) => {
    if (!fecha) return "No especificada";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const overdueAlert = orden && isOverdue(orden);

  // ─── Panel styles: mobile = bottom sheet, desktop = right drawer ───────────
  const panelStyle: React.CSSProperties = isMobile
    ? {
        // Mobile: bottom sheet, slides up from bottom
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(100dvh - 48px)",
        zIndex: 401,
        background: "var(--color-bg-base)",
        boxShadow: "var(--shadow-xl)",
        borderTop: "1px solid var(--color-border)",
        borderRadius: "1.25rem 1.25rem 0 0",
        display: "flex",
        flexDirection: "column",
        transform: isOpen ? "translateY(0)" : "translateY(100%)",
        transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
      }
    : {
        // Desktop: right drawer, slides in from right
        position: "fixed",
        top: 0,
        right: 0,
        width: "min(700px, 95vw)",
        height: "100dvh",
        zIndex: 401,
        background: "var(--color-bg-base)",
        boxShadow: "var(--shadow-xl)",
        borderLeft: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 300ms cubic-bezier(0.4,0,0.2,1)",
      };

  // ── Tab: Resumen ─────────────────────────────────────────────────────────
  function tabResumen() {
    if (!orden) return null;
    return (
      <div className="space-y-4 pb-6">
        <Card title="Dispositivo">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Marca / Modelo</p>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {orden.marcaDispositivo} {orden.modeloDispositivo}
              </p>
            </div>
            {orden.imei && (
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>IMEI</p>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                  {orden.imei}
                </p>
              </div>
            )}
            {orden.numeroSerie && (
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>N° Serie</p>
                <p className="text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>{orden.numeroSerie}</p>
              </div>
            )}
            {orden.condicionDispositivo && (
              <div>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Condición</p>
                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.condicionDispositivo}</p>
              </div>
            )}
            {orden.accesoriosEntregados && (
              <div className="col-span-2">
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Accesorios</p>
                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.accesoriosEntregados}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Acceso al dispositivo */}
        {(orden.patronDesbloqueo || orden.passwordDispositivo) && (
          <div className="rounded-xl p-4" style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-warning-text)" }}>🔐 Acceso al Dispositivo</p>
            <div className="grid grid-cols-1 gap-2">
              {orden.patronDesbloqueo && (
                <div>
                  <p className="text-xs" style={{ color: "var(--color-warning)" }}>Patrón</p>
                  <p className="text-sm font-bold px-3 py-1.5 rounded mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning-text)", background: "rgba(0,0,0,0.08)" }}>
                    {orden.patronDesbloqueo}
                  </p>
                </div>
              )}
              {orden.passwordDispositivo && (
                <div>
                  <p className="text-xs" style={{ color: "var(--color-warning)" }}>PIN / Contraseña</p>
                  <p className="text-sm font-bold px-3 py-1.5 rounded mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning-text)", background: "rgba(0,0,0,0.08)" }}>
                    {orden.passwordDispositivo}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {orden.aprobacionParcial && (
          <div className="rounded-xl p-4" style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-warning-text)" }}>⚠️ Aprobación Parcial</p>
            {orden.notasCliente && (
              <p className="text-xs mt-1" style={{ color: "var(--color-warning-text)" }}>{orden.notasCliente}</p>
            )}
          </div>
        )}

        <Card title="Problema Reportado">
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
            {orden.problemaReportado}
          </p>
        </Card>

        <Card title="Fechas">
          <div className="space-y-2">
            {[
              { label: "Recepción", value: orden.fechaRecepcion, color: "var(--color-text-primary)" },
              { label: "Entrega Estimada", value: orden.fechaEstimadaEntrega, color: overdueAlert ? "var(--color-danger)" : "var(--color-accent)" },
              { label: "Completado", value: orden.fechaCompletado, color: "var(--color-success)" },
              { label: "Entregado", value: orden.fechaEntregado, color: "var(--color-text-muted)" },
            ]
              .filter(({ value }) => value)
              .map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color }}>{formatFecha(value)}</span>
                </div>
              ))}
          </div>
        </Card>

        {orden.cuentasDispositivo && Array.isArray(orden.cuentasDispositivo) && orden.cuentasDispositivo.length > 0 && (
          <Card title="Cuentas del Dispositivo">
            <div className="space-y-2">
              {orden.cuentasDispositivo.map((cuenta: { tipo?: string; email?: string; usuario?: string; notas?: string }, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "var(--color-bg-sunken)" }}>
                  <span className="text-base">
                    {cuenta.tipo === "Google" ? "📧" : cuenta.tipo === "Apple" ? "🍎" : cuenta.tipo === "Samsung" ? "📱" : "🔐"}
                  </span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>{cuenta.tipo}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {cuenta.email || cuenta.usuario}
                    </p>
                    {cuenta.notas && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{cuenta.notas}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {orden.notasInternas && (
          <Card title="Notas Internas">
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>{orden.notasInternas}</p>
          </Card>
        )}

        <button
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium"
          style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
          onClick={() => setModalEditarOpen(true)}
        >
          <Edit className="w-4 h-4" /> Editar datos
        </button>
      </div>
    );
  }

  // ── Tab: Diagnóstico ─────────────────────────────────────────────────────
  function tabDiagnostico() {
    if (!orden) return null;
    return (
      <div className="space-y-4 pb-6">
        <Card title="Diagnóstico del Técnico">
          {orden.diagnosticoTecnico ? (
            <div className="space-y-3">
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                {orden.diagnosticoTecnico}
              </p>
              {orden.notasTecnico && (
                <div className="p-3 rounded-lg" style={{ background: "var(--color-info-bg)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-info-text)" }}>Notas del Técnico</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-info)" }}>{orden.notasTecnico}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wrench className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--color-border-strong)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Diagnóstico pendiente</p>
            </div>
          )}
        </Card>

        <Card title="Técnico Asignado">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--color-info-bg)" }}>
              <Wrench className="w-5 h-5" style={{ color: "var(--color-info)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.tecnicoNombre || "No asignado"}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Técnico de reparación</p>
            </div>
          </div>
        </Card>

        {orden.partesReemplazadas && orden.partesReemplazadas.length > 0 && (
          <Card title="Partes del Diagnóstico">
            <div className="space-y-2">
              {orden.partesReemplazadas.map((parte: { parte?: string; cantidad?: number; costo?: number }, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--color-border-subtle)" }}>
                  <div>
                    <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{parte.parte}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Cant: {parte.cantidad || 1}</p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                    ${((parte.costo || 0) * (parte.cantidad || 1)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {orden.fechaEstimadaEntrega && (
          <Card title="Entrega Estimada">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: overdueAlert ? "var(--color-danger)" : "var(--color-accent)" }} />
              <p className="text-sm font-medium" style={{ color: overdueAlert ? "var(--color-danger)" : "var(--color-accent)" }}>
                {formatFecha(orden.fechaEstimadaEntrega)}
                {overdueAlert && " · ⚠️ Vencida"}
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Tab: Presupuesto ─────────────────────────────────────────────────────
  function tabPresupuesto() {
    if (!orden) return null;
    return (
      <div className="space-y-4 pb-6">
        {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
          <AnticipoCajaPanel orden={orden} onOrdenUpdated={handleSuccess} />
        )}
        <PresupuestoSummary orden={orden} />
        {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
          <button
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onClick={() => setModalPresupuestoOpen(true)}
          >
            <Edit className="w-4 h-4" /> Editar presupuesto
          </button>
        )}
      </div>
    );
  }

  // ── Render tabs content ──────────────────────────────────────────────────
  function renderTab() {
    if (!orden) return null;
    switch (activeTab) {
      case "resumen":     return tabResumen();
      case "diagnostico": return tabDiagnostico();
      case "presupuesto": return tabPresupuesto();
      case "historial":
        return (
          <div className="space-y-4 pb-6">
            <TimelineOrden ordenId={orden.id} estadoActual={orden.estado} />
            <HistorialNotificaciones ordenId={orden.id} />
          </div>
        );
      case "fotos":
        return <GaleriaFotosOrden orden={orden} onUpdate={handleSuccess} />;
      case "piezas":
        return <PiezasInventarioPanel ordenId={orden.id} estadoOrden={orden.estado} />;
      case "mensajeria":
        return <CentroMensajesPanel orden={orden} onUpdate={handleSuccess} />;
      case "tiempo":
        return <BitacoraTiempoPanel ordenId={orden.id} />;
      default:
        return null;
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[400] transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.5)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Mobile handle bar */}
      {isMobile && (
        <div
          className="fixed z-[402] transition-opacity duration-300"
          style={{
            opacity: isOpen ? 1 : 0,
            pointerEvents: "none",
            bottom: "calc(100dvh - 44px)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="rounded-full"
            style={{ width: 40, height: 4, background: "var(--color-border-strong)" }}
          />
        </div>
      )}

      {/* Drawer / Bottom sheet panel */}
      <div style={panelStyle}>

        {/* ── Compact header: folio + estado + cliente ── */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
            borderRadius: isMobile ? "1.25rem 1.25rem 0 0" : undefined,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg flex-shrink-0"
              style={{ color: "var(--color-text-muted)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
            {orden ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-bold"
                    style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
                  >
                    {orden.folio}
                  </span>
                  <EstadoBadge estado={orden.estado} />
                  <PrioridadBadge prioridad={orden.prioridad} />
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                  {orden.marcaDispositivo} {orden.modeloDispositivo}
                  {orden.clienteNombre ? ` · ${orden.clienteNombre}${orden.clienteApellido ? ` ${orden.clienteApellido}` : ""}` : ""}
                </p>
              </div>
            ) : loading ? (
              <div className="space-y-1">
                <div className="w-32 h-4 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
                <div className="w-48 h-3 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {orden && (
              <button
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-muted)", background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => setModalEditarOpen(true)}
                title="Editar orden"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {orden && (
              <button
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-muted)", background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => window.open(`/dashboard/reparaciones/${orden.id}/ticket`, "_blank")}
                title="Imprimir ticket de taller"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            {/* Botón rápido "✓ Listo" — solo cuando está en_reparacion */}
            {orden && orden.estado === "en_reparacion" && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                style={{ color: "var(--color-success-text)", background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                onClick={() => abrirCambiarEstado("completado")}
                title="Marcar reparación como completada"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="ml-1">Listo</span>
              </button>
            )}
            {/* Botón de estado genérico para el resto de transiciones */}
            {orden && !["entregado", "cancelado", "no_reparable"].includes(orden.estado) && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--color-primary)", background: "var(--color-primary-light)", border: "1px solid transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                onClick={() => abrirCambiarEstado()}
                title="Cambiar estado de la orden"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Estado</span>
              </button>
            )}
            {orden && (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--color-accent)", background: "var(--color-accent-light)", border: "1px solid transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
                onClick={() => router.push(`/dashboard/reparaciones/${orden.id}`)}
                title="Abrir página completa"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Ver todo</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Compact client/date strip ── */}
        {orden && (
          <div
            className="px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap"
            style={{
              background: "var(--color-bg-surface)",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            {/* Cliente */}
            {orden.clienteNombre ? (
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
                >
                  {orden.clienteNombre[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate" style={{ color: "var(--color-text-primary)" }}>
                    {orden.clienteNombre} {orden.clienteApellido || ""}
                  </p>
                  {orden.clienteTelefono && (
                    <a
                      href={`https://wa.me/52${orden.clienteTelefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
                    >
                      <Phone className="w-3 h-3" />
                      {orden.clienteTelefono}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Sin cliente</span>
            )}

            {/* Fecha estimada / vencida */}
            <div className="text-right flex-shrink-0">
              {overdueAlert ? (
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-danger)" }} />
                  <div>
                    <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-danger-text)" }}>¡Vencida!</p>
                    <p className="text-xs leading-tight" style={{ color: "var(--color-danger)" }}>
                      {formatFecha(orden.fechaEstimadaEntrega)}
                    </p>
                  </div>
                </div>
              ) : orden.fechaEstimadaEntrega ? (
                <div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Entrega est.</p>
                  <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                    {formatFecha(orden.fechaEstimadaEntrega)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Recibido</p>
                  <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {formatFecha(orden.fechaRecepcion)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Overdue + listo_entrega: WhatsApp promotion banner ── */}
        {overdueAlert && orden.clienteTelefono && orden.estado === "listo_entrega" && (
          <div
            className="mx-3 mt-2 flex-shrink-0 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
            style={{
              background: "var(--color-warning-bg)",
              border: "1px solid var(--color-warning)",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-warning-text)" }}>
                  Equipo listo · entrega vencida
                </p>
                <p className="text-xs leading-tight truncate" style={{ color: "var(--color-warning)" }}>
                  Invita al cliente a pasar hoy y libera caja
                </p>
              </div>
            </div>
            <a
              href={encodeURI(
                `https://wa.me/52${orden.clienteTelefono.replace(/\D/g, "")}?text=Hola ${orden.clienteNombre || "cliente"} 👋 Tu equipo ${orden.marcaDispositivo} ${orden.modeloDispositivo} ya está listo para recoger. Folio: ${orden.folio}. ¡Te esperamos hoy! 📱`
              )}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: "#25D366", color: "#fff" }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Avisar WA
            </a>
          </div>
        )}

        {/* ── Tabs bar ── */}
        <div
          className="flex-shrink-0 flex items-center overflow-x-auto mt-1"
          style={{
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
            scrollbarWidth: "none",
          }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap flex-shrink-0"
                style={{
                  color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                  borderBottom: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                  background: "transparent",
                  transition: "color 150ms ease",
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Scrollable content area — THE CRITICAL FIX ── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-4"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          } as React.CSSProperties}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
            </div>
          ) : drawerError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 p-6">
              <Wrench className="w-10 h-10" style={{ color: "var(--color-danger)" }} />
              <p className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>
                No se pudo cargar la orden.
              </p>
              <button
                onClick={() => fetchOrden()}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Reintentar
              </button>
            </div>
          ) : !orden ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Wrench className="w-10 h-10" style={{ color: "var(--color-border-strong)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No se encontró la orden</p>
            </div>
          ) : (
            renderTab()
          )}
        </div>
      </div>

      {/* Modales — fuera del panel para evitar clipping */}
      {orden && (
        <>
          <ModalEditarOrden
            isOpen={modalEditarOpen}
            onClose={() => setModalEditarOpen(false)}
            orden={orden}
            onSuccess={handleSuccess}
          />
          <ModalEditarPresupuesto
            isOpen={modalPresupuestoOpen}
            onClose={() => setModalPresupuestoOpen(false)}
            orden={orden}
            onSuccess={handleSuccess}
          />
          <ModalCambiarEstado
            isOpen={modalCambiarEstadoOpen}
            onClose={() => setModalCambiarEstadoOpen(false)}
            ordenId={orden.id}
            folio={orden.folio}
            estadoActual={orden.estado}
            onSuccess={handleSuccess}
            estadoInicial={estadoInicialModal}
          />
        </>
      )}
    </>
  );
}
