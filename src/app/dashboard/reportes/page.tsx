"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, TrendingUp, TrendingDown, DollarSign, BarChart2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ReportesData {
  kpis: {
    creditosNuevosMes: number;
    montoCreditosMes: number;
    cobranzaMes: number;
    pagosCountMes: number;
    creditosActivos: number;
    tasaRecuperacion: number;
    totalCreditos: number;
    totalPagos: number;
  };
  creditosPorMes: Array<{ mes: string; cantidad: number; monto: number }>;
  pagosPorMes: Array<{ mes: string; cantidad: number; monto: number }>;
  estadosCreditos: Record<string, number>;
  metodosPago: Record<string, number>;
  topClientes: Array<{ nombre: string; monto: number }>;
}

interface PnlData {
  periodo: { mes: number; anio: number };
  ingresos: {
    pagosCredito: number;
    ventasPOS: number;
    reparaciones: number;
    total: number;
  };
  costos: {
    cmv: number;
    piezasReparacion: number;
    comprasInventario: number;
    total: number;
  };
  utilidades: {
    bruta: number;
    operativa: number;
    margenBruto: number;
    margenOperativo: number;
  };
  contexto: {
    cantidadPagos: number;
    cantidadVentas: number;
    cantidadReparaciones: number;
  };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const COLORES_ESTADO: Record<string, string> = {
  activo: "#10B981",
  pagado: "#3B82F6",
  vencido: "#EF4444",
  cancelado: "#6B7280",
};

const NOMBRES_ESTADO: Record<string, string> = {
  activo: "Activo",
  pagado: "Pagado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

const COLORES_METODO: Record<string, string> = {
  efectivo: "#10B981",
  transferencia: "#3B82F6",
  deposito: "#F59E0B",
  mixto: "#8B5CF6",
};

const NOMBRES_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  deposito: "Deposito",
  mixto: "Mixto",
};

const fmt = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const fmtDec = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

// ─── Componente fila de estado de resultados ──────────────────────────────────

function PnlRow({
  label,
  monto,
  sublabel,
  indent = false,
  negativo = false,
  bold = false,
  borderTop = false,
  highlight = false,
}: {
  label: string;
  monto: number;
  sublabel?: string;
  indent?: boolean;
  negativo?: boolean;
  bold?: boolean;
  borderTop?: boolean;
  highlight?: boolean;
}) {
  const color = highlight
    ? monto >= 0 ? "var(--color-success)" : "var(--color-danger)"
    : negativo
    ? "var(--color-danger)"
    : "var(--color-text-primary)";

  return (
    <div
      className="flex items-center justify-between py-2.5 px-1"
      style={{
        borderTop: borderTop ? "1px solid var(--color-border)" : undefined,
        background: highlight ? (monto >= 0 ? "var(--color-success-bg)" : "var(--color-danger-bg)") : undefined,
        borderRadius: highlight ? "var(--radius-md)" : undefined,
        padding: highlight ? "10px 12px" : undefined,
        marginTop: highlight ? "4px" : undefined,
      }}
    >
      <div style={{ paddingLeft: indent ? 20 : 0 }}>
        <span
          className={bold ? "font-semibold" : "font-normal"}
          style={{
            fontSize: bold ? 14 : 13,
            color: bold ? "var(--color-text-primary)" : "var(--color-text-secondary)",
          }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            className="block"
            style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1 }}
          >
            {sublabel}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: bold ? 15 : 13,
          fontWeight: bold ? 600 : 400,
          color,
        }}
      >
        {negativo && monto > 0 ? `(${fmtDec(monto)})` : fmtDec(monto)}
      </span>
    </div>
  );
}

// ─── Componente P&L ───────────────────────────────────────────────────────────

