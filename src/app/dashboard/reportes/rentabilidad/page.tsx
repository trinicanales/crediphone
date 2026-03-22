"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  ChevronDown, ChevronRight, AlertCircle, RefreshCw,
} from "lucide-react";
import { useDistribuidor } from "@/components/DistribuidorProvider";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TopProducto {
  nombre: string;
  ingresos: number;
  costo: number;
  margen: number;
  pctMargen: number;
  unidades: number;
}

interface CategoriaRentabilidad {
  id: string;
  nombre: string;
  ingresos: number;
  costo: number;
  margenBruto: number;
  pctMargen: number;
  unidades: number;
  topProductos: TopProducto[];
}

interface RentabilidadData {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  totales: {
    ingresos: number;
    costo: number;
    margenBruto: number;
    pctMargen: number;
    unidades: number;
  };
  categorias: CategoriaRentabilidad[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

const COLOR_PALETTE = [
  "#0099B8", "#00B8D9", "#0E3570", "#15803D", "#B45309",
  "#1D4ED8", "#7C3AED", "#DB2777", "#EA580C", "#65A30D",
];

const PERIODO_LABELS: Record<string, string> = {
  semana: "Últimos 7 días",
  mes: "Este mes",
  trimestre: "Últimos 3 meses",
  anio: "Este año",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "var(--color-bg-elevated)" }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-4"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </p>
        <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: "var(--color-text-primary)" }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: trend === "down" ? "var(--color-danger)" : trend === "up" ? "var(--color-success)" : "var(--color-text-muted)" }}>
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Fila de categoría expandible ────────────────────────────────────────────

