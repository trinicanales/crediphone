"use client";

/**
 * FASE 46 — Lista de Órdenes de Compra
 * Permite al admin gestionar sus órdenes a proveedores.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Package,
} from "lucide-react";
import type { OrdenCompra, EstadoOrdenCompra } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const ESTADO_META: Record<EstadoOrdenCompra, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  borrador:         { label: "Borrador",         color: "var(--color-text-muted)",   bg: "var(--color-bg-elevated)", icon: <FileText className="w-3.5 h-3.5" /> },
  enviada:          { label: "Enviada",           color: "var(--color-info)",         bg: "var(--color-info-bg)",     icon: <Truck className="w-3.5 h-3.5" /> },
  recibida_parcial: { label: "Recib. parcial",   color: "var(--color-warning-text)", bg: "var(--color-warning-bg)", icon: <Package className="w-3.5 h-3.5" /> },
  recibida:         { label: "Recibida",          color: "var(--color-success)",      bg: "var(--color-success-bg)", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  cancelada:        { label: "Cancelada",         color: "var(--color-danger)",       bg: "var(--color-danger-bg)",  icon: <XCircle className="w-3.5 h-3.5" /> },
};

function EstadoBadge({ estado }: { estado: EstadoOrdenCompra }) {
  const meta = ESTADO_META[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-20 rounded-xl animate-pulse"
          style={{ background: "var(--color-bg-elevated)" }}
        />
      ))}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function OrdenesCompraPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrdenCompra | "todos">("todos");

  // Redirigir si no tiene permiso
  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchOrdenes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroEstado !== "todos") params.set("estado", filtroEstado);
      const res = await fetch(`/api/ordenes-compra?${params}`);
      const d = await res.json();
      if (d.success) setOrdenes(d.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

  const ordenesFiltradas = ordenes.filter((o) => {
    const q = busqueda.toLowerCase();
    if (!q) return true;
    return (
      o.folio.toLowerCase().includes(q) ||
      o.proveedor?.nombre.toLowerCase().includes(q) ||
      o.notas?.toLowerCase().includes(q)
    );
  });

  // KPIs rápidos
  const kpis = [
    { label: "Total",     value: ordenes.length,                                        color: "var(--color-accent)" },
    { label: "Enviadas",  value: ordenes.filter(o => o.estado === "enviada").length,     color: "var(--color-info)" },
    { label: "En camino", value: ordenes.filter(o => o.estado === "recibida_parcial").length, color: "var(--color-warning)" },
    { label: "Recibidas", value: ordenes.filter(o => o.estado === "recibida").length,    color: "var(--color-success)" },
  ];

  if (!user || !["admin", "super_admin"].includes(user.role)) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-24">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Órdenes de Compra
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Gestiona pedidos a proveedores · actualiza stock al recibir
          </p>
        </div>
        <Link href="/dashboard/compras/nueva">
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--color-accent)", color: "white", transition: "background 200ms" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-accent-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-accent)")}
          >
            <Plus className="w-4 h-4" />
            Nueva orden
          </button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl p-4"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{k.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: k.color, fontFamily: "var(--font-data)" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
              placeholder="Buscar por folio, proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-strong)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,153,184,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {/* Filtro estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoOrdenCompra | "todos")}
            className="px-3 py-2.5 rounded-lg text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            <option value="todos">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="recibida_parcial">Recepción parcial</option>
            <option value="recibida">Recibida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          {/* Refresh */}
          <button
            onClick={fetchOrdenes}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-secondary)",
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </Card>

      {/* Tabla / Lista */}
      <Card>
        {loading ? (
          <Skeleton />
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {busqueda || filtroEstado !== "todos" ? "Sin resultados" : "Sin órdenes de compra"}
            </p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--color-text-muted)" }}>
              {busqueda || filtroEstado !== "todos"
                ? "Prueba cambiando los filtros"
                : "Crea tu primera orden de compra a un proveedor"}
            </p>
            {!busqueda && filtroEstado === "todos" && (
              <Link href="/dashboard/compras/nueva">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--color-accent)", color: "white" }}
                >
                  + Nueva orden
                </button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Header tabla */}
            <div
              className="grid text-xs font-semibold uppercase tracking-wider pb-3 mb-1 hidden sm:grid"
              style={{
                gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr 1fr",
                color: "var(--color-text-muted)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <span>Folio</span>
              <span>Proveedor</span>
              <span>Fecha</span>
              <span>Total</span>
              <span>Estado</span>
              <span>Esperada</span>
            </div>

            <div className="space-y-2 mt-2">
              {ordenesFiltradas.map((orden) => (
                <Link key={orden.id} href={`/dashboard/compras/${orden.id}`}>
                  <div
                    className="grid items-center p-4 rounded-xl cursor-pointer"
                    style={{
                      gridTemplateColumns: "1fr",
                      border: "1px solid var(--color-border-subtle)",
                      background: "var(--color-bg-base)",
                      transition: "all 180ms var(--ease-smooth)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--color-bg-elevated)";
                      el.style.borderColor = "var(--color-border)";
                      el.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--color-bg-base)";
                      el.style.borderColor = "var(--color-border-subtle)";
                      el.style.transform = "translateX(0)";
                    }}
                  >
                    {/* Mobile: todo en columna */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-bold"
                            style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
                          >
                            {orden.folio}
                          </span>
                          <EstadoBadge estado={orden.estado} />
                        </div>
                        <p className="text-sm mt-0.5 truncate" style={{ color: "var(--color-text-primary)" }}>
                          {orden.proveedor?.nombre ?? "Sin proveedor"}
                        </p>
                        <div
                          className="flex items-center gap-3 mt-1 text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmtDate(orden.fechaOrden)}
                          </span>
                          {orden.fechaEsperada && (
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              Esperada: {fmtDate(orden.fechaEsperada)}
                            </span>
                          )}
                          <span>
                            {orden.items?.length ?? 0} producto{(orden.items?.length ?? 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-base font-bold"
                          style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
                        >
                          {fmt(orden.total)}
                        </p>
                        {orden.descuento > 0 && (
                          <p className="text-xs" style={{ color: "var(--color-success)" }}>
                            -{fmt(orden.descuento)} desc.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