function TabPnl() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anios = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/pnl?mes=${mes}&anio=${anio}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error ?? "Error al cargar P&L");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => { cargar(); }, [cargar]);

  // Datos para gráfica de ingresos vs costos
  const chartData = data
    ? [
        { name: "Ingresos", valor: data.ingresos.total, fill: "var(--color-success)" },
        { name: "Costos", valor: data.costos.total, fill: "var(--color-danger)" },
        { name: "Utilidad", valor: Math.max(0, data.utilidades.operativa), fill: "var(--color-accent)" },
      ]
    : [];

  return (
    <div>
      {/* Selector de período */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>Período:</span>
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          style={{
            background: "var(--color-bg-sunken)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            padding: "6px 10px",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            outline: "none",
          }}
        >
          {MESES.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          style={{
            background: "var(--color-bg-sunken)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            padding: "6px 10px",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            outline: "none",
          }}
        >
          {anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {loading && (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Calculando...</span>
        )}
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{ height: 420, background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
            />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Ingresos Totales",
                valor: data.ingresos.total,
                color: "var(--color-success)",
                bg: "var(--color-success-bg)",
                icon: <TrendingUp className="w-5 h-5" />,
              },
              {
                label: "Costos Totales",
                valor: data.costos.total,
                color: "var(--color-danger)",
                bg: "var(--color-danger-bg)",
                icon: <TrendingDown className="w-5 h-5" />,
              },
              {
                label: "Utilidad Bruta",
                valor: data.utilidades.bruta,
                color: data.utilidades.bruta >= 0 ? "var(--color-success)" : "var(--color-danger)",
                bg: data.utilidades.bruta >= 0 ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                icon: <DollarSign className="w-5 h-5" />,
              },
              {
                label: "Margen Bruto",
                valor: null,
                pct: data.utilidades.margenBruto,
                color: data.utilidades.margenBruto >= 0 ? "var(--color-accent)" : "var(--color-danger)",
                bg: "var(--color-accent-light)",
                icon: <BarChart2 className="w-5 h-5" />,
              },
            ].map((kpi, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
                    {kpi.label}
                  </span>
                  <span style={{ color: kpi.color, opacity: 0.7 }}>{kpi.icon}</span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 20,
                    fontWeight: 700,
                    color: kpi.color,
                  }}
                >
                  {kpi.valor !== null ? fmtDec(kpi.valor) : `${kpi.pct}%`}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estado de Resultados */}
            <Card>
              <div className="mb-4">
                <h3
                  className="text-base font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Estado de Resultados — {MESES[data.periodo.mes - 1]} {data.periodo.anio}
                </h3>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {data.contexto.cantidadVentas} ventas · {data.contexto.cantidadPagos} pagos de crédito · {data.contexto.cantidadReparaciones} reparaciones entregadas
                </p>
              </div>

              <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: 8 }}>
                {/* INGRESOS */}
                <div
                  className="text-xs font-semibold uppercase tracking-wider mb-1 mt-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Ingresos
                </div>
                <PnlRow
                  label="Pagos de créditos"
                  sublabel={`${data.contexto.cantidadPagos} pagos`}
                  monto={data.ingresos.pagosCredito}
                  indent
                />
                <PnlRow
                  label="Ventas POS (contado)"
                  sublabel={`${data.contexto.cantidadVentas} ventas`}
                  monto={data.ingresos.ventasPOS}
                  indent
                />
                <PnlRow
                  label="Reparaciones cobradas"
                  sublabel={`${data.contexto.cantidadReparaciones} entregadas`}
                  monto={data.ingresos.reparaciones}
                  indent
                />
                <PnlRow
                  label="Total Ingresos"
                  monto={data.ingresos.total}
                  bold
                  borderTop
                />

                {/* COSTOS */}
                <div
                  className="text-xs font-semibold uppercase tracking-wider mb-1 mt-4"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Costos y Egresos
                </div>
                <PnlRow
                  label="Costo de mercancía vendida (CMV)"
                  sublabel="Costo de productos vendidos en POS"
                  monto={data.costos.cmv}
                  negativo
                  indent
                />
                <PnlRow
                  label="Piezas de reparación"
                  sublabel="Costo de refacciones usadas"
                  monto={data.costos.piezasReparacion}
                  negativo
                  indent
                />
                <PnlRow
                  label="Compras de inventario"
                  sublabel="Órdenes de compra recibidas"
                  monto={data.costos.comprasInventario}
                  negativo
                  indent
                />
                <PnlRow
                  label="Total Costos"
                  monto={data.costos.total}
                  bold
                  negativo
                  borderTop
                />

                {/* UTILIDADES */}
                <div className="mt-3" />
                <PnlRow
                  label="Utilidad Bruta"
                  sublabel={`Ingresos − CMV · Margen ${data.utilidades.margenBruto}%`}
                  monto={data.utilidades.bruta}
                  bold
                  highlight
                />
                <PnlRow
                  label="Utilidad Operativa"
                  sublabel={`Ingresos − Todos los costos · Margen ${data.utilidades.margenOperativo}%`}
                  monto={data.utilidades.operativa}
                  bold
                  highlight
                />
              </div>
            </Card>

            {/* Gráfica Ingresos vs Costos */}
            <div className="flex flex-col gap-4">
              <Card>
                <h3
                  className="text-base font-semibold mb-4"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Ingresos vs Costos vs Utilidad
                </h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={48}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border-subtle)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                          color: "var(--color-text-primary)",
                        }}
                        formatter={(v: number | undefined) => [fmtDec(v ?? 0), ""]}
                      />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Desglose de ingresos */}
              <Card>
                <h3
                  className="text-base font-semibold mb-3"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Desglose de Ingresos
                </h3>
                {data.ingresos.total === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    Sin ingresos registrados en este período.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[
                      { label: "Pagos créditos", val: data.ingresos.pagosCredito, color: "var(--color-primary)" },
                      { label: "Ventas POS", val: data.ingresos.ventasPOS, color: "var(--color-accent)" },
                      { label: "Reparaciones", val: data.ingresos.reparaciones, color: "var(--color-success)" },
                    ].map((item) => {
                      const pct = data.ingresos.total > 0
                        ? Math.round((item.val / data.ingresos.total) * 100)
                        : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between mb-1">
                            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                              {item.label}
                            </span>
                            <span style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>
                              {fmtDec(item.val)} ({pct}%)
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: "var(--color-bg-elevated)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: item.color,
                                transition: "width 600ms var(--ease-smooth)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Nota metodológica */}
          <div
            className="mt-4 px-4 py-3 rounded-lg text-xs"
            style={{
              background: "var(--color-info-bg)",
              color: "var(--color-info-text)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <strong>Nota metodológica:</strong> El CMV se calcula con el precio de costo registrado en cada
            producto al momento de la consulta. Los productos sin costo registrado cuentan como $0.
            Las compras de inventario corresponden a órdenes de compra en estado &quot;recibida&quot; en el período.
            Este reporte es orientativo — tu contador puede validar con los datos completos en la sección Facturación.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [data, setData] = useState<ReportesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [tabActivo, setTabActivo] = useState<"creditos" | "pnl">("creditos");

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch("/api/reportes/pdf", { method: "POST" });
      if (!response.ok) throw new Error("Error al generar PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "reporte.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando PDF:", error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/reportes");
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error("Error cargando reportes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4"
            style={{ borderColor: "var(--color-accent)" }}
          />
          <p style={{ color: "var(--color-text-secondary)" }}>Cargando reportes...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 lg:p-8">
        <p style={{ color: "var(--color-text-muted)" }}>Error al cargar reportes</p>
      </div>
    );
  }

  // Preparar datos para PieChart
  const estadosData = Object.entries(data.estadosCreditos)
    .map(([estado, cantidad]) => ({
      name: NOMBRES_ESTADO[estado] || estado,
      value: cantidad,
      estado,
    }))
    .filter((d) => d.value > 0);

  const metodosData = Object.entries(data.metodosPago)
    .map(([metodo, cantidad]) => ({
      name: NOMBRES_METODO[metodo] || metodo,
      value: cantidad,
      metodo,
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Reportes y Analytics
          </h1>
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Métricas financieras y estado de resultados del negocio
          </p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-primary-text)",
          }}
        >
          <Download className={`w-4 h-4 ${downloadingPdf ? "animate-pulse" : ""}`} />
          {downloadingPdf ? "Generando..." : "Descargar PDF"}
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ background: "var(--color-bg-elevated)" }}
      >
        {(
          [
            { id: "creditos", label: "Créditos y Cobranza" },
            { id: "pnl", label: "Estado de Resultados" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTabActivo(tab.id)}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: tabActivo === tab.id ? "var(--color-bg-surface)" : "transparent",
              color:
                tabActivo === tab.id
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
              boxShadow: tabActivo === tab.id ? "var(--shadow-xs)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Créditos y Cobranza ── */}
      {tabActivo === "creditos" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Créditos Este Mes
              </div>
              <div
                className="text-2xl font-bold mt-2"
                style={{ color: "var(--color-info)", fontFamily: "var(--font-data)" }}
              >
                {fmt(data.kpis.montoCreditosMes)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {data.kpis.creditosNuevosMes} nuevos créditos
              </div>
            </Card>
            <Card>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Cobranza del Mes
              </div>
              <div
                className="text-2xl font-bold mt-2"
                style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
              >
                {fmt(data.kpis.cobranzaMes)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {data.kpis.pagosCountMes} pagos recibidos
              </div>
            </Card>
            <Card>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Créditos Activos
              </div>
              <div
                className="text-3xl font-bold mt-2"
                style={{ color: "var(--color-primary)", fontFamily: "var(--font-data)" }}
              >
                {data.kpis.creditosActivos}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                de {data.kpis.totalCreditos} totales
              </div>
            </Card>
            <Card>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Tasa Recuperación
              </div>
              <div
                className="text-3xl font-bold mt-2"
                style={{ color: "var(--color-warning)", fontFamily: "var(--font-data)" }}
              >
                {data.kpis.tasaRecuperacion}%
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {data.kpis.totalPagos} pagos totales
              </div>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-base font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Tendencia de Créditos (6 meses)
              </h3>
              <div className="h-72">
                {data.creditosPorMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.creditosPorMes}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border-subtle)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                          color: "var(--color-text-primary)",
                        }}
                        formatter={(value: number | undefined, name: string | undefined) =>
                          name === "Monto" ? [fmt(value ?? 0), name ?? ""] : [value ?? 0, name ?? ""]
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="right"
                        dataKey="cantidad"
                        name="Cantidad"
                        fill="var(--color-border)"
                        opacity={0.6}
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="monto"
                        name="Monto"
                        stroke="var(--color-accent)"
                        strokeWidth={2.5}
                        dot={{ fill: "var(--color-accent)", r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    className="h-full flex items-center justify-center"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Sin datos disponibles
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Cobranza por Mes (6 meses)
              </h3>
              <div className="h-72">
                {data.pagosPorMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.pagosPorMes}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border-subtle)"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                          color: "var(--color-text-primary)",
                        }}
                        formatter={(value: number | undefined) => [fmt(value ?? 0), "Cobrado"]}
                      />
                      <Bar
                        dataKey="monto"
                        name="Cobrado"
                        fill="var(--color-success)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    className="h-full flex items-center justify-center"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Sin datos disponibles
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-base font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Distribución de Créditos por Estado
              </h3>
              <div className="h-72">
                {estadosData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={estadosData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                        }
                        outerRadius={90}
                        dataKey="value"
                      >
                        {estadosData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORES_ESTADO[entry.estado] || "var(--color-border)"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                          color: "var(--color-text-primary)",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    className="h-full flex items-center justify-center"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Sin datos disponibles
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Métodos de Pago
              </h3>
              <div className="h-72">
                {metodosData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metodosData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                        }
                        outerRadius={90}
                        dataKey="value"
                      >
                        {metodosData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORES_METODO[entry.metodo] || "var(--color-border)"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg-elevated)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                          color: "var(--color-text-primary)",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    className="h-full flex items-center justify-center"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Sin datos disponibles
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Top Clientes */}
          {data.topClientes.length > 0 && (
            <Card>
              <h3 className="text-base font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Top 5 Clientes por Crédito Activo
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topClientes} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border-subtle)"
                      opacity={0.5}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      width={120}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                        color: "var(--color-text-primary)",
                      }}
                      formatter={(value: number | undefined) => [fmt(value ?? 0), "Monto"]}
                    />
                    <Bar
                      dataKey="monto"
                      fill="var(--color-primary-mid)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── TAB: Estado de Resultados / P&L ── */}
      {tabActivo === "pnl" && <TabPnl />}
    </div>
  );
}
