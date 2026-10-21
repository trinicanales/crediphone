"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { formatMXN as fmt, formatMXNDec as fmtDec } from "@/lib/format";
import {
  Smartphone,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Percent,
  TrendingUp,
  RefreshCw,
  Banknote,
  Calendar,
  Award,
} from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ModeloVendido {
  marca: string;
  modelo: string;
  unidades: number;
  ingresoTotal: number;
  precioPromedio: number;
  ventasConDescuento: number;
}

interface TendenciaMes {
  mes: string;
  contado: number;
  credito: number;
  ingresos: number;
  enganches: number;
}

interface EstadisticasEquipos {
  periodo: { inicio: string; fin: string; label: string };
  resumen: {
    totalContado: number;
    totalCredito: number;
    totalEquipos: number;
    ingresoContado: number;
    ingresoEnganche: number;
    descuentosAplicados: number;
    montoDescuentos: number;
  };
  modelosMasVendidos: ModeloVendido[];
  estadisticasCredito: {
    totalCreditos: number;
    enganhePromedio: number;
    montoPagoPromedio: number;
    plazoPromedio: number;
    porFrecuencia: { semanal: number; quincenal: number; mensual: number };
    ingresoEngancheTotal: number;
  };
  tendencia: TendenciaMes[];
}

type Periodo = "mes" | "3m" | "6m" | "ano";

