"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Download,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  User,
  CreditCard,
  TrendingUp,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { Credito, Pago, Cliente } from "@/types";
import { ComprobantePagoModal } from "@/components/print/ComprobantePagoModal";
import type { DatosComprobante } from "@/lib/print/comprobante";

// ─── Helpers ───────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(d: Date | string) {
  return new Date(d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generarCalendario(
  fechaInicio: Date,
  frecuenciaPago: string,
  plazo: number
): Date[] {
  const fechas: Date[] = [];
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);

  let total: number;
  switch (frecuenciaPago) {
    case "semanal":   total = plazo * 4; break;
    case "quincenal": total = plazo * 2; break;
    default:          total = plazo;     break;
  }

  for (let i = 1; i <= total; i++) {
    const f = new Date(inicio);
    if (frecuenciaPago === "mensual") {
      f.setMonth(inicio.getMonth() + i);
    } else if (frecuenciaPago === "quincenal") {
      f.setDate(inicio.getDate() + 15 * i);
    } else {
      f.setDate(inicio.getDate() + 7 * i);
    }
    f.setHours(0, 0, 0, 0);
    fechas.push(f);
  }
  return fechas;
}

interface CuotaCalendario {
  numero: number;
  fecha: Date;
  monto: number;
  estado: "pagado" | "vencido" | "pendiente";
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  background: "var(--color-bg-sunken)",
  color: "var(--color-text-primary)",
  outline: "none",
};

const selectStyle = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  background: "var(--color-bg-sunken)",
  color: "var(--color-text-primary)",
  outline: "none",
};

const cardSectionStyle = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};

// ─── Row components ────────────────────────────────────────────
function PagoRow({ pago, index, total }: { pago: Pago; index: number; total: number }) {
  const [hovered, setHovered] = useState(false);
  const metodoLabel: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    deposito: "Depósito",
    mixto: "Mixto",
    payjoy: "Payjoy",
  };
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--color-border-subtle)",
        transition: "background 150ms",
      }}
    >
      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {total - index}
      </td>
      <td
        className="px-4 py-3 text-sm whitespace-nowrap"
        style={{ color: "var(--color-text-primary)" }}
      >
        {fmtFecha(pago.fechaPago)}
      </td>
      <td
        className="px-4 py-3 text-sm font-semibold whitespace-nowrap"
        style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
      >
        ${fmt(Number(pago.monto))}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {metodoLabel[pago.metodoPago] || pago.metodoPago}
      </td>
      <td
        className="px-4 py-3 text-xs"
        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
      >
        {pago.referencia || "—"}
      </td>
    </tr>
  );
}

