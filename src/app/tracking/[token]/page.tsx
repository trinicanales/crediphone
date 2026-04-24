"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Smartphone,
  Search,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  ChevronRight,
  AlertTriangle,
  Package,
  CalendarDays,
  User,
  Lock,
  CircleDashed,
  Gift,
  Bell,
  Camera,
  ZoomIn,
  X as XIcon,
} from "lucide-react";
import { TimelineEstados } from "@/components/reparaciones/TimelineEstados";
import { BarraProgresoReparacion } from "@/components/tracking/BarraProgresoReparacion";
import type { EstadoOrdenReparacion, ParteReemplazada, PiezaCotizacion } from "@/types";

/* ── Types ─────────────────────────────────────────────────── */

interface OrdenTracking {
  id: string;
  folio: string;
  estado: EstadoOrdenReparacion;
  marcaDispositivo: string;
  modeloDispositivo: string;
  imei?: string;
  problemaReportado: string;
  diagnosticoTecnico?: string;
  costoReparacion: number;
  costoPartes: number;
  costoTotal: number;
  partesReemplazadas: ParteReemplazada[];
  piezasCotizacion: PiezaCotizacion[];
  fechaRecepcion: Date;
  fechaEstimadaEntrega?: Date;
  fechaCompletado?: Date;
  prioridad: string;
  requiereAprobacion: boolean;
  aprobadoPorCliente: boolean;
  esGarantia: boolean;
  totalAnticipos?: number;
  saldoPendiente?: number;
  checklistApertura?: string | null;
}

interface FotoEquipo {
  id: string;
  url: string;
  tipo: string;
  descripcion: string | null;
}

interface Anticipo {
  monto: number;
  tipo_pago: string;
  fecha_anticipo: string;
  notas?: string;
}

interface HistorialEstado {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario?: { name: string } | null;
  comentario?: string | null;
  created_at: string;
}

interface TrackingData {
  orden: OrdenTracking;
  cliente: {
    nombre: string;
    apellido: string;
    aceptaPromociones: boolean;
    preferenciasPromociones: { accesorios?: boolean; combos?: boolean; celulares?: boolean };
  };
  tecnico: { nombre: string };
  historial: HistorialEstado[];
  anticipos: Anticipo[];
  fotos: FotoEquipo[];
  puntos: {
    saldoDisponible: number;
    totalGanado: number;
    puntosUltimaReparacion: number;
  } | null;
  piezasEnCamino?: { nombre: string; estado: string; fechaEstimadaLlegada: string | null }[];
}

/* ── Estado visual mapping ──────────────────────────────────── */

interface EstadoInfo {
  label: string;
  descripcion: string;
  icon: typeof CheckCircle2;
  bgColor: string;
  textColor: string;
  iconColor: string;
  borderColor: string;
}

function getEstadoInfo(estado: EstadoOrdenReparacion): EstadoInfo {
  const map: Record<string, EstadoInfo> = {
    recibido: {
      label: "Recibido",
      descripcion: "Tu dispositivo ha sido recibido y está en cola para diagnóstico.",
      icon: CircleDashed,
      bgColor: "var(--color-info-bg)",
      textColor: "var(--color-info-text)",
      iconColor: "var(--color-info)",
      borderColor: "var(--color-info)",
    },
    diagnostico: {
      label: "En Diagnóstico",
      descripcion: "Nuestro técnico está evaluando tu dispositivo en este momento.",
      icon: Search,
      bgColor: "var(--color-warning-bg)",
      textColor: "var(--color-warning-text)",
      iconColor: "var(--color-warning)",
      borderColor: "var(--color-warning)",
    },
    presupuesto: {
      label: "Presupuesto Listo",
      descripcion: "El diagnóstico está completo. Revisa y aprueba el presupuesto.",
      icon: AlertTriangle,
      bgColor: "var(--color-warning-bg)",
      textColor: "var(--color-warning-text)",
      iconColor: "var(--color-warning)",
      borderColor: "var(--color-warning)",
    },
    aprobado: {
      label: "Aprobado",
      descripcion: "Presupuesto aprobado. Tu reparación está por comenzar.",
      icon: CheckCircle2,
      bgColor: "var(--color-success-bg)",
      textColor: "var(--color-success-text)",
      iconColor: "var(--color-success)",
      borderColor: "var(--color-success)",
    },
    en_reparacion: {
      label: "En Reparación",
      descripcion: "Tu dispositivo está siendo reparado por nuestro técnico.",
      icon: Wrench,
      bgColor: "var(--color-accent-light)",
      textColor: "var(--color-accent)",
      iconColor: "var(--color-accent)",
      borderColor: "var(--color-accent)",
    },
    completado: {
      label: "Reparación Completada",
      descripcion: "¡Tu dispositivo ha sido reparado exitosamente!",
      icon: CheckCircle2,
      bgColor: "var(--color-success-bg)",
      textColor: "var(--color-success-text)",
      iconColor: "var(--color-success)",
      borderColor: "var(--color-success)",
    },
    listo_entrega: {
      label: "Listo para Recoger",
      descripcion: "Tu dispositivo está listo. ¡Pasa a recogerlo cuando gustes!",
      icon: Package,
      bgColor: "var(--color-success-bg)",
      textColor: "var(--color-success-text)",
      iconColor: "var(--color-success)",
      borderColor: "var(--color-success)",
    },
    entregado: {
      label: "Entregado",
      descripcion: "Dispositivo entregado al cliente. ¡Gracias por elegirnos!",
      icon: ShieldCheck,
      bgColor: "var(--color-bg-elevated)",
      textColor: "var(--color-text-secondary)",
      iconColor: "var(--color-text-muted)",
      borderColor: "var(--color-border)",
    },
    no_reparable: {
      label: "No Reparable",
      descripcion: "Lamentablemente, este dispositivo no puede ser reparado.",
      icon: XCircle,
      bgColor: "var(--color-danger-bg)",
      textColor: "var(--color-danger-text)",
      iconColor: "var(--color-danger)",
      borderColor: "var(--color-danger)",
    },
    cancelado: {
      label: "Cancelado",
      descripcion: "La orden ha sido cancelada.",
      icon: XCircle,
      bgColor: "var(--color-bg-elevated)",
      textColor: "var(--color-text-muted)",
      iconColor: "var(--color-text-muted)",
      borderColor: "var(--color-border)",
    },
  };
  return map[estado] ?? map["recibido"];
}

