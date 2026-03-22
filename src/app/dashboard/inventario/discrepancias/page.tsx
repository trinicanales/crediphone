"use client";

import { useState, useEffect, useCallback } from "react";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck, AlertTriangle, TrendingDown, TrendingUp,
  Minus, RefreshCw, Download, ChevronDown, ChevronUp,
  Package, CheckCircle2, XCircle, Search,
} from "lucide-react";
import type { VerificacionInventarioDetallada, DiferenciaVerificacion } from "@/types";
import type { CSSProperties } from "react";

// ─── Tipos auxiliares ──────────────────────────────────────────────────────────

interface ResumenVerificacion extends VerificacionInventarioDetallada {
  diferencias?: DiferenciaVerificacion[];
  cargandoDiferencias?: boolean;
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function DiscrepanciasPage() {
  const { user, loading: authLoading } = useAuth();
  const { distribuidorActivo } = useDistribuidor();
  const router = useRouter();

  const [verificaciones, setVerificaciones] = useState<ResumenVerificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Auth guard
  useEffect(() => {
    if (!authLoading && user && !["admin", "super_admin"].includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchVerificaciones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hdrs: Record<string, string> = {};
      if (distribuidorActivo?.id) hdrs["X-Distribuidor-Id"] = distribuidorActivo.id;
      const res  = await fetch("/api/inventario/verificaciones", { headers: hdrs });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Error al obtener datos");
      setVerificaciones(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [distribuidorActivo]);

  useEffect(() => { fetchVerificaciones(); }, [fetchVerificaciones]);

  const toggleExpanded = useCallback(async (id: string) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    // Cargar diferencias si aún no las tiene
    setVerificaciones((prev) => prev.map((v) =>
      v.id === id ? { ...v, cargandoDiferencias: true } : v
    ));
    try {
      const hdrs: Record<string, string> = {};
      if (distribuidorActivo?.id) hdrs["X-Distribuidor-Id"] = distribuidorActivo.id;
      const res  = await fetch(`/api/inventario/verificaciones/${id}?action=diferencias`, { headers: hdrs });
      const json = await res.json();
      setVerificaciones((prev) => prev.map((v) =>
        v.id === id
          ? { ...v, diferencias: json.data ?? [], cargandoDiferencias: false }
          : v
      ));
    } catch {
      setVerificaciones((prev) => prev.map((v) =>
        v.id === id ? { ...v, diferencias: [], cargandoDiferencias: false } : v
      ));
    }
  }, [expandido, distribuidorActivo]);

  // Exportar CSV de diferencias de una verificación
  function exportarCSV(v: ResumenVerificacion) {
    const rows: string[][] = [
      ["Producto", "Marca", "Modelo", "Código Barras", "Stock Sistema", "Cantidad Contada", "Diferencia"],
    ];
    (v.diferencias ?? []).forEach((d) => {
      rows.push([
        d.nombre, d.marca, d.modelo,
        d.codigoBarras ?? "",
        String(d.stockSistema),
        String(d.cantidadContada),
        String(d.diferencia),
      ]);
    });
    const csv  = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `discrepancias-${v.folio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtradas = verificaciones.filter((v) => {
    const q = filtroBusqueda.toLowerCase();
    const matchQ = !q || v.folio.toLowerCase().includes(q);
    const matchE = filtroEstado === "todos" || v.estado === filtroEstado;
    const matchD = filtroEstado === "con_discrepancias"
      ? v.totalProductosFaltantes > 0
      : true;
    return matchQ && matchE && matchD;
  });

  // ── KPIs globales ──────────────────────────────────────────────────────────
  const completadas   = verificaciones.filter((v) => v.estado === "completada");
  const totalVer      = completadas.length;
  const conDiscrep    = completadas.filter((v) => v.totalProductosFaltantes > 0).length;
  const pctExactitud  = totalVer > 0
    ? Math.round(((totalVer - conDiscrep) / totalVer) * 100)
    : 0;
  const totalFaltantes = completadas.reduce((s, v) => s + (v.totalProductosFaltantes ?? 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────

  const kpiCard = (
    icon: React.ReactNode,
    label: string,
    value: string | number,
    accent: string,
    bg: string,
  ) => (
    <div style={{
      background: "var(--color-bg-surface)",
      border: "1px solid var(--color-border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding: "1rem 1.25rem",
      boxShadow: "var(--shadow-sm)",
      display: "flex", alignItems: "center", gap: "0.875rem",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "var(--radius-md)",
        background: bg, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.125rem" }}>{label}</p>
        <p style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>
          {value}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "1.5rem", background: "var(--color-bg-base)", minHeight: "100vh" }} className="app-bg">
      {/* ── Topbar ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            Reporte de Discrepancias
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Historial de verificaciones físicas vs stock del sistema
          </p>
        </div>
        <button
          onClick={fetchVerificaciones}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.5rem 1rem",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-text-secondary)",
            fontSize: "0.875rem", cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {kpiCard(<ClipboardCheck className="w-5 h-5" />, "Verificaciones completadas", totalVer, "var(--color-info-text)", "var(--color-info-bg)")}
        {kpiCard(<CheckCircle2 className="w-5 h-5" />, "Exactitud de inventario", `${pctExactitud}%`, "var(--color-success-text)", "var(--color-success-bg)")}
        {kpiCard(<AlertTriangle className="w-5 h-5" />, "Con discrepancias", conDiscrep, "var(--color-warning-text)", "var(--color-warning-bg)")}
        {kpiCard(<XCircle className="w-5 h-5" />, "Total faltantes acumulados", totalFaltantes, "var(--color-danger-text)", "var(--color-danger-bg)")}
      </div>

      {/* ── Filtros ── */}
      <div style={{
        display: "flex", gap: "0.75rem", marginBottom: "1rem",
        flexWrap: "wrap", alignItems: "center",
      }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search style={{
            position: "absolute", left: "0.75rem", top: "50%",
            transform: "translateY(-50%)", width: 16, height: 16,
            color: "var(--color-text-muted)", pointerEvents: "none",
          }} />
          <input
            type="text"
            placeholder="Buscar por folio..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            style={{
              width: "100%", paddingLeft: "2.25rem", paddingRight: "0.875rem",
              paddingTop: "0.5rem", paddingBottom: "0.5rem",
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-primary)", fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>
        {(["todos", "completada", "en_proceso", "cancelada", "con_discrepancias"] as const).map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            style={{
              padding: "0.4375rem 0.875rem",
              background: filtroEstado === e ? "var(--color-primary)" : "var(--color-bg-surface)",
              color: filtroEstado === e ? "var(--color-primary-text)" : "var(--color-text-secondary)",
              border: `1px solid ${filtroEstado === e ? "var(--color-primary)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-full)",
              fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            {e === "todos" ? "Todos" : e === "completada" ? "Completadas" : e === "en_proceso" ? "En proceso" : e === "cancelada" ? "Canceladas" : "Con discrepancias"}
          </button>
        ))}
      </div>

      {/* ── Estados loading / error / empty ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse" style={{
              height: 72, background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-subtle)",
            }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: "1rem", background: "var(--color-danger-bg)",
          border: "1px solid var(--color-danger)", borderRadius: "var(--radius-md)",
          color: "var(--color-danger-text)", fontSize: "0.875rem",
        }}>
          <span className="flex items-center gap-1.5"><AlertTriangle size={14} />{error}</span>
        </div>
      )}

      {!loading && !error && filtradas.length === 0 && (
        <div style={{
          textAlign: "center", padding: "3rem 1rem",
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-lg)",
        }}>
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>
            No hay verificaciones registradas
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>
            Realiza una verificación física desde{" "}
            <a href="/dashboard/inventario/verificar" style={{ color: "var(--color-accent)" }}>
              Verificar Inventario
            </a>
          </p>
        </div>
      )}

      {/* ── Lista de verificaciones ── */}
      {!loading && !error && filtradas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtradas.map((v) => {
            const isExp        = expandido === v.id;
            const completada   = v.estado === "completada";
            const tieneDiscrep = (v.totalProductosFaltantes ?? 0) > 0;
            const pctAcierto   = v.totalProductosEsperados > 0
              ? Math.round((v.totalProductosEscaneados / v.totalProductosEsperados) * 100)
              : 0;

            const estadoBadge: CSSProperties = completada
              ? tieneDiscrep
                ? { background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }
                : { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
              : v.estado === "en_proceso"
                ? { background: "var(--color-info-bg)", color: "var(--color-info-text)" }
                : { background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" };

            const estadoLabel = completada
              ? tieneDiscrep ? "Con discrepancias" : "Exacto"
              : v.estado === "en_proceso" ? "En proceso" : "Cancelada";

            return (
              <div key={v.id} style={{
                background: "var(--color-bg-surface)",
                border: `1px solid ${isExp ? "var(--color-border-strong)" : "var(--color-border-subtle)"}`,
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                boxShadow: isExp ? "var(--shadow-md)" : "var(--shadow-xs)",
                transition: "box-shadow 200ms ease, border-color 200ms ease",
              }}>
                {/* ── Fila resumen ── */}
                <button
                  onClick={() => toggleExpanded(v.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    gap: "1rem", padding: "1rem 1.25rem",
                    background: "transparent", border: "none", cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {/* Estado icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "var(--radius-md)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, ...estadoBadge,
                  }}>
                    {completada
                      ? tieneDiscrep
                        ? <AlertTriangle style={{ width: 18, height: 18 }} />
                        : <CheckCircle2 style={{ width: 18, height: 18 }} />
                      : v.estado === "en_proceso"
                        ? <RefreshCw style={{ width: 18, height: 18 }} />
                        : <XCircle style={{ width: 18, height: 18 }} />
                    }
                  </div>

                  {/* Folio + fecha */}
                  <div style={{ flex: "0 0 auto", minWidth: 130 }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9375rem", color: "var(--color-text-primary)", letterSpacing: "0.04em" }}>
                      {v.folio}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.125rem" }}>
                      {new Date(v.fechaInicio).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {/* Badge estado */}
                  <span style={{
                    padding: "0.2rem 0.625rem", borderRadius: "var(--radius-full)",
                    fontSize: "0.75rem", fontWeight: 600, flexShrink: 0,
                    ...estadoBadge,
                  }}>
                    {estadoLabel}
                  </span>

                  {/* Métricas */}
                  <div style={{ display: "flex", gap: "1.5rem", marginLeft: "auto", flexWrap: "wrap" }}>
                    <Metrica label="Esperados" value={v.totalProductosEsperados} />
                    <Metrica label="Contados" value={v.totalProductosEscaneados} />
                    <Metrica
                      label="Faltantes"
                      value={v.totalProductosFaltantes}
                      accent={tieneDiscrep ? "var(--color-danger)" : "var(--color-success)"}
                    />
                    <Metrica label="Exactitud" value={`${pctAcierto}%`} accent={pctAcierto >= 95 ? "var(--color-success)" : pctAcierto >= 80 ? "var(--color-warning)" : "var(--color-danger)"} />
                  </div>

                  {/* Chevron */}
                  <div style={{ color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "0.5rem" }}>
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* ── Panel expandido ── */}
                {isExp && (
                  <div style={{
                    borderTop: "1px solid var(--color-border-subtle)",
                    padding: "1rem 1.25rem",
                    background: "var(--color-bg-base)",
                  }}>
                    {v.cargandoDiferencias && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse" style={{ height: 40, background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)" }} />
                        ))}
                      </div>
                    )}

                    {!v.cargandoDiferencias && v.diferencias !== undefined && v.diferencias.length === 0 && (
                      <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--color-text-muted)" }}>
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-success)" }} />
                        <p style={{ fontSize: "0.875rem", fontWeight: 500 }}>Sin discrepancias — inventario exacto</p>
                      </div>
                    )}

                    {!v.cargandoDiferencias && v.diferencias && v.diferencias.length > 0 && (
                      <>
                        {/* Barra de acciones */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                          <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                            <strong style={{ color: "var(--color-text-primary)" }}>{v.diferencias.length}</strong> producto{v.diferencias.length !== 1 ? "s" : ""} con diferencia
                          </p>
                          <button
                            onClick={() => exportarCSV(v)}
                            style={{
                              display: "flex", alignItems: "center", gap: "0.375rem",
                              padding: "0.375rem 0.875rem",
                              background: "var(--color-bg-surface)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-md)",
                              color: "var(--color-text-secondary)",
                              fontSize: "0.8125rem", cursor: "pointer",
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Exportar CSV
                          </button>
                        </div>

                        {/* Tabla de discrepancias */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                                {["Producto", "Código", "Stock sistema", "Contado", "Diferencia"].map((h) => (
                                  <th key={h} style={{
                                    padding: "0.5rem 0.75rem", textAlign: "left",
                                    color: "var(--color-text-muted)", fontWeight: 600,
                                    fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em",
                                    whiteSpace: "nowrap",
                                  }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {v.diferencias.map((d, idx) => (
                                <tr
                                  key={d.productoId}
                                  style={{
                                    borderBottom: "1px solid var(--color-border-subtle)",
                                    background: idx % 2 === 0 ? "transparent" : "var(--color-bg-surface)",
                                  }}
                                >
                                  <td style={{ padding: "0.5625rem 0.75rem", color: "var(--color-text-primary)", fontWeight: 500 }}>
                                    <div>{d.nombre}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                                      {d.marca} {d.modelo}
                                    </div>
                                  </td>
                                  <td style={{ padding: "0.5625rem 0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                                    {d.codigoBarras ?? "—"}
                                  </td>
                                  <td style={{ padding: "0.5625rem 0.75rem", textAlign: "center", fontFamily: "var(--font-data)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                                    {d.stockSistema}
                                  </td>
                                  <td style={{ padding: "0.5625rem 0.75rem", textAlign: "center", fontFamily: "var(--font-data)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                                    {d.cantidadContada}
                                  </td>
                                  <td style={{ padding: "0.5625rem 0.75rem", textAlign: "center" }}>
                                    <DeltaBadge delta={d.diferencia} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Resumen delta */}
                        <ResumenDelta diferencias={v.diferencias} />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────────

function Metrica({
  label, value, accent,
}: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <p style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginBottom: "0.125rem" }}>{label}</p>
      <p style={{
        fontFamily: "var(--font-data)", fontWeight: 700, fontSize: "0.9375rem",
        color: accent ?? "var(--color-text-primary)",
      }}>
        {value}
      </p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
      <Minus className="w-3.5 h-3.5" /> 0
    </span>
  );
  const pos = delta > 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      padding: "0.2rem 0.625rem",
      background: pos ? "var(--color-success-bg)" : "var(--color-danger-bg)",
      color: pos ? "var(--color-success-text)" : "var(--color-danger-text)",
      borderRadius: "var(--radius-full)",
      fontSize: "0.8125rem", fontWeight: 700, fontFamily: "var(--font-data)",
    }}>
      {pos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {pos ? "+" : ""}{delta}
    </span>
  );
}

function ResumenDelta({ diferencias }: { diferencias: DiferenciaVerificacion[] }) {
  const sobrantes = diferencias.filter((d) => d.diferencia > 0);
  const faltantes = diferencias.filter((d) => d.diferencia < 0);
  const totalSob  = sobrantes.reduce((s, d) => s + d.diferencia, 0);
  const totalFal  = faltantes.reduce((s, d) => s + Math.abs(d.diferencia), 0);

  return (
    <div style={{
      display: "flex", gap: "0.75rem", marginTop: "0.875rem",
      padding: "0.75rem 1rem",
      background: "var(--color-bg-surface)",
      border: "1px solid var(--color-border-subtle)",
      borderRadius: "var(--radius-md)",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <TrendingUp className="w-4 h-4" style={{ color: "var(--color-success)" }} />
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
          Sobrantes: <strong style={{ fontFamily: "var(--font-data)", color: "var(--color-success-text)" }}>+{totalSob}</strong> uds en {sobrantes.length} productos
        </span>
      </div>
      <div style={{ width: 1, background: "var(--color-border-subtle)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <TrendingDown className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
          Faltantes: <strong style={{ fontFamily: "var(--font-data)", color: "var(--color-danger-text)" }}>-{totalFal}</strong> uds en {faltantes.length} productos
        </span>
      </div>
    </div>
  );
}
