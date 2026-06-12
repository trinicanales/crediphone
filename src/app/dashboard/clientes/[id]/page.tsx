"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  User, Phone, Mail, Star, ShieldCheck, Wrench, CreditCard, DollarSign,
  ArrowLeft, ChevronDown, ChevronRight, ExternalLink, MessageCircle,
  Loader2, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientePerfil {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  scoring?: number;
  puntosDisponibles: number;
  puntosAcumulados: number;
}

interface OrdenPerfil {
  id: string;
  folio: string;
  estado: string;
  marcaDispositivo: string;
  modeloDispositivo: string;
  imei?: string;
  costoTotal: number;
  fechaRecepcion: string;
  fechaCompletado?: string;
  esGarantia: boolean;
  garantiaActiva?: { diasGarantia: number; fechaVencimiento: string } | null;
}

interface CreditoPerfil {
  id: string;
  folio?: string;
  monto: number;
  saldoPendiente: number;
  estado: string;
  fechaInicio: string;
  tasaInteres: number;
  plazoSemanas: number;
}

interface PagoPerfil {
  id: string;
  monto: number;
  fechaPago: string;
  metodoPago: string;
  creditoId: string;
}

interface Stats {
  totalReparaciones: number;
  reparacionesActivas: number;
  garantiasActivas: number;
  creditosActivos: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtFecha(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const ESTADO_REPARACION: Record<string, { label: string; bg: string; color: string }> = {
  listo_entrega:    { label: "Listo",         bg: "var(--color-success-bg)",  color: "var(--color-success)" },
  en_reparacion:    { label: "En rep.",        bg: "var(--color-info-bg)",     color: "var(--color-info)" },
  esperando_piezas: { label: "Esp. piezas",   bg: "var(--color-warning-bg)",  color: "var(--color-warning)" },
  entregado:        { label: "Entregado",      bg: "var(--color-bg-elevated)", color: "var(--color-text-muted)" },
  cancelado:        { label: "Cancelado",      bg: "var(--color-danger-bg)",   color: "var(--color-danger)" },
  no_reparable:     { label: "No reparable",  bg: "var(--color-danger-bg)",   color: "var(--color-danger)" },
  presupuesto:      { label: "Presupuesto",    bg: "var(--color-bg-elevated)", color: "var(--color-accent)" },
  diagnostico:      { label: "Diagnóstico",    bg: "var(--color-info-bg)",     color: "var(--color-info)" },
  recibido:         { label: "Recibido",       bg: "var(--color-bg-elevated)", color: "var(--color-text-muted)" },
};

const ESTADO_CREDITO: Record<string, { label: string; color: string }> = {
  activo:   { label: "Activo",    color: "var(--color-success)" },
  vencido:  { label: "Vencido",   color: "var(--color-danger)" },
  liquidado: { label: "Liquidado", color: "var(--color-text-muted)" },
  cancelado: { label: "Cancelado", color: "var(--color-danger)" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientePerfilPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClientePerfil | null>(null);
  const [ordenes, setOrdenes] = useState<OrdenPerfil[]>([]);
  const [creditos, setCreditos] = useState<CreditoPerfil[]>([]);
  const [pagos, setPagos] = useState<PagoPerfil[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);
  const [mostrarPagos, setMostrarPagos] = useState(false);
  const [enviandoAcceso, setEnviandoAcceso] = useState(false);
  const [accesoEnviado, setAccesoEnviado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clientes/${id}/perfil`);
        const data = await res.json();
        if (data.success) {
          setCliente(data.data.cliente);
          setOrdenes(data.data.ordenes);
          setCreditos(data.data.creditos);
          setPagos(data.data.pagos);
          setStats(data.data.stats);
        }
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    };
    void cargar();
  }, [id]);

  const handleEnviarAcceso = async () => {
    setEnviandoAcceso(true);
    try {
      const res = await fetch("/api/cliente/enviar-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: id }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.waLink) {
          window.open(data.waLink, "_blank");
        }
        setAccesoEnviado(true);
        setTimeout(() => setAccesoEnviado(false), 4000);
      }
    } catch {
      // silencioso
    } finally {
      setEnviandoAcceso(false);
    }
  };

  const ordenesActivas = ordenes.filter(
    (o) => !["entregado", "cancelado", "no_reparable"].includes(o.estado)
  );
  const ordenesArchivadas = ordenes.filter(
    (o) => ["entregado", "cancelado", "no_reparable"].includes(o.estado)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: "var(--color-text-muted)" }}>
        Cargando perfil...
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p style={{ color: "var(--color-text-muted)" }}>Cliente no encontrado</p>
        <button onClick={() => router.back()} style={{ color: "var(--color-accent)" }}>
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a clientes
      </button>

      {/* Header del cliente */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--color-accent-light)" }}
          >
            <User className="w-7 h-7" style={{ color: "var(--color-accent)" }} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
              {cliente.nombre} {cliente.apellido}
            </h1>
            <div className="flex flex-wrap gap-3 mt-1">
              {cliente.telefono && (
                <span className="flex items-center gap-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <Phone className="w-3.5 h-3.5" />
                  {cliente.telefono}
                </span>
              )}
              {cliente.email && (
                <span className="flex items-center gap-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <Mail className="w-3.5 h-3.5" />
                  {cliente.email}
                </span>
              )}
            </div>
          </div>

          {/* Scoring + Puntos */}
          <div className="flex gap-4">
            {cliente.scoring !== undefined && (
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Scoring</p>
                <p
                  className="text-2xl font-bold font-mono"
                  style={{ color: cliente.scoring >= 70 ? "var(--color-success)" : cliente.scoring >= 40 ? "var(--color-warning)" : "var(--color-danger)" }}
                >
                  {cliente.scoring}
                </p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Puntos</p>
              <p className="text-2xl font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                {cliente.puntosDisponibles.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleEnviarAcceso}
            disabled={enviandoAcceso || accesoEnviado}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: accesoEnviado ? "var(--color-success-bg)" : "var(--color-bg-sunken)",
              color: accesoEnviado ? "var(--color-success)" : "var(--color-text-secondary)",
              border: `1px solid ${accesoEnviado ? "var(--color-success)" : "var(--color-border)"}`,
              cursor: enviandoAcceso ? "not-allowed" : "pointer",
              opacity: enviandoAcceso ? 0.7 : 1,
              transition: "all 0.2s",
            }}
          >
            {enviandoAcceso ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : accesoEnviado ? (
              <><CheckCircle2 className="w-4 h-4" /> ¡Link enviado!</>
            ) : (
              <><MessageCircle className="w-4 h-4" /> Enviar acceso por WhatsApp</>
            )}
          </button>
        </div>

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { icon: Wrench, label: "Reparaciones", value: stats.totalReparaciones, color: "var(--color-accent)" },
              { icon: Wrench, label: "Activas", value: stats.reparacionesActivas, color: "var(--color-info)" },
              { icon: ShieldCheck, label: "Garantías", value: stats.garantiasActivas, color: "var(--color-success)" },
              { icon: CreditCard, label: "Créditos activos", value: stats.creditosActivos, color: "var(--color-warning)" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="rounded-xl p-3 text-center"
                style={{ background: "var(--color-bg-sunken)" }}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                <p className="text-xl font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>{value}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reparaciones activas */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
          <Wrench className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          Reparaciones activas ({ordenesActivas.length})
        </h2>
        {ordenesActivas.length === 0 ? (
          <p className="text-sm py-3" style={{ color: "var(--color-text-muted)" }}>Sin reparaciones activas</p>
        ) : (
          <div className="space-y-2">
            {ordenesActivas.map((o) => (
              <OrdenRow key={o.id} orden={o} />
            ))}
          </div>
        )}
      </section>

      {/* Reparaciones archivadas (toggle) */}
      {ordenesArchivadas.length > 0 && (
        <section>
          <button
            onClick={() => setMostrarArchivadas((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium py-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {mostrarArchivadas ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Historial de reparaciones ({ordenesArchivadas.length})
          </button>
          {mostrarArchivadas && (
            <div className="space-y-2 mt-2">
              {ordenesArchivadas.map((o) => (
                <OrdenRow key={o.id} orden={o} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Créditos */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
          <CreditCard className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          Créditos ({creditos.length})
        </h2>
        {creditos.length === 0 ? (
          <p className="text-sm py-3" style={{ color: "var(--color-text-muted)" }}>Sin créditos registrados</p>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          >
            {creditos.map((c, i) => {
              const estadoInfo = ESTADO_CREDITO[c.estado] ?? { label: c.estado, color: "var(--color-text-muted)" };
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                  style={{
                    background: "var(--color-bg-surface)",
                    borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
                  }}
                >
                  <div>
                    <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {c.folio ?? c.id.substring(0, 8)}
                    </span>
                    <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {fmtFecha(c.fechaInicio)} · {c.plazoSemanas}sem
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>
                        {fmtPrecio(c.monto)}
                      </p>
                      {c.saldoPendiente > 0 && (
                        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                          Saldo: {fmtPrecio(c.saldoPendiente)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: estadoInfo.color }}>
                      {estadoInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pagos recientes */}
      {pagos.length > 0 && (
        <section>
          <button
            onClick={() => setMostrarPagos((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium py-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {mostrarPagos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <DollarSign className="w-4 h-4" />
            Pagos recientes ({pagos.length})
          </button>
          {mostrarPagos && (
            <div className="mt-2 space-y-1">
              {pagos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2 rounded-lg text-sm"
                  style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
                >
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {fmtFecha(p.fechaPago)} · {p.metodoPago}
                  </span>
                  <span className="font-mono font-semibold" style={{ color: "var(--color-success)" }}>
                    {fmtPrecio(p.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── OrdenRow sub-component ────────────────────────────────────────────────────

function OrdenRow({ orden }: { orden: OrdenPerfil }) {
  const estadoInfo = ESTADO_REPARACION[orden.estado] ?? { label: orden.estado, bg: "var(--color-bg-elevated)", color: "var(--color-text-muted)" };
  const hoy = Date.now();
  const garantiaVigente = orden.garantiaActiva && new Date(orden.garantiaActiva.fechaVencimiento).getTime() >= hoy;

  const handleVerOrden = () => {
    window.location.href = `/dashboard/reparaciones?orden=${orden.id}`;
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>
            {orden.folio}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: estadoInfo.bg, color: estadoInfo.color }}>
            {estadoInfo.label}
          </span>
          {garantiaVigente && (
            <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
              <ShieldCheck className="w-3 h-3" />
              En garantía
            </span>
          )}
          {orden.esGarantia && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}>
              Garantía
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {[orden.marcaDispositivo, orden.modeloDispositivo].filter(Boolean).join(" ")}
          {orden.imei && <span className="font-mono ml-2">{orden.imei}</span>}
          <span className="ml-2">{new Date(orden.fechaRecepcion).toLocaleDateString("es-MX")}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {orden.costoTotal > 0 && (
          <span className="text-sm font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
            ${orden.costoTotal.toFixed(2)}
          </span>
        )}
        <button
          onClick={handleVerOrden}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--color-text-muted)" }}
          title="Ver orden"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