function CategoriaRow({
  cat,
  totalIngresos,
  idx,
}: {
  cat: CategoriaRentabilidad;
  totalIngresos: number;
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const share = totalIngresos > 0 ? (cat.ingresos / totalIngresos) * 100 : 0;
  const esRentable = cat.pctMargen >= 20;
  const esNegativo = cat.margenBruto < 0;

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer transition-colors"
        style={{
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* Indicador de color */}
        <td className="py-3 pl-4 pr-2 w-1">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: COLOR_PALETTE[idx % COLOR_PALETTE.length] }}
          />
        </td>

        {/* Nombre */}
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            {open
              ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            }
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              {cat.nombre}
            </span>
          </div>
        </td>

        {/* Ingresos */}
        <td className="py-3 pr-4 text-right">
          <span className="text-sm font-mono" style={{ color: "var(--color-text-primary)" }}>
            {fmt(cat.ingresos)}
          </span>
        </td>

        {/* Costo */}
        <td className="py-3 pr-4 text-right">
          <span className="text-sm font-mono" style={{ color: "var(--color-text-secondary)" }}>
            {fmt(cat.costo)}
          </span>
        </td>

        {/* Margen bruto */}
        <td className="py-3 pr-4 text-right">
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: esNegativo ? "var(--color-danger)" : "var(--color-success)" }}
          >
            {fmt(cat.margenBruto)}
          </span>
        </td>

        {/* % Margen con barra */}
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 rounded-full flex-1 min-w-0"
              style={{ background: "var(--color-bg-sunken)", maxWidth: 80 }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(Math.max(cat.pctMargen, 0), 100)}%`,
                  background: esNegativo
                    ? "var(--color-danger)"
                    : esRentable
                    ? "var(--color-success)"
                    : "var(--color-warning)",
                }}
              />
            </div>
            <span
              className="text-xs font-mono w-12 text-right"
              style={{
                color: esNegativo
                  ? "var(--color-danger)"
                  : esRentable
                  ? "var(--color-success)"
                  : "var(--color-warning)",
              }}
            >
              {pct(cat.pctMargen)}
            </span>
          </div>
        </td>

        {/* % del total */}
        <td className="py-3 pr-4 text-right">
          <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
            {pct(share)}
          </span>
        </td>

        {/* Unidades */}
        <td className="py-3 pr-6 text-right">
          <span className="text-sm font-mono" style={{ color: "var(--color-text-secondary)" }}>
            {cat.unidades}
          </span>
        </td>
      </tr>

      {/* Detalle expandido: top productos */}
      {open && (
        <tr>
          <td colSpan={8} className="p-0">
            <div
              className="px-10 py-3"
              style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border-subtle)" }}
            >
              {cat.topProductos.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Sin datos de productos para este período.
                </p>
              ) : (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
                    TOP {cat.topProductos.length} PRODUCTOS POR MARGEN
                  </p>
                  <div className="space-y-1.5">
                    {cat.topProductos.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span
                          className="text-xs font-mono w-4 text-right shrink-0"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          #{i + 1}
                        </span>
                        <span className="text-xs flex-1 truncate" style={{ color: "var(--color-text-primary)" }}>
                          {p.nombre}
                        </span>
                        <span className="text-xs font-mono w-20 text-right shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                          {fmt(p.ingresos)}
                        </span>
                        <span
                          className="text-xs font-mono w-16 text-right shrink-0 font-semibold"
                          style={{ color: p.pctMargen >= 20 ? "var(--color-success)" : p.pctMargen < 0 ? "var(--color-danger)" : "var(--color-warning)" }}
                        >
                          {pct(p.pctMargen)}
                        </span>
                        <span className="text-xs font-mono w-16 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
                          {p.unidades} uds
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg p-3 text-xs space-y-1"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
        fontFamily: "var(--font-data)",
      }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.name !== "% Margen"
            ? fmt(p.value)
            : `${Number(p.value).toFixed(1)}%`}
        </p>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RentabilidadPage() {
  const [data, setData] = useState<RentabilidadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "trimestre" | "anio">("mes");

  const { distribuidorActivo } = useDistribuidor();

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers: Record<string, string> = {};
      if (distribuidorActivo?.id) headers["X-Distribuidor-Id"] = distribuidorActivo.id;

      const res = await fetch(`/api/reportes/rentabilidad?periodo=${periodo}`, { headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Error al cargar");
      setData(json.data);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [periodo, distribuidorActivo]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Estado: loading ──
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  // ── Estado: error ──
  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-96 gap-4">
        <AlertCircle className="w-12 h-12" style={{ color: "var(--color-danger)" }} />
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{error}</p>
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <RefreshCw className="w-4 h-4" /> Reintentar
        </button>
      </div>
    );
  }

  // ── Estado: sin datos ──
  if (!data || data.categorias.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-96 gap-3">
        <Package className="w-12 h-12" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
          Sin ventas en el período seleccionado
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Registra ventas en el POS para ver el análisis de rentabilidad.
        </p>
      </div>
    );
  }

  const { totales, categorias } = data;

  // Datos para gráfica de barras
  const barData = categorias.slice(0, 8).map((c, i) => ({
    name: c.nombre.length > 14 ? c.nombre.slice(0, 12) + "…" : c.nombre,
    Ingresos: c.ingresos,
    Costo: c.costo,
    "% Margen": c.pctMargen,
    color: COLOR_PALETTE[i % COLOR_PALETTE.length],
  }));

  // Datos para pie chart (participación en ingresos)
  const pieData = categorias.slice(0, 6).map((c, i) => ({
    name: c.nombre,
    value: c.ingresos,
    color: COLOR_PALETTE[i % COLOR_PALETTE.length],
  }));

  return (
    <div className="p-6 space-y-6" style={{ background: "var(--color-bg-base)" }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Rentabilidad por Categoría
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {PERIODO_LABELS[periodo]} · {categorias.length} categorías con ventas
          </p>
        </div>

        {/* Selector de período */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--color-border)" }}
        >
          {(["semana", "mes", "trimestre", "anio"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: periodo === p ? "var(--color-primary)" : "var(--color-bg-surface)",
                color: periodo === p ? "#fff" : "var(--color-text-secondary)",
                borderRight: "1px solid var(--color-border)",
              }}
            >
              {PERIODO_LABELS[p].split(" ")[periodo === p ? 0 : 1] ?? PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs globales ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos Totales"
          value={fmt(totales.ingresos)}
          icon={DollarSign}
          color="var(--color-accent)"
        />
        <KpiCard
          label="Costo de Ventas"
          value={fmt(totales.costo)}
          icon={Package}
          color="var(--color-warning)"
        />
        <KpiCard
          label="Margen Bruto"
          value={fmt(totales.margenBruto)}
          sub={pct(totales.pctMargen) + " del total"}
          icon={TrendingUp}
          color="var(--color-success)"
          trend={totales.margenBruto >= 0 ? "up" : "down"}
        />
        <KpiCard
          label="Unidades Vendidas"
          value={totales.unidades.toLocaleString("es-MX")}
          sub={`${categorias.length} categorías`}
          icon={Package}
          color="var(--color-info)"
        />
      </div>

      {/* ── Gráficas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Barras: ingresos vs costo por categoría */}
        <div
          className="lg:col-span-3 rounded-xl p-5"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Ingresos vs Costo por Categoría
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)", fontFamily: "var(--font-ui)" }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-muted)" }} />
              <Bar dataKey="Ingresos" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Costo" fill="var(--color-warning)" radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: participación en ingresos */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Participación en Ingresos
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                label={({ percent }: { percent?: number }) =>
                  (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number | string | undefined) => fmt(Number(v ?? 0))}
                contentStyle={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "var(--color-text-muted)" }}
                formatter={(value) => value.length > 18 ? value.slice(0, 16) + "…" : value}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabla detalle por categoría ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Detalle por Categoría
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Haz clic en una fila para ver los 5 productos más rentables de esa categoría
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                <th className="w-1" />
                <th className="py-2.5 pl-2 pr-4 text-left text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  CATEGORÍA
                </th>
                <th className="py-2.5 pr-4 text-right text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  INGRESOS
                </th>
                <th className="py-2.5 pr-4 text-right text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  COSTO
                </th>
                <th className="py-2.5 pr-4 text-right text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  MARGEN BRUTO
                </th>
                <th className="py-2.5 pr-4 text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  % MARGEN
                </th>
                <th className="py-2.5 pr-4 text-right text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  % DEL TOTAL
                </th>
                <th className="py-2.5 pr-6 text-right text-xs font-semibold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  UNIDADES
                </th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat, idx) => (
                <CategoriaRow
                  key={cat.id}
                  cat={cat}
                  totalIngresos={totales.ingresos}
                  idx={idx}
                />
              ))}
            </tbody>
            {/* Fila de totales */}
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--color-border)", background: "var(--color-bg-elevated)" }}>
                <td />
                <td className="py-3 pl-2 pr-4 text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                  TOTAL
                </td>
                <td className="py-3 pr-4 text-right text-sm font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>
                  {fmt(totales.ingresos)}
                </td>
                <td className="py-3 pr-4 text-right text-sm font-mono" style={{ color: "var(--color-text-secondary)" }}>
                  {fmt(totales.costo)}
                </td>
                <td className="py-3 pr-4 text-right text-sm font-bold font-mono" style={{ color: totales.margenBruto >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                  {fmt(totales.margenBruto)}
                </td>
                <td className="py-3 pr-4">
                  <span className="text-sm font-bold font-mono" style={{ color: totales.pctMargen >= 20 ? "var(--color-success)" : "var(--color-warning)" }}>
                    {pct(totales.pctMargen)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>
                  100%
                </td>
                <td className="py-3 pr-6 text-right text-sm font-mono" style={{ color: "var(--color-text-secondary)" }}>
                  {totales.unidades.toLocaleString("es-MX")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Leyenda de colores */}
        <div
          className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-1.5"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          {[
            { label: "≥ 20% margen", color: "var(--color-success)", desc: "Rentable" },
            { label: "0–19% margen", color: "var(--color-warning)", desc: "Revisar" },
            { label: "< 0% margen", color: "var(--color-danger)", desc: "Pérdida" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                <strong style={{ color: item.color }}>{item.desc}</strong>: {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
