"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Smartphone,
  Search,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  Package,
  CalendarDays,
  User,
  Lock,
  CircleDashed,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ─────────────────────────────────────────────────── */

interface OrdenPublica {
  folio: string;
  estado: string;
  marcaDispositivo: string;
  modeloDispositivo: string;
  problemaReportado: string;
  diagnosticoTecnico?: string;
  prioridad: string;
  fechaRecepcion: string;
  fechaEstimadaEntrega?: string;
  fechaCompletado?: string;
  esGarantia: boolean;
  costoTotal: number;
  requiereAprobacion: boolean;
  aprobadoPorCliente: boolean;
  aprobacionParcial?: boolean;
  clienteNombre?: string;
  tecnicoNombre?: string;
  historial: { estado_nuevo: string; estado_anterior: string | null; comentario?: string; created_at: string }[];
  trackingToken?: string | null;
  whatsappSoporte?: string;
  nombreEmpresa?: string;
}

/* ── Estado visual ──────────────────────────────────────────── */

const ESTADOS: Record<string, { label: string; descripcion: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  recibido:       { label: "Recibido",              descripcion: "Tu dispositivo fue recibido y está en cola para diagnóstico.",  icon: CircleDashed,  color: "var(--color-info)",     bg: "var(--color-info-bg)" },
  diagnostico:    { label: "En Diagnóstico",         descripcion: "Nuestro técnico está evaluando tu dispositivo.",               icon: Search,        color: "var(--color-warning)",  bg: "var(--color-warning-bg)" },
  presupuesto:    { label: "Presupuesto Listo",      descripcion: "El diagnóstico está completo. Revisa y aprueba el presupuesto.", icon: AlertTriangle, color: "var(--color-warning)",  bg: "var(--color-warning-bg)" },
  aprobado:       { label: "Aprobado",               descripcion: "Presupuesto aprobado. La reparación está por comenzar.",       icon: CheckCircle2,  color: "var(--color-success)",  bg: "var(--color-success-bg)" },
  en_reparacion:  { label: "En Reparación",          descripcion: "Tu dispositivo está siendo reparado.",                        icon: Wrench,        color: "var(--color-accent)",   bg: "var(--color-accent-light)" },
  completado:     { label: "Reparación Completada",  descripcion: "¡Tu dispositivo ha sido reparado exitosamente!",              icon: CheckCircle2,  color: "var(--color-success)",  bg: "var(--color-success-bg)" },
  listo_entrega:  { label: "Listo para Recoger",     descripcion: "¡Tu dispositivo está listo. Pasa a recogerlo!",              icon: Package,       color: "var(--color-success)",  bg: "var(--color-success-bg)" },
  entregado:      { label: "Entregado",              descripcion: "Dispositivo entregado. ¡Gracias por elegirnos!",              icon: ShieldCheck,   color: "var(--color-text-muted)", bg: "var(--color-bg-elevated)" },
  no_reparable:   { label: "No Reparable",           descripcion: "Lamentablemente, este dispositivo no puede ser reparado.",    icon: XCircle,       color: "var(--color-danger)",   bg: "var(--color-danger-bg)" },
  cancelado:      { label: "Cancelado",              descripcion: "La orden ha sido cancelada.",                                 icon: XCircle,       color: "var(--color-text-muted)", bg: "var(--color-bg-elevated)" },
};

function getEstado(estado: string) {
  return ESTADOS[estado] ?? ESTADOS["recibido"];
}

function formatFecha(f?: string) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

/* ── Loading ─────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="min-h-screen app-bg py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center mb-8 space-y-2">
          <div className="h-6 w-36 rounded mx-auto animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-4 w-52 rounded mx-auto animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}>
          <div className="px-6 py-10 flex flex-col items-center gap-3" style={{ background: "var(--color-sidebar-bg)" }}>
            <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--color-sidebar-surface)" }} />
            <div className="h-9 w-44 rounded animate-pulse" style={{ background: "var(--color-sidebar-surface)" }} />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-16 w-full rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
            <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Error ─────────────────────────────────────────────────── */

function ErrorPage({ mensaje }: { mensaje: string }) {
  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center text-center gap-5"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--color-danger-bg)" }}>
          <AlertTriangle className="w-8 h-8" style={{ color: "var(--color-danger)" }} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Orden no encontrada</h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{mensaje}</p>
        </div>
        <div className="w-full rounded-lg p-4 text-sm" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
          Verifica el folio o contacta al servicio de reparación para obtener ayuda.
        </div>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */

