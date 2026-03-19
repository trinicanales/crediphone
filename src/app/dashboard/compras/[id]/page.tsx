"use client";

/**
 * FASE 46 — Detalle de Orden de Compra
 * Permite ver la orden, cambiar su estado y registrar la recepción de productos.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  FileText,
  Edit3,
} from "lucide-react";
import type { OrdenCompra, OrdenCompraItem, EstadoOrdenCompra } from "@/types";
import Link from "next/link";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const ESTADO_META: Record<EstadoOrdenCompra, { label: string; color: string; bg: string }> = {
  borrador:         { label: "Borrador",           color: "var(--color-text-muted)",   bg: "var(--color-bg-elevated)" },
  enviada:          { label: "Enviada al proveedor", color: "var(--color-info)",        bg: "var(--color-info-bg)" },
  recibida_parcial: { label: "Recepción parcial",   color: "var(--color-warning-text)", bg: "var(--color-warning-bg)" },
  recibida:         { label: "Completamente recibida", color: "var(--color-success)",   bg: "var(--color-success-bg)" },
  cancelada:        { label: "Cancelada",            color: "var(--color-danger)",      bg: "var(--color-danger-bg)" },
};

// Transiciones de estado permitidas
const SIGUIENTE_ESTADO: Partial<Record<EstadoOrdenCompra, EstadoOrdenCompra>> = {
  borrador: "enviada",
  enviada:  "recibida",      // o recibida_parcial via recepción
};

function ProgressBar({ recibida, total }: { recibida: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((recibida / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "var(--color-bg-elevated)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "var(--color-success)" : "var(--color-accent)",
          }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)", minWidth: "2.5rem" }}>
        {pct}%
      </span>
    </div>
  );
}

export default function OrdenCompraDetallePage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [loading, setLoading] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [showRecepcion, setShowRecepcion] = useState(false);
  const [notasRecepcion, setNotasRecepcion] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchOrden = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ordenes-compra/${id}`);
      const d = await res.json();
      if (d.success) {
        setOrden(d.data);
        // Inicializar cantidades en 0 si aún no se ha tocado
        const init: Record<string, number> = {};
        (d.data as OrdenCompra).items?.forEach((it: OrdenCompraItem) => {
          init[it.id] = 0;
        });
        setCantidades((prev) => {
          const merged = { ...init };
          Object.keys(prev).forEach((k) => {
            if (k in merged) merged[k] = prev[k];
          });
          return merged;
        });
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrden(); }, [fetchOrden]);

  const cambiarEstado = async (nuevoEstado: EstadoOrdenCompra) => {
    setCambiandoEstado(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/ordenes-compra/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setOrden(d.data);
      setMsg({ type: "success", text: "Estado actualizado" });
    } catch (err) {
      setMsg({ type: "error", text: String(err) });
    } finally {
      setCambiandoEstado(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleRecepcion = async () => {
    const recepciones = Object.entries(cantidades)
      .filter(([, cant]) => cant > 0)
      .map(([itemId, cantidadRecibida]) => ({ itemId, cantidadRecibida }));

    if (recepciones.length === 0) {
      setMsg({ type: "error", text: "Ingresa al menos una cantidad recibida" });
      return;
    }

    setGuardandoRecepcion(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/ordenes-compra/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recibir",
          recepciones,
          notasRecepcion,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setOrden(d.data);
      setShowRecepcion(false);
      setCantidades({});
      setMsg({ type: "success", text: "Mercancía recibida y stock actualizado" });
    } catch (err) {
      setMsg({ type: "error", text: String(err) });
    } finally {
      setGuardandoRecepcion(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  if (!user || !["admin", "super_admin"].includes(user.role)) return null;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-accent)" }}
        />
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--color-text-muted)" }}>Orden no encontrada</p>
        <Link href="/dashboard/compras">
          <Button className="mt-4">← Volver</Button>
        </Link>
      </div>
    );
  }

  const estadoMeta = ESTADO_META[orden.estado];
  const siguienteEstado = SIGUIENTE_ESTADO[orden.estado];
  const puedeRecibirParcial = ["enviada", "recibida_parcial"].includes(orden.estado);
  const puedeCancelar = ["borrador", "enviada"].includes(orden.estado);

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <Link href="/dashboard/compras">
          <button
            className="p-2 rounded-lg mt-1"
            style={{ border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
            >
              {orden.folio}
            </h1>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ background: estadoMeta.bg, color: estadoMeta.color }}
            >
              {estadoMeta.label}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {orden.proveedor?.nombre ?? "Sin proveedor"} · {fmtDate(orden.fechaOrden)}
            {orden.fechaEsperada && ` · Esperada: ${fmtDate(orden.fechaEsperada)}`}
          </p>
        </div>
      </div>

      {/* Mensaje feedback */}
      {msg && (
        <div
          className="mb-6 p-4 rounded-xl text-sm font-medium"
          style={
            msg.type === "success"
              ? { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
              : { background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }
          }
        >
          {msg.type === "success" ? "✓ " : "✕ "}{msg.text}
        </div>
      )}

      {/* Acciones de estado */}
      {(siguienteEstado || puedeRecibirParcial || puedeCancelar) && orden.estado !== "recibida" && orden.estado !== "cancelada" && (
        <Card className="mb-6">
          <h4 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Acciones
          </h4>
          <div className="flex flex-wrap gap-3">
            {/* Marcar como enviada */}
            {orden.estado === "borrador" && (
              <button
                onClick={() => cambiarEstado("enviada")}
                disabled={cambiandoEstado}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--color-info)", color: "white" }}
              >
                <Truck className="w-4 h-4" />
                Marcar como enviada
              </button>
            )}

            {/* Recibir mercancía */}
            {puedeRecibirParcial && (
              <button
                onClick={() => setShowRecepcion((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: showRecepcion ? "var(--color-bg-elevated)" : "var(--color-accent)",
                  color: showRecepcion ? "var(--color-text-primary)" : "white",
                  border: showRecepcion ? "1px solid var(--color-border)" : "none",
                }}
              >
                <Package className="w-4 h-4" />
                {showRecepcion ? "Cancelar recepción" : "Registrar recepción"}
              </button>
            )}

            {/* Cancelar */}
            {puedeCancelar && (
              <button
                onClick={async () => {
                  if (!confirm("¿Cancelar esta orden? No se puede deshacer.")) return;
                  setCancelando(true);
                  await cambiarEstado("cancelada");
                  setCancelando(false);
                }}
                disabled={cancelando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-danger)",
                  color: "var(--color-danger)",
                }}
              >
                <XCircle className="w-4 h-4" />
                Cancelar orden
              </button>
            )}
          </div>

          {/* Panel de recepción */}
          {showRecepcion && (
            <div
              className="mt-5 p-4 rounded-xl"
              style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border-subtle)" }}
            >
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                Ingresa las cantidades que llegaron hoy:
              </p>
              <div className="space-y-3 mb-4">
                {orden.items?.map((item) => {
                  const pendiente = item.cantidad - item.cantidadRecibida;
                  if (pendiente <= 0) return null;
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                          {item.descripcion}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          Recibido: {item.cantidadRecibida}/{item.cantidad} · Pendiente: {pendiente}
                        </p>
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <Input
                          type="number"
                          min="0"
                          max={pendiente}
                          value={cantidades[item.id] ?? 0}
                          onChange={(e) => {
                            const val = Math.min(pendiente, Math.max(0, parseInt(e.target.value) || 0));
                            setCantidades((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mb-3">
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Notas de recepción (opcional)
                </label>
                <Input
                  value={notasRecepcion}
                  onChange={(e) => setNotasRecepcion(e.target.value)}
                  placeholder="Ej: Faltó 1 unidad, llegó dañado el accesorio..."
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleRecepcion} disabled={guardandoRecepcion}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {guardandoRecepcion ? "Registrando..." : "Confirmar recepción y actualizar stock"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detalle de ítems */}
      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Package className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Productos ({orden.items?.length ?? 0})
          </h3>
        </div>

        <div className="space-y-3">
          {(orden.items ?? []).map((item) => {
            const estaCompleto = item.cantidadRecibida >= item.cantidad;
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl"
                style={{
                  background: "var(--color-bg-base)",
                  border: `1px solid ${estaCompleto ? "var(--color-success)40" : "var(--color-border-subtle)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {item.descripcion}
                      </p>
                      {item.sku && (
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                        >
                          {item.sku}
                        </span>
                      )}
                      {estaCompleto && (
                        <CheckCircle2 className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                      )}
                    </div>
                    {(item.marca || item.modelo) && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {[item.marca, item.modelo].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
                    >
                      {fmt(item.subtotal)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {item.cantidad} × {fmt(item.precioUnitario)}
                      {item.descuentoPct > 0 && ` (−${item.descuentoPct}%)`}
                    </p>
                  </div>
                </div>
                {/* Barra de progreso de recepción */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                    <span>Recibido: {item.cantidadRecibida}/{item.cantidad}</span>
                    <span>{Math.round((item.cantidadRecibida / item.cantidad) * 100)}%</span>
                  </div>
                  <ProgressBar recibida={item.cantidadRecibida} total={item.cantidad} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Totales */}
        <div
          className="mt-6 pt-4 space-y-2"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--color-text-muted)" }}>Subtotal</span>
            <span style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>{fmt(orden.subtotal)}</span>
          </div>
          {orden.descuento > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-text-muted)" }}>Descuento</span>
              <span style={{ fontFamily: "var(--font-data)", color: "var(--color-success)" }}>−{fmt(orden.descuento)}</span>
            </div>
          )}
          <div
            className="flex justify-between text-base font-bold pt-2"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Total</span>
            <span style={{ fontFamily: "var(--font-data)", color: "var(--color-accent)" }}>{fmt(orden.total)}</span>
          </div>
        </div>
      </Card>

      {/* Info general */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <FileText className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Información general</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Proveedor",     value: orden.proveedor?.nombre ?? "—" },
            { label: "Condiciones",   value: orden.condicionesPago || "—" },
            { label: "Moneda",        value: orden.moneda },
            { label: "Fecha orden",   value: fmtDate(orden.fechaOrden) },
            { label: "F. esperada",   value: fmtDate(orden.fechaEsperada) },
            { label: "F. recibida",   value: fmtDate(orden.fechaRecibida) },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{row.label}</p>
              <p className="font-medium mt-0.5" style={{ color: "var(--color-text-primary)" }}>{row.value}</p>
            </div>
          ))}
        </div>
        {orden.notas && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--color-bg-elevated)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Notas</p>
            <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.notas}</p>
          </div>
        )}
        {orden.notasRecepcion && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--color-info-bg)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--color-info)" }}>Notas de recepción</p>
            <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{orden.notasRecepcion}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
