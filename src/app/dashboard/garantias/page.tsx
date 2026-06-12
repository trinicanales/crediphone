"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, Clock, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";

interface GarantiaItem {
  id: string;
  ordenId: string;
  clienteId: string;
  tipoGarantia: string;
  diasGarantia: number;
  fechaInicio: string;
  fechaVencimiento: string;
  estado: string;
  ordenGarantiaId: string | null;
  folio: string;
  imei: string | null;
  marcaDispositivo: string;
  modeloDispositivo: string;
  fechaEntrega: string | null;
  clienteNombre: string;
  notas: string | null;
  motivoReclamo: string | null;
}

const ESTADO_LABEL: Record<string, string> = {
  activa: "Activa",
  usada: "Reclamada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

function diasRestantes(fechaVencimiento: string): number {
  const vence = new Date(fechaVencimiento).getTime();
  const hoy = Date.now();
  return Math.ceil((vence - hoy) / 86_400_000);
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function BadgeEstado({ estado, diasLeft }: { estado: string; diasLeft?: number }) {
  let bg = "var(--color-bg-elevated)";
  let color = "var(--color-text-muted)";
  if (estado === "activa") {
    if (diasLeft !== undefined && diasLeft <= 7) {
      bg = "var(--color-warning-bg)";
      color = "var(--color-warning)";
    } else {
      bg = "var(--color-success-bg)";
      color = "var(--color-success)";
    }
  } else if (estado === "usada") {
    bg = "var(--color-info-bg)";
    color = "var(--color-info)";
  } else if (estado === "vencida") {
    bg = "var(--color-bg-elevated)";
    color = "var(--color-text-muted)";
  } else if (estado === "cancelada") {
    bg = "var(--color-danger-bg)";
    color = "var(--color-danger)";
  }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

function GarantiaCard({ g, onVerOrden }: { g: GarantiaItem; onVerOrden: (id: string) => void }) {
  const dias = diasRestantes(g.fechaVencimiento);
  const venceProximo = g.estado === "activa" && dias >= 0 && dias <= 7;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "var(--color-bg-surface)",
        border: venceProximo
          ? "1px solid var(--color-warning)"
          : "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>
              {g.folio}
            </span>
            <BadgeEstado estado={g.estado} diasLeft={dias} />
            {venceProximo && (
              <span className="text-xs flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
                <AlertTriangle className="w-3 h-3" />
                {dias === 0 ? "Vence hoy" : `${dias}d`}
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {g.clienteNombre}
          </p>
        </div>
        <button
          onClick={() => onVerOrden(g.ordenId)}
          className="p-1.5 rounded-lg flex-shrink-0"
          style={{ color: "var(--color-text-muted)" }}
          title="Ver orden"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p style={{ color: "var(--color-text-muted)" }}>Equipo</p>
          <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
            {[g.marcaDispositivo, g.modeloDispositivo].filter(Boolean).join(" ") || "—"}
          </p>
        </div>
        {g.imei && (
          <div>
            <p style={{ color: "var(--color-text-muted)" }}>IMEI</p>
            <p className="font-mono font-medium" style={{ color: "var(--color-text-primary)" }}>
              {g.imei}
            </p>
          </div>
        )}
        <div>
          <p style={{ color: "var(--color-text-muted)" }}>Garantía</p>
          <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
            {g.diasGarantia} días
          </p>
        </div>
        <div>
          <p style={{ color: "var(--color-text-muted)" }}>Vence</p>
          <p
            className="font-medium"
            style={{ color: venceProximo ? "var(--color-warning)" : "var(--color-text-primary)" }}
          >
            {fmtFecha(g.fechaVencimiento)}
          </p>
        </div>
      </div>

      {g.estado === "usada" && g.motivoReclamo && (
        <p className="text-xs rounded-lg px-3 py-1.5" style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}>
          Reclamo: {g.motivoReclamo}
        </p>
      )}
    </div>
  );
}

export default function GarantiasPage() {
  const [garantias, setGarantias] = useState<GarantiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/garantias");
      const data = await res.json();
      if (data.success) setGarantias(data.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void cargar(); }, []);

  const hoy = Date.now();
  const semana = hoy + 7 * 86_400_000;

  const activas = garantias.filter((g) => g.estado === "activa" && new Date(g.fechaVencimiento).getTime() >= hoy);
  const vencenSemana = activas.filter((g) => new Date(g.fechaVencimiento).getTime() <= semana);
  const activasNormales = activas.filter((g) => new Date(g.fechaVencimiento).getTime() > semana);
  const reclamaciones = garantias.filter((g) => g.estado === "usada");
  const historial = garantias.filter((g) => g.estado === "vencida" || g.estado === "cancelada");

  const handleVerOrden = (ordenId: string) => {
    window.location.href = `/dashboard/reparaciones?orden=${ordenId}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6" style={{ color: "var(--color-success)" }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
              Garantías
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {activas.length} activa{activas.length !== 1 ? "s" : ""} · {reclamaciones.length} reclamación{reclamaciones.length !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="p-2 rounded-lg"
          style={{ color: "var(--color-text-muted)" }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--color-text-muted)" }}>
          Cargando garantías...
        </div>
      ) : (
        <>
          {/* Vencen esta semana */}
          {vencenSemana.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-warning)" }}>
                  Vencen esta semana ({vencenSemana.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vencenSemana.map((g) => (
                  <GarantiaCard key={g.id} g={g} onVerOrden={handleVerOrden} />
                ))}
              </div>
            </section>
          )}

          {/* Activas normales */}
          {activasNormales.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  Activas ({activasNormales.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activasNormales.map((g) => (
                  <GarantiaCard key={g.id} g={g} onVerOrden={handleVerOrden} />
                ))}
              </div>
            </section>
          )}

          {/* Sin garantías activas */}
          {activas.length === 0 && reclamaciones.length === 0 && (
            <div className="text-center py-16">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-border-strong)" }} />
              <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                No hay garantías activas
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                Las garantías se crean automáticamente al entregar una reparación con garantía configurada
              </p>
            </div>
          )}

          {/* Reclamaciones abiertas */}
          {reclamaciones.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" style={{ color: "var(--color-info)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  Reclamaciones abiertas ({reclamaciones.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {reclamaciones.map((g) => (
                  <GarantiaCard key={g.id} g={g} onVerOrden={handleVerOrden} />
                ))}
              </div>
            </section>
          )}

          {/* Historial colapsable */}
          {historial.length > 0 && (
            <section>
              <button
                onClick={() => setMostrarHistorial((v) => !v)}
                className="flex items-center gap-2 py-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                {mostrarHistorial ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  Historial (vencidas / canceladas) — {historial.length}
                </span>
              </button>
              {mostrarHistorial && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-3">
                  {historial.map((g) => (
                    <GarantiaCard key={g.id} g={g} onVerOrden={handleVerOrden} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