/* ── Helpers ─────────────────────────────────────────────────── */

function formatFecha(fecha: Date | undefined | string): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

/* ── Sub-components ─────────────────────────────────────────── */

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title?: string;
  icon?: typeof Smartphone;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {title && (
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          {Icon && (
            <Icon
              className="w-4 h-4 shrink-0"
              style={{ color: "var(--color-accent)" }}
            />
          )}
          <h3
            className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {title}
          </h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
      <span className="text-sm shrink-0" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <span
        className="text-sm text-right font-medium"
        style={{
          color: "var(--color-text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Loading skeleton ───────────────────────────────────────── */

function TrackingSkeleton() {
  return (
    <div
      className="min-h-screen app-bg py-8 px-4"
      aria-hidden="true"
    >
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header skeleton */}
        <div className="text-center mb-8 space-y-2">
          <div
            className="h-6 w-36 rounded mx-auto animate-pulse"
            style={{ background: "var(--color-bg-elevated)" }}
          />
          <div
            className="h-4 w-52 rounded mx-auto animate-pulse"
            style={{ background: "var(--color-bg-elevated)" }}
          />
        </div>

        {/* Folio card skeleton */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
        >
          <div
            className="px-6 py-10 flex flex-col items-center gap-3"
            style={{ background: "var(--color-sidebar-bg)" }}
          >
            <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--color-sidebar-surface)" }} />
            <div className="h-9 w-44 rounded animate-pulse" style={{ background: "var(--color-sidebar-surface)" }} />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-16 w-full rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
            <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
            <div className="h-4 w-1/2 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
          </div>
        </div>

        {/* Device info skeleton */}
        <div
          className="rounded-xl p-5 space-y-3"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
        >
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
          {[80, 60, 72].map((w) => (
            <div key={w} className="flex justify-between items-center py-1">
              <div className="h-3 w-20 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
              <div className={`h-3 w-${w === 80 ? "32" : w === 60 ? "24" : "28"} rounded animate-pulse`} style={{ background: "var(--color-bg-elevated)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Error state ─────────────────────────────────────────────── */

function TrackingError({ message }: { message: string }) {
  return (
    <div
      className="min-h-screen app-bg flex items-center justify-center p-4"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center text-center gap-5"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "var(--color-danger-bg)" }}
        >
          <AlertTriangle
            className="w-8 h-8"
            style={{ color: "var(--color-danger)" }}
          />
        </div>

        <div className="space-y-2">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Link no válido
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {message || "No se encontró información para este link de seguimiento."}
          </p>
        </div>

        <div
          className="w-full rounded-lg p-4 text-sm"
          style={{
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-secondary)",
          }}
        >
          Verifica que el link sea correcto o contacta a{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>CREDIPHONE</strong>{" "}
          para obtener ayuda.
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export default function TrackingPublicoPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const [promoAcepta, setPromoAcepta] = useState(false);
  const [promoPrefs, setPromoPrefs] = useState({
    accesorios: true,
    combos: true,
    cargadores: true,
    equipos: true,
  });
  const [savingPromos, setSavingPromos] = useState(false);
  const [promoSaved, setPromoSaved] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState<FotoEquipo | null>(null);
  // FASE 35: Promociones reales de la base de datos
  const [promosReales, setPromosReales] = useState<{
    id: string;
    titulo: string;
    descripcion: string | null;
    imagenUrl: string | null;
    precioNormal: number | null;
    precioPromocion: number | null;
    categoria: string;
  }[]>([]);

  useEffect(() => {
    fetchTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (data?.cliente) {
      setPromoAcepta(data.cliente.aceptaPromociones ?? false);
      const prefs = data.cliente.preferenciasPromociones as Record<string, boolean> | undefined;
      setPromoPrefs({
        accesorios: prefs?.accesorios ?? true,
        combos: prefs?.combos ?? true,
        cargadores: prefs?.cargadores ?? true,
        equipos: prefs?.celulares ?? true,
      });
    }
  }, [data]);

  async function fetchTracking() {
    try {
      setLoading(true);
      const response = await fetch(`/api/tracking/${token}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // FASE 35: Cargar promociones reales en paralelo
        void fetchPromos();
      } else {
        setError(result.message || "No se pudo cargar el tracking");
      }
    } catch (err) {
      setError("Error al cargar el tracking");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPromos() {
    try {
      const res = await fetch(`/api/tracking/${token}/promociones`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setPromosReales(result.data);
      }
    } catch (err) {
      console.error("[tracking] Error al cargar promociones:", err);
    }
  }

  async function handleAccion(accion: "aprobar" | "aprobar_parcial" | "rechazar") {
    try {
      setProcessing(true);
      setMostrarOpciones(false);
      const response = await fetch(`/api/tracking/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const result = await response.json();
      if (result.success) {
        setActionMessage(result.message);
        await fetchTracking();
      } else {
        alert(result.message || "Error al procesar la acción");
      }
    } catch (err) {
      alert("Error al procesar la solicitud");
      console.error("Error:", err);
    } finally {
      setProcessing(false);
    }
  }

  function handleContactarWhatsApp() {
    if (!data) return;
    const numero = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391";
    const msg = `Hola CREDIPHONE, tengo una consulta sobre mi reparación:\n\nFolio: ${data.orden.folio}\nDispositivo: ${data.orden.marcaDispositivo} ${data.orden.modeloDispositivo}\n\n`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function handleGuardarPromos() {
    try {
      setSavingPromos(true);
      setPromoSaved(false);
      const response = await fetch(`/api/tracking/${token}/preferencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aceptaPromociones: promoAcepta,
          preferencias: {
            accesorios: promoPrefs.accesorios,
            combos: promoPrefs.combos,
            cargadores: promoPrefs.cargadores,
            celulares: promoPrefs.equipos,
          },
        }),
      });
      if (response.ok) {
        setPromoSaved(true);
        setTimeout(() => setPromoSaved(false), 5000);
      }
    } catch (err) {
      console.error("Error al guardar preferencias:", err);
    } finally {
      setSavingPromos(false);
    }
  }

  /* ── Render states ── */

  if (loading) return <TrackingSkeleton />;
  if (error || !data) return <TrackingError message={error ?? ""} />;

  const { orden, tecnico, historial, anticipos, fotos = [], piezasEnCamino = [] } = data;
  const estadoInfo = getEstadoInfo(orden.estado);
  const StatusIcon = estadoInfo.icon;

  // Costo: visible siempre que haya monto; estado "presupuesto" ya tiene su propio panel de autorización
  const tieneCosto = orden.costoTotal > 0;
  const costoEsEstimado = ["recibido", "diagnostico"].includes(orden.estado);
  const mostrarCosto = tieneCosto && orden.estado !== "presupuesto";

  return (
    <div
      className="min-h-screen app-bg py-8 px-4"
    >
      <div className="max-w-lg mx-auto space-y-4">

        {/* ── Cabecera de marca ─────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: "var(--color-accent)" }}
            />
            <span
              className="text-base font-bold tracking-widest uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-primary)",
                letterSpacing: "0.12em",
              }}
            >
              CREDIPHONE
            </span>
          </div>
          <p
            className="text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Seguimiento de Reparación
          </p>
        </div>

        {/* ── Tarjeta de folio ──────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {/* Header oscuro con folio */}
          <div
            className="px-6 py-8 flex flex-col items-center gap-2"
            style={{ background: "var(--color-sidebar-bg)" }}
          >
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--color-sidebar-text-dim)", fontFamily: "var(--font-mono)" }}
            >
              Orden de Servicio
            </p>
            <h2
              className="text-3xl font-bold tracking-wider"
              style={{
                color: "var(--color-sidebar-active)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {orden.folio}
            </h2>
            {orden.esGarantia && (
              <div
                className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(0, 184, 217, 0.15)",
                  border: "1px solid rgba(0, 184, 217, 0.4)",
                  color: "var(--color-sidebar-active)",
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Orden en Garantía
              </div>
            )}
          </div>

          {/* Mensaje de acción exitosa */}
          {actionMessage && (
            <div
              className="mx-5 mt-5 flex items-start gap-3 rounded-lg px-4 py-3"
              style={{
                background: "var(--color-success-bg)",
                border: "1px solid var(--color-success)",
              }}
            >
              <CheckCircle2
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: "var(--color-success)" }}
              />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--color-success-text)" }}
              >
                {actionMessage}
              </p>
            </div>
          )}

          {/* Estado actual */}
          <div className="p-5">
            <div
              className="flex items-center gap-4 rounded-xl p-4"
              style={{
                background: estadoInfo.bgColor,
                border: `1px solid ${estadoInfo.borderColor}`,
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.6)" }}
              >
                <StatusIcon
                  className="w-6 h-6"
                  style={{ color: estadoInfo.iconColor }}
                />
              </div>
              <div>
                <p
                  className="text-base font-bold leading-tight"
                  style={{ color: estadoInfo.textColor }}
                >
                  {estadoInfo.label}
                </p>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: estadoInfo.textColor, opacity: 0.8 }}
                >
                  {estadoInfo.descripcion}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Barra de progreso de 7 pasos ─────────────────── */}
        <div
          className="rounded-2xl overflow-hidden px-4"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <BarraProgresoReparacion estado={orden.estado} />
        </div>

        {/* ── Información del dispositivo ───────────────────── */}
        <SectionCard title="Tu Dispositivo" icon={Smartphone}>
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            <InfoRow
              label="Dispositivo"
              value={`${orden.marcaDispositivo} ${orden.modeloDispositivo}`}
            />
            {orden.imei && (
              <InfoRow label="IMEI" value={orden.imei} mono />
            )}
            <InfoRow label="Problema reportado" value={orden.problemaReportado} />
          </div>
        </SectionCard>

        {/* ── Diagnóstico técnico ───────────────────────────── */}
        {orden.diagnosticoTecnico && (
          <SectionCard title="Diagnóstico Técnico" icon={Search}>
            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {orden.diagnosticoTecnico}
            </p>

            {orden.partesReemplazadas.length > 0 && (
              <>
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Partes a reemplazar
                </p>
                <div className="space-y-1">
                  {orden.partesReemplazadas.map((parte, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: "var(--color-bg-elevated)" }}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <span
                          className="text-sm"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {parte.parte}{" "}
                          <span style={{ color: "var(--color-text-muted)" }}>
                            ×{parte.cantidad}
                          </span>
                        </span>
                      </div>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{
                          color: "var(--color-text-primary)",
                          fontFamily: "var(--font-data)",
                        }}
                      >
                        {formatCurrency(parte.costo * parte.cantidad)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        )}

        {/* ── Inspección al abrir el equipo (checklist de apertura) ── */}
        {orden.checklistApertura && (() => {
          const text = orden.checklistApertura!;
          const tieneProblemas = text.includes("⚠️ Problemas:");
          const problemasMatch = text.match(/⚠️ Problemas: (.+?)(?:\.|$)/);
          const okMatch = text.match(/✅ Sin problemas: (.+?)(?:\.|$)/);
          const problemas = problemasMatch ? problemasMatch[1].split(", ") : [];
          const okItems = okMatch ? okMatch[1].split(", ") : [];

          return (
            <SectionCard title="Inspección del Equipo" icon={Search}>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                Al abrir tu equipo, el técnico documentó el estado interno de los componentes.
              </p>

              {tieneProblemas && (
                <div
                  className="rounded-lg px-4 py-3 mb-3"
                  style={{
                    background: "var(--color-danger-bg)",
                    border: "1px solid var(--color-danger)",
                  }}
                >
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-danger-text)" }}>
                    ⚠️ Condiciones encontradas
                  </p>
                  <ul className="space-y-1">
                    {problemas.map((p, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: "var(--color-danger-text)" }}>
                        <span className="shrink-0 mt-0.5">•</span>
                        {p.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {okItems.length > 0 && (
                <div className="space-y-1">
                  {okItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <CheckCircle2
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: "var(--color-success)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {item.trim()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          );
        })()}

        {/* ── Fotos del equipo ──────────────────────────────── */}
        {fotos.length > 0 && (
          <SectionCard title="Fotos del Equipo" icon={Camera}>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
              Fotografías tomadas al momento de recibir y revisar tu dispositivo.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((foto) => (
                <button
                  key={foto.id}
                  type="button"
                  onClick={() => setFotoSeleccionada(foto)}
                  className="relative rounded-lg overflow-hidden aspect-square group"
                  style={{
                    border: "1px solid var(--color-border-subtle)",
                    background: "var(--color-bg-elevated)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.url}
                    alt={foto.descripcion || foto.tipo || "Foto del equipo"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: "rgba(0,0,0,0)",
                      transition: "background 150ms ease",
                    }}
                  >
                    <ZoomIn
                      className="w-5 h-5"
                      style={{ color: "rgba(255,255,255,0)", transition: "color 150ms ease" }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Lightbox de foto ─────────────────────────────── */}
        {fotoSeleccionada && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setFotoSeleccionada(null)}
          >
            <div
              className="relative max-w-lg w-full rounded-2xl overflow-hidden"
              style={{ background: "var(--color-bg-surface)", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoSeleccionada.url}
                alt={fotoSeleccionada.descripcion || fotoSeleccionada.tipo || "Foto del equipo"}
                style={{ width: "100%", display: "block", maxHeight: "75vh", objectFit: "contain" }}
              />
              {fotoSeleccionada.descripcion && (
                <p
                  className="px-4 py-3 text-sm text-center"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {fotoSeleccionada.descripcion}
                </p>
              )}
              <button
                type="button"
                onClick={() => setFotoSeleccionada(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <XIcon className="w-4 h-4" style={{ color: "#fff" }} />
              </button>
            </div>
          </div>
        )}

        {/* ── AUTORIZACIÓN REQUERIDA — diseño formal rojo/negro ── */}
        {orden.estado === "presupuesto" &&
          !orden.aprobadoPorCliente &&
          !actionMessage && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "2.5px solid #B91C1C",
                boxShadow: "0 8px 40px rgba(185,28,28,0.22), 0 2px 8px rgba(0,0,0,0.18)",
              }}
            >
              {/* Header negro con alerta roja */}
              <div
                className="px-5 pt-6 pb-5 flex flex-col items-center gap-3 text-center"
                style={{ background: "#080F1A" }}
              >
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                  style={{
                    background: "rgba(185,28,28,0.20)",
                    border: "1px solid rgba(185,28,28,0.65)",
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#EF4444" }} />
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#EF4444", fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}
                  >
                    Autorización Requerida
                  </span>
                </div>

                <div>
                  <p
                    className="text-xl font-bold"
                    style={{ color: "#F1F5F9", fontFamily: "var(--font-ui)" }}
                  >
                    Presupuesto de Reparación
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "#5A8FAA", fontFamily: "var(--font-mono)" }}
                  >
                    {orden.folio} · {orden.marcaDispositivo} {orden.modeloDispositivo}
                  </p>
                </div>

                <p
                  className="text-xs max-w-xs leading-relaxed"
                  style={{ color: "#7AAABB" }}
                >
                  El técnico completó el diagnóstico de tu equipo. Revisa el presupuesto y elige cómo deseas proceder.
                </p>
              </div>

              {/* Body — blanco con texto negro, muy legible */}
              <div className="space-y-4" style={{ background: "#FFFFFF", padding: "20px" }}>

                {/* Desglose de costos */}
                <div
                  className="rounded-xl overflow-hidden divide-y"
                  style={{ border: "1px solid #E2E8F0" }}
                >
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm" style={{ color: "#64748B" }}>Mano de obra</span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "#0F172A", fontFamily: "var(--font-data)" }}
                    >
                      {formatCurrency(orden.costoReparacion)}
                    </span>
                  </div>
                  {orden.costoPartes > 0 && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm" style={{ color: "#64748B" }}>Partes / Refacciones</span>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: "#0F172A", fontFamily: "var(--font-data)" }}
                      >
                        {formatCurrency(orden.costoPartes)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Detalle de piezas cotizadas */}
                {orden.piezasCotizacion && orden.piezasCotizacion.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#64748B" }}>
                      Detalle de piezas
                    </p>
                    <div className="rounded-xl overflow-hidden divide-y" style={{ border: "1px solid #E2E8F0" }}>
                      {orden.piezasCotizacion.map((p, i) => (
                        <div key={i} className="flex justify-between items-center px-4 py-2.5">
                          <div>
                            <span className="text-sm" style={{ color: "#0F172A" }}>{p.nombre}</span>
                            {p.cantidad > 1 && (
                              <span className="text-xs ml-1.5" style={{ color: "#94A3B8" }}>× {p.cantidad}</span>
                            )}
                          </div>
                          <span
                            className="text-sm tabular-nums"
                            style={{ color: "#64748B", fontFamily: "var(--font-data)" }}
                          >
                            {formatCurrency(p.precioTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total prominente — fondo negro */}
                <div
                  className="rounded-xl px-5 py-4 flex items-center justify-between"
                  style={{ background: "#0B1929" }}
                >
                  <div>
                    <p
                      className="text-xs uppercase tracking-wider mb-1"
                      style={{ color: "#5A8FAA", fontFamily: "var(--font-mono)" }}
                    >
                      Total a pagar
                    </p>
                    <p
                      className="text-4xl font-bold tabular-nums"
                      style={{ color: "#FFFFFF", fontFamily: "var(--font-data)", lineHeight: 1 }}
                    >
                      {formatCurrency(orden.costoTotal)}
                    </p>
                  </div>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: "rgba(185,28,28,0.15)",
                      border: "1.5px solid rgba(185,28,28,0.50)",
                    }}
                  >
                    <AlertTriangle className="w-7 h-7" style={{ color: "#EF4444" }} />
                  </div>
                </div>

                {/* Nota legal */}
                <p
                  className="text-xs text-center leading-relaxed"
                  style={{ color: "#94A3B8" }}
                >
                  Al aprobar, autorizas a CREDIPHONE a realizar la reparación descrita. El costo indicado es el total a pagar al momento de recoger tu equipo.
                </p>

                {/* Botones — flujo de decisión */}
                {!mostrarOpciones ? (
                  <div className="space-y-2.5 pt-1">
                    {/* Aprobar todo — verde oscuro, muy prominente */}
                    <button
                      onClick={() => handleAccion("aprobar")}
                      disabled={processing}
                      className="w-full flex items-center justify-center gap-2.5 rounded-xl text-base font-bold"
                      style={{
                        background: processing ? "#15803D99" : "#166534",
                        color: "#FFFFFF",
                        border: "none",
                        cursor: processing ? "not-allowed" : "pointer",
                        padding: "16px 24px",
                        fontFamily: "var(--font-ui)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      {processing ? "Procesando…" : "Autorizo la reparación completa"}
                    </button>

                    {/* Otras opciones — secundario, sin tanto peso */}
                    <button
                      onClick={() => setMostrarOpciones(true)}
                      disabled={processing}
                      className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                      style={{
                        background: "#F8FAFC",
                        color: "#334155",
                        border: "1.5px solid #CBD5E1",
                        cursor: processing ? "not-allowed" : "pointer",
                        padding: "12px 24px",
                        fontFamily: "var(--font-ui)",
                      }}
                    >
                      Ver otras opciones
                    </button>
                  </div>
                ) : (
                  /* Panel expandido de opciones */
                  <div className="space-y-3 pt-1">
                    <p
                      className="text-sm font-bold text-center"
                      style={{ color: "#1E293B" }}
                    >
                      ¿Qué deseas hacer?
                    </p>

                    {/* Solo problema original */}
                    <button
                      onClick={() => handleAccion("aprobar_parcial")}
                      disabled={processing}
                      className="w-full text-left rounded-xl"
                      style={{
                        background: "#EFF6FF",
                        border: "1.5px solid #93C5FD",
                        cursor: processing ? "not-allowed" : "pointer",
                        opacity: processing ? 0.7 : 1,
                        padding: "16px",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0 mt-0.5">🔧</span>
                        <div>
                          <p className="text-sm font-bold" style={{ color: "#1E3A8A" }}>
                            Solo reparar el problema original
                          </p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#475569" }}>
                            Apruebas únicamente la reparación por la que trajiste el equipo. No se realizarán trabajos adicionales del diagnóstico.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Cancelar todo */}
                    <button
                      onClick={() => handleAccion("rechazar")}
                      disabled={processing}
                      className="w-full text-left rounded-xl"
                      style={{
                        background: "#FEF2F2",
                        border: "1.5px solid #FCA5A5",
                        cursor: processing ? "not-allowed" : "pointer",
                        opacity: processing ? 0.7 : 1,
                        padding: "16px",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
                        <div>
                          <p className="text-sm font-bold" style={{ color: "#7F1D1D" }}>
                            No acepto — Cancelar el servicio
                          </p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#475569" }}>
                            No se realizará ninguna reparación. Puedes pasar a recoger tu equipo sin costo por el servicio.
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Volver */}
                    <button
                      onClick={() => setMostrarOpciones(false)}
                      disabled={processing}
                      className="w-full py-2 text-xs text-center"
                      style={{
                        color: "#94A3B8",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ← Volver
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* ── Costo total ───────────────────────────────────── */}
        {mostrarCosto && (
          <SectionCard>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Costo Total
                  </p>
                  {costoEsEstimado && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
                    >
                      estimado
                    </span>
                  )}
                </div>
                <p
                  className="text-3xl font-bold tabular-nums"
                  style={{
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {formatCurrency(orden.costoTotal)}
                </p>
                {costoEsEstimado && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    El técnico está revisando tu equipo. El monto puede ajustarse.
                  </p>
                )}
              </div>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: costoEsEstimado ? "var(--color-warning-bg)" : "var(--color-success-bg)" }}
              >
                <CheckCircle2
                  className="w-6 h-6"
                  style={{ color: costoEsEstimado ? "var(--color-warning)" : "var(--color-success)" }}
                />
              </div>
            </div>
          </SectionCard>
        )}

        {/* Sin costo aún — cuando no hay presupuesto y no hay costo */}
        {!tieneCosto && !["presupuesto", "cancelado", "no_reparable"].includes(orden.estado) && (
          <SectionCard>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--color-info-bg)" }}
              >
                <Search className="w-5 h-5" style={{ color: "var(--color-info)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Por cotizar</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  El técnico está revisando tu equipo. Recibirás el presupuesto pronto.
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Anticipos ─────────────────────────────────────── */}
        {anticipos && anticipos.length > 0 && (
          <SectionCard title="Anticipos Recibidos">
            <div className="space-y-2">
              {anticipos.map((anticipo, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ background: "var(--color-bg-elevated)" }}
                >
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {formatFecha(anticipo.fecha_anticipo)}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {anticipo.tipo_pago}
                      {anticipo.notas && ` — ${anticipo.notas}`}
                    </p>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{
                      color: "var(--color-success)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {formatCurrency(anticipo.monto)}
                  </span>
                </div>
              ))}

              {/* Totales */}
              <div
                className="pt-3 mt-1 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--color-border-subtle)" }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Total anticipado
                </span>
                <span
                  className="text-base font-bold tabular-nums"
                  style={{
                    color: "var(--color-success)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {formatCurrency(orden.totalAnticipos ?? 0)}
                </span>
              </div>

              {orden.saldoPendiente !== undefined && orden.saldoPendiente > 0 && (
                <div
                  className="rounded-lg px-4 py-3 flex items-center justify-between"
                  style={{
                    background: "var(--color-warning-bg)",
                    border: "1px solid var(--color-warning)",
                  }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ color: "var(--color-warning-text)" }}
                  >
                    Saldo pendiente
                  </span>
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{
                      color: "var(--color-warning)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {formatCurrency(orden.saldoPendiente)}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* ── Piezas en camino ─────────────────────────────── */}
        {piezasEnCamino.length > 0 && (
          <SectionCard title="Estado de tu refacción">
            <div className="space-y-2">
              {piezasEnCamino.map((pieza, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--color-bg-elevated)" }}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base">{pieza.estado === "en_camino" ? "🚚" : "⏳"}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{pieza.nombre}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {pieza.estado === "en_camino" ? "En camino" : "Pendiente de envío"}
                        {pieza.fechaEstimadaLlegada && (
                          <> · Llega aprox. <strong style={{ color: "var(--color-text-secondary)" }}>
                            {new Date(pieza.fechaEstimadaLlegada).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                          </strong></>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={
                    pieza.estado === "en_camino"
                      ? { background: "#dbeafe", color: "#1d4ed8" }
                      : { background: "#fef3c7", color: "#92400e" }
                  }>
                    {pieza.estado === "en_camino" ? "En camino" : "Por enviar"}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Puntos de Loyalty ────────────────────────────── */}
        {data.puntos && orden.estado === "entregado" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0a1628 0%, #0f2040 100%)",
              border: "1px solid rgba(255,200,0,0.25)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div className="px-5 py-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                style={{ background: "rgba(255,200,0,0.15)" }}
              >
                ⭐
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "#ffd700" }}>
                  ¡Ganaste {data.puntos.puntosUltimaReparacion} punto{data.puntos.puntosUltimaReparacion !== 1 ? "s" : ""}!
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Por esta reparación · cada 50 pesos = 1 punto
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold" style={{ color: "#ffd700", fontFamily: "var(--font-data)" }}>
                  {data.puntos.saldoDisponible}
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  pts disponibles
                </p>
              </div>
            </div>
            {data.puntos.saldoDisponible > 0 && (
              <div
                className="px-5 py-3 text-xs"
                style={{
                  borderTop: "1px solid rgba(255,200,0,0.15)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                💡 Tienes <span style={{ color: "#ffd700", fontWeight: 700 }}>${data.puntos.saldoDisponible} MXN</span> disponibles para canjear en tu próxima visita
              </div>
            )}
          </div>
        )}

        {/* ── Consentimiento de Promociones ────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--color-accent-light)" }}
            >
              <Gift className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Ofertas y Promociones
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                ¿Deseas recibir información de nuestros productos y promociones?
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Toggle principal */}
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4" style={{ color: promoAcepta ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  Recibir notificaciones de ofertas
                </span>
              </div>
              <button
                onClick={() => setPromoAcepta(!promoAcepta)}
                className="relative shrink-0"
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: promoAcepta ? "var(--color-accent)" : "var(--color-border)",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 200ms ease",
                  padding: 0,
                }}
                aria-label="Toggle promociones"
              >
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 3,
                    left: promoAcepta ? 23 : 3,
                    transition: "left 200ms ease",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }}
                />
              </button>
            </div>

            {/* Opciones de categorías — visibles cuando acepta */}
            {promoAcepta && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  ¿Qué te interesa recibir?
                </p>
                {[
                  {
                    key: "accesorios" as const,
                    emoji: "🛡️",
                    titulo: "Fundas y accesorios",
                    desc: "Fundas, cristales templados, audífonos y más para tu dispositivo.",
                  },
                  {
                    key: "combos" as const,
                    emoji: "📦",
                    titulo: "Combos especiales",
                    desc: "Paquetes de funda + cristal templado + cargador a precio especial.",
                  },
                  {
                    key: "cargadores" as const,
                    emoji: "⚡",
                    titulo: "Cargadores de calidad",
                    desc: "Cargadores originales y de marca garantizados para tu equipo.",
                  },
                  {
                    key: "equipos" as const,
                    emoji: "📱",
                    titulo: "Equipos a crédito o contado",
                    desc: "Celulares nuevos y seminuevos con opciones de financiamiento.",
                  },
                ].map(({ key, emoji, titulo, desc }) => {
                  const activo = promoPrefs[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setPromoPrefs((p) => ({ ...p, [key]: !p[key] }))}
                      className="w-full text-left rounded-xl flex items-start gap-3"
                      style={{
                        background: activo ? "var(--color-accent-light)" : "var(--color-bg-elevated)",
                        border: `1.5px solid ${activo ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                        padding: "12px 14px",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                      }}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                      <div className="flex-1">
                        <p
                          className="text-sm font-semibold leading-tight"
                          style={{ color: activo ? "var(--color-accent)" : "var(--color-text-primary)" }}
                        >
                          {titulo}
                        </p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                          {desc}
                        </p>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: activo ? "var(--color-accent)" : "transparent",
                          border: `1.5px solid ${activo ? "var(--color-accent)" : "var(--color-border)"}`,
                        }}
                      >
                        {activo && (
                          <CheckCircle2 className="w-3 h-3" style={{ color: "#fff" }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Nota de privacidad */}
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Solo te enviaremos mensajes por WhatsApp cuando tengamos algo relevante para ti. Puedes cambiar tu preferencia en cualquier momento.
            </p>

            {/* Botón guardar */}
            <button
              onClick={handleGuardarPromos}
              disabled={savingPromos}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              style={{
                background: promoSaved ? "var(--color-success)" : "var(--color-primary)",
                color: "#FFFFFF",
                border: "none",
                cursor: savingPromos ? "not-allowed" : "pointer",
                opacity: savingPromos ? 0.7 : 1,
                padding: "12px 24px",
                fontFamily: "var(--font-ui)",
                transition: "background 300ms ease",
              }}
            >
              {promoSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Preferencias guardadas
                </>
              ) : savingPromos ? (
                "Guardando…"
              ) : (
                "Guardar preferencias"
              )}
            </button>
          </div>
        </div>

        {/* ── Promociones reales (FASE 35) ────────────────────── */}
        {data.cliente.aceptaPromociones && promosReales.length > 0 && (() => {
          const numero = process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391";
          // Filtrar por preferencias del cliente
          const prefs = data.cliente.preferenciasPromociones as Record<string, boolean | undefined>;
          const promosFiltradas = promosReales.filter((p) => {
            const cat = p.categoria;
            // categorías de preferencia mapeadas
            if (cat === "accesorios" && prefs.accesorios === false) return false;
            if (cat === "combos" && prefs.combos === false) return false;
            if (cat === "celulares" && prefs.celulares === false) return false;
            return true;
          });
          if (promosFiltradas.length === 0) return null;

          const emojiCategoria: Record<string, string> = {
            accesorios: "🛡️",
            combos: "📦",
            celulares: "📱",
            servicios: "🔧",
            general: "🎁",
          };

          return (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Header */}
              <div
                className="px-5 py-4 flex items-center gap-2"
                style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
              >
                <span className="text-base">🎁</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Ofertas exclusivas para ti
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Porque elegiste CREDIPHONE
                  </p>
                </div>
              </div>

              {/* Cards de promociones reales */}
              <div className="p-4 space-y-3">
                {promosFiltradas.map((promo) => {
                  const emoji = emojiCategoria[promo.categoria] ?? "🎁";
                  const descuento =
                    promo.precioNormal && promo.precioPromocion
                      ? Math.round(((promo.precioNormal - promo.precioPromocion) / promo.precioNormal) * 100)
                      : null;
                  const msgWA = `Hola CREDIPHONE, vi la promoción "${promo.titulo}" en el tracking de mi reparación (folio ${orden.folio}). ¿Pueden darme más información?`;
                  return (
                    <div
                      key={promo.id}
                      className="rounded-xl p-4 flex items-start gap-3"
                      style={{
                        background: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <span className="text-2xl shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                            {promo.titulo}
                          </p>
                          {descuento !== null && (
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{
                                background: "var(--color-success-bg)",
                                color: "var(--color-success-text)",
                              }}
                            >
                              -{descuento}%
                            </span>
                          )}
                        </div>
                        {promo.descripcion && (
                          <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--color-text-muted)" }}>
                            {promo.descripcion}
                          </p>
                        )}
                        {promo.precioPromocion !== null && (
                          <div className="flex items-baseline gap-2 mb-3">
                            <span
                              className="text-base font-bold"
                              style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}
                            >
                              ${promo.precioPromocion.toLocaleString("es-MX")}
                            </span>
                            {promo.precioNormal !== null && (
                              <span
                                className="text-xs line-through"
                                style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}
                              >
                                ${promo.precioNormal.toLocaleString("es-MX")}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() =>
                            window.open(
                              `https://wa.me/${numero}?text=${encodeURIComponent(msgWA)}`,
                              "_blank"
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg"
                          style={{
                            background: "#25D366",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Me interesa
                        </button>
                      </div>
                    </div>
                  );
                })}

                <p className="text-xs text-center pt-1" style={{ color: "var(--color-text-muted)" }}>
                  Recibes estas ofertas porque aceptaste comunicaciones de CREDIPHONE.{" "}
                  <span style={{ color: "var(--color-accent)" }}>
                    Escríbenos para desactivarlas.
                  </span>
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── Historial de estados ──────────────────────────── */}
        {historial && historial.length > 0 && (
          <SectionCard title="Historial de Cambios" icon={Clock}>
            <TimelineEstados historial={historial} />
          </SectionCard>
        )}

        {/* ── Fechas ───────────────────────────────────────── */}
        <SectionCard title="Fechas" icon={CalendarDays}>
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            <InfoRow
              label="Recepción"
              value={formatFecha(orden.fechaRecepcion)}
            />
            {orden.fechaEstimadaEntrega && (
              <InfoRow
                label="Entrega estimada"
                value={formatFecha(orden.fechaEstimadaEntrega)}
              />
            )}
            {orden.fechaCompletado && (
              <InfoRow
                label="Completado"
                value={formatFecha(orden.fechaCompletado)}
              />
            )}
          </div>
        </SectionCard>

        {/* ── Técnico asignado ─────────────────────────────── */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-bg-elevated)" }}
          >
            <User
              className="w-4 h-4"
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
          <div>
            <p
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Técnico asignado
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {tecnico.nombre}
            </p>
          </div>
        </div>

        {/* ── Descargar contrato PDF ───────────────────────── */}
        <div
          className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div>
            <p
              className="text-sm font-medium mb-0.5"
              style={{ color: "var(--color-text-primary)" }}
            >
              Contrato / Comprobante de servicio
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Descarga tu orden de reparación en PDF
            </p>
          </div>
          <button
            onClick={() =>
              window.open(`/api/tracking/${token}/pdf`, "_blank")
            }
            className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.opacity = "0.85")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.opacity = "1")
            }
          >
            📄 Descargar PDF
          </button>
        </div>

        {/* ── Contacto WhatsApp ─────────────────────────────── */}
        <div
          className="rounded-2xl p-5 flex flex-col items-center gap-4 text-center"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div>
            <p
              className="text-sm font-medium mb-0.5"
              style={{ color: "var(--color-text-primary)" }}
            >
              ¿Tienes dudas sobre tu reparación?
            </p>
            <p
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Nuestro equipo está aquí para ayudarte
            </p>
          </div>

          <button
            onClick={handleContactarWhatsApp}
            className="flex items-center gap-2.5 py-3 px-6 rounded-xl text-sm font-bold"
            style={{
              background: "#25D366",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
              boxShadow: "0 2px 8px rgba(37,211,102,0.35)",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "#1ebe5d")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "#25D366")
            }
          >
            <MessageCircle className="w-5 h-5" />
            Contactar por WhatsApp
          </button>
        </div>

        {/* ── Catálogo de Servicios (vista previa) ─────────── */}
        <div
          className="rounded-2xl overflow-hidden glass"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          {/* Header de la sección */}
          <div
            className="px-5 py-4 flex items-start gap-3"
            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "var(--color-primary-light)" }}
            >
              <Wrench className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
            </div>
            <div>
              <p
                className="text-sm font-bold leading-snug"
                style={{ color: "var(--color-text-primary)" }}
              >
                Mientras esperas, explora nuestros servicios
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                Accesorios de calidad y reparaciones expertas al mejor precio
              </p>
            </div>
          </div>

          {/* Grid 2×2 de servicios populares */}
          <div className="p-4 grid grid-cols-2 gap-3">
            {(
              [
                {
                  emoji: "📱",
                  nombre: "Cambio de Pantalla",
                  desde: "Desde $450",
                  tiempo: "24–48 hrs",
                  accentBg: "var(--color-accent-light)",
                  accentBorder: "rgba(0,153,184,0.3)",
                  accentText: "var(--color-accent)",
                },
                {
                  emoji: "🔋",
                  nombre: "Batería Original",
                  desde: "Desde $280",
                  tiempo: "1–2 hrs",
                  accentBg: "var(--color-success-bg)",
                  accentBorder: "rgba(21,128,61,0.25)",
                  accentText: "var(--color-success)",
                },
                {
                  emoji: "📸",
                  nombre: "Cámara y Sensor",
                  desde: "Desde $350",
                  tiempo: "24–48 hrs",
                  accentBg: "var(--color-warning-bg)",
                  accentBorder: "rgba(180,83,9,0.25)",
                  accentText: "var(--color-warning)",
                },
                {
                  emoji: "🛡️",
                  nombre: "Fundas y Cristales",
                  desde: "Accesorios premium",
                  tiempo: "Entrega inmediata",
                  accentBg: "var(--color-primary-light)",
                  accentBorder: "rgba(9,36,74,0.15)",
                  accentText: "var(--color-primary)",
                },
              ] as const
            ).map((s) => (
              <div
                key={s.nombre}
                className="rounded-xl p-3.5 flex flex-col gap-2 cursor-pointer select-none"
                style={{
                  background: s.accentBg,
                  border: `1px solid ${s.accentBorder}`,
                  transition: "transform 200ms var(--ease-spring), box-shadow 200ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
                onClick={() => { window.location.href = "/catalogo"; }}
              >
                <span className="text-2xl leading-none">{s.emoji}</span>
                <div className="space-y-0.5">
                  <p
                    className="text-xs font-bold leading-tight"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {s.nombre}
                  </p>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: s.accentText }}
                  >
                    {s.desde}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ⏱ {s.tiempo}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA principal */}
          <div className="px-4 pb-4">
            <a
              href="/catalogo"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-text)",
                textDecoration: "none",
                transition: "background 200ms var(--ease-smooth)",
                boxShadow: "var(--shadow-sm)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--color-primary-mid)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--color-primary)")
              }
            >
              <ChevronRight className="w-4 h-4" />
              Ver Catálogo Completo
            </a>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-1.5 py-4">
          <Lock
            className="w-3 h-3"
            style={{ color: "var(--color-text-muted)" }}
          />
          <p
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            Este link es único y privado — no lo compartas
          </p>
        </div>

      </div>
    </div>
  );
}
