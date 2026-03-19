"use client";

/**
 * FASE 53 — Dashboard Ejecutivo Persistente (Command Center)
 * Para roles: admin, super_admin
 *
 * Zona 1: Pulso del Día        → 6 KPI cards
 * Zona 2: Órdenes activas      → mini-tabla de reparaciones con drawer
 * Zona 3: Acciones Rápidas     → 5 shortcuts por rol
 * Zona 4: Stream de Actividad  → últimos 12 eventos
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Wallet,
  Store,
  PackageX,
  CreditCard,
  Vault,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Package,
  Users,
  BarChart3,
  Zap,
  Activity,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { OrdenDrawer } from "@/components/reparaciones/drawer/OrdenDrawer";
import { ModalOrden } from "@/components/reparaciones/ModalOrden";
import type { OrdenReparacionDetallada } from "@/types";

// ── Tipos ─────────────────────────────────────────────────────

interface ResumenDashboard {
  reparaciones: {
    activas: number;
    listasEntrega: number;
    esperandoPiezas: number;
    abiertas: number;
    urgentes: number;
  };
  finanzas: {
    cobradoHoy: number;
    ventasHoy: number;
    totalIngresoHoy: number;
  };
  creditos: {
    conMora: number;
    montoMoraTotal: number;
  };
  inventario: {
    stockCritico: number;
  };
  caja: {
    activa: boolean;
    folio: string | null;
  };
}

interface StreamEvent {
  id: string;
  tipo: "reparacion" | "pago" | "venta";
  descripcion: string;
  detalle: string;
  fecha: string;
  icono: string;
  color: string;
}

// ── Helpers ───────────────────────────────────────────────────

const formatMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ── Skeleton para KPI card ────────────────────────────────────

function KpiSkeleton() {
  return (
    <div
      className="rounded-xl p-5 animate-pulse"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-28 rounded mb-3" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-9 w-20 rounded mb-2" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-3 w-32 rounded" style={{ background: "var(--color-bg-sunken)" }} />
        </div>
        <div className="w-11 h-11 rounded-lg ml-3" style={{ background: "var(--color-bg-elevated)" }} />
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  href?: string;
  alert?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, iconColor, iconBg, href, alert }: KpiCardProps) {
  const [hov, setHov] = useState(false);

  const inner = (
    <div
      className="rounded-xl p-5 flex items-start justify-between"
      style={{
        background: "var(--color-bg-surface)",
        border: `1px solid ${alert ? "var(--color-danger)" : "var(--color-border-subtle)"}`,
        boxShadow: hov ? "var(--shadow-md)" : "var(--shadow-sm)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        transition: "all 200ms var(--ease-spring)",
        cursor: href ? "pointer" : "default",
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium mb-1"
          style={{ color: alert ? "var(--color-danger)" : "var(--color-text-secondary)" }}
        >
          {label}
          {alert && <span className="ml-1.5 text-xs">⚠</span>}
        </p>
        <p
          className="text-3xl font-bold mb-1.5 tabular-nums"
          style={{
            color: alert ? "var(--color-danger)" : "var(--color-text-primary)",
            fontFamily: "var(--font-data)",
          }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block"
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        {inner}
      </Link>
    );
  }
  return <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>{inner}</div>;
}

// ── Estado de orden badge ─────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  recibido:         { label: "Recibida",    bg: "var(--color-info-bg)",    text: "var(--color-info)" },
  diagnostico:      { label: "Diagnóstico", bg: "var(--color-warning-bg)", text: "var(--color-warning)" },
  esperando_piezas: { label: "Sin piezas",  bg: "var(--color-danger-bg)",  text: "var(--color-danger)" },
  reparando:        { label: "Reparando",   bg: "var(--color-accent-light)",text: "var(--color-accent)" },
  listo_entrega:    { label: "Lista",       bg: "var(--color-success-bg)", text: "var(--color-success)" },
  presupuesto:      { label: "Presupuesto", bg: "var(--color-warning-bg)", text: "var(--color-warning)" },
  aprobado:         { label: "Aprobado",    bg: "var(--color-success-bg)", text: "var(--color-success)" },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, bg: "var(--color-bg-elevated)", text: "var(--color-text-secondary)" };
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

// ── Acciones Rápidas por rol ───────────────────────────────────

interface AccionRapida {
  label: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  color: string;
  bg: string;
}

function AccionesRapidas({
  role,
  cajaActiva,
  onNuevaOrden,
}: {
  role: string;
  cajaActiva: boolean;
  onNuevaOrden: () => void;
}) {
  const router = useRouter();

  const accionesAdmin: AccionRapida[] = [
    { label: "Nueva reparación",    icon: Wrench,      action: onNuevaOrden,               color: "var(--color-accent)",   bg: "var(--color-accent-light)" },
    { label: "Punto de venta",       icon: Store,       href: "/dashboard/pos",              color: "var(--color-info)",     bg: "var(--color-info-bg)" },
    { label: cajaActiva ? "Ver caja" : "Abrir caja", icon: Vault, href: "/dashboard/pos/caja", color: cajaActiva ? "var(--color-success)" : "var(--color-warning)", bg: cajaActiva ? "var(--color-success-bg)" : "var(--color-warning-bg)" },
    { label: "Nuevo cliente",        icon: Users,       href: "/dashboard/clientes",         color: "var(--color-primary)",  bg: "var(--color-primary-light)" },
    { label: "Nuevo crédito",        icon: CreditCard,  href: "/dashboard/creditos",         color: "var(--color-warning)",  bg: "var(--color-warning-bg)" },
  ];

  const accionesSuperAdmin: AccionRapida[] = [
    { label: "Nueva reparación",    icon: Wrench,      action: onNuevaOrden,               color: "var(--color-accent)",   bg: "var(--color-accent-light)" },
    { label: "Punto de venta",       icon: Store,       href: "/dashboard/pos",              color: "var(--color-info)",     bg: "var(--color-info-bg)" },
    { label: "Cartera vencida",      icon: AlertTriangle,href: "/dashboard/creditos/cartera-vencida", color: "var(--color-danger)",  bg: "var(--color-danger-bg)" },
    { label: "Reportes",             icon: BarChart3,   href: "/dashboard/reportes",         color: "var(--color-primary)",  bg: "var(--color-primary-light)" },
    { label: "Distribuidores",       icon: Zap,         href: "/dashboard/admin/distribuidores", color: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  ];

  const acciones = role === "super_admin" ? accionesSuperAdmin : accionesAdmin;

  return (
    <div>
      <h3
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        Acciones rápidas
      </h3>
      <div className="flex flex-col gap-2">
        {acciones.map((acc) => {
          const btn = (
            <button
              key={acc.label}
              onClick={() => {
                if (acc.action) acc.action();
                else if (acc.href) router.push(acc.href);
              }}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-left"
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-subtle)",
                color: "var(--color-text-primary)",
                transition: "all 150ms var(--ease-smooth)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = acc.bg;
                (e.currentTarget as HTMLButtonElement).style.color = acc.color;
                (e.currentTarget as HTMLButtonElement).style.borderColor = acc.color;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--color-bg-elevated)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-primary)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-subtle)";
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: acc.bg, color: acc.color }}
              >
                <acc.icon className="w-3.5 h-3.5" />
              </div>
              {acc.label}
            </button>
          );
          return btn;
        })}
      </div>
    </div>
  );
}

// ── Stream de Actividad ───────────────────────────────────────

const STREAM_COLOR: Record<string, string> = {
  accent:  "var(--color-accent)",
  success: "var(--color-success)",
  info:    "var(--color-info)",
  warning: "var(--color-warning)",
};
const STREAM_BG: Record<string, string> = {
  accent:  "var(--color-accent-light)",
  success: "var(--color-success-bg)",
  info:    "var(--color-info-bg)",
  warning: "var(--color-warning-bg)",
};
const STREAM_ICON: Record<string, React.ElementType> = {
  wrench: Wrench,
  wallet: Wallet,
  store:  Store,
};

function StreamItem({ ev }: { ev: StreamEvent }) {
  const Icon = STREAM_ICON[ev.icono] ?? Activity;
  const color = STREAM_COLOR[ev.color] ?? "var(--color-text-secondary)";
  const bg = STREAM_BG[ev.color] ?? "var(--color-bg-elevated)";

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: bg, color }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate" style={{ color: "var(--color-text-primary)" }}>
          {ev.descripcion}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>
          {ev.detalle}
        </p>
      </div>
      <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
        {timeAgo(ev.fecha)}
      </span>
    </div>
  );
}

// ── Widget de órdenes activas ─────────────────────────────────

const ORDEN_TABS = [
  { key: "pendiente",       label: "Pendientes",  estados: ["recibido", "diagnostico", "presupuesto"] },
  { key: "listo_entrega",   label: "Listas",      estados: ["listo_entrega"] },
  { key: "esperando",       label: "Sin piezas",  estados: ["esperando_piezas"] },
] as const;

function OrdenesWidget({
  ordenes,
  loading,
  onOpen,
}: {
  ordenes: OrdenReparacionDetallada[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const [tabIdx, setTabIdx] = useState(0);
  const tab = ORDEN_TABS[tabIdx];

  const filtered = ordenes.filter((o) =>
    (tab.estados as readonly string[]).includes(o.estado)
  );

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Órdenes activas
          </h3>
        </div>
        <Link
          href="/dashboard/reparaciones"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
        {ORDEN_TABS.map((t, i) => {
          const count = ordenes.filter((o) =>
            (t.estados as readonly string[]).includes(o.estado)
          ).length;
          return (
            <button
              key={t.key}
              onClick={() => setTabIdx(i)}
              className="flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5"
              style={{
                borderBottom: tabIdx === i ? "2px solid var(--color-accent)" : "2px solid transparent",
                color: tabIdx === i ? "var(--color-accent)" : "var(--color-text-muted)",
                background: "transparent",
                transition: "all 150ms ease",
              }}
            >
              {t.label}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: tabIdx === i ? "var(--color-accent-light)" : "var(--color-bg-elevated)",
                    color: tabIdx === i ? "var(--color-accent)" : "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-3 animate-pulse">
              <div className="h-4 w-16 rounded" style={{ background: "var(--color-bg-elevated)" }} />
              <div className="h-4 flex-1 rounded" style={{ background: "var(--color-bg-sunken)" }} />
              <div className="h-5 w-20 rounded-full" style={{ background: "var(--color-bg-elevated)" }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8" style={{ color: "var(--color-success)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
              Sin órdenes en esta categoría
            </p>
          </div>
        ) : (
          filtered.slice(0, 6).map((o) => (
            <button
              key={o.id}
              onClick={() => onOpen(o.id)}
              className="w-full px-5 py-3 flex items-center gap-3 text-left"
              style={{ transition: "background 120ms ease" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--color-bg-elevated)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span
                className="text-xs font-mono font-semibold flex-shrink-0"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
              >
                {o.folio ?? o.id.slice(0, 8)}
              </span>
              <span className="flex-1 text-sm truncate" style={{ color: "var(--color-text-primary)" }}>
                {o.clienteNombre ?? "—"}
              </span>
              <span className="text-xs truncate max-w-[120px]" style={{ color: "var(--color-text-muted)" }}>
                {o.marcaDispositivo} {o.modeloDispositivo}
              </span>
              <EstadoBadge estado={o.estado} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Greeting inteligente ──────────────────────────────────────

function Greeting({ nombre }: { nombre: string }) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const hoy = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex items-end justify-between flex-wrap gap-2">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {saludo}, {nombre.split(" ")[0]} 👋
        </h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color: "var(--color-text-muted)" }}>
          {hoy}
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────

export function DashboardEjecutivo() {
  const { user } = useAuth();

  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [stream, setStream] = useState<StreamEvent[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenReparacionDetallada[]>([]);

  const [loadingResumen, setLoadingResumen] = useState(true);
  const [loadingStream, setLoadingStream] = useState(true);
  const [loadingOrdenes, setLoadingOrdenes] = useState(true);

  const [drawerOrdenId, setDrawerOrdenId] = useState<string | null>(null);
  const [modalOrdenOpen, setModalOrdenOpen] = useState(false);

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    setLoadingResumen(true);
    setLoadingStream(true);
    setLoadingOrdenes(true);

    const REQUIEREN_ACCION = ["recibido", "diagnostico", "esperando_piezas", "presupuesto", "aprobado", "listo_entrega"];

    const [resRes, streamRes, ordenesRes] = await Promise.allSettled([
      fetch("/api/dashboard/resumen").then((r) => r.json()),
      fetch("/api/dashboard/stream").then((r) => r.json()),
      fetch("/api/reparaciones?detalladas=true").then((r) => r.json()),
    ]);

    if (resRes.status === "fulfilled" && resRes.value.success) {
      setResumen(resRes.value.data);
    }
    setLoadingResumen(false);

    if (streamRes.status === "fulfilled" && streamRes.value.success) {
      setStream(streamRes.value.data);
    }
    setLoadingStream(false);

    if (ordenesRes.status === "fulfilled" && ordenesRes.value.success) {
      const todas: OrdenReparacionDetallada[] = ordenesRes.value.data;
      setOrdenes(todas.filter((o) => REQUIEREN_ACCION.includes(o.estado)));
    }
    setLoadingOrdenes(false);

    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void fetchAll();
    const interval = setInterval(() => { void fetchAll(); }, 3 * 60 * 1000);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearInterval(interval);
  }, [fetchAll]);

  const r = resumen;
  const nombre = user?.name ?? user?.email ?? "usuario";

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Greeting + refresh ── */}
      <div className="flex items-center justify-between">
        <Greeting nombre={nombre} />
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text-muted)",
          }}
          title="Actualizar dashboard"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {lastRefresh.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
        </button>
      </div>

      {/* ── Zona 1: Pulso del Día — 6 KPIs ── */}
      <section>
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          Pulso del día
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {loadingResumen ? (
            Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              {/* 1. Reparaciones activas */}
              <KpiCard
                label="Reparaciones activas"
                value={r?.reparaciones.activas ?? 0}
                sub={r && r.reparaciones.urgentes > 0
                  ? `${r.reparaciones.urgentes} urgentes`
                  : `${r?.reparaciones.abiertas ?? 0} abiertas hoy`}
                icon={Wrench}
                iconColor="var(--color-accent)"
                iconBg="var(--color-accent-light)"
                href="/dashboard/reparaciones"
                alert={(r?.reparaciones.urgentes ?? 0) > 0}
              />

              {/* 2. Listas para entrega */}
              <KpiCard
                label="Listas para entrega"
                value={r?.reparaciones.listasEntrega ?? 0}
                sub="Clientes esperando"
                icon={CheckCircle2}
                iconColor="var(--color-success)"
                iconBg="var(--color-success-bg)"
                href="/dashboard/reparaciones"
                alert={(r?.reparaciones.listasEntrega ?? 0) > 3}
              />

              {/* 3. Cobrado hoy */}
              <KpiCard
                label="Cobrado hoy"
                value={formatMXN(r?.finanzas.cobradoHoy ?? 0)}
                sub={`+${formatMXN(r?.finanzas.ventasHoy ?? 0)} POS`}
                icon={Wallet}
                iconColor="var(--color-success)"
                iconBg="var(--color-success-bg)"
                href="/dashboard/pagos"
              />

              {/* 4. Ventas POS */}
              <KpiCard
                label="Ventas POS hoy"
                value={formatMXN(r?.finanzas.ventasHoy ?? 0)}
                sub={r?.caja.activa ? `Caja ${r.caja.folio ?? "abierta"}` : "Sin caja activa"}
                icon={Store}
                iconColor="var(--color-info)"
                iconBg="var(--color-info-bg)"
                href="/dashboard/pos/historial"
              />

              {/* 5. Cartera vencida */}
              <KpiCard
                label="Cartera vencida"
                value={r?.creditos.conMora ?? 0}
                sub={r && r.creditos.montoMoraTotal > 0
                  ? formatMXN(r.creditos.montoMoraTotal)
                  : "Sin mora activa"}
                icon={CreditCard}
                iconColor="var(--color-warning)"
                iconBg="var(--color-warning-bg)"
                href="/dashboard/creditos/cartera-vencida"
                alert={(r?.creditos.conMora ?? 0) > 5}
              />

              {/* 6. Stock crítico */}
              <KpiCard
                label="Stock crítico"
                value={r?.inventario.stockCritico ?? 0}
                sub="Productos agotados"
                icon={PackageX}
                iconColor="var(--color-danger)"
                iconBg="var(--color-danger-bg)"
                href="/dashboard/inventario/alertas"
                alert={(r?.inventario.stockCritico ?? 0) > 0}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Zona 2+3: Grid principal ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Columna izquierda (2/3): Órdenes activas */}
        <div className="xl:col-span-2">
          <OrdenesWidget
            ordenes={ordenes}
            loading={loadingOrdenes}
            onOpen={(id) => setDrawerOrdenId(id)}
          />
        </div>

        {/* Columna derecha (1/3): Acciones + Stream */}
        <div className="flex flex-col gap-5">

          {/* Acciones rápidas */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <AccionesRapidas
              role={user?.role ?? "admin"}
              cajaActiva={r?.caja.activa ?? false}
              onNuevaOrden={() => setModalOrdenOpen(true)}
            />
          </div>

          {/* Stream de actividad */}
          <div
            className="rounded-xl overflow-hidden flex-1"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Actividad reciente
                </h3>
              </div>
              <Clock className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
            </div>

            <div className="px-5 divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {loadingStream ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="py-3 flex items-center gap-3 animate-pulse">
                    <div className="w-7 h-7 rounded-lg" style={{ background: "var(--color-bg-elevated)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 rounded" style={{ background: "var(--color-bg-elevated)" }} />
                      <div className="h-3 w-1/2 rounded" style={{ background: "var(--color-bg-sunken)" }} />
                    </div>
                    <div className="h-3 w-8 rounded" style={{ background: "var(--color-bg-sunken)" }} />
                  </div>
                ))
              ) : stream.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="w-7 h-7 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Sin actividad reciente
                  </p>
                </div>
              ) : (
                stream.map((ev) => <StreamItem key={ev.id} ev={ev} />)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Drawers y Modales ── */}
      {drawerOrdenId && (
        <OrdenDrawer
          ordenId={drawerOrdenId}
          onClose={() => setDrawerOrdenId(null)}
          onRefresh={() => { fetchAll(); setDrawerOrdenId(null); }}
        />
      )}

      {modalOrdenOpen && (
        <ModalOrden
          isOpen={modalOrdenOpen}
          onClose={() => setModalOrdenOpen(false)}
          onSuccess={() => { setModalOrdenOpen(false); fetchAll(); }}
        />
      )}
    </div>
  );
}
