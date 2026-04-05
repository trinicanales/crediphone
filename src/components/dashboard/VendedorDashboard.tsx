"use client";

/**
 * FASE 44 — Dashboard especializado para el rol VENDEDOR.
 * Muestra: caja POS, ventas del día, créditos creados, acciones rápidas de venta.
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  CreditCard,
  Package,
  Users,
  Bell,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/components/AuthProvider";
import { BannerInventarioSemanal } from "@/components/inventario/BannerInventarioSemanal";

interface VentaStats {
  totalCobradoHoy: number;
  totalPagosHoy: number;
  creditosActivos: number;
  totalClientes: number;
  productosEnStock: number;
  valorInventario: number;
}

interface CajaStatus {
  sesionActiva: boolean;
  folio?: string;
  esMia?: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function Skeleton() {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-3 w-24 rounded mb-3" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-7 w-20 rounded mb-2" style={{ background: "var(--color-bg-elevated)" }} />
          <div className="h-3 w-16 rounded" style={{ background: "var(--color-bg-sunken)" }} />
        </div>
        <div className="w-11 h-11 rounded-xl" style={{ background: "var(--color-bg-elevated)" }} />
      </div>
    </div>
  );
}

export function VendedorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<VentaStats | null>(null);
  const [caja, setCaja] = useState<CajaStatus>({ sesionActiva: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, cajaRes] = await Promise.all([
          fetch("/api/stats"),
          fetch(`/api/pos/caja?action=activa&usuarioId=${user?.id}`),
        ]);
        const statsData = await statsRes.json();
        const cajaData = await cajaRes.json();

        if (statsData.success) {
          const s = statsData.data;
          setStats({
            totalCobradoHoy: s.totalCobradoHoy ?? 0,
            totalPagosHoy: s.totalPagos ?? 0,
            creditosActivos: s.creditosActivos ?? 0,
            totalClientes: s.totalClientes ?? 0,
            productosEnStock: s.productosEnStock ?? 0,
            valorInventario: s.valorInventario ?? 0,
          });
        }

        if (cajaData.success && cajaData.data) {
          setCaja({ sesionActiva: true, folio: cajaData.data.folio, esMia: true });
        }
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="p-6 lg:p-8 pb-24">
      {/* Recordatorio inventario semanal (mié-sáb) */}
      <BannerInventarioSemanal />

      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {saludo}, {user?.name?.split(" ")[0] || "vendedor"} 🛒
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Panel de ventas ·{" "}
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Estado de caja */}
        <Link href="/dashboard/pos/caja">
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: caja.sesionActiva ? "var(--color-success-bg)" : "var(--color-bg-surface)",
              border: `1px solid ${caja.sesionActiva ? "var(--color-success)" : "var(--color-border)"}`,
              transition: "all 180ms",
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: caja.sesionActiva ? "var(--color-success)" : "var(--color-text-muted)",
              }}
            />
            <span
              className="text-sm font-medium"
              style={{
                color: caja.sesionActiva ? "var(--color-success-text)" : "var(--color-text-muted)",
              }}
            >
              {caja.sesionActiva ? `Caja abierta · ${caja.folio}` : "Caja cerrada"}
            </span>
          </div>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)
        ) : (
          <>
            {/* Cobrado hoy */}
            <Link href="/dashboard/pos/historial">
              <div
                className="rounded-2xl p-5 flex items-start justify-between"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 200ms var(--ease-smooth)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Cobrado hoy
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                    {fmt(stats?.totalCobradoHoy ?? 0)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    {stats?.totalPagosHoy ?? 0} transacciones
                  </p>
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center ml-4"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
                >
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </Link>

            {/* Créditos activos */}
            <Link href="/dashboard/creditos">
              <div
                className="rounded-2xl p-5 flex items-start justify-between"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 200ms var(--ease-smooth)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Créditos activos
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                    {stats?.creditosActivos ?? 0}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    {stats?.totalClientes ?? 0} clientes en total
                  </p>
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center ml-4"
                  style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
            </Link>

            {/* Inventario */}
            <Link href="/dashboard/productos">
              <div
                className="rounded-2xl p-5 flex items-start justify-between"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 200ms var(--ease-smooth)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
                    Productos en stock
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                    {stats?.productosEnStock ?? 0}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    Valor: {fmt(stats?.valorInventario ?? 0)}
                  </p>
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center ml-4"
                  style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
                >
                  <Package className="w-5 h-5" />
                </div>
              </div>
            </Link>
          </>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Acciones rápidas
          </h3>
          <div className="space-y-2">
            {[
              {
                href: "/dashboard/pos",
                icon: <ShoppingCart className="w-4 h-4" />,
                label: "Abrir POS",
                sub: "Venta de contado",
                accent: true,
              },
              {
                href: "/dashboard/creditos",
                icon: <CreditCard className="w-4 h-4" />,
                label: "Nuevo crédito",
                sub: "Venta a crédito",
                accent: false,
              },
              {
                href: "/dashboard/clientes",
                icon: <Users className="w-4 h-4" />,
                label: "Buscar cliente",
                sub: "Ver historial",
                accent: false,
              },
              {
                href: "/dashboard/recordatorios",
                icon: <Bell className="w-4 h-4" />,
                label: "Recordatorios",
                sub: "Avisar a clientes",
                accent: false,
              },
              {
                href: "/dashboard/productos",
                icon: <Package className="w-4 h-4" />,
                label: "Catálogo",
                sub: "Ver productos",
                accent: false,
              },
              {
                href: "/dashboard/inventario/verificar",
                icon: <TrendingUp className="w-4 h-4" />,
                label: "Verificar inventario",
                sub: "Conteo físico",
                accent: false,
              },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{
                    background: item.accent ? "var(--color-accent-light)" : "var(--color-bg-base)",
                    border: `1px solid ${item.accent ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                    transition: "all 180ms var(--ease-smooth)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = item.accent
                      ? "var(--color-accent)"
                      : "var(--color-bg-elevated)";
                    if (item.accent) {
                      (e.currentTarget as HTMLElement)
                        .querySelectorAll("span, svg")
                        .forEach((el) => ((el as HTMLElement).style.color = "white"));
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = item.accent
                      ? "var(--color-accent-light)"
                      : "var(--color-bg-base)";
                    if (item.accent) {
                      (e.currentTarget as HTMLElement)
                        .querySelectorAll("span, svg")
                        .forEach((el) => ((el as HTMLElement).style.color = ""));
                    }
                  }}
                >
                  <span style={{ color: "var(--color-accent)" }}>{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {item.label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {item.sub}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Tip del día + historial de caja */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              >
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Tu turno en caja
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {caja.sesionActiva
                    ? `Folio activo: ${caja.folio}`
                    : "Sin caja abierta — recuerda registrar tu turno"}
                </p>
              </div>
            </div>
            <Link href="/dashboard/pos/caja">
              <button
                className="w-full py-2 rounded-lg text-sm font-medium"
                style={{
                  background: caja.sesionActiva ? "var(--color-success-bg)" : "var(--color-accent)",
                  color: caja.sesionActiva ? "var(--color-success-text)" : "white",
                  border: caja.sesionActiva ? "1px solid var(--color-success)" : "none",
                  transition: "opacity 180ms",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
              >
                {caja.sesionActiva ? "✓ Ver sesión de caja" : "Abrir caja"}
              </button>
            </Link>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
              Historial de ventas
            </h4>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
              Revisa las ventas realizadas en tu turno actual
            </p>
            <Link href="/dashboard/pos/historial">
              <button
                className="w-full py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "var(--color-bg-base)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border)",
                  transition: "all 180ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--color-bg-base)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                }}
              >
                Ver historial →
              </button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