const PERIODO_LABELS: Record<Periodo, string> = {
  mes: "Este mes",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  ano: "Este año",
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function EquiposReportePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<EstadisticasEquipos | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  useEffect(() => {
    if (user?.role && !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/equipos/stats?periodo=${periodo}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!user?.role || !["admin", "super_admin"].includes(user.role)) return null;

  const totalEquipos = data?.resumen.totalEquipos ?? 0;
  const pctContado =
    totalEquipos > 0 ? ((data?.resumen.totalContado ?? 0) / totalEquipos) * 100 : 0;
  const pctCredito =
    totalEquipos > 0 ? ((data?.resumen.totalCredito ?? 0) / totalEquipos) * 100 : 0;

  const tendenciaMax = Math.max(...(data?.tendencia.map((t) => t.ingresos) ?? [1]));

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: "var(--color-bg-base)" }}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <Smartphone className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
              Dashboard de Equipos
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Ventas de contado, créditos, modelos más vendidos y tendencias
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de período */}
            <div
              className="flex gap-1 p-1 rounded-xl"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              {(Object.entries(PERIODO_LABELS) as [Periodo, string][]).map(([key, label]) => (
                <PeriodoBtn key={key} active={periodo === key} onClick={() => setPeriodo(key)}>
                  {label}
                </PeriodoBtn>
              ))}
            </div>

            <button
              onClick={fetchData}
              className="p-2 rounded-xl"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── KPI Strip ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={<Smartphone className="w-5 h-5" />}
              label="Total equipos"
              value={data?.resumen.totalEquipos ?? 0}
              tipo="numero"
              variant="accent"
            />
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5" />}
              label="De contado"
              value={data?.resumen.totalContado ?? 0}
              sub={`${pctContado.toFixed(0)}% del total`}
              tipo="numero"
              variant="info"
            />
            <KpiCard
              icon={<CreditCard className="w-5 h-5" />}
              label="A crédito"
              value={data?.resumen.totalCredito ?? 0}
              sub={`${pctCredito.toFixed(0)}% del total`}
              tipo="numero"
              variant="warning"
            />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Ingresos contado"
              value={data?.resumen.ingresoContado ?? 0}
              tipo="moneda"
              variant="success"
            />
            <KpiCard
              icon={<Banknote className="w-5 h-5" />}
              label="Enganches cobrados"
              value={data?.resumen.ingresoEnganche ?? 0}
              tipo="moneda"
              variant="success"
            />
            <KpiCard
              icon={<Percent className="w-5 h-5" />}
              label="Con descuento"
              value={data?.resumen.descuentosAplicados ?? 0}
              sub={data?.resumen.montoDescuentos ? `−${fmt(data.resumen.montoDescuentos)}` : undefined}
              tipo="numero"
              variant="danger"
            />
          </div>
        )}

        {/* ── Fila 2: Modelos + Crédito ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Modelos más vendidos */}
          <div
            className="lg:col-span-2 rounded-2xl"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
            >
              <h2 className="font-semibold text-base flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                <Award className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                Modelos más vendidos
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
                Ventas contado
              </span>
            </div>

            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
                ))}
              </div>
            ) : !data || data.modelosMasVendidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14">
                <Smartphone className="w-10 h-10" style={{ color: "var(--color-text-muted)" }} />
                <p className="mt-3 text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Sin ventas de contado en el período</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Las ventas a crédito no aparecen aquí</p>
              </div>
            ) : (
              <>
                {/* Encabezado tabla */}
                <div
                  className="grid px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{
                    gridTemplateColumns: "1.5rem 1fr 4rem 4rem 5rem 4rem",
                    gap: "0.75rem",
                    background: "var(--color-bg-elevated)",
                    color: "var(--color-text-muted)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <span>#</span>
                  <span>Modelo</span>
                  <span className="text-right">Uds.</span>
                  <span className="text-right">P. prom.</span>
                  <span className="text-right">Ingresos</span>
                  <span className="text-right">Desc.</span>
                </div>

                {data.modelosMasVendidos.map((m, idx) => (
                  <ModeloRow key={`${m.marca}-${m.modelo}`} modelo={m} idx={idx} total={data.modelosMasVendidos.length} />
                ))}
              </>
            )}
          </div>

          {/* Panel crédito */}
          <div className="space-y-4">

            {/* Estructura de pagos */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h2 className="font-semibold text-base mb-4 flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                <CreditCard className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
                Estructura de créditos
              </h2>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
                  ))}
                </div>
              ) : data?.estadisticasCredito.totalCreditos === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>Sin créditos en el período</p>
              ) : (
                <div className="space-y-3">
                  <CreditoStat label="Créditos otorgados" value={String(data?.estadisticasCredito.totalCreditos ?? 0)} />
                  <CreditoStat label="Enganche promedio" value={fmtDec(data?.estadisticasCredito.enganhePromedio ?? 0)} highlight />
                  <CreditoStat label="Cuota promedio" value={fmtDec(data?.estadisticasCredito.montoPagoPromedio ?? 0)} />
                  <CreditoStat label="Plazo promedio" value={`${(data?.estadisticasCredito.plazoPromedio ?? 0).toFixed(1)} meses`} />
                  <CreditoStat label="Total enganches" value={fmt(data?.estadisticasCredito.ingresoEngancheTotal ?? 0)} highlight />

                  {/* Frecuencia de pago */}
                  <div className="pt-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
                      Frecuencia de pago
                    </p>
                    {(
                      [
                        ["Semanal", data?.estadisticasCredito.porFrecuencia.semanal ?? 0],
                        ["Quincenal", data?.estadisticasCredito.porFrecuencia.quincenal ?? 0],
                        ["Mensual", data?.estadisticasCredito.porFrecuencia.mensual ?? 0],
                      ] as [string, number][]
                    ).map(([label, count]) => {
                      const total = data?.estadisticasCredito.totalCreditos ?? 1;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={label} className="mb-1.5">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                            <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>
                              {count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-elevated)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: "var(--color-warning)",
                                transition: "width 0.6s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Contado vs crédito (visual) */}
            {!loading && data && data.resumen.totalEquipos > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--color-text-primary)" }}>
                  Contado vs Crédito
                </h2>
                <div className="flex h-3 rounded-full overflow-hidden mb-2" style={{ background: "var(--color-bg-elevated)" }}>
                  <div
                    style={{
                      width: `${pctContado}%`,
                      background: "var(--color-info)",
                      transition: "width 0.6s ease",
                    }}
                  />
                  <div
                    style={{
                      width: `${pctCredito}%`,
                      background: "var(--color-warning)",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <div className="flex gap-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--color-info)" }} />
                    Contado {pctContado.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--color-warning)" }} />
                    Crédito {pctCredito.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tendencia últimos 6 meses ───────────────────────────────────── */}
        <div
          className="rounded-2xl"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            className="px-5 py-4 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
          >
            <TrendingUp className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            <h2 className="font-semibold text-base" style={{ color: "var(--color-text-primary)" }}>
              Tendencia — últimos 6 meses
            </h2>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Encabezado */}
              <div
                className="grid px-5 py-2 text-xs font-semibold uppercase tracking-wide min-w-max"
                style={{
                  gridTemplateColumns: "7rem 1fr 1fr 1fr 1fr",
                  gap: "1.5rem",
                  background: "var(--color-bg-elevated)",
                  color: "var(--color-text-muted)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Mes
                </span>
                <span className="text-right">Contado</span>
                <span className="text-right">Créditos</span>
                <span className="text-right">Total uds.</span>
                <span className="text-right">Ingresos contado</span>
              </div>

              {(data?.tendencia ?? []).map((t, idx) => (
                <TendenciaRow key={t.mes} t={t} idx={idx} max={tendenciaMax} total={data?.tendencia.length ?? 6} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function PeriodoBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: active ? "var(--color-bg-surface)" : hover ? "var(--color-bg-surface)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
        boxShadow: active ? "var(--shadow-xs)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function KpiCard({
  icon, label, value, sub, tipo, variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  tipo: "numero" | "moneda";
  variant: "accent" | "info" | "warning" | "success" | "danger";
}) {
  const colors = {
    accent:  { bg: "var(--color-accent-light)",  icon: "var(--color-accent)",  text: "var(--color-accent)" },
    info:    { bg: "var(--color-info-bg)",        icon: "var(--color-info)",    text: "var(--color-info-text)" },
    warning: { bg: "var(--color-warning-bg)",     icon: "var(--color-warning)", text: "var(--color-warning-text)" },
    success: { bg: "var(--color-success-bg)",     icon: "var(--color-success)", text: "var(--color-success-text)" },
    danger:  { bg: "var(--color-danger-bg)",      icon: "var(--color-danger)",  text: "var(--color-danger-text)" },
  }[variant];

  const display =
    tipo === "moneda"
      ? value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
      : value.toLocaleString("es-MX");

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: colors.bg, border: `1px solid ${colors.bg}` }}
    >
      <div style={{ color: colors.icon }} className="mb-2">{icon}</div>
      <p
        className="font-bold leading-none"
        style={{
          color: colors.icon,
          fontFamily: "var(--font-data)",
          fontSize: tipo === "moneda" && value >= 10000 ? "1rem" : "1.35rem",
        }}
      >
        {display}
      </p>
      <p className="text-xs mt-1" style={{ color: colors.text }}>{label}</p>
      {sub && (
        <p className="text-xs mt-0.5 font-medium" style={{ color: colors.icon, opacity: 0.75 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ModeloRow({ modelo, idx, total }: { modelo: ModeloVendido; idx: number; total: number }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="grid items-center px-4 py-3 text-sm"
      style={{
        gridTemplateColumns: "1.5rem 1fr 4rem 4rem 5rem 4rem",
        gap: "0.75rem",
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: idx < total - 1 ? "1px solid var(--color-border-subtle)" : "none",
        transition: "background var(--duration-fast)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Rank */}
      <span
        className="text-xs font-bold text-center"
        style={{
          color: idx < 3 ? "var(--color-accent)" : "var(--color-text-muted)",
          fontFamily: "var(--font-data)",
        }}
      >
        {idx + 1}
      </span>

      {/* Modelo */}
      <div className="min-w-0">
        <p className="font-medium truncate text-sm" style={{ color: "var(--color-text-primary)" }}>
          {modelo.marca} {modelo.modelo}
        </p>
      </div>

      {/* Unidades */}
      <p className="text-right font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
        {modelo.unidades}
      </p>

      {/* Precio promedio */}
      <p className="text-right text-xs" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
        {modelo.precioPromedio.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
      </p>

      {/* Ingresos */}
      <p className="text-right font-semibold text-xs" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
        {modelo.ingresoTotal.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
      </p>

      {/* Descuentos */}
      <div className="flex justify-end">
        {modelo.ventasConDescuento > 0 ? (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
          >
            {modelo.ventasConDescuento} desc.
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
        )}
      </div>
    </div>
  );
}

function CreditoStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span
        className="text-sm font-semibold"
        style={{
          color: highlight ? "var(--color-warning)" : "var(--color-text-primary)",
          fontFamily: "var(--font-data)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TendenciaRow({ t, idx, max, total }: { t: TendenciaMes; idx: number; max: number; total: number }) {
  const [hover, setHover] = useState(false);
  const barPct = max > 0 ? (t.ingresos / max) * 100 : 0;

  return (
    <div
      className="grid items-center px-5 py-3 min-w-max"
      style={{
        gridTemplateColumns: "7rem 1fr 1fr 1fr 1fr",
        gap: "1.5rem",
        background: hover ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: idx < total - 1 ? "1px solid var(--color-border-subtle)" : "none",
        transition: "background var(--duration-fast)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Mes */}
      <span className="text-sm font-medium capitalize" style={{ color: "var(--color-text-primary)" }}>
        {t.mes}
      </span>

      {/* Contado */}
      <span className="text-right text-sm" style={{ color: "var(--color-info)", fontFamily: "var(--font-data)" }}>
        {t.contado}
      </span>

      {/* Créditos */}
      <span className="text-right text-sm" style={{ color: "var(--color-warning)", fontFamily: "var(--font-data)" }}>
        {t.credito}
      </span>

      {/* Total */}
      <span className="text-right text-sm font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
        {t.contado + t.credito}
      </span>

      {/* Ingresos contado con mini barra */}
      <div className="flex items-center gap-2 justify-end">
        <div className="w-20 h-2 rounded-full overflow-hidden hidden sm:block" style={{ background: "var(--color-bg-elevated)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${barPct}%`,
              background: "var(--color-accent)",
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <span className="text-sm font-semibold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
          {t.ingresos.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
