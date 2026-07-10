"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench, CreditCard, ShieldCheck, Star, Phone, MessageCircle,
  ChevronDown, ChevronRight, Loader2, LogOut, CheckCircle2, Clock, AlertCircle,
  Package, DollarSign,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClienteData {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
}

interface OrdenData {
  id: string;
  folio: string;
  estado: string;
  marcaDispositivo: string;
  modeloDispositivo: string;
  imei?: string;
  precioTotal: number;
  fechaRecepcion: string;
  fechaCompletado?: string;
  esGarantia: boolean;
  garantiaActiva?: { diasGarantia: number; fechaVencimiento: string } | null;
}

interface CreditoData {
  id: string;
  folio?: string;
  monto: number;
  saldoPendiente: number;
  estado: string;
  fechaInicio: string;
  tasaInteres: number;
  plazo: number;
}

interface PortalData {
  cliente: ClienteData;
  ordenes: OrdenData[];
  creditos: CreditoData[];
  puntos: { disponibles: number; acumulados: number };
  config: { nombreEmpresa: string; whatsappNumero: string | null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtFecha(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const ESTADO_COLOR: Record<string, { label: string; bg: string; text: string }> = {
  listo_entrega:    { label: "Listo para recoger", bg: "var(--color-success-bg)",  text: "var(--color-success)" },
  en_reparacion:    { label: "En reparación",      bg: "var(--color-info-bg)",     text: "var(--color-info)" },
  esperando_piezas: { label: "Esperando piezas",   bg: "var(--color-warning-bg)",  text: "var(--color-warning)" },
  entregado:        { label: "Entregado",           bg: "var(--color-bg-elevated)", text: "var(--color-text-muted)" },
  cancelado:        { label: "Cancelado",           bg: "var(--color-danger-bg)",   text: "var(--color-danger)" },
  no_reparable:     { label: "No reparable",        bg: "var(--color-danger-bg)",   text: "var(--color-danger)" },
  presupuesto:      { label: "Esperando aprobación", bg: "var(--color-bg-elevated)", text: "var(--color-accent)" },
  diagnostico:      { label: "En diagnóstico",      bg: "var(--color-info-bg)",     text: "var(--color-info)" },
  recibido:         { label: "Recibido",            bg: "var(--color-bg-elevated)", text: "var(--color-text-secondary)" },
};

const CREDITO_COLOR: Record<string, { label: string; text: string }> = {
  activo:    { label: "Activo",    text: "var(--color-success)" },
  vencido:   { label: "Vencido",   text: "var(--color-danger)" },
  liquidado: { label: "Liquidado", text: "var(--color-text-muted)" },
  cancelado: { label: "Cancelado", text: "var(--color-danger)" },
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function OrdenRow({ orden }: { orden: OrdenData }) {
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);
  const estado = ESTADO_COLOR[orden.estado] ?? { label: orden.estado, bg: "var(--color-bg-elevated)", text: "var(--color-text-muted)" };
  const activa = !["entregado", "cancelado", "no_reparable"].includes(orden.estado);

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: hover ? "var(--color-bg-elevated)" : "var(--color-bg-base)",
        transition: "background 0.15s",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        className="w-full text-left"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "0.875rem 1rem" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: "var(--color-text-secondary)" }}
              >
                #{orden.folio}
              </span>
              {activa && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: estado.bg, color: estado.text }}
                >
                  {estado.label}
                </span>
              )}
              {orden.garantiaActiva && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
                >
                  <ShieldCheck className="w-3 h-3" />
                  En garantía
                </span>
              )}
              {orden.esGarantia && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}
                >
                  Garantía
                </span>
              )}
            </div>
            <p
              className="text-sm font-semibold mt-0.5 truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {orden.marcaDispositivo} {orden.modeloDispositivo}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {fmtFecha(orden.fechaRecepcion)}
              {!activa && orden.fechaCompletado && ` · Entregado ${fmtFecha(orden.fechaCompletado)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!activa && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: estado.bg, color: estado.text }}
              >
                {estado.label}
              </span>
            )}
            {expanded
              ? <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
            }
          </div>
        </div>
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 1rem 1rem",
            borderTop: "1px solid var(--color-border)",
            paddingTop: "0.75rem",
          }}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {orden.imei && (
              <>
                <dt style={{ color: "var(--color-text-muted)" }}>IMEI/Serie</dt>
                <dd className="font-mono text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {orden.imei}
                </dd>
              </>
            )}
            <dt style={{ color: "var(--color-text-muted)" }}>Costo del servicio</dt>
            <dd className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {fmtPrecio(orden.precioTotal)}
            </dd>
            {orden.garantiaActiva && (
              <>
                <dt style={{ color: "var(--color-text-muted)" }}>Garantía hasta</dt>
                <dd style={{ color: "var(--color-success)" }}>
                  {fmtFecha(orden.garantiaActiva.fechaVencimiento)}
                  {" "}
                  <span style={{ color: "var(--color-text-muted)" }}>
                    ({orden.garantiaActiva.diasGarantia} días)
                  </span>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientePerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalData | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    fetch("/api/cliente/perfil")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/cliente/solicitar-acceso");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.success) setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleCerrarSesion = async () => {
    setCerrando(true);
    await fetch("/api/cliente/auth", { method: "DELETE" });
    router.replace("/cliente/solicitar-acceso");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-base)" }}>
        <div className="flex flex-col items-center gap-3" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="text-sm">Cargando tu historial...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { cliente, ordenes, creditos, puntos, config } = data;
  const waNumero = config.whatsappNumero?.replace(/\D/g, "");
  const waUrl = waNumero ? `https://wa.me/${waNumero}` : null;

  const ordenesActivas = ordenes.filter(
    (o) => !["entregado", "cancelado", "no_reparable"].includes(o.estado)
  );
  const ordenesHistorial = ordenes.filter((o) =>
    ["entregado", "cancelado", "no_reparable"].includes(o.estado)
  );
  const creditosActivos = creditos.filter((c) => c.estado === "activo");
  const garantiasActivas = ordenes.filter((o) => o.garantiaActiva);

  const nombreCompleto = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");

  return (
    <div style={{ background: "var(--color-bg-base)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--color-bg-elevated)",
          borderBottom: "1px solid var(--color-border)",
          padding: "1rem 1.25rem",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
              {config.nombreEmpresa}
            </p>
            <h1 className="text-base font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
              {nombreCompleto}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleCerrarSesion}
            disabled={cerrando}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
              background: "transparent",
              cursor: cerrando ? "not-allowed" : "pointer",
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Stats rápidos */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: <Wrench className="w-4 h-4" />,
              label: "Servicios",
              value: ordenesActivas.length > 0 ? `${ordenesActivas.length} activo${ordenesActivas.length > 1 ? "s" : ""}` : `${ordenes.length} total`,
              color: "var(--color-info)",
            },
            {
              icon: <ShieldCheck className="w-4 h-4" />,
              label: "Garantías",
              value: `${garantiasActivas.length} activa${garantiasActivas.length !== 1 ? "s" : ""}`,
              color: "var(--color-success)",
            },
            {
              icon: <Star className="w-4 h-4" />,
              label: "Puntos",
              value: puntos.disponibles,
              color: "var(--color-warning)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "0.875rem 0.75rem",
                textAlign: "center",
              }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full mx-auto mb-1.5"
                style={{ background: "var(--color-bg-sunken)", color: stat.color }}
              >
                {stat.icon}
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Órdenes activas */}
        {ordenesActivas.length > 0 && (
          <section>
            <h2
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <Wrench className="w-4 h-4" style={{ color: "var(--color-info)" }} />
              Servicios activos
            </h2>
            <div className="space-y-2">
              {ordenesActivas.map((o) => <OrdenRow key={o.id} orden={o} />)}
            </div>
          </section>
        )}

        {/* Créditos activos */}
        {creditosActivos.length > 0 && (
          <section>
            <h2
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <CreditCard className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
              Créditos activos
            </h2>
            <div className="space-y-2">
              {creditosActivos.map((c) => {
                const pct = c.monto > 0 ? Math.round(((c.monto - c.saldoPendiente) / c.monto) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    style={{
                      background: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                      padding: "0.875rem 1rem",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        {c.folio && (
                          <p className="font-mono text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                            #{c.folio}
                          </p>
                        )}
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {fmtPrecio(c.monto)} total
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: "var(--color-danger)" }}>
                          {fmtPrecio(c.saldoPendiente)}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>pendiente</p>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div
                      style={{
                        height: "4px",
                        background: "var(--color-border)",
                        borderRadius: "99px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--color-success)",
                          borderRadius: "99px",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      {pct}% pagado · {c.plazo} pagos
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Garantías activas */}
        {garantiasActivas.length > 0 && (
          <section>
            <h2
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <ShieldCheck className="w-4 h-4" style={{ color: "var(--color-success)" }} />
              Garantías vigentes
            </h2>
            <div className="space-y-2">
              {garantiasActivas.map((o) => {
                const g = o.garantiaActiva!;
                const diasRestantes = Math.ceil(
                  (new Date(g.fechaVencimiento).getTime() - Date.now()) / 86400000
                );
                return (
                  <div
                    key={o.id}
                    style={{
                      background: "var(--color-success-bg)",
                      border: "1px solid var(--color-success)",
                      borderRadius: "var(--radius-lg)",
                      padding: "0.875rem 1rem",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs" style={{ color: "var(--color-success)" }}>
                          #{o.folio}
                        </p>
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {o.marcaDispositivo} {o.modeloDispositivo}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: "var(--color-success)" }}>
                          {diasRestantes}d
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>restantes</p>
                      </div>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      Vence el {fmtFecha(g.fechaVencimiento)} · {g.diasGarantia} días de garantía
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Historial de servicios */}
        {ordenesHistorial.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setMostrarHistorial((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold mb-2"
              style={{ color: "var(--color-text-secondary)", background: "transparent" }}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
                Historial de servicios
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-normal"
                  style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                >
                  {ordenesHistorial.length}
                </span>
              </span>
              {mostrarHistorial
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
              }
            </button>
            {mostrarHistorial && (
              <div className="space-y-2">
                {ordenesHistorial.map((o) => <OrdenRow key={o.id} orden={o} />)}
              </div>
            )}
          </section>
        )}

        {/* Estado vacío */}
        {ordenes.length === 0 && creditos.length === 0 && (
          <div
            className="text-center py-12 space-y-2"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Package className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm">No tienes servicios registrados aún.</p>
          </div>
        )}

        {/* Botón de contacto */}
        {waUrl && (
          <section>
            <div
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <MessageCircle className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--color-success)" }} />
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                ¿Tienes alguna duda?
              </h3>
              <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
                Contáctanos por WhatsApp y con gusto te ayudamos.
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#25d366", color: "#fff" }}
              >
                <MessageCircle className="w-4 h-4" />
                Contactar por WhatsApp
              </a>
            </div>
          </section>
        )}

        {/* Puntos */}
        {puntos.acumulados > 0 && (
          <section>
            <div
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "var(--color-warning-bg)" }}
                >
                  <Star className="w-5 h-5" style={{ color: "var(--color-warning)" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {puntos.disponibles} puntos disponibles
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {puntos.acumulados} acumulados en total · Aplica en tu próximo servicio
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="text-center text-xs pb-4" style={{ color: "var(--color-text-muted)" }}>
          {config.nombreEmpresa} · Portal del Cliente
        </p>
      </div>
    </div>
  );
}
