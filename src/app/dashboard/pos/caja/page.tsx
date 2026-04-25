"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  XCircle,
  Plus,
  Zap,
  AlertCircle,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  Coins,
  Wrench,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { generarReporteX, generarReporteZ, abrirReporte } from "@/lib/utils/reportes";
import type { CajaSesion, CajaMovimiento, ConteoDenominaciones, AnticipoEnSesion } from "@/types";

// ─── Denominaciones MXN ───────────────────────────────────────────
const DENOMINACIONES: { key: keyof Omit<ConteoDenominaciones, "monedas">; label: string; valor: number }[] = [
  { key: "b1000", label: "$1,000", valor: 1000 },
  { key: "b500",  label: "$500",   valor: 500  },
  { key: "b200",  label: "$200",   valor: 200  },
  { key: "b100",  label: "$100",   valor: 100  },
  { key: "b50",   label: "$50",    valor: 50   },
  { key: "b20",   label: "$20",    valor: 20   },
];

const CONTEO_INICIAL: ConteoDenominaciones = {
  b1000: 0, b500: 0, b200: 0, b100: 0, b50: 0, b20: 0, monedas: 0,
};

function calcularTotalConteo(c: ConteoDenominaciones): number {
  return (
    c.b1000 * 1000 +
    c.b500  * 500  +
    c.b200  * 200  +
    c.b100  * 100  +
    c.b50   * 50   +
    c.b20   * 20   +
    c.monedas
  );
}

// ─── Tipos de movimiento en UI ────────────────────────────────────
type TipoMovUI = "pay_in" | "pay_out";

function labelMovimiento(tipo: string): string {
  switch (tipo) {
    case "pay_in":            return "Entrada";
    case "pay_out":           return "Salida";
    case "deposito":          return "Depósito";
    case "retiro":            return "Retiro";
    case "entrada_anticipo":  return "Anticipo (entrada)";
    case "devolucion_anticipo": return "Anticipo (devolución)";
    default: return tipo;
  }
}

function esEntrada(tipo: string): boolean {
  return ["pay_in", "deposito", "entrada_anticipo"].includes(tipo);
}