function CuotaRow({ cuota }: { cuota: CuotaCalendario }) {
  const [hovered, setHovered] = useState(false);

  let bg = "transparent";
  if (hovered) bg = "var(--color-bg-elevated)";
  else if (cuota.estado === "vencido") bg = "var(--color-danger-bg)";

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bg,
        borderBottom: "1px solid var(--color-border-subtle)",
        transition: "background 150ms",
      }}
    >
      <td className="px-4 py-2.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {cuota.numero}
      </td>
      <td
        className="px-4 py-2.5 text-sm whitespace-nowrap"
        style={{ color: "var(--color-text-primary)" }}
      >
        {fmtFecha(cuota.fecha)}
      </td>
      <td
        className="px-4 py-2.5 text-sm font-medium"
        style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
      >
        ${fmt(cuota.monto)}
      </td>
      <td className="px-4 py-2.5">
        {cuota.estado === "pagado" ? (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "var(--color-success-bg)",
              color: "var(--color-success-text)",
            }}
          >
            <CheckCircle2 className="w-3 h-3" /> Pagado
          </span>
        ) : cuota.estado === "vencido" ? (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "var(--color-danger-bg)",
              color: "var(--color-danger-text)",
            }}
          >
            <XCircle className="w-3 h-3" /> Vencido
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-muted)",
            }}
          >
            <Clock className="w-3 h-3" /> Pendiente
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Componente principal ──────────────────────────────────────
export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [credito, setCredito] = useState<Credito | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [totalPagado, setTotalPagado] = useState(0);
  const [comprobante, setComprobante] = useState<Omit<DatosComprobante, "empresaNombre"> | null>(null);
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [tabActivo, setTabActivo] = useState<"resumen" | "pagos" | "calendario">("resumen");
  const [modalPago, setModalPago] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [formPago, setFormPago] = useState({
    monto: "",
    fechaPago: new Date().toISOString().split("T")[0],
    metodoPago: "efectivo",
    referencia: "",
    detallePago: "",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/creditos/${id}`),
        fetch(`/api/creditos/${id}/pagos`),
      ]);
      const [cData, pData] = await Promise.all([cRes.json(), pRes.json()]);

      if (!cData.success) throw new Error(cData.error);
      if (!pData.success) throw new Error(pData.error);

      const c: Credito = cData.data;
      setCredito(c);
      setPagos(pData.data.pagos);
      setTotalPagado(pData.data.totalPagado);
      setSaldoPendiente(pData.data.saldoPendiente);

      const clRes = await fetch(`/api/clientes/${c.clienteId}`);
      const clData = await clRes.json();
      if (clData.success) setCliente(clData.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar crédito");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const descargarPdf = async () => {
    setDescargandoPdf(true);
    try {
      const res = await fetch(`/api/creditos/${id}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credito-${credito?.folio || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar PDF");
    } finally {
      setDescargandoPdf(false);
    }
  };

  const abrirModalPago = () => {
    setFormPago({
      monto: credito ? String(credito.pagoQuincenal) : "",
      fechaPago: new Date().toISOString().split("T")[0],
      metodoPago: "efectivo",
      referencia: "",
      detallePago: "",
    });
    setErrorPago(null);
    setModalPago(true);
  };

  const registrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credito) return;
    const monto = parseFloat(formPago.monto);
    if (!monto || monto <= 0) {
      setErrorPago("El monto debe ser mayor a 0");
      return;
    }
    setGuardandoPago(true);
    setErrorPago(null);
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditoId: credito.id,
          monto,
          fechaPago: formPago.fechaPago,
          metodoPago: formPago.metodoPago,
          referencia: formPago.referencia || null,
          detallePago: formPago.detallePago || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || data.message);
      setModalPago(false);

      // Comprobante para el cliente (ticket térmico o WhatsApp)
      const pagoId: string = String(data.data?.id ?? "");
      setComprobante({
        tipo: "abono_credito",
        folioRecibo: pagoId ? `PAG-${pagoId.replace(/-/g, "").slice(0, 8).toUpperCase()}` : `PAG-${Date.now().toString(36).toUpperCase()}`,
        folioReferencia: credito.folio || credito.id.slice(0, 8).toUpperCase(),
        fecha: new Date(),
        clienteNombre: cliente ? [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") : "Cliente",
        clienteTelefono: cliente?.telefono,
        monto,
        total: credito.monto,
        saldoRestante: typeof data.saldoRestante === "number" ? data.saldoRestante : Math.max(0, saldoPendiente - monto),
        metodoPago: formPago.metodoPago,
        referencia: formPago.referencia || undefined,
      });
      await cargar();
    } catch (err) {
      setErrorPago(err instanceof Error ? err.message : "Error al registrar pago");
    } finally {
      setGuardandoPago(false);
    }
  };

  // Construir calendario de cuotas
  const calendario: CuotaCalendario[] = (() => {
    if (!credito) return [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechas = generarCalendario(
      new Date(credito.fechaInicio),
      credito.frecuenciaPago || "quincenal",
      credito.plazo
    );

    let saldoAcumulado = 0;
    const pagoOrdenado = [...pagos].sort(
      (a, b) => new Date(a.fechaPago).getTime() - new Date(b.fechaPago).getTime()
    );

    return fechas.map((fecha, i) => {
      const monto = credito.pagoQuincenal;
      saldoAcumulado += monto;

      const totalPagadoHasta = pagoOrdenado
        .filter((p) => new Date(p.fechaPago) <= fecha)
        .reduce((s, p) => s + Number(p.monto), 0);

      let estado: CuotaCalendario["estado"] = "pendiente";
      if (totalPagadoHasta >= saldoAcumulado) {
        estado = "pagado";
      } else if (fecha < hoy) {
        estado = "vencido";
      }

      return { numero: i + 1, fecha, monto, estado };
    });
  })();

  const cuotasPagadas    = calendario.filter((c) => c.estado === "pagado").length;
  const cuotasVencidas   = calendario.filter((c) => c.estado === "vencido").length;
  const cuotasPendientes = calendario.filter((c) => c.estado === "pendiente").length;
  const proximaCuota     = calendario.find((c) => c.estado !== "pagado");

  const estadoBadge: Record<string, "success" | "danger" | "warning" | "default"> = {
    activo: "success",
    pagado: "default",
    vencido: "danger",
    cancelado: "warning",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2
          className="w-10 h-10 animate-spin"
          style={{ color: "var(--color-accent)" }}
        />
      </div>
    );
  }

  if (error || !credito) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle
          className="w-12 h-12 mx-auto mb-3"
          style={{ color: "var(--color-danger)" }}
        />
        <p style={{ color: "var(--color-danger)" }}>{error || "Crédito no encontrado"}</p>
        <Button className="mt-4" variant="secondary" onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/creditos")}
            className="p-1.5 rounded-lg transition-colors"
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--color-bg-elevated)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <ChevronLeft
              className="w-5 h-5"
              style={{ color: "var(--color-text-secondary)" }}
            />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-xl font-bold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {credito.folio ? `Crédito #${credito.folio}` : "Detalle de Crédito"}
              </h1>
              <Badge variant={estadoBadge[credito.estado] || "default"}>
                {credito.estado.charAt(0).toUpperCase() + credito.estado.slice(1)}
              </Badge>
              {(credito.diasMora ?? 0) > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger-text)",
                  }}
                >
                  {credito.diasMora} días de mora
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {fmtFecha(credito.fechaInicio)} — {fmtFecha(credito.fechaFin)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={cargar}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={descargarPdf} disabled={descargandoPdf}>
            {descargandoPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            PDF
          </Button>
          {credito.estado !== "pagado" && credito.estado !== "cancelado" && (
            <Button onClick={abrirModalPago}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Pago
            </Button>
          )}
        </div>
      </div>

      {/* ── Tarjetas resumen ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Monto crédito",
            value: `$${fmt(credito.monto)}`,
            color: "var(--color-text-primary)",
          },
          {
            label: "Total pagado",
            value: `$${fmt(totalPagado)}`,
            color: "var(--color-success)",
          },
          {
            label: "Saldo pendiente",
            value: `$${fmt(saldoPendiente)}`,
            color: "var(--color-warning)",
          },
          {
            label: "Mora acumulada",
            value: `$${fmt(credito.montoMora ?? 0)}`,
            color:
              (credito.montoMora ?? 0) > 0
                ? "var(--color-danger)"
                : "var(--color-text-muted)",
          },
        ].map((card) => (
          <div key={card.label} style={cardSectionStyle}>
            <p
              className="text-xs mb-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {card.label}
            </p>
            <p
              className="text-lg font-bold"
              style={{ color: card.color, fontFamily: "var(--font-data)" }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div
        className="flex gap-1"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {(["resumen", "pagos", "calendario"] as const).map((tab) => {
          const isActive = tabActivo === tab;
          return (
            <button
              key={tab}
              onClick={() => setTabActivo(tab)}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize"
              style={{
                borderBottomColor: isActive ? "var(--color-accent)" : "transparent",
                color: isActive
                  ? "var(--color-accent)"
                  : "var(--color-text-muted)",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  e.currentTarget.style.color = "var(--color-text-muted)";
              }}
            >
              {tab === "resumen"
                ? "Resumen"
                : tab === "pagos"
                ? `Pagos (${pagos.length})`
                : `Calendario (${calendario.length})`}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Resumen ──────────────────────────────────────── */}
      {tabActivo === "resumen" && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Datos del crédito */}
          <div style={cardSectionStyle} className="space-y-3">
            <h3
              className="font-semibold flex items-center gap-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              <CreditCard
                className="w-4 h-4"
                style={{ color: "var(--color-accent)" }}
              />
              Datos del Crédito
            </h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Monto original",   `$${fmt(credito.montoOriginal ?? credito.monto)}`],
                ["Enganche",         `$${fmt(credito.enganche ?? 0)} (${credito.enganchePorcentaje ?? 0}%)`],
                ["Plazo",            `${credito.plazo} meses`],
                ["Frecuencia pago",  ((credito.frecuenciaPago ?? "quincenal").charAt(0).toUpperCase() + (credito.frecuenciaPago ?? "quincenal").slice(1))],
                ["Cuota",            `$${fmt(credito.pagoQuincenal)}`],
                ["Tasa de interés",  `${credito.tasaInteres}% anual`],
                ["Tasa mora diaria", `$${fmt(credito.tasaMoraDiaria ?? 50)}/día`],
                ["Inicio",           fmtFecha(credito.fechaInicio)],
                ["Vencimiento",      fmtFecha(credito.fechaFin)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt style={{ color: "var(--color-text-muted)" }}>{label}</dt>
                  <dd
                    className="font-medium text-right"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Datos del cliente */}
          <div style={cardSectionStyle} className="space-y-3">
            <h3
              className="font-semibold flex items-center gap-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              <User className="w-4 h-4" style={{ color: "var(--color-success)" }} />
              Cliente
            </h3>
            {cliente ? (
              <dl className="space-y-2 text-sm">
                {[
                  ["Nombre",    `${cliente.nombre} ${cliente.apellido}`],
                  ["Teléfono",  cliente.telefono],
                  ["Email",     cliente.email || "—"],
                  ["Dirección", cliente.direccion || "—"],
                  ["CURP",      cliente.curp || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt
                      className="flex-shrink-0"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {label}
                    </dt>
                    <dd
                      className="font-medium text-right truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Cargando cliente...
              </p>
            )}
          </div>

          {/* Progreso del crédito */}
          <div style={cardSectionStyle} className="space-y-3 md:col-span-2">
            <h3
              className="font-semibold flex items-center gap-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              <TrendingUp className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
              Progreso
            </h3>
            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-3 rounded-full overflow-hidden"
                style={{ background: "var(--color-bg-sunken)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      credito.monto > 0 ? (totalPagado / credito.monto) * 100 : 0
                    )}%`,
                    background: "var(--color-success)",
                  }}
                />
              </div>
              <span
                className="text-sm font-medium whitespace-nowrap"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {credito.monto > 0
                  ? Math.round((totalPagado / credito.monto) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <p
                  className="text-xl font-bold"
                  style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
                >
                  {cuotasPagadas}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Cuotas pagadas
                </p>
              </div>
              <div>
                <p
                  className="text-xl font-bold"
                  style={{
                    color:
                      cuotasVencidas > 0
                        ? "var(--color-danger)"
                        : "var(--color-text-muted)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {cuotasVencidas}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Cuotas vencidas
                </p>
              </div>
              <div>
                <p
                  className="text-xl font-bold"
                  style={{
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {cuotasPendientes}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Cuotas pendientes
                </p>
              </div>
            </div>
            {proximaCuota && proximaCuota.estado !== "pagado" && (
              <div
                className="p-3 rounded-lg flex items-center gap-2 text-sm"
                style={
                  proximaCuota.estado === "vencido"
                    ? {
                        background: "var(--color-danger-bg)",
                        color: "var(--color-danger-text)",
                      }
                    : {
                        background: "var(--color-info-bg)",
                        color: "var(--color-info-text)",
                      }
                }
              >
                {proximaCuota.estado === "vencido" ? (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                )}
                <span>
                  {proximaCuota.estado === "vencido" ? "Cuota vencida" : "Próxima cuota"}:
                  <strong className="ml-1">${fmt(proximaCuota.monto)}</strong>
                  <span className="ml-1">— {fmtFecha(proximaCuota.fecha)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Historial de pagos ────────────────────────────── */}
      {tabActivo === "pagos" && (
        <div
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.75rem",
            overflow: "hidden",
          }}
        >
          {pagos.length === 0 ? (
            <div
              className="text-center py-12"
              style={{ color: "var(--color-text-muted)" }}
            >
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay pagos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead style={{ background: "var(--color-bg-elevated)" }}>
                  <tr>
                    {["#", "Fecha", "Monto", "Método", "Referencia"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((pago, i) => (
                    <PagoRow key={pago.id} pago={pago} index={i} total={pagos.length} />
                  ))}
                </tbody>
                <tfoot
                  style={{
                    background: "var(--color-bg-elevated)",
                    borderTop: "2px solid var(--color-border)",
                  }}
                >
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-sm font-semibold"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Total pagado
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold"
                      style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}
                    >
                      ${fmt(totalPagado)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Registrar Pago ─────────────────────────────── */}
      {comprobante && (
        <ComprobantePagoModal isOpen onClose={() => setComprobante(null)} datos={comprobante} />
      )}

      <Modal isOpen={modalPago} onClose={() => setModalPago(false)} title="Registrar Pago">
        <form onSubmit={registrarPago} className="space-y-4">
          {errorPago && (
            <div
              className="flex items-center gap-2 rounded-lg p-3 text-sm"
              style={{
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger-text)",
              }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {errorPago}
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Monto *
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              >
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formPago.monto}
                onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })}
                style={{ ...inputStyle, paddingLeft: "1.75rem" }}
              />
            </div>
            {credito && (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Cuota: ${fmt(credito.pagoQuincenal)} — Saldo pendiente: ${fmt(saldoPendiente)}
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Fecha de pago *
            </label>
            <input
              type="date"
              required
              value={formPago.fechaPago}
              onChange={(e) => setFormPago({ ...formPago, fechaPago: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Método de pago *
            </label>
            <select
              required
              value={formPago.metodoPago}
              onChange={(e) => setFormPago({ ...formPago, metodoPago: e.target.value })}
              style={selectStyle}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="deposito">Depósito</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Referencia / Comprobante
            </label>
            <input
              type="text"
              value={formPago.referencia}
              onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })}
              placeholder="Número de transferencia, recibo, etc."
              style={inputStyle}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Notas
            </label>
            <textarea
              rows={2}
              value={formPago.detallePago}
              onChange={(e) => setFormPago({ ...formPago, detallePago: e.target.value })}
              placeholder="Observaciones adicionales..."
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalPago(false)}
              disabled={guardandoPago}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardandoPago}>
              {guardandoPago ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                </>
              ) : (
                "Registrar Pago"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Tab: Calendario de cuotas ─────────────────────────── */}
      {tabActivo === "calendario" && (
        <div
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.75rem",
            overflow: "hidden",
          }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead style={{ background: "var(--color-bg-elevated)" }}>
                <tr>
                  {["#", "Fecha vencimiento", "Monto cuota", "Estado"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendario.map((cuota) => (
                  <CuotaRow key={cuota.numero} cuota={cuota} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
