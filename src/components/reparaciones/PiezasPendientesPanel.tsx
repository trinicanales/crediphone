"use client";

import { useCallback, useEffect, useState } from "react";
import { PackagePlus, RefreshCw, AlertCircle, ExternalLink, Clock } from "lucide-react";

interface PedidoPendiente {
  id: string;
  nombrePieza: string;
  costoEstimado: number;
  costoEnvio: number;
  notas: string | null;
  financiadoPor: string;
  createdAt: string;
  creadoPorNombre: string | null;
  orden: {
    id: string | null;
    folio: string | null;
    estado: string | null;
    marcaDispositivo: string;
    modeloDispositivo: string;
    clienteNombre: string;
    clienteTelefono: string | null;
  };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const FINANCIADO_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  bolsa:  { label: "Bolsa",  bg: "var(--color-accent-light)",   color: "var(--color-accent)" },
  caja:   { label: "Caja",   bg: "var(--color-danger-bg)",      color: "var(--color-danger)" },
  mixto:  { label: "Mixto",  bg: "var(--color-warning-bg)",     color: "var(--color-warning-text)" },
};

interface Props {
  onAbrirOrden?: (ordenId: string) => void;
}

export function PiezasPendientesPanel({ onAbrirOrden }: Props) {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/reparaciones/piezas-pendientes");
      const data = await res.json();
      if (data.success) setPedidos(data.data);
      else setError(data.error || "Error al cargar");
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const sinCosto = pedidos.filter((p) => p.costoEstimado === 0);
  const conCosto = pedidos.filter((p) => p.costoEstimado > 0);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <PackagePlus className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Piezas por pedir al proveedor
          </span>
          {pedidos.length > 0 && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {pedidos.length}
            </span>
          )}
        </div>
        <button
          onClick={cargar}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--color-text-muted)" }}
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        {cargando && (
          <div className="flex justify-center py-6">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {!cargando && error && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!cargando && !error && pedidos.length === 0 && (
          <div className="text-center py-6">
            <PackagePlus className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin piezas pendientes de pedir
            </p>
          </div>
        )}

        {/* Sin costo → necesitan atención urgente */}
        {sinCosto.length > 0 && (
          <div className="mb-4">
            <div
              className="flex items-center gap-2 mb-2 px-1 py-1 rounded-lg"
              style={{ background: "var(--color-danger-bg)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-danger)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
                Sin costo registrado — contactar proveedor ({sinCosto.length})
              </span>
            </div>
            <div className="space-y-2">
              {sinCosto.map((p) => (
                <PedidoRow key={p.id} pedido={p} urgente onAbrirOrden={onAbrirOrden} />
              ))}
            </div>
          </div>
        )}

        {/* Con costo → pedidas, esperando llegar */}
        {conCosto.length > 0 && (
          <div>
            {sinCosto.length > 0 && (
              <p className="text-xs font-semibold mb-2 px-1" style={{ color: "var(--color-text-muted)" }}>
                En proceso ({conCosto.length})
              </p>
            )}
            <div className="space-y-2">
              {conCosto.map((p) => (
                <PedidoRow key={p.id} pedido={p} urgente={false} onAbrirOrden={onAbrirOrden} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila de pedido ────────────────────────────────────────────────────────────

function PedidoRow({
  pedido,
  urgente,
  onAbrirOrden,
}: {
  pedido: PedidoPendiente;
  urgente: boolean;
  onAbrirOrden?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const financiado = FINANCIADO_BADGE[pedido.financiadoPor] ?? FINANCIADO_BADGE.bolsa;

  return (
    <div
      className="rounded-xl p-3 flex items-start gap-3"
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: urgente
          ? "1px solid var(--color-danger)"
          : "1px solid var(--color-border)",
        transition: "background 0.15s",
        cursor: "default",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pieza info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {pedido.nombrePieza}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: financiado.bg, color: financiado.color }}
          >
            {financiado.label}
          </span>
          {pedido.costoEstimado > 0 && (
            <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-success)" }}>
              {fmtPrecio(pedido.costoEstimado + pedido.costoEnvio)}
            </span>
          )}
        </div>

        {/* Orden */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="text-xs font-mono font-bold"
            style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: onAbrirOrden ? "pointer" : "default", padding: 0 }}
            onClick={() => pedido.orden.id && onAbrirOrden?.(pedido.orden.id)}
          >
            {pedido.orden.folio}
          </button>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {pedido.orden.marcaDispositivo} {pedido.orden.modeloDispositivo}
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            · {pedido.orden.clienteNombre}
          </span>
        </div>

        {pedido.notas && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            📝 {pedido.notas.slice(0, 80)}
          </p>
        )}

        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <Clock className="w-3 h-3" />
          {fmtFecha(pedido.createdAt)}
          {pedido.creadoPorNombre && ` · ${pedido.creadoPorNombre}`}
        </div>
      </div>

      {/* Botón abrir orden */}
      {onAbrirOrden && pedido.orden.id && (
        <button
          className="p-1.5 rounded-lg flex-shrink-0"
          style={{ color: "var(--color-text-muted)", background: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => onAbrirOrden(pedido.orden.id!)}
          title="Abrir orden"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