// ─────────────────────────────────────────────────────────────────
export default function CajaPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [sesionActiva, setSesionActiva] = useState<CajaSesion | null>(null);
  const [loadingSesion, setLoadingSesion] = useState(true);
  const [sesiones, setSesiones] = useState<CajaSesion[]>([]);
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([]);

  // Config
  const [fondoCaja, setFondoCaja] = useState<number>(500);

  // FASE 41: Bolsa virtual
  const [anticiposSesion, setAnticiposSesion] = useState<AnticipoEnSesion[]>([]);
  const [anticiposSinSesion, setAnticiposSinSesion] = useState<AnticipoEnSesion[]>([]);
  const [loadingAnticipossesion, setLoadingAnticiposSesion] = useState(false);

  // Modal Abrir
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [montoInicial, setMontoInicial] = useState("");
  const [notasApertura, setNotasApertura] = useState("");

  // Modal Cerrar — FASE 40: conteo ciego
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [conteoDenom, setConteoDenom] = useState<ConteoDenominaciones>(CONTEO_INICIAL);
  const [notasCierre, setNotasCierre] = useState("");
  const [payjoyStats, setPayjoyStats] = useState<CajaSesion["payjoyStats"]>(undefined);

  // Bolsas cobradas en esta sesión (reparaciones entregadas)
  interface BolsaCobrada {
    ordenId: string; folio: string; dispositivo: string;
    clienteNombre: string; costoTotal: number; totalAnticipos: number;
    ingresoNeto: number; reembolsoCaja: number;
  }
  const [bolsasCobradas, setBolsasCobradas] = useState<BolsaCobrada[]>([]);
  const [totalBolsasCobradas, setTotalBolsasCobradas] = useState(0);

  // Modal Pay In / Pay Out
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovUI>("pay_in");
  const [montoMovimiento, setMontoMovimiento] = useState("");
  const [conceptoMovimiento, setConceptoMovimiento] = useState("");

  const [processing, setProcessing] = useState(false);
  const [generandoReporte, setGenerandoReporte] = useState(false);
  const [sesionOtroEmpleado, setSesionOtroEmpleado] = useState<{ folio: string; nombre: string } | null>(null);

  // Integración asistencia ↔ caja
  const [asistenciaActiva, setAsistenciaActiva] = useState<boolean | null>(null);
  const [registrarEntradaConCaja, setRegistrarEntradaConCaja] = useState(true);
  const [registrarSalidaConCaja, setRegistrarSalidaConCaja] = useState(true);

  // ── Protección de ruta ──────────────────────────────────────────
  useEffect(() => {
    if (user && !["admin", "vendedor", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // ── Fetch inicial ───────────────────────────────────────────────
  const fetchSesionActiva = useCallback(async () => {
    try {
      setLoadingSesion(true);
      const response = await fetch(`/api/pos/caja?action=activa&usuarioId=${user?.id}`);
      const data = await response.json();
      setSesionActiva(data.success && data.data ? data.data : null);
    } catch (error) {
      console.error("Error fetching sesion activa:", error);
    } finally {
      setLoadingSesion(false);
    }
  }, [user?.id]);

  const fetchHistorialSesiones = useCallback(async () => {
    try {
      const response = await fetch("/api/pos/caja");
      const data = await response.json();
      if (data.success) {
        setSesiones(data.data);
        const otraAbierta = (data.data as CajaSesion[]).find(
          (s) => s.estado === "abierta" && s.usuarioId !== user?.id
        );
        setSesionOtroEmpleado(
          otraAbierta
            ? { folio: otraAbierta.folio, nombre: otraAbierta.usuarioNombre || "otro empleado" }
            : null
        );
      }
    } catch (error) {
      console.error("Error fetching sesiones:", error);
    }
  }, [user?.id]);

  const fetchMovimientos = useCallback(async (sesionId: string) => {
    try {
      const response = await fetch(`/api/pos/caja/${sesionId}?action=movimientos`);
      const data = await response.json();
      if (data.success) setMovimientos(data.data);
    } catch (error) {
      console.error("Error fetching movimientos:", error);
    }
  }, []);

  // FASE 41: anticipos de la sesión activa
  const fetchAnticiposSesion = useCallback(async (sesionId: string) => {
    try {
      setLoadingAnticiposSesion(true);
      const response = await fetch(`/api/pos/caja/${sesionId}?action=anticipos`);
      const data = await response.json();
      if (data.success) setAnticiposSesion(data.data);
    } catch (error) {
      console.error("Error fetching anticipos sesion:", error);
    } finally {
      setLoadingAnticiposSesion(false);
    }
  }, []);

  // FASE 41: anticipos sin sesión (admin/super_admin)
  const fetchAnticiposSinSesion = useCallback(async () => {
    try {
      const response = await fetch("/api/pos/caja?action=anticipos-sin-sesion");
      const data = await response.json();
      if (data.success) setAnticiposSinSesion(data.data);
    } catch (error) {
      console.error("Error fetching anticipos sin sesion:", error);
    }
  }, []);

  // FASE 40: cargar fondo de caja configurable
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/configuracion");
      const data = await res.json();
      if (data.success && data.data?.fondoCaja != null) {
        setFondoCaja(data.data.fondoCaja);
      }
    } catch {
      // no crítico
    }
  }, []);

  const fetchAsistenciaActiva = useCallback(async () => {
    try {
      const res = await fetch("/api/asistencia/activa");
      const data = await res.json();
      setAsistenciaActiva(data.success && !!data.data);
    } catch {
      setAsistenciaActiva(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSesionActiva();
      fetchHistorialSesiones();
      fetchConfig();
      fetchAsistenciaActiva();
      if (["admin", "super_admin"].includes(user.role)) fetchAnticiposSinSesion();
    }
  }, [user, fetchSesionActiva, fetchHistorialSesiones, fetchConfig, fetchAsistenciaActiva, fetchAnticiposSinSesion]);

  useEffect(() => {
    if (sesionActiva) {
      fetchMovimientos(sesionActiva.id);
      fetchAnticiposSesion(sesionActiva.id);
    }
  }, [sesionActiva, fetchMovimientos, fetchAnticiposSesion]);

  // ── Reporte X / Z ───────────────────────────────────────────────
  const handleGenerarReporte = async (sesionId: string, tipo: "X" | "Z") => {
    setGenerandoReporte(true);
    try {
      const response = await fetch(`/api/pos/caja/${sesionId}?action=reporte`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      const { sesion, movimientos: movs, ventas, anticipos, distribuidorNombre } = data.data;
      const html =
        tipo === "X"
          ? generarReporteX({ sesion, movimientos: movs, ventas, anticipos, distribuidorNombre })
          : generarReporteZ({ sesion, movimientos: movs, ventas, anticipos, distribuidorNombre });
      abrirReporte(html, `Reporte ${tipo} — ${sesion.folio}`);
    } catch (error) {
      console.error("Error generando reporte:", error);
      alert("Error al generar el reporte");
    } finally {
      setGenerandoReporte(false);
    }
  };

  // ── Abrir Caja ──────────────────────────────────────────────────
  const handleAbrirCaja = async () => {
    const monto = parseFloat(montoInicial);
    if (isNaN(monto) || monto < 0) { alert("Ingrese un monto inicial válido"); return; }
    setProcessing(true);
    try {
      const response = await fetch("/api/pos/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abrir", montoInicial: monto, notas: notasApertura || undefined }),
      });
      const data = await response.json();
      if (data.success) {
        setSesionActiva(data.data);
        setShowAbrirModal(false);
        setMontoInicial("");
        setNotasApertura("");
        fetchHistorialSesiones();

        // Registrar entrada de asistencia si el checkbox está activo y no hay sesión activa
        if (registrarEntradaConCaja && asistenciaActiva === false) {
          try {
            const asistRes = await fetch("/api/asistencia", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notas: "Entrada registrada al abrir caja" }),
            });
            if (asistRes.ok) setAsistenciaActiva(true);
          } catch { /* silencioso */ }
        }
      } else {
        alert(data.error || "Error al abrir caja");
      }
    } catch (error) {
      console.error("Error opening caja:", error);
      alert("Error al abrir caja");
    } finally {
      setProcessing(false);
    }
  };

  // ── Cerrar Caja — FASE 40 ───────────────────────────────────────
  const handleCerrarCaja = async () => {
    if (!sesionActiva) return;
    const montoFinal = calcularTotalConteo(conteoDenom);
    if (!confirm("¿Confirmar cierre de caja con el conteo registrado?")) return;
    setProcessing(true);
    try {
      const response = await fetch(`/api/pos/caja/${sesionActiva.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cerrar",
          montoFinal,
          notas: notasCierre || undefined,
          conteoDenominaciones: conteoDenom,
        }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.data?.payjoyStats) setPayjoyStats(data.data.payjoyStats);
        setSesionActiva(null);
        setShowCerrarModal(false);
        setConteoDenom(CONTEO_INICIAL);
        setNotasCierre("");
        setAnticiposSesion([]);
        fetchHistorialSesiones();
        if (["admin", "super_admin"].includes(user?.role ?? "")) fetchAnticiposSinSesion();

        // Registrar salida de asistencia si el checkbox está activo y hay sesión activa
        if (registrarSalidaConCaja && asistenciaActiva === true) {
          try {
            await fetch("/api/asistencia/checkout", { method: "POST" });
            setAsistenciaActiva(false);
          } catch { /* silencioso */ }
        }

        alert("Caja cerrada exitosamente");
      } else {
        alert(data.error || "Error al cerrar caja");
      }
    } catch (error) {
      console.error("Error closing caja:", error);
      alert("Error al cerrar caja");
    } finally {
      setProcessing(false);
    }
  };

  // ── Pay In / Pay Out ────────────────────────────────────────────
  const handleAgregarMovimiento = async () => {
    if (!sesionActiva) return;
    const monto = parseFloat(montoMovimiento);
    if (isNaN(monto) || monto <= 0) { alert("Ingrese un monto válido"); return; }
    if (!conceptoMovimiento.trim()) { alert("Ingrese un concepto"); return; }
    setProcessing(true);
    try {
      const response = await fetch(`/api/pos/caja/${sesionActiva.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "movimiento",
          tipo: tipoMovimiento,
          monto,
          concepto: conceptoMovimiento,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShowMovimientoModal(false);
        setMontoMovimiento("");
        setConceptoMovimiento("");
        fetchMovimientos(sesionActiva.id);
        fetchSesionActiva();
      } else {
        alert(data.error || "Error al agregar movimiento");
      }
    } catch (error) {
      console.error("Error adding movimiento:", error);
      alert("Error al agregar movimiento");
    } finally {
      setProcessing(false);
    }
  };

  // ── Guards ──────────────────────────────────────────────────────
  if (!user || !["admin", "vendedor", "super_admin"].includes(user.role)) return null;

  if (loadingSesion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center" style={{ color: "var(--color-text-muted)" }}>Cargando...</div>
      </div>
    );
  }

  // Helpers para UI
  const labelStyle = { color: "var(--color-text-secondary)" };
  const totalConteo = calcularTotalConteo(conteoDenom);
  const montoEsperadoActual = sesionActiva
    ? sesionActiva.montoInicial +
      sesionActiva.totalVentasEfectivo +
      sesionActiva.totalDepositos -
      sesionActiva.totalRetiros
    : 0;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Gestión de Caja
        </h1>
        <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Administra turnos de caja, entradas/salidas y corte
        </p>
      </div>

      {/* Banner sesión de otro empleado */}
      {sesionOtroEmpleado && !sesionActiva && (
        <div
          className="mb-6 p-4 rounded-xl flex items-start gap-3"
          style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-warning-text)" }}>
              {sesionOtroEmpleado.nombre} tiene la caja abierta ({sesionOtroEmpleado.folio})
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-warning-text)" }}>
              Solo puede existir una sesión activa por tienda. Coordina con {sesionOtroEmpleado.nombre} antes de abrir tu turno.
            </p>
          </div>
        </div>
      )}

      {/* Sesión Actual */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Sesión Actual
          </h2>
          <div className="flex gap-2">
            {sesionActiva && (
              <Button variant="secondary" onClick={() => router.push("/dashboard/pos")}>
                Ir al POS →
              </Button>
            )}
            {!sesionActiva && (
              <Button
                onClick={() => {
                  setMontoInicial(fondoCaja > 0 ? String(fondoCaja) : "");
                  setShowAbrirModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Abrir Caja
              </Button>
            )}
          </div>
        </div>

        {sesionActiva ? (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg" style={{ background: "var(--color-info-bg)" }}>
                <p className="text-sm" style={labelStyle}>Folio</p>
                <p className="text-lg font-bold" style={{ color: "var(--color-info)", fontFamily: "var(--font-mono)" }}>
                  {sesionActiva.folio}
                </p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--color-success-bg)" }}>
                <p className="text-sm" style={labelStyle}>Monto Inicial</p>
                <p className="text-lg font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                  ${sesionActiva.montoInicial.toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: "var(--color-accent-light)" }}>
                <p className="text-sm" style={labelStyle}>Tiempo Abierto</p>
                <p className="text-lg font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                  {Math.floor((Date.now() - new Date(sesionActiva.fechaApertura).getTime()) / (1000 * 60 * 60))}h
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => { setTipoMovimiento("pay_in"); setShowMovimientoModal(true); }}
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Entrada
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setTipoMovimiento("pay_out"); setShowMovimientoModal(true); }}
              >
                <ArrowDownCircle className="w-4 h-4 mr-2" />
                Salida
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleGenerarReporte(sesionActiva.id, "X")}
                disabled={generandoReporte}
              >
                <FileText className="w-4 h-4 mr-2" />
                {generandoReporte ? "Generando..." : "Reporte X"}
              </Button>
              <Button variant="danger" onClick={async () => {
                setConteoDenom(CONTEO_INICIAL);
                setShowCerrarModal(true);
                if (sesionActiva) {
                  try {
                    const res = await fetch(`/api/pos/caja/${sesionActiva.id}/bolsas-cobradas`);
                    const data = await res.json();
                    if (data.success) {
                      setBolsasCobradas(data.data);
                      setTotalBolsasCobradas(data.totalIngresado ?? 0);
                    }
                  } catch { /* no bloquea */ }
                }
              }}>
                <XCircle className="w-4 h-4 mr-2" />
                Cerrar Caja
              </Button>
            </div>

            {/* Movimientos del turno */}
            {movimientos.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
                  Movimientos del turno
                </h3>
                <div className="space-y-2">
                  {movimientos.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "var(--color-bg-elevated)" }}
                    >
                      <div className="flex items-center gap-3">
                        {esEntrada(mov.tipo) ? (
                          <ArrowUpCircle className="w-5 h-5" style={{ color: "var(--color-success)" }} />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5" style={{ color: "var(--color-danger)" }} />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{mov.concepto}</p>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                background: esEntrada(mov.tipo)
                                  ? "var(--color-success-bg)"
                                  : "var(--color-danger-bg)",
                                color: esEntrada(mov.tipo)
                                  ? "var(--color-success-text)"
                                  : "var(--color-danger-text)",
                              }}
                            >
                              {labelMovimiento(mov.tipo)}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                            {new Date(mov.createdAt).toLocaleString("es-MX")}
                          </p>
                        </div>
                      </div>
                      <p
                        className="text-lg font-bold"
                        style={{
                          color: esEntrada(mov.tipo) ? "var(--color-success)" : "var(--color-danger)",
                          fontFamily: "var(--font-data)",
                        }}
                      >
                        {esEntrada(mov.tipo) ? "+" : "-"}${mov.monto.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          {/* FASE 41: Bolsa de Reparaciones */}
          {(anticiposSesion.length > 0 || loadingAnticipossesion) && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Bolsa de Reparaciones
                </h3>
                <span
                  className="px-2 py-0.5 text-xs rounded-full font-medium"
                  style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
                >
                  ${anticiposSesion.reduce((s, a) => s + a.monto, 0).toFixed(2)}
                </span>
              </div>
              {loadingAnticipossesion ? (
                <div className="h-16 rounded-lg animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
              ) : (
                <div className="space-y-2">
                  {anticiposSesion.map((ant) => (
                    <div
                      key={ant.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <div className="flex items-center gap-3">
                        <Wrench className="w-4 h-4 shrink-0" style={{ color: "var(--color-accent)" }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                              {ant.folioOrden}
                            </p>
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              {ant.clienteNombre}
                            </span>
                          </div>
                          {ant.empleadoNombre && (
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              Recibió: {ant.empleadoNombre} · {new Date(ant.fechaAnticipo).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                          +${ant.monto.toFixed(2)}
                        </p>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}
                        >
                          {ant.tipoPago}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>

        ) : (
          <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No hay sesión de caja activa</p>
            <p className="text-sm mt-2">Abre una caja para comenzar a operar</p>
          </div>
        )}
      </Card>

      {/* Historial */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          Historial de Sesiones
        </h2>
        <div className="space-y-3">
          {sesiones.map((sesion) => (
            <div key={sesion.id} className="rounded-lg p-4" style={{ border: "1px solid var(--color-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p
                      className="font-semibold"
                      style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
                    >
                      {sesion.folio}
                    </p>
                    <span
                      className="px-2 py-1 text-xs rounded-full"
                      style={
                        sesion.estado === "abierta"
                          ? { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
                          : { background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }
                      }
                    >
                      {sesion.estado === "abierta" ? "Abierta" : "Cerrada"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p style={labelStyle}>Apertura</p>
                      <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {new Date(sesion.fechaApertura).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <div>
                      <p style={labelStyle}>Monto Inicial</p>
                      <p className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                        ${sesion.montoInicial.toFixed(2)}
                      </p>
                    </div>
                    {sesion.estado === "cerrada" && sesion.montoFinal && (
                      <>
                        <div>
                          <p style={labelStyle}>Monto Declarado</p>
                          <p className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                            ${sesion.montoFinal.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p style={labelStyle}>Diferencia</p>
                          <p
                            className="font-bold"
                            style={{
                              color:
                                (sesion.diferencia || 0) === 0
                                  ? "var(--color-success)"
                                  : (sesion.diferencia || 0) > 0
                                  ? "var(--color-info)"
                                  : "var(--color-danger)",
                              fontFamily: "var(--font-data)",
                            }}
                          >
                            {sesion.diferencia && sesion.diferencia !== 0
                              ? `${sesion.diferencia > 0 ? "+" : ""}$${sesion.diferencia.toFixed(2)}`
                              : "Sin diferencia"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleGenerarReporte(sesion.id, sesion.estado === "cerrada" ? "Z" : "X")}
                  disabled={generandoReporte}
                  style={{
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Printer className="w-3 h-3" />
                  {sesion.estado === "cerrada" ? "Rep. Z" : "Rep. X"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* FASE 41: Anticipos sin sesión de caja — solo admin / super_admin */}
      {["admin", "super_admin"].includes(user.role) && anticiposSinSesion.length > 0 && (
        <Card className="p-6 mt-6">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-danger)" }} />
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-danger)" }}>
                Anticipos sin sesión de caja ({anticiposSinSesion.length})
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Efectivo recibido en reparaciones sin una sesión de caja activa. Revisar con el empleado correspondiente.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {anticiposSinSesion.map((ant) => (
              <div
                key={ant.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-4 h-4 shrink-0" style={{ color: "var(--color-danger)" }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "var(--color-danger-text)", fontFamily: "var(--font-mono)" }}>
                        {ant.folioOrden}
                      </p>
                      <span className="text-sm" style={{ color: "var(--color-danger-text)" }}>
                        {ant.clienteNombre}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                      {ant.empleadoNombre ? `Registrado por: ${ant.empleadoNombre}` : "Empleado desconocido"}
                      {" · "}
                      {new Date(ant.fechaAnticipo).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: "var(--color-danger)", fontFamily: "var(--font-data)" }}>
                    ${ant.monto.toFixed(2)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-danger-text)" }}>Sin sesión</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Modal Abrir Caja ───────────────────────────────────── */}
      {showAbrirModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Abrir Caja</h2>
            {fondoCaja > 0 && (
              <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
                Fondo configurado: <span style={{ fontFamily: "var(--font-data)", color: "var(--color-accent)" }}>${fondoCaja.toFixed(2)}</span>
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Monto Inicial *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  placeholder="0.00"
                />
                {fondoCaja > 0 && montoInicial !== String(fondoCaja) && (
                  <button
                    type="button"
                    className="mt-1 text-xs underline"
                    style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => setMontoInicial(String(fondoCaja))}
                  >
                    Usar fondo configurado (${fondoCaja.toFixed(2)})
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Notas (opcional)
                </label>
                <Input
                  value={notasApertura}
                  onChange={(e) => setNotasApertura(e.target.value)}
                  placeholder="Ej: Turno matutino"
                />
              </div>
              {/* Asistencia integrada: entrada */}
              {asistenciaActiva === false && (
                <label
                  className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl"
                  style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)" }}
                >
                  <input
                    type="checkbox"
                    checked={registrarEntradaConCaja}
                    onChange={(e) => setRegistrarEntradaConCaja(e.target.checked)}
                    className="w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-info-text)" }}>
                      Registrar entrada de asistencia
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-info-text)", opacity: 0.8 }}>
                      No has checado entrada hoy
                    </p>
                  </div>
                </label>
              )}
              {asistenciaActiva === true && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)" }}
                >
                  <UserCheck className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
                  <p className="text-xs" style={{ color: "var(--color-success-text)" }}>
                    Asistencia ya registrada para hoy
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowAbrirModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleAbrirCaja} disabled={processing || !montoInicial} className="flex-1">
                  {processing ? "Abriendo..." : "Abrir Caja"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Modal Cerrar Caja — FASE 40: conteo ciego ─────────── */}
      {showCerrarModal && sesionActiva && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
              Corte de Caja — Conteo Ciego
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--color-text-muted)" }}>
              Cuenta el efectivo por denominación. El monto esperado se revelará al confirmar el cierre.
            </p>

            {/* Resumen del turno (sin monto esperado — conteo ciego) */}
            <div
              className="rounded-lg p-4 mb-5 space-y-2 text-sm"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                Resumen del turno
              </p>
              {[
                { label: "Monto Inicial",     value: `$${sesionActiva.montoInicial.toFixed(2)}`,           color: "var(--color-text-primary)" },
                { label: "Ventas Efectivo",   value: `+$${sesionActiva.totalVentasEfectivo.toFixed(2)}`,   color: "var(--color-success)" },
                { label: "Entradas",          value: `+$${sesionActiva.totalDepositos.toFixed(2)}`,         color: "var(--color-success)" },
                { label: "Salidas",           value: `-$${sesionActiva.totalRetiros.toFixed(2)}`,           color: "var(--color-danger)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                  <span className="font-medium" style={{ color, fontFamily: "var(--font-data)" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* ── Bolsas cobradas hoy ── */}
            {bolsasCobradas.length > 0 && (
              <div className="rounded-lg overflow-hidden mb-5" style={{ border: "1px solid var(--color-border)" }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ background: "var(--color-success-bg)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🛍️</span>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-success-text)" }}>
                      Reparaciones cobradas este turno ({bolsasCobradas.length})
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                    +${totalBolsasCobradas.toFixed(2)}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
                  {bolsasCobradas.map((b) => (
                    <div key={b.ordenId} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>{b.folio}</span>
                        <span className="mx-2 text-xs" style={{ color: "var(--color-text-muted)" }}>·</span>
                        <span className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>{b.clienteNombre}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
                          +${(b.ingresoNeto - b.reembolsoCaja).toFixed(2)}
                        </p>
                        {b.totalAnticipos > 0 && (
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            Anticipo: ${b.totalAnticipos.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Conteo por denominación ── */}
            <div
              className="rounded-lg overflow-hidden mb-5"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <div
                className="px-4 py-2 flex items-center gap-2"
                style={{ background: "var(--color-primary-light)" }}
              >
                <Coins className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                  Conteo por denominación
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg-elevated)" }}>
                    <th className="px-4 py-2 text-left font-medium" style={{ color: "var(--color-text-secondary)" }}>Denominación</th>
                    <th className="px-4 py-2 text-center font-medium" style={{ color: "var(--color-text-secondary)" }}>Cantidad</th>
                    <th className="px-4 py-2 text-right font-medium" style={{ color: "var(--color-text-secondary)" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {DENOMINACIONES.map(({ key, label, valor }, idx) => (
                    <tr
                      key={key}
                      style={{
                        background: idx % 2 === 0 ? "var(--color-bg-surface)" : "var(--color-bg-elevated)",
                        borderTop: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <td className="px-4 py-2 font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                        {label}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConteoDenom(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                            style={{
                              width: 24, height: 24, borderRadius: 4,
                              background: "var(--color-bg-elevated)",
                              border: "1px solid var(--color-border)",
                              cursor: "pointer", display: "flex",
                              alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <ChevronDown className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={conteoDenom[key]}
                            onChange={(e) => setConteoDenom(prev => ({
                              ...prev,
                              [key]: Math.max(0, parseInt(e.target.value) || 0),
                            }))}
                            style={{
                              width: 60, textAlign: "center",
                              padding: "2px 4px", borderRadius: 4,
                              border: "1px solid var(--color-border)",
                              background: "var(--color-bg-sunken)",
                              color: "var(--color-text-primary)",
                              fontFamily: "var(--font-data)",
                              fontSize: 14,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setConteoDenom(prev => ({ ...prev, [key]: prev[key] + 1 }))}
                            style={{
                              width: 24, height: 24, borderRadius: 4,
                              background: "var(--color-bg-elevated)",
                              border: "1px solid var(--color-border)",
                              cursor: "pointer", display: "flex",
                              alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <ChevronUp className="w-3 h-3" style={{ color: "var(--color-text-muted)" }} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                        ${(conteoDenom[key] * valor).toLocaleString("es-MX")}
                      </td>
                    </tr>
                  ))}
                  {/* Monedas */}
                  <tr
                    style={{
                      background: "var(--color-bg-surface)",
                      borderTop: "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <td className="px-4 py-2 font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                      Monedas
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={conteoDenom.monedas || ""}
                          onChange={(e) => setConteoDenom(prev => ({
                            ...prev,
                            monedas: Math.max(0, parseFloat(e.target.value) || 0),
                          }))}
                          placeholder="0.00"
                          style={{
                            width: 100, padding: "4px 8px", borderRadius: 4,
                            border: "1px solid var(--color-border)",
                            background: "var(--color-bg-sunken)",
                            color: "var(--color-text-primary)",
                            fontFamily: "var(--font-data)",
                            fontSize: 14,
                          }}
                        />
                        <span className="ml-auto font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                          ${conteoDenom.monedas.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* Total */}
                  <tr style={{ borderTop: "2px solid var(--color-border-strong)", background: "var(--color-primary-light)" }}>
                    <td className="px-4 py-3 font-bold" style={{ color: "var(--color-text-primary)" }} colSpan={2}>
                      Total Contado
                    </td>
                    <td
                      className="px-4 py-3 text-right text-lg font-bold"
                      style={{ color: "var(--color-primary)", fontFamily: "var(--font-data)" }}
                    >
                      ${totalConteo.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payjoy Stats (informativo) */}
            {payjoyStats ? (
              <div className="p-4 rounded-lg mb-4" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-info)" }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--color-info-text)" }}>
                      Payjoy — Solo informativo
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-info)" }}>
                      Este dinero NO está en caja física · Procesado por Payjoy
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded p-2 text-center" style={{ background: "var(--color-bg-surface)" }}>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Pagos recibidos</p>
                    <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                      {payjoyStats.totalPagosPayjoy}
                    </p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ background: "var(--color-bg-surface)" }}>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Total Payjoy</p>
                    <p className="text-lg font-bold" style={{ color: "var(--color-info)", fontFamily: "var(--font-data)" }}>
                      ${payjoyStats.montoTotalPayjoy.toLocaleString("es-MX")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="p-3 rounded-lg mb-4 flex items-start gap-3"
                style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
              >
                <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
                <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>
                  <span className="font-medium">Pagos Payjoy</span> — Los pagos recibidos vía Payjoy se mostrarán aquí al cerrar.
                </p>
              </div>
            )}

            {/* Notas y botones */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Notas de Cierre (opcional)
                </label>
                <Input
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Observaciones del turno"
                />
              </div>

              {/* Diferencia prevista (solo visible si hay conteo) */}
              {totalConteo > 0 && (
                <div
                  className="p-3 rounded-lg"
                  style={{
                    background:
                      Math.abs(totalConteo - montoEsperadoActual) < 1
                        ? "var(--color-success-bg)"
                        : "var(--color-warning-bg)",
                    border: `1px solid ${
                      Math.abs(totalConteo - montoEsperadoActual) < 1
                        ? "var(--color-success)"
                        : "var(--color-warning)"
                    }`,
                  }}
                >
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--color-text-secondary)" }}>Monto esperado:</span>
                    <span style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>
                      ${montoEsperadoActual.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span style={{ color: "var(--color-text-secondary)" }}>Total contado:</span>
                    <span style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>
                      ${totalConteo.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                    <span style={{ color: "var(--color-text-primary)" }}>Diferencia:</span>
                    <span
                      style={{
                        fontFamily: "var(--font-data)",
                        color:
                          Math.abs(totalConteo - montoEsperadoActual) < 1
                            ? "var(--color-success)"
                            : totalConteo > montoEsperadoActual
                            ? "var(--color-info)"
                            : "var(--color-danger)",
                      }}
                    >
                      {totalConteo - montoEsperadoActual >= 0 ? "+" : ""}${(totalConteo - montoEsperadoActual).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Asistencia integrada: salida */}
              {asistenciaActiva === true && (
                <label
                  className="flex items-center gap-2.5 cursor-pointer mb-3 p-3 rounded-xl"
                  style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
                >
                  <input
                    type="checkbox"
                    checked={registrarSalidaConCaja}
                    onChange={(e) => setRegistrarSalidaConCaja(e.target.checked)}
                    className="w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-warning-text)" }}>
                      Registrar salida de asistencia
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-warning-text)", opacity: 0.8 }}>
                      Tienes una sesión de asistencia activa
                    </p>
                  </div>
                </label>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowCerrarModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleCerrarCaja}
                  disabled={processing || totalConteo < 0}
                  className="flex-1"
                >
                  {processing ? "Cerrando..." : "Confirmar Cierre"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Modal Pay In / Pay Out ─────────────────────────────── */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
              {tipoMovimiento === "pay_in" ? "Entrada de Efectivo" : "Salida de Efectivo"}
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
              {tipoMovimiento === "pay_in"
                ? "Registra dinero que entra a la caja sin relación a una venta (ej: cambio, fondo adicional)."
                : "Registra dinero que sale de la caja sin relación a una venta (ej: pago a proveedor, gasto chico)."}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Monto *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montoMovimiento}
                  onChange={(e) => setMontoMovimiento(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Concepto *
                </label>
                <Input
                  value={conceptoMovimiento}
                  onChange={(e) => setConceptoMovimiento(e.target.value)}
                  placeholder={
                    tipoMovimiento === "pay_in"
                      ? "Ej: Fondo adicional, cambio de billete"
                      : "Ej: Pago a proveedor, gasto de limpieza"
                  }
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => { setShowMovimientoModal(false); setMontoMovimiento(""); setConceptoMovimiento(""); }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAgregarMovimiento}
                  disabled={processing || !montoMovimiento || !conceptoMovimiento.trim()}
                  className="flex-1"
                >
                  {processing ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
