"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, ExternalLink, Edit, Loader2, Package, Wrench, Clock, FileText } from "lucide-react";
import { OrdenDetailHeader } from "@/components/reparaciones/detail/OrdenDetailHeader";
import { PresupuestoSummary } from "@/components/reparaciones/detail/PresupuestoSummary";
import { TimelineOrden } from "@/components/reparaciones/TimelineOrden";
import { GaleriaFotosOrden } from "@/components/reparaciones/GaleriaFotosOrden";
import { HistorialNotificaciones } from "@/components/reparaciones/HistorialNotificaciones";
import { ModalEditarOrden } from "@/components/reparaciones/ModalEditarOrden";
import { ModalEditarPresupuesto } from "@/components/reparaciones/ModalEditarPresupuesto";
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
  { id: "resumen",     label: "📋 Resumen" },
  { id: "diagnostico", label: "🔧 Diagnóstico" },
  { id: "presupuesto", label: "💰 Presupuesto" },
  { id: "historial",   label: "📅 Historial" },
  { id: "fotos",       label: "📸 Fotos" },
  { id: "piezas",      label: "📦 Piezas" },
  { id: "mensajeria",  label: "💬 Mensajería" },
  { id: "tiempo",      label: "⏱ Tiempo" },
];

export function OrdenDrawer({ ordenId, onClose, onRefresh, defaultTab = "resumen" }: OrdenDrawerProps) {
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalPresupuestoOpen, setModalPresupuestoOpen] = useState(false);

  const isOpen = !!ordenId;

  const fetchOrden = useCallback(async () => {
    if (!ordenId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/reparaciones/${ordenId}`);
      const data = await res.json();
      if (data.success) setOrden(data.data);
    } catch (err) {
      console.error("Error cargando orden en drawer:", err);
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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Tab: Resumen ────────────────────────────────────────────────────────────
  function TabResumen() {
    if (!orden) return null;
    return (
      <div className="space-y-4">
        {/* Info del dispositivo */}
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
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Número de Serie</p>
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

        {/* Aprobación parcial */}
        {orden.aprobacionParcial && (
          <div className="rounded-xl p-4" style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-warning-text)" }}>⚠️ Aprobación Parcial</p>
            {orden.notasCliente && (
              <p className="text-xs mt-1" style={{ color: "var(--color-warning-text)" }}>{orden.notasCliente}</p>
            )}
          </div>
        )}

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

        {/* Problema reportado */}
        <Card title="Problema Reportado">
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
            {orden.problemaReportado}
          </p>
        </Card>

        {/* Fechas */}
        <Card title="Fechas">
          <div className="space-y-2">
            {[
              { label: "Recepción", value: orden.fechaRecepcion, color: "var(--color-text-primary)" },
              { label: "Entrega Estimada", value: orden.fechaEstimadaEntrega, color: "var(--color-accent)" },
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

        {/* Cuentas del dispositivo */}
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

        {/* Notas internas */}
        {orden.notasInternas && (
          <Card title="Notas Internas">
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>{orden.notasInternas}</p>
          </Card>
        )}

        {/* Botones editar — solo en drawer */}
        <div className="flex gap-2 pt-2">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-sunken)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onClick={() => setModalEditarOpen(true)}
          >
            <Edit className="w-4 h-4" /> Editar datos
          </button>
        </div>
      </div>
    );
  }

  // ── Tab: Diagnóstico ────────────────────────────────────────────────────────
  function TabDiagnostico() {
    if (!orden) return null;
    return (
      <div className="space-y-4">
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

        {/* Partes reemplazadas del diagnóstico */}
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
              <Clock className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                {formatFecha(orden.fechaEstimadaEntrega)}
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Tab: Presupuesto ────────────────────────────────────────────────────────
  function TabPresupuesto() {
    if (!orden) return null;
    return (
      <div className="space-y-4">
        {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
          <AnticipoCajaPanel orden={orden} onOrdenUpdated={handleSuccess} />
        )}
        <PresupuestoSummary orden={orden} />
        {/* Botón editar presupuesto */}
        {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
          <button
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
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

  // ── Render tabs content ─────────────────────────────────────────────────────
  function renderTab() {
    if (!orden) return null;
    switch (activeTab) {
      case "resumen":     return <TabResumen />;
      case "diagnostico": return <TabDiagnostico />;
      case "presupuesto": return <TabPresupuesto />;
      case "historial":
        return (
          <div className="space-y-4">
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
          background: "rgba(0,0,0,0.45)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 right-0 h-full z-[401] flex flex-col transition-transform duration-300"
        style={{
          width: "min(680px, 95vw)",
          background: "var(--color-bg-base)",
          boxShadow: "var(--shadow-xl)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          borderLeft: "1px solid var(--color-border)",
        }}
      >
        {/* ── Drawer Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--color-text-muted)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
            {orden && (
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                  {orden.folio}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {orden.marcaDispositivo} {orden.modeloDispositivo}
                </p>
              </div>
            )}
          </div>

          {orden && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: "var(--color-accent)", background: "var(--color-accent-light)", border: "1px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--color-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid transparent")}
              onClick={() => router.push(`/dashboard/reparaciones/${orden.id}`)}
              title="Abrir página completa"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver completo
            </button>
          )}
        </div>

        {/* ── Header con info del cliente (cuando hay orden) ── */}
        {orden && (
          <div
            className="flex-shrink-0"
            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
          >
            <OrdenDetailHeader orden={orden} onEdit={() => setModalEditarOpen(true)} />
          </div>
        )}

        {/* ── Tabs ── */}
        <div
          className="flex-shrink-0 flex items-center gap-0 overflow-x-auto px-4"
          style={{
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className="px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
              style={{
                color: activeTab === tab.id ? "var(--color-accent)" : "var(--color-text-muted)",
                borderBottom: activeTab === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
                background: "transparent",
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-accent)" }} />
            </div>
          ) : !orden ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No se pudo cargar la orden</p>
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
        </>
      )}
    </>
  );
}