export default function ReparacionFolioPage() {
  const params = useParams();
  const router = useRouter();
  const folio = (params.folio as string)?.toUpperCase();

  const [orden, setOrden] = useState<OrdenPublica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpleado, setIsEmpleado] = useState(false);

  // Estados finales donde NO redirigimos al tracking (ya no hay acción pendiente del cliente)
  const estadosFinales = ["listo_entrega", "entregado", "no_reparable", "cancelado"];

  useEffect(() => {
    // Verificar si hay sesión activa (empleado en dashboard)
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setIsEmpleado(!!session?.user);
      } catch {
        setIsEmpleado(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!folio) return;

    async function cargar() {
      try {
        setLoading(true);
        const res = await fetch(`/api/reparacion/${folio}`);
        const data = await res.json();
        if (data.success) {
          setOrden(data.data);
          // Redirigir al tracking solo si hay token Y no es un estado final
          // (en estados finales la página de QR de entrega es más útil)
          if (data.data.trackingToken && !estadosFinales.includes(data.data.estado)) {
            router.replace(`/tracking/${data.data.trackingToken}`);
          }
        } else {
          setError(data.message || "No se encontró la orden");
        }
      } catch {
        setError("Error al cargar la orden");
      } finally {
        setLoading(false);
      }
    }

    cargar();
  }, [folio, router]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Skeleton />;
  if (error || !orden) return <ErrorPage mensaje={error ?? "No se encontró información para este folio."} />;

  const estadoInfo = getEstado(orden.estado);
  const StatusIcon = estadoInfo.icon;

  // Pasos del proceso para mostrar progreso visual
  const PASOS = ["recibido", "diagnostico", "aprobado", "en_reparacion", "completado", "listo_entrega", "entregado"];
  const pasoActual = PASOS.indexOf(orden.estado);

  function handleWhatsApp() {
    const numero = orden?.whatsappSoporte || process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391";
    const msg = `Hola, consulta sobre mi reparación:\n\nFolio: ${orden!.folio}\nDispositivo: ${orden!.marcaDispositivo} ${orden!.modeloDispositivo}\n\n`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="min-h-screen app-bg py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Marca */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--color-accent)" }} />
            <span className="text-base font-bold tracking-widest uppercase"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)", letterSpacing: "0.12em" }}
            >
              {orden?.nombreEmpresa || "CREDIPHONE"}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Seguimiento de Reparación</p>
        </div>

        {/* Tarjeta de folio y estado */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-md)" }}
        >
          {/* Header oscuro */}
          <div className="px-6 py-8 flex flex-col items-center gap-2" style={{ background: "var(--color-sidebar-bg)" }}>
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--color-sidebar-text-dim)", fontFamily: "var(--font-mono)" }}>
              Orden de Servicio
            </p>
            <h2 className="text-3xl font-bold tracking-wider"
              style={{ color: "var(--color-sidebar-active)", fontFamily: "var(--font-mono)" }}
            >
              {orden.folio}
            </h2>
            {orden.esGarantia && (
              <div className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(0,184,217,0.15)", border: "1px solid rgba(0,184,217,0.4)", color: "var(--color-sidebar-active)" }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Orden en Garantía
              </div>
            )}
          </div>

          {/* Estado actual */}
          <div className="p-5">
            <div className="flex items-center gap-4 rounded-xl p-4"
              style={{ background: estadoInfo.bg, border: `1px solid ${estadoInfo.color}` }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.6)" }}>
                <StatusIcon className="w-6 h-6" style={{ color: estadoInfo.color }} />
              </div>
              <div>
                <p className="text-base font-bold leading-tight" style={{ color: estadoInfo.color }}>
                  {estadoInfo.label}
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: estadoInfo.color, opacity: 0.85 }}>
                  {estadoInfo.descripcion}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            {pasoActual >= 0 && orden.estado !== "cancelado" && orden.estado !== "no_reparable" && (
              <div className="mt-4">
                <div className="flex items-center gap-1">
                  {PASOS.map((paso, i) => (
                    <div key={paso} className="flex-1 h-1.5 rounded-full"
                      style={{
                        background: i <= pasoActual
                          ? "var(--color-success)"
                          : "var(--color-bg-elevated)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Recibido</span>
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Entregado</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Banner entrega (listo_entrega) ── */}
        {orden.estado === "listo_entrega" && isEmpleado && (
          <div className="rounded-xl p-5"
            style={{ background: "var(--color-success-bg)", border: "2px solid var(--color-success)" }}
          >
            <div className="flex items-start gap-3 mb-4">
              <Package className="w-6 h-6 shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
              <div>
                <p className="text-base font-bold" style={{ color: "var(--color-success-text, var(--color-success))" }}>
                  Equipo listo para entrega
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-success-text, var(--color-success))", opacity: 0.85 }}>
                  Folio escaneado: <strong style={{ fontFamily: "var(--font-mono)" }}>{orden.folio}</strong>
                </p>
              </div>
            </div>
            <a
              href={`/dashboard/reparaciones?buscar=${orden.folio}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
              style={{ background: "var(--color-success)", color: "#fff", textDecoration: "none" }}
            >
              <ArrowRight className="w-5 h-5" />
              Ir al dashboard — procesar entrega
            </a>
          </div>
        )}

        {orden.estado === "listo_entrega" && !isEmpleado && (
          <div className="rounded-xl p-4"
            style={{ background: "var(--color-info-bg, #e0f2fe)", border: "1px solid var(--color-info, #0ea5e9)" }}
          >
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-info, #0369a1)" }} />
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-info, #0369a1)" }}>
                  Tu equipo está listo para recoger
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-info, #0369a1)", opacity: 0.9 }}>
                  Solicita a un empleado de {orden?.nombreEmpresa || "la tienda"} que procese la entrega presentando este folio.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Banner entregado ── */}
        {orden.estado === "entregado" && (
          <div className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--color-success)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
              Equipo entregado
              {orden.fechaCompletado && (
                <span className="font-normal" style={{ color: "var(--color-success)", opacity: 0.8 }}>
                  {" "}— {formatFecha(orden.fechaCompletado)}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Alerta de aprobación parcial */}
        {orden.aprobacionParcial && (
          <div className="rounded-xl p-4"
            style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-sm" style={{ color: "var(--color-warning-text)" }}>
                  Aprobación Parcial
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-warning-text)", opacity: 0.85 }}>
                  Autorizaste solo la reparación del problema original. No se realizarán las reparaciones adicionales.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Información del dispositivo */}
        <div className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <Smartphone className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
            <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)" }}>
              Tu Dispositivo
            </h3>
          </div>
          <div className="p-5 divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            <div className="flex justify-between py-2.5">
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Dispositivo</span>
              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.marcaDispositivo} {orden.modeloDispositivo}
              </span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Problema reportado</span>
              <span className="text-sm font-medium text-right max-w-[55%]" style={{ color: "var(--color-text-primary)" }}>
                {orden.problemaReportado}
              </span>
            </div>
          </div>
        </div>

        {/* Diagnóstico técnico (si ya hay) */}
        {orden.diagnosticoTecnico && (
          <div className="rounded-xl overflow-hidden"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)" }}>
                Diagnóstico Técnico
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {orden.diagnosticoTecnico}
              </p>
            </div>
          </div>
        )}

        {/* Aviso si requiere aprobación y tiene token */}
        {orden.estado === "presupuesto" && !orden.aprobadoPorCliente && orden.trackingToken && (
          <div className="rounded-xl p-4"
            style={{ background: "var(--color-warning-bg)", border: "2px solid var(--color-warning)" }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-warning-text)" }}>
                  Tu aprobación es requerida
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-warning-text)", opacity: 0.85 }}>
                  El técnico preparó un presupuesto para tu reparación. Usa el link que te enviamos por WhatsApp para aprobarlo o rechazarlo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
            <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)" }}>
              Fechas
            </h3>
          </div>
          <div className="p-5 divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            <div className="flex justify-between py-2.5">
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Recepción</span>
              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {formatFecha(orden.fechaRecepcion)}
              </span>
            </div>
            {orden.fechaEstimadaEntrega && (
              <div className="flex justify-between py-2.5">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Entrega estimada</span>
                <span className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                  {formatFecha(orden.fechaEstimadaEntrega)}
                </span>
              </div>
            )}
            {orden.fechaCompletado && (
              <div className="flex justify-between py-2.5">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Completado</span>
                <span className="text-sm font-medium" style={{ color: "var(--color-success)" }}>
                  {formatFecha(orden.fechaCompletado)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Técnico */}
        {orden.tecnicoNombre && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-bg-elevated)" }}>
              <User className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Técnico asignado</p>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{orden.tecnicoNombre}</p>
            </div>
          </div>
        )}

        {/* Historial */}
        {orden.historial.length > 0 && (
          <div className="rounded-xl overflow-hidden"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--color-text-secondary)" }}>
                Historial
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {orden.historial.map((h, i) => {
                const info = getEstado(h.estado_nuevo);
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: info.color }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {info.label}
                      </p>
                      {h.comentario && (
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{h.comentario}</p>
                      )}
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {new Date(h.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WhatsApp */}
        <div className="rounded-2xl p-5 flex flex-col items-center gap-4 text-center"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)" }}
        >
          <div>
            <p className="text-sm font-medium mb-0.5" style={{ color: "var(--color-text-primary)" }}>
              ¿Tienes dudas sobre tu reparación?
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Nuestro equipo está aquí para ayudarte
            </p>
          </div>
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-2.5 py-3 px-6 rounded-xl text-sm font-bold"
            style={{ background: "#25D366", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", boxShadow: "0 2px 8px rgba(37,211,102,0.35)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#1ebe5d")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#25D366")}
          >
            <MessageCircle className="w-5 h-5" />
            Contactar por WhatsApp
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 py-4">
          <Lock className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {orden?.nombreEmpresa || "CREDIPHONE"} — Servicio de Reparaciones
          </p>
        </div>

      </div>
    </div>
  );
}
