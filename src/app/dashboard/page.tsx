"use client";

import React, { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/components/AuthProvider";
import { useConfig } from "@/components/ConfigProvider";
import { ModalOrden } from "@/components/reparaciones/ModalOrden";
import { OrdenDrawer } from "@/components/reparaciones/drawer/OrdenDrawer";
import { PanelTraspasosPendientes } from "@/components/reparaciones/traspasos/PanelTraspasosPendientes";
import { PanelConfirmacionesDeposito } from "@/components/reparaciones/confirmaciones/PanelConfirmacionesDeposito";
import { PanelAutorizacionesPendientes } from "@/components/autorizaciones/PanelAutorizacionesPendientes";
// FASE 44: Dashboards especializados por rol
import { CobradorDashboard } from "@/components/dashboard/CobradorDashboard";
import { TecnicoDashboard } from "@/components/dashboard/TecnicoDashboard";
import { VendedorDashboard } from "@/components/dashboard/VendedorDashboard";
// FASE 53: Command Center para admin y super_admin
import { DashboardEjecutivo } from "@/components/dashboard/DashboardEjecutivo";
import type { DashboardStats as RepDashboardStats } from "@/lib/db/reparaciones-dashboard";
import type { OrdenReparacionDetallada } from "@/types";
import { AlertTriangle, Wrench } from "lucide-react";

interface DashboardStats {
  totalClientes: number;
  clientesActivos: number;
  totalCreditos: number;
  creditosActivos: number;
  creditosConMora: number;
  montoTotalCreditos: number;
  montoTotalActivos: number;
  montoTotalMora: number;
  totalPagos: number;
  totalCobradoHoy: number;
  totalProductos: number;
  productosEnStock: number;
  valorInventario: number;
  tasaRecuperacion: number;
  riesgoDistribucion: {
    BAJO: number;
    MEDIO: number;
    ALTO: number;
    MUY_ALTO: number;
  };
  creditosAtencion: Array<{
    id: string;
    clienteId: string;
    diasMora: number;
    montoMora: number;
    monto: number;
  }>;
}

interface CajaStatus {
  sesionActiva: boolean;
  folio?: string;
  abiertaPor?: string;
  esMia?: boolean;
}

// Skeleton para una StatCard
function StatCardSkeleton() {
  return (
    <div
      className="rounded-xl p-5 animate-pulse"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-28 rounded mb-3" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-8 w-20 rounded mb-2" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-3 w-24 rounded" style={{ background: "var(--color-bg-sunken)" }} />
        </div>
        <div className="w-12 h-12 rounded-lg" style={{ background: "var(--color-bg-elevated)" }} />
      </div>
    </div>
  );
}

// Skeleton genérico de sección
function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="rounded-xl p-5 animate-pulse"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="h-5 w-36 rounded mb-4" style={{ background: "var(--color-bg-elevated)" }} />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-3.5 w-24 rounded" style={{ background: "var(--color-bg-elevated)" }} />
            <div className="h-3.5 w-16 rounded" style={{ background: "var(--color-bg-sunken)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isModuleEnabled } = useConfig();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [repStats, setRepStats] = useState<RepDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [repLoading, setRepLoading] = useState(true);
  const [cajaStatus, setCajaStatus] = useState<CajaStatus>({ sesionActiva: false });
  const [modalOrdenOpen, setModalOrdenOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Drawer de reparaciones en el dashboard principal
  const [drawerOrdenId, setDrawerOrdenId] = useState<string | null>(null);
  const [ordenesPendientes, setOrdenesPendientes] = useState<OrdenReparacionDetallada[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  // PAGES-002: Esperar a que user esté cargado antes de hacer fetch (evita 401/403 en carga inicial)
  useEffect(() => {
    if (!user) return;
    fetchStats();
    fetchRepStats();
    fetchOrdenesPendientes();
    if (["admin", "vendedor", "super_admin"].includes(user.role)) {
      fetchCajaStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchOrdenesPendientes = async () => {
    try {
      setLoadingPendientes(true);
      const res = await fetch("/api/reparaciones?detalladas=true");
      const data = await res.json();
      if (data.success) {
        // Solo estados que requieren acción inmediata
        const REQUIEREN_ACCION = ["recibido", "diagnostico", "esperando_piezas", "presupuesto", "aprobado", "listo_entrega"];
        const pendientes = (data.data as OrdenReparacionDetallada[])
          .filter((o) => REQUIEREN_ACCION.includes(o.estado))
          .slice(0, 6); // máximo 6 en el widget
        setOrdenesPendientes(pendientes);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPendientes(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/stats");
      const data = await response.json();
      if (data.success) setStats(data.data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepStats = async () => {
    try {
      setRepLoading(true);
      const res = await fetch("/api/reparaciones/dashboard");
      const data = await res.json();
      if (data.success) setRepStats(data.data);
    } catch (error) {
      console.error("Error al cargar reparaciones:", error);
    } finally {
      setRepLoading(false);
    }
  };

  const fetchCajaStatus = async () => {
    try {
      const res = await fetch(`/api/pos/caja?action=activa&usuarioId=${user?.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setCajaStatus({ sesionActiva: true, folio: data.data.folio, esMia: true });
      } else {
        const resAll = await fetch("/api/pos/caja");
        const dataAll = await resAll.json();
        if (dataAll.success && Array.isArray(dataAll.data)) {
          const activa = dataAll.data.find((s: any) => s.estado === "abierta");
          if (activa) {
            setCajaStatus({
              sesionActiva: true,
              folio: activa.folio,
              abiertaPor: activa.empleadoNombre || "otro empleado",
              esMia: false,
            });
          }
        }
      }
    } catch {
      // silencioso
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  const getRoleLabel = () => {
    if (!user) return "";
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Administrador",
      vendedor: "Vendedor",
      cobrador: "Cobrador",
      tecnico: "Técnico",
    };
    return labels[user.role] || user.role;
  };

  const canSeeCarteraVencida = user && ["admin", "cobrador", "vendedor", "super_admin"].includes(user.role);
  const canUsePOS = user && ["admin", "vendedor", "super_admin"].includes(user.role);
  const canSeeEmpleados = user && ["admin", "super_admin"].includes(user.role);
  const canSeeReportes = user && ["admin", "super_admin"].includes(user.role);
  // tecnico NO tiene acceso a clientes/créditos/pagos/inventario
  const canSeeFinanzas = user && ["admin", "vendedor", "cobrador", "super_admin"].includes(user.role);
  const canSeeInventario = user && ["admin", "vendedor", "super_admin"].includes(user.role);

  // Calcular distribución de riesgo como porcentajes para las barras
  const totalRiesgo =
    (stats?.riesgoDistribucion?.BAJO || 0) +
    (stats?.riesgoDistribucion?.MEDIO || 0) +
    (stats?.riesgoDistribucion?.ALTO || 0) +
    (stats?.riesgoDistribucion?.MUY_ALTO || 0);

  const riesgoPct = (nivel: number) =>
    totalRiesgo > 0 ? Math.round((nivel / totalRiesgo) * 100) : 0;

  // Conteos de reparaciones por estado
  const repPorEstado = repStats?.graficas?.porEstado ?? {};
  const estadosRep = [
    { key: "recibido",    label: "Recibido",    color: "var(--color-info)" },
    { key: "diagnostico", label: "Diagnóstico", color: "var(--color-accent)" },
    { key: "esperando_piezas", label: "Esperando piezas", color: "var(--color-warning-text)" },
    { key: "reparando",  label: "Reparando",   color: "var(--color-warning)" },
    { key: "listo",      label: "Listo",        color: "var(--color-success)" },
  ].filter((e) => (repPorEstado[e.key] || 0) > 0);

  // FASE 44: Enrutar a dashboard especializado según el rol
  if (!user) {
    // Mientras se carga el usuario, mostrar skeleton mínimo
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-xl" style={{ background: "var(--color-bg-surface)" }} />
          <div className="h-4 w-80 rounded" style={{ background: "var(--color-bg-surface)" }} />
        </div>
      </div>
    );
  }

  if (user.role === "cobrador") {
    return <CobradorDashboard />;
  }

  if (user.role === "tecnico") {
    return <TecnicoDashboard />;
  }

  if (user.role === "vendedor") {
    return <VendedorDashboard />;
  }

  // FASE 53: admin y super_admin → Command Center
  if (user.role === "admin" || user.role === "super_admin") {
    return <DashboardEjecutivo />;
  }

  // Fallback (no debería llegar aquí) → dashboard completo legacy
  return (
    <div className="p-6 lg:p-8 pb-24">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Dashboard
          </h1>
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {user
              ? `Bienvenido, ${user.name || user.email} · ${getRoleLabel()}`
              : "Resumen general de CREDIPHONE"}
          </p>
        </div>

        {/* Indicador de caja */}
        {canUsePOS && (
          <Link href="/dashboard/pos/caja">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
              style={{
                background: cajaStatus.sesionActiva
                  ? cajaStatus.esMia
                    ? "var(--color-success-bg)"
                    : "var(--color-warning-bg)"
                  : "var(--color-bg-surface)",
                border: `1px solid ${
                  cajaStatus.sesionActiva
                    ? cajaStatus.esMia
                      ? "var(--color-success)"
                      : "var(--color-warning)"
                    : "var(--color-border)"
                }`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: cajaStatus.sesionActiva
                    ? cajaStatus.esMia
                      ? "var(--color-success)"
                      : "var(--color-warning)"
                    : "var(--color-text-muted)",
                }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color: cajaStatus.sesionActiva
                    ? cajaStatus.esMia
                      ? "var(--color-success-text)"
                      : "var(--color-warning-text)"
                    : "var(--color-text-muted)",
                }}
              >
                {cajaStatus.sesionActiva
                  ? cajaStatus.esMia
                    ? `Caja abierta · ${cajaStatus.folio}`
                    : `Caja abierta por ${cajaStatus.abiertaPor}`
                  : "Sin caja abierta"}
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* Alerta: caja abierta por otro empleado */}
      {canUsePOS && cajaStatus.sesionActiva && !cajaStatus.esMia && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning)",
          }}
        >
          <AlertTriangle size={20} style={{ color: "var(--color-warning)", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--color-warning-text)" }}>
              {cajaStatus.abiertaPor} tiene la caja abierta ({cajaStatus.folio}).
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)" }}>
              Solo puede haber una caja activa a la vez. Si necesitas operar, solicita el cierre de
              caja.
            </p>
          </div>
          <Link href="/dashboard/pos/caja">
            <button
              className="text-xs font-medium px-3 py-1.5 rounded"
              style={{ background: "var(--color-warning)", color: "white" }}
            >
              Ver Caja
            </button>
          </Link>
        </div>
      )}

      {/* FASE 39: Panel autorizaciones de descuento — solo admin/super_admin */}
      {user && ["admin", "super_admin"].includes(user.role) && (
        <div className="mb-4">
          <PanelAutorizacionesPendientes compact={false} />
        </div>
      )}

      {/* FASE 38: Panel confirmaciones depósito — solo admin/super_admin */}
      {user && ["admin", "super_admin"].includes(user.role) && (
        <div className="mb-4">
          <PanelConfirmacionesDeposito compact={false} />
        </div>
      )}

      {/* FASE 37: Panel traspasos pendientes — solo vendedor/admin (no técnico, no cobrador) */}
      {user && ["vendedor", "admin", "super_admin"].includes(user.role) && (
        <div className="mb-6">
          <PanelTraspasosPendientes compact={false} />
        </div>
      )}

      {/* ═══ Stats principales (clicables) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Clientes"
              value={stats?.totalClientes || 0}
              subtitle={`${stats?.creditosActivos || 0} con crédito activo`}
              color="blue"
              href={canSeeFinanzas ? "/dashboard/clientes" : undefined}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              }
            />

            <StatCard
              title="Créditos Activos"
              value={stats?.creditosActivos || 0}
              subtitle={`${stats?.creditosConMora || 0} con mora`}
              color={(stats?.creditosConMora || 0) > 0 ? "yellow" : "green"}
              href={canSeeFinanzas ? "/dashboard/creditos" : undefined}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
            />

            <StatCard
              title="Cobrado Hoy"
              value={formatCurrency(stats?.totalCobradoHoy || 0)}
              subtitle={`${stats?.totalPagos || 0} pagos recibidos`}
              color="green"
              href={canSeeFinanzas ? "/dashboard/pagos" : undefined}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />

            <StatCard
              title="Tasa Recuperación"
              value={`${stats?.tasaRecuperacion?.toFixed(1) || "0"}%`}
              subtitle="Créditos recuperados"
              color="blue"
              href={canSeeReportes ? "/dashboard/reportes" : undefined}
              progress={stats?.tasaRecuperacion ?? 0}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Alerta: Créditos con mora */}
      {stats && stats.creditosAtencion && stats.creditosAtencion.length > 0 && canSeeCarteraVencida && (
        <div className="mb-8">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-semibold flex items-center"
                style={{ color: "var(--color-text-primary)" }}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: "var(--color-danger)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Créditos que Requieren Atención
              </h3>
              <Link href="/dashboard/creditos/cartera-vencida">
                <span className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                  Ver cartera vencida →
                </span>
              </Link>
            </div>
            <div className="space-y-3">
              {stats.creditosAtencion.slice(0, 3).map((credito) => (
                <Link href={`/dashboard/creditos/${credito.id}`} key={credito.id}>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
                    style={{
                      background: "var(--color-danger-bg)",
                      border: "1px solid var(--color-danger)",
                      transition: "opacity 150ms",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                        Crédito #{credito.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                        Monto: {formatCurrency(credito.monto)} · Mora:{" "}
                        {formatCurrency(credito.montoMora)}
                      </p>
                    </div>
                    <span
                      className="inline-block px-3 py-1 text-xs font-semibold rounded-full ml-3"
                      style={{
                        background: "var(--color-danger)",
                        color: "white",
                      }}
                    >
                      {credito.diasMora} días
                    </span>
                  </div>
                </Link>
              ))}
              {stats.creditosAtencion.length > 3 && (
                <Link href="/dashboard/creditos/cartera-vencida">
                  <p className="text-sm text-center pt-1" style={{ color: "var(--color-accent)" }}>
                    Ver {stats.creditosAtencion.length - 3} créditos más →
                  </p>
                </Link>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ Fila media: Acciones + Finanzas + Riesgo ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        {/* Acciones Rápidas — filtradas por rol */}
        <Card>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Acciones Rápidas
          </h3>
          <div className="space-y-2">
            {/* Nueva Orden de Servicio */}
            <button
              onClick={() => setModalOrdenOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left"
              style={{
                background: "var(--color-accent-light)",
                border: "1px solid var(--color-accent)",
                transition: "all 200ms var(--ease-spring)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--color-accent)";
                (e.currentTarget as HTMLElement).querySelectorAll("span, svg").forEach((el) => {
                  (el as HTMLElement).style.color = "white";
                });
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--color-accent-light)";
                (e.currentTarget as HTMLElement).querySelectorAll("span, svg").forEach((el) => {
                  (el as HTMLElement).style.color = "";
                });
              }}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "var(--color-accent)" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
                Nueva Orden de Servicio
              </span>
            </button>

            {/* POS — admin, vendedor */}
            {canUsePOS && (
              <ActionLink href="/dashboard/pos" icon="cart" label="Caja Rápida — POS">
                {cajaStatus.sesionActiva && cajaStatus.esMia && (
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--color-success-bg)",
                      color: "var(--color-success-text)",
                    }}
                  >
                    Abierta
                  </span>
                )}
              </ActionLink>
            )}

            {/* Cartera Vencida */}
            {canSeeCarteraVencida && (
              <ActionLink href="/dashboard/creditos/cartera-vencida" icon="warning" label="Cartera Vencida" iconColor="var(--color-danger)">
                {(stats?.creditosConMora || 0) > 0 && (
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "var(--color-danger)", color: "white" }}
                  >
                    {stats?.creditosConMora}
                  </span>
                )}
              </ActionLink>
            )}

            {/* Registrar Pago */}
            {user && ["admin", "cobrador", "super_admin"].includes(user.role) && (
              <ActionLink href="/dashboard/pagos" icon="payment" label="Registrar Pago" iconColor="var(--color-success)" />
            )}

            {/* Recordatorios — visible para admin/super_admin (técnico/cobrador/vendedor tienen su propio dashboard) */}
            {user && (
              <ActionLink href="/dashboard/recordatorios" icon="bell" label="Recordatorios">
                {(stats?.creditosConMora || 0) > 0 && (
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "var(--color-danger)", color: "white" }}
                  >
                    {stats?.creditosConMora}
                  </span>
                )}
              </ActionLink>
            )}

            {/* Reparaciones */}
            <ActionLink href="/dashboard/reparaciones" icon="wrench" label="Reparaciones">
              {(repStats?.kpis?.ordenesActivas || 0) > 0 && (
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}
                >
                  {repStats?.kpis?.ordenesActivas} activas
                </span>
              )}
            </ActionLink>

            {/* Empleados */}
            {canSeeEmpleados && (
              <ActionLink href="/dashboard/empleados" icon="people" label="Empleados" />
            )}

            {/* Payjoy — todos los roles */}
            {isModuleEnabled("payjoy") && (
              <ActionLink
                href="/dashboard/payjoy"
                icon="zap"
                label="Payjoy"
                iconColor="var(--color-accent)"
              />
            )}

            {/* Reportes */}
            {canSeeReportes && (
              <ActionLink href="/dashboard/reportes" icon="chart" label="Reportes" />
            )}
          </div>
        </Card>

        {/* Resumen Financiero */}
        {loading ? (
          <CardSkeleton rows={4} />
        ) : (
          <Card>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
              Resumen Financiero
            </h3>
            <div className="space-y-4">
              {[
                { label: "Total en Créditos", value: stats?.montoTotalCreditos || 0, color: "var(--color-text-primary)" },
                { label: "Créditos Activos", value: stats?.montoTotalActivos || 0, color: "var(--color-success)" },
                { label: "Total en Mora", value: stats?.montoTotalMora || 0, color: "var(--color-danger)" },
                { label: "Valor Inventario", value: stats?.valorInventario || 0, color: "var(--color-accent)" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center pb-3"
                  style={{
                    borderBottom: i < 3 ? "1px solid var(--color-border-subtle)" : "none",
                  }}
                >
                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    {item.label}
                  </span>
                  <span
                    className="text-base font-bold"
                    style={{ color: item.color, fontFamily: "var(--font-data)" }}
                  >
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
            {/* Mini barra: activos vs total */}
            {(stats?.montoTotalCreditos || 0) > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                  <span>Cartera activa</span>
                  <span>
                    {Math.round(((stats?.montoTotalActivos || 0) / (stats?.montoTotalCreditos || 1)) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-elevated)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(((stats?.montoTotalActivos || 0) / (stats?.montoTotalCreditos || 1)) * 100)}%`,
                      background: "var(--color-success)",
                    }}
                  />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Distribución de Riesgo — con barras */}
        {loading ? (
          <CardSkeleton rows={4} />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Distribución de Riesgo
              </h3>
              {canSeeFinanzas && (
                <Link href="/dashboard/clientes">
                  <span className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                    Ver clientes →
                  </span>
                </Link>
              )}
            </div>
            <div className="space-y-3">
              {[
                { label: "Riesgo Bajo",     value: stats?.riesgoDistribucion?.BAJO     || 0, color: "var(--color-success)" },
                { label: "Riesgo Medio",    value: stats?.riesgoDistribucion?.MEDIO    || 0, color: "var(--color-warning)" },
                { label: "Riesgo Alto",     value: stats?.riesgoDistribucion?.ALTO     || 0, color: "var(--color-warning-text)" },
                { label: "Riesgo Muy Alto", value: stats?.riesgoDistribucion?.MUY_ALTO || 0, color: "var(--color-danger)" },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                        {item.value}
                      </span>
                      {totalRiesgo > 0 && (
                        <span className="text-xs w-8 text-right" style={{ color: "var(--color-text-muted)" }}>
                          {riesgoPct(item.value)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--color-bg-elevated)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${riesgoPct(item.value)}%`,
                        background: item.color,
                        transition: "width 600ms var(--ease-smooth)",
                      }}
                    />
                  </div>
                </div>
              ))}
              {totalRiesgo === 0 && (
                <p className="text-xs text-center py-2" style={{ color: "var(--color-text-muted)" }}>
                  Sin datos de scoring todavía
                </p>
              )}
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                {totalRiesgo} clientes con scoring · Basado en historial de pagos
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* ═══ Órdenes que requieren acción ═══ */}
      {(loadingPendientes || ordenesPendientes.length > 0) && (
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--color-border-subtle)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-primary)" }}>
                <Wrench size={15} style={{ color: "var(--color-accent)" }} />
                Órdenes que requieren acción
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Recibidas, en diagnóstico, presupuesto pendiente o listas para entregar
              </p>
            </div>
            <Link href="/dashboard/reparaciones">
              <span className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>Ver todas →</span>
            </Link>
          </div>

          {loadingPendientes ? (
            <div className="text-center py-4 text-sm" style={{ color: "var(--color-text-muted)" }}>Cargando...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ordenesPendientes.map((orden) => {
                const estadoColors: Record<string, { bg: string; color: string; label: string }> = {
                  recibido:      { bg: "var(--color-info-bg)",    color: "var(--color-info)",    label: "Recibido" },
                  diagnostico:   { bg: "var(--color-warning-bg)", color: "var(--color-warning)", label: "Diagnóstico" },
                  presupuesto:   { bg: "var(--color-warning-bg)", color: "var(--color-warning)", label: "Presupuesto" },
                  listo_entrega: { bg: "var(--color-success-bg)", color: "var(--color-success)", label: "Listo Entrega" },
                };
                const ec = estadoColors[orden.estado] ?? { bg: "var(--color-bg-elevated)", color: "var(--color-text-muted)", label: orden.estado };
                return (
                  <button
                    key={orden.id}
                    className="text-left p-3 rounded-xl transition-all"
                    style={{ background: ec.bg, border: `1px solid ${ec.color}33` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                    onClick={() => setDrawerOrdenId(orden.id)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                        {orden.folio}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: ec.color + "22", color: ec.color }}>
                        {ec.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {orden.marcaDispositivo} {orden.modeloDispositivo}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {orden.clienteNombre} {orden.clienteApellido || ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Fila inferior: Reparaciones + Inventario ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Widget Reparaciones */}
        {repLoading ? (
          <CardSkeleton rows={5} />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Reparaciones
              </h3>
              <Link href="/dashboard/reparaciones">
                <span className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                  Ver todas →
                </span>
              </Link>
            </div>

            {repStats ? (
              <>
                {/* KPIs reparaciones */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    {
                      label: "Activas",
                      value: repStats.kpis?.ordenesActivas || 0,
                      color: "var(--color-info)",
                      bg: "var(--color-info-bg)",
                    },
                    {
                      label: "Listas p/ entregar",
                      value: repStats.graficas?.porEstado?.listo || 0,
                      color: "var(--color-success)",
                      bg: "var(--color-success-bg)",
                    },
                    {
                      label: "Presupuestos",
                      value: repStats.kpis?.presupuestosPendientes || 0,
                      color: "var(--color-warning)",
                      bg: "var(--color-warning-bg)",
                    },
                  ].map((kpi, i) => (
                    <div
                      key={i}
                      className="text-center p-3 rounded-xl"
                      style={{ background: kpi.bg, border: `1px solid ${kpi.color}22` }}
                    >
                      <p
                        className="text-2xl font-bold"
                        style={{ color: kpi.color, fontFamily: "var(--font-data)" }}
                      >
                        {kpi.value}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {kpi.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Desglose por estado */}
                {estadosRep.length > 0 ? (
                  <div
                    className="space-y-2 pt-3"
                    style={{ borderTop: "1px solid var(--color-border-subtle)" }}
                  >
                    <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>
                      Por estado
                    </p>
                    {estadosRep.map(({ key, label, color }) => {
                      const count = repPorEstado[key] || 0;
                      const total = repStats.kpis?.ordenesActivas || 1;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                                {label}
                              </span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                              {count}
                            </span>
                          </div>
                          <div
                            className="h-1 rounded-full overflow-hidden"
                            style={{ background: "var(--color-bg-elevated)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((count / total) * 100)}%`,
                                background: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="text-center py-4 rounded-lg mt-2"
                    style={{ background: "var(--color-bg-elevated)" }}
                  >
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      No hay órdenes activas
                    </p>
                    <button
                      onClick={() => setModalOrdenOpen(true)}
                      className="text-xs font-medium mt-1"
                      style={{ color: "var(--color-accent)" }}
                    >
                      Crear primera orden →
                    </button>
                  </div>
                )}

                {/* Ingresos del mes */}
                {(repStats.kpis?.ingresosMes || 0) > 0 && (
                  <div
                    className="mt-3 pt-3 flex justify-between items-center"
                    style={{ borderTop: "1px solid var(--color-border-subtle)" }}
                  >
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      Ingresos este mes
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
                    >
                      {formatCurrency(repStats.kpis.ingresosMes)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div
                className="text-center py-8 rounded-lg"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Sin datos de reparaciones
                </p>
                <button
                  onClick={() => setModalOrdenOpen(true)}
                  className="text-xs font-medium mt-2"
                  style={{ color: "var(--color-accent)" }}
                >
                  Crear primera orden →
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Widget Inventario */}
        {loading ? (
          <CardSkeleton rows={4} />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Inventario
              </h3>
              {canSeeInventario && (
                <Link href="/dashboard/inventario/alertas">
                  <span className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                    Ver alertas →
                  </span>
                </Link>
              )}
            </div>

            <div className="space-y-4">
              {[
                {
                  label: "Total productos",
                  value: stats?.totalProductos || 0,
                  display: String(stats?.totalProductos || 0),
                  color: "var(--color-text-primary)",
                },
                {
                  label: "Con stock disponible",
                  value: stats?.productosEnStock || 0,
                  display: String(stats?.productosEnStock || 0),
                  color: "var(--color-success)",
                },
                {
                  label: "Sin stock",
                  value: (stats?.totalProductos || 0) - (stats?.productosEnStock || 0),
                  display: String((stats?.totalProductos || 0) - (stats?.productosEnStock || 0)),
                  color: (stats?.totalProductos || 0) - (stats?.productosEnStock || 0) > 0
                    ? "var(--color-danger)"
                    : "var(--color-text-muted)",
                },
                {
                  label: "Valor total inventario",
                  value: stats?.valorInventario || 0,
                  display: formatCurrency(stats?.valorInventario || 0),
                  color: "var(--color-accent)",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center pb-3"
                  style={{
                    borderBottom: i < 3 ? "1px solid var(--color-border-subtle)" : "none",
                  }}
                >
                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    {item.label}
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: item.color, fontFamily: "var(--font-data)" }}
                  >
                    {item.display}
                  </span>
                </div>
              ))}
            </div>

            {/* Barra de disponibilidad */}
            {(stats?.totalProductos || 0) > 0 && (
              <div className="mt-4">
                <div
                  className="flex justify-between text-xs mb-1.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span>Disponibilidad de stock</span>
                  <span>
                    {Math.round(((stats?.productosEnStock || 0) / (stats?.totalProductos || 1)) * 100)}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--color-bg-elevated)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(((stats?.productosEnStock || 0) / (stats?.totalProductos || 1)) * 100)}%`,
                      background:
                        (stats?.productosEnStock || 0) / (stats?.totalProductos || 1) > 0.7
                          ? "var(--color-success)"
                          : (stats?.productosEnStock || 0) / (stats?.totalProductos || 1) > 0.4
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Acceso rápido a módulos de inventario — solo admin/vendedor/super_admin */}
            {canSeeInventario && (
            <div
              className="mt-4 pt-3 flex gap-2"
              style={{ borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <Link href="/dashboard/inventario/verificar" className="flex-1">
                <div
                  className="text-center py-2 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-sunken)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
                  }}
                >
                  Verificar
                </div>
              </Link>
              <Link href="/dashboard/inventario/ubicaciones" className="flex-1">
                <div
                  className="text-center py-2 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-sunken)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
                  }}
                >
                  Ubicaciones
                </div>
              </Link>
              <Link href="/dashboard/productos" className="flex-1">
                <div
                  className="text-center py-2 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-sunken)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
                  }}
                >
                  Productos
                </div>
              </Link>
            </div>
            )}
          </Card>
        )}
      </div>

      {/* ═══ FAB ═══ */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2">
            <FabOption
              label="Nueva Orden de Servicio"
              icon="wrench"
              onClick={() => { setFabOpen(false); setModalOrdenOpen(true); }}
            />
            {canUsePOS && (
              <FabOption
                label="Caja Rápida (POS)"
                icon="cart"
                onClick={() => { setFabOpen(false); router.push("/dashboard/pos"); }}
              />
            )}
            {user && !["tecnico"].includes(user.role) && (
              <FabOption
                label="Nuevo Cliente"
                icon="person"
                onClick={() => { setFabOpen(false); router.push("/dashboard/clientes"); }}
              />
            )}
          </div>
        )}

        <button
          onClick={() => setFabOpen(!fabOpen)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
          style={{
            background: "var(--color-accent)",
            color: "white",
            boxShadow: "var(--shadow-xl)",
            transition: "all 200ms var(--ease-spring)",
            transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "var(--color-accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "var(--color-accent)")
          }
          title={fabOpen ? "Cerrar menú" : "Acciones rápidas"}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {fabOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />
      )}

      {/* Modal Nueva Orden */}
      <ModalOrden
        isOpen={modalOrdenOpen}
        onClose={() => setModalOrdenOpen(false)}
        onSuccess={() => {
          setModalOrdenOpen(false);
          fetchOrdenesPendientes();
          fetchRepStats();
        }}
      />

      {/* Drawer de reparaciones — acceso rápido desde el dashboard */}
      <OrdenDrawer
        ordenId={drawerOrdenId}
        onClose={() => setDrawerOrdenId(null)}
        onRefresh={fetchOrdenesPendientes}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════
   Componentes internos auxiliares
══════════════════════════════════════════════ */

const ICONS: Record<string, ReactNode> = {
  zap: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  cart: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  payment: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  bell: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  wrench: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  people: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  person: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
};

function ActionLink({
  href,
  icon,
  label,
  iconColor,
  children,
}: {
  href: string;
  icon: string;
  label: string;
  iconColor?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href}>
      <div
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-subtle)",
          transition: "all 150ms",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "var(--color-bg-sunken)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)")
        }
      >
        <span style={{ color: iconColor || "var(--color-text-secondary)" }}>
          {ICONS[icon]}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          {label}
        </span>
        {children}
      </div>
    </Link>
  );
}

function FabOption({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium"
      style={{
        background: "var(--color-bg-surface)",
        color: "var(--color-text-primary)",
        boxShadow: "var(--shadow-md)",
        border: "1px solid var(--color-border)",
        whiteSpace: "nowrap",
        transition: "all 150ms",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)")
      }
    >
      <span>{ICONS[icon]}</span>
      {label}
    </button>
  );
}
