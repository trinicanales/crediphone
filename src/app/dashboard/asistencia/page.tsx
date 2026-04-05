"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  Clock, Users, TrendingUp, Calendar,
  CheckCircle2, XCircle, Loader2, AlertTriangle,
  UserX, LogOut, RotateCcw,
} from "lucide-react";
import type { AsistenciaSesion, EstadisticasAsistencia } from "@/types";
import { BannerInventarioSemanal } from "@/components/inventario/BannerInventarioSemanal";

const MXH = (h: number) => `${h}h`;

function formatFecha(d: Date | string) {
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function formatHora(d: Date | string) {
  return new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function formatDuracion(minutos?: number) {
  if (!minutos) return "—";
  if (minutos < 60) return `${minutos}m`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function minutosDesde(fecha: Date | string) {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: "var(--color-bg-elevated)" }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string | number; sub?: string; icon: typeof Clock; color: string }) {
  return (
    <div className="rounded-xl p-5"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "22" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{sub}</p>}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AsistenciaPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [sesiones, setSesiones] = useState<AsistenciaSesion[]>([]);
  const [stats, setStats] = useState<EstadisticasAsistencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState<string | null>(null); // userId que se está cerrando

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "cerrado">("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroDesde)  params.set("desde", filtroDesde);
      if (filtroHasta)  params.set("hasta", filtroHasta);

      const res = await fetch(`/api/asistencia?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error al cargar asistencia");
      setSesiones(data.data ?? []);
      setStats(data.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [user, filtroEstado, filtroDesde, filtroHasta]);

  useEffect(() => {
    if (!authLoading && user) {
      if (!["admin", "super_admin"].includes(user.role)) {
        router.replace("/dashboard");
        return;
      }
      cargar();
    }
  }, [authLoading, user, cargar, router]);

  async function handleCerrarTurno(usuarioId: string, usuarioNombre?: string) {
    if (!confirm(`¿Cerrar el turno de ${usuarioNombre ?? "este empleado"}?`)) return;
    setCerrando(usuarioId);
    try {
      const res = await fetch("/api/asistencia/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId, notas: "Turno cerrado por administrador." }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al cerrar turno");
    } finally {
      setCerrando(null);
    }
  }

  const sesionesActivas  = sesiones.filter((s) => s.estado === "activo");
  const sesionesHistorial = sesiones.filter((s) => s.estado === "cerrado");

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (authLoading || (loading && !stats)) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="w-12 h-12" style={{ color: "var(--color-danger)" }} />
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{error}</p>
        <button onClick={cargar} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer" }}>
          <RotateCcw className="w-4 h-4" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Recordatorio inventario semanal */}
      <BannerInventarioSemanal />

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-ui)" }}>
            Control de Asistencia
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Registro de entradas y salidas del personal
          </p>
        </div>
        <button onClick={cargar} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)", cursor: loading ? "not-allowed" : "pointer" }}>
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Presentes ahora"    value={stats.presentes}             sub="empleados en turno activo"    icon={Users}      color="var(--color-success)" />
          <KpiCard label="Horas totales hoy"  value={MXH(stats.totalHorasHoy)}    sub="suma de todos los turnos"     icon={Clock}      color="var(--color-accent)" />
          <KpiCard label="Horas este mes"     value={MXH(stats.totalHorasMes)}    sub="turnos cerrados del mes"      icon={Calendar}   color="var(--color-primary)" />
          <KpiCard label="Promedio por día"   value={MXH(stats.promedioHorasDia)} sub="horas promedio trabajadas"    icon={TrendingUp} color="var(--color-warning)" />
        </div>
      )}

      {/* Quién está aquí ahora */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
      >
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-success)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              En turno ahora ({sesionesActivas.length})
            </p>
          </div>
        </div>

        {sesionesActivas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ color: "var(--color-text-muted)" }}>
            <UserX className="w-10 h-10 opacity-30" />
            <p className="text-sm">Ningún empleado tiene turno activo en este momento</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            {sesionesActivas.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
                    {(s.usuarioNombre || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {s.usuarioNombre ?? "Empleado"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Entrada: {formatHora(s.fechaEntrada)} · {formatDuracion(minutosDesde(s.fechaEntrada))} activo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCerrarTurno(s.usuarioId, s.usuarioNombre)}
                  disabled={cerrando === s.usuarioId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-bg-elevated)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                    cursor: cerrando === s.usuarioId ? "not-allowed" : "pointer",
                    opacity: cerrando === s.usuarioId ? 0.6 : 1,
                  }}
                >
                  {cerrando === s.usuarioId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Cerrar turno
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial con filtros */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Historial</p>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as "" | "activo" | "cerrado")}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <option value="">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="cerrado">Cerrados</option>
            </select>

            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>Desde</label>
              <input
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>Hasta</label>
              <input
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
            </div>

            {(filtroEstado || filtroDesde || filtroHasta) && (
              <button
                onClick={() => { setFiltroEstado(""); setFiltroDesde(""); setFiltroHasta(""); }}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", cursor: "pointer" }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: "var(--color-text-muted)" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando historial...</span>
          </div>
        ) : sesionesHistorial.length === 0 && sesionesActivas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: "var(--color-text-muted)" }}>
            <Clock className="w-10 h-10 opacity-30" />
            <p className="text-sm">No hay registros de asistencia en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
                  {["Empleado", "Fecha", "Entrada", "Salida", "Duración", "Estado"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--color-text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
                {sesionesHistorial.map((s) => (
                  <tr key={s.id} className="transition-colors"
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {s.usuarioNombre ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--color-text-secondary)" }}>
                      {formatFecha(s.fechaEntrada)}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
                      {formatHora(s.fechaEntrada)}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
                      {s.fechaSalida ? formatHora(s.fechaSalida) : "—"}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)", fontWeight: 600 }}>
                      {formatDuracion(s.duracionMinutos)}
                    </td>
                    <td className="px-5 py-3">
                      {s.estado === "activo" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}>
                          <XCircle className="w-3 h-3" /> Cerrado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen por empleado */}
      {stats && stats.resumenEmpleados.length > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Resumen del mes por empleado
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
            {stats.resumenEmpleados
              .sort((a, b) => b.horasMes - a.horasMes)
              .map((emp) => (
                <div key={emp.usuarioId} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
                      {emp.nombre.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{emp.nombre}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{emp.diasTrabajados} día(s) trabajado(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                      {MXH(emp.horasMes)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: emp.estadoActual === "presente" ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                        color: emp.estadoActual === "presente" ? "var(--color-success-text)" : "var(--color-text-muted)",
                      }}>
                      {emp.estadoActual === "presente" ? "Presente" : "Ausente"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
