"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  AlertTriangle, PackageX, TrendingDown, CheckCircle, XCircle, Clock,
  Barcode, User, RefreshCw, ExternalLink, Flame, ShoppingCart,
  Archive, Square, CheckSquare, ChevronDown, ChevronUp, Plus, Minus,
  Package, Tag,
} from "lucide-react";
import type { Producto, AlertaProductoNuevoDetallada, EstadisticasPOS } from "@/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function suggeridoQty(p: Producto) {
  const min = p.stockMinimo ?? 5;
  const deficit = Math.max(0, min - p.stock);
  return Math.max(1, deficit + Math.ceil(min * 0.5)); // déficit + 50% buffer
}

// ── tipos internos ────────────────────────────────────────────────────────────

interface LineaResurtido { productoId: string; nombre: string; proveedor: string | undefined; stock: number; stockMinimo: number | undefined; cantidad: number; }

// ── modal resurtido ───────────────────────────────────────────────────────────

function ModalResurtido({
  lineas, onClose, onCrear,
}: {
  lineas: LineaResurtido[];
  onClose: () => void;
  onCrear: (items: LineaResurtido[], notas: string) => Promise<void>;
}) {
  const [items, setItems] = useState<LineaResurtido[]>(lineas);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setQty = (id: string, qty: number) =>
    setItems((prev) => prev.map((l) => l.productoId === id ? { ...l, cantidad: Math.max(1, qty) } : l));

  // Agrupar por proveedor para mostrar secciones
  const grupos = items.reduce<Record<string, LineaResurtido[]>>((acc, l) => {
    const key = l.proveedor ?? "Sin proveedor asignado";
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  const handleCrear = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCrear(items, notas);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear la orden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>
              Solicitud de resurtido
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {items.length} producto{items.length !== 1 ? "s" : ""} seleccionado{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Líneas agrupadas por proveedor */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {Object.entries(grupos).map(([grupo, gLineas]) => (
            <div key={grupo}>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                  {grupo}
                </span>
              </div>
              <div className="space-y-2 ml-4">
                {gLineas.map((l) => (
                  <div
                    key={l.productoId}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border-subtle)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: "var(--color-text-primary)" }}>
                        {l.nombre}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Stock: <span style={{ color: l.stock === 0 ? "var(--color-danger)" : "var(--color-warning)", fontFamily: "var(--font-data)" }}>{l.stock}</span>
                        {l.stockMinimo !== undefined && <> · Mín: <span style={{ fontFamily: "var(--font-data)" }}>{l.stockMinimo}</span></>}
                      </p>
                    </div>
                    {/* Cantidad editable */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setQty(l.productoId, l.cantidad - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                        style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.cantidad}
                        onChange={(e) => setQty(l.productoId, parseInt(e.target.value) || 1)}
                        className="w-14 text-center text-sm font-bold rounded-lg px-1 py-1 focus:outline-none"
                        style={{
                          background: "var(--color-bg-surface)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-primary)",
                          fontFamily: "var(--font-data)",
                        }}
                      />
                      <button
                        onClick={() => setQty(l.productoId, l.cantidad + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                        style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-border)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-xs ml-1" style={{ color: "var(--color-text-muted)" }}>pzas</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Notas para el pedido (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej: urgente, misma referencia que el último pedido…"
              className="w-full px-3 py-2 rounded-xl text-sm resize-none focus:outline-none"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-xl" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: loading ? "var(--color-bg-elevated)" : "var(--color-primary)",
              color: loading ? "var(--color-text-muted)" : "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <ShoppingCart className="w-4 h-4" />
            {loading ? "Creando…" : "Crear orden de compra"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── modal descontinuar ────────────────────────────────────────────────────────

function ModalDescontinuar({
  producto, onClose, onConfirm,
}: {
  producto: Producto;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)" }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl shrink-0" style={{ background: "var(--color-warning-bg)" }}>
            <Archive className="w-5 h-5" style={{ color: "var(--color-warning)" }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Descontinuar producto
            </h3>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              <strong>{producto.nombre}</strong> se marcará como inactivo. No aparecerá en ventas ni en
              futuros pedidos, pero se conserva todo el historial.
            </p>
          </div>
        </div>
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)" }}
        >
          Esta acción se puede revertir editando el producto desde el catálogo.
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-warning)", color: "#fff", opacity: loading ? 0.6 : 1 }}
          >
            <Archive className="w-4 h-4" />
            {loading ? "Guardando…" : "Descontinuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── modal notas (reemplaza prompt()) ─────────────────────────────────────────

function ModalNotas({
  titulo, placeholder, onConfirm, onClose,
}: {
  titulo: string; placeholder: string;
  onConfirm: (notas: string) => void; onClose: () => void;
}) {
  const [notas, setNotas] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)" }}>
        <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{titulo}</h3>
        <textarea
          autoFocus
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-sm resize-none focus:outline-none"
          style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
            Cancelar
          </button>
          <button onClick={() => { onConfirm(notas); onClose(); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-accent)", color: "#fff" }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProductoAlertaRow (con checkbox + acciones) ───────────────────────────────

function ProductoAlertaRow({
  producto, tipo, seleccionado, onToggle, onResurtir, onDescontinuar,
}: {
  producto: Producto;
  tipo: "agotado" | "bajo";
  seleccionado: boolean;
  onToggle: () => void;
  onResurtir: (p: Producto) => void;
  onDescontinuar: (p: Producto) => void;
}) {
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isAgotado = tipo === "agotado";
  const pctStock = producto.stockMinimo && producto.stockMinimo > 0
    ? Math.round((producto.stock / (producto.stockMinimo * 2)) * 100)
    : 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: seleccionado ? "var(--color-accent-light)" : hover ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: seleccionado
          ? "1px solid var(--color-accent)"
          : `1px solid ${isAgotado ? "var(--color-danger-bg)" : "var(--color-warning-bg)"}`,
        transition: "all var(--duration-normal)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button type="button" onClick={onToggle} className="shrink-0 flex items-center">
          {seleccionado
            ? <CheckSquare className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            : <Square className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />}
        </button>

        {/* Indicador de color */}
        <div className="w-1.5 h-10 rounded-full shrink-0"
          style={{ background: isAgotado ? "var(--color-danger)" : "var(--color-warning)" }} />

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
            {producto.nombre}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {[producto.marca, producto.modelo].filter(Boolean).join(" ")}
            {producto.codigoBarras && <span className="ml-2 font-mono">{producto.codigoBarras}</span>}
          </p>
          {/* Mini barra de stock */}
          {producto.stockMinimo !== undefined && producto.stockMinimo > 0 && (
            <div className="w-28 h-1 mt-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-elevated)" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.min(100, pctStock)}%`,
                background: isAgotado ? "var(--color-danger)" : "var(--color-warning)",
              }} />
            </div>
          )}
        </div>

        {/* Cifras de stock */}
        <div className="text-center shrink-0 w-14">
          <p className="text-xl font-bold" style={{ color: isAgotado ? "var(--color-danger)" : "var(--color-warning)", fontFamily: "var(--font-data)" }}>
            {producto.stock}
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>actual</p>
        </div>
        {producto.stockMinimo !== undefined && (
          <div className="text-center shrink-0 w-14">
            <p className="text-lg font-semibold" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-data)" }}>
              {producto.stockMinimo}
            </p>
            <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>mínimo</p>
          </div>
        )}

        {/* Badge estado */}
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0"
          style={{ background: isAgotado ? "var(--color-danger-bg)" : "var(--color-warning-bg)", color: isAgotado ? "var(--color-danger-text)" : "var(--color-warning-text)" }}>
          {isAgotado ? "Agotado" : "Stock bajo"}
        </span>

        {/* Botones de acción */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onResurtir(producto)}
            title="Agregar a solicitud de resurtido"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "var(--color-accent-light)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-accent)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-accent-light)"; e.currentTarget.style.color = "var(--color-accent)"; }}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Resurtir
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title="Más opciones"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div
          className="flex items-center gap-3 px-4 pb-3 flex-wrap"
          style={{ borderTop: "1px dashed var(--color-border-subtle)" }}
        >
          <a href={`/dashboard/productos`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
            <ExternalLink className="w-3.5 h-3.5" />
            Ver en catálogo
          </a>
          <button
            onClick={() => onDescontinuar(producto)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning-bg)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-warning)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-warning-bg)"; e.currentTarget.style.color = "var(--color-warning-text)"; }}
          >
            <Archive className="w-3.5 h-3.5" />
            Descontinuar producto
          </button>
          {producto.tipo && (
            <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}>
              Tipo: {producto.tipo.replace("_", " ")}
            </span>
          )}
          {producto.ubicacionFisica && (
            <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}>
              📍 {producto.ubicacionFisica}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── KpiCard (ahora clicable) ──────────────────────────────────────────────────

function KpiCard({
  icon, label, value, variant, active, onClick,
}: {
  icon: React.ReactNode; label: string; value: number;
  variant: "danger" | "warning" | "info" | "accent";
  active?: boolean; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const c = {
    danger:  { bg: "var(--color-danger-bg)",   text: "var(--color-danger-text)",   icon: "var(--color-danger)",  border: "var(--color-danger)" },
    warning: { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)",  icon: "var(--color-warning)", border: "var(--color-warning)" },
    info:    { bg: "var(--color-info-bg)",     text: "var(--color-info-text)",     icon: "var(--color-info)",    border: "var(--color-info)" },
    accent:  { bg: "var(--color-accent-light)", text: "var(--color-accent)",       icon: "var(--color-accent)",  border: "var(--color-accent)" },
  }[variant];

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => onClick && setHover(false)}
      style={{
        background: c.bg,
        border: active ? `2px solid ${c.border}` : `1px solid ${c.bg}`,
        boxShadow: hover ? "var(--shadow-md)" : "none",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition: "all 200ms var(--ease-spring)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ color: c.icon }}>{icon}</div>
      <div>
        <p className="text-2xl font-bold" style={{ color: c.icon, fontFamily: "var(--font-data)" }}>{value}</p>
        <p className="text-xs" style={{ color: c.text }}>{label}</p>
      </div>
      {onClick && value > 0 && (
        <div className="ml-auto">
          <ChevronDown className="w-4 h-4" style={{ color: c.icon, opacity: 0.6 }} />
        </div>
      )}
    </div>
  );
}

// ── AlertaDesconocidoRow ──────────────────────────────────────────────────────

function AlertaDesconocidoRow({
  alerta, onUpdate,
}: {
  alerta: AlertaProductoNuevoDetallada;
  onUpdate: (id: string, estado: "revisado" | "registrado" | "descartado", notas?: string) => void;
}) {
  const [notasModal, setNotasModal] = useState<"registrado" | null>(null);
  const [confirmDescartar, setConfirmDescartar] = useState(false);

  const estadoStyle: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pendiente:  { bg: "var(--color-warning-bg)",  text: "var(--color-warning-text)",  icon: <Clock className="w-3.5 h-3.5" /> },
    revisado:   { bg: "var(--color-info-bg)",     text: "var(--color-info-text)",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
    registrado: { bg: "var(--color-success-bg)",  text: "var(--color-success-text)",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
    descartado: { bg: "var(--color-bg-elevated)", text: "var(--color-text-muted)",    icon: <XCircle className="w-3.5 h-3.5" /> },
  };
  const st = estadoStyle[alerta.estado] ?? estadoStyle.pendiente;

  return (
    <>
      {notasModal && (
        <ModalNotas
          titulo="Notas de registro"
          placeholder="Describe el producto o acción tomada…"
          onConfirm={(notas) => onUpdate(alerta.id, "registrado", notas || undefined)}
          onClose={() => setNotasModal(null)}
        />
      )}
      {confirmDescartar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDescartar(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)" }}>
            <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>¿Descartar esta alerta?</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              El código <strong className="font-mono">{alerta.codigoEscaneado}</strong> se marcará como descartado.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDescartar(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
                Cancelar
              </button>
              <button onClick={() => { onUpdate(alerta.id, "descartado"); setConfirmDescartar(false); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-danger)", color: "#fff" }}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-xl p-4" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Barcode className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <div className="min-w-0">
              <p className="font-mono font-semibold text-base" style={{ color: "var(--color-text-primary)" }}>
                {alerta.codigoEscaneado}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{alerta.usuarioEscaner?.name ?? "Desconocido"}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(alerta.fechaAlerta)}</span>
                {alerta.verificacion && <span>Verificación: {alerta.verificacion.folio}</span>}
              </div>
              {alerta.notas && (
                <p className="mt-2 text-xs px-2 py-1 rounded-lg" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
                  {alerta.notas}
                </p>
              )}
              {alerta.estado !== "pendiente" && alerta.usuarioRevisor && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Revisado por <strong>{alerta.usuarioRevisor.name}</strong>
                  {alerta.fechaRevision && ` · ${formatDate(alerta.fechaRevision)}`}
                </p>
              )}
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{ background: st.bg, color: st.text }}>
            {st.icon}{alerta.estado.charAt(0).toUpperCase() + alerta.estado.slice(1)}
          </span>
        </div>

        {alerta.estado === "pendiente" && (
          <div className="flex gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            <ActionBtn onClick={() => onUpdate(alerta.id, "revisado")} variant="secondary">
              <CheckCircle className="w-4 h-4" />Revisado
            </ActionBtn>
            <ActionBtn onClick={() => setNotasModal("registrado")} variant="success">
              <Package className="w-4 h-4" />Producto registrado
            </ActionBtn>
            <ActionBtn onClick={() => setConfirmDescartar(true)} variant="danger">
              <XCircle className="w-4 h-4" />Descartar
            </ActionBtn>
          </div>
        )}
      </div>
    </>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

function ActionBtn({ onClick, variant, children }: { onClick: () => void; variant: "secondary" | "success" | "danger"; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const s = {
    secondary: { bg: hover ? "var(--color-bg-elevated)" : "var(--color-bg-sunken)", color: "var(--color-text-secondary)", border: "var(--color-border)" },
    success:   { bg: hover ? "var(--color-success)"     : "var(--color-success-bg)", color: hover ? "#fff" : "var(--color-success-text)", border: "var(--color-success-bg)" },
    danger:    { bg: hover ? "var(--color-danger)"      : "var(--color-danger-bg)",  color: hover ? "#fff" : "var(--color-danger-text)",  border: "var(--color-danger-bg)" },
  }[variant];
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {children}
    </button>
  );
}

// ── TabBtn / FilterBtn ────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{ background: active ? "var(--color-bg-surface)" : hover ? "var(--color-bg-surface)" : "transparent", color: active ? "var(--color-text-primary)" : "var(--color-text-muted)", boxShadow: active ? "var(--shadow-xs)" : "none" }}>
      {children}
    </button>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
      style={{ background: active ? "var(--color-accent)" : hover ? "var(--color-bg-elevated)" : "var(--color-bg-surface)", color: active ? "#fff" : "var(--color-text-secondary)", border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border-subtle)"}` }}>
      {children}
    </button>
  );
}

// ── DemandaRow ────────────────────────────────────────────────────────────────

function DemandaRow({
  tv, idx, total, onResurtir,
}: {
  tv: { productoId: string; productoNombre: string; cantidadVendida: number; totalVentas: number; producto: Producto | null };
  idx: number; total: number;
  onResurtir: (p: Producto) => void;
}) {
  const [hover, setHover] = useState(false);
  const prod = tv.producto!;
  const stockMinimo = prod.stockMinimo ?? 3;
  const stockCritico = prod.stock === 0;
  const stockBajoF = prod.stock > 0 && prod.stock <= stockMinimo;
  const stockColor = stockCritico ? "var(--color-danger)" : stockBajoF ? "var(--color-warning)" : "var(--color-success)";
  const badge = stockCritico
    ? { label: "Agotado", bg: "var(--color-danger-bg)", text: "var(--color-danger-text)" }
    : stockBajoF
    ? { label: "Stock bajo", bg: "var(--color-warning-bg)", text: "var(--color-warning-text)" }
    : { label: "En stock", bg: "var(--color-success-bg)", text: "var(--color-success-text)" };

  return (
    <div
      className="grid grid-cols-12 items-center px-4 py-3 text-sm"
      style={{ background: hover ? "var(--color-bg-elevated)" : "transparent", borderBottom: idx < total - 1 ? "1px solid var(--color-border-subtle)" : "none", transition: "background var(--duration-fast)" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    >
      <div className="col-span-4 flex items-center gap-2 min-w-0">
        <span className="text-xs font-bold w-6 text-center shrink-0" style={{ color: idx < 3 ? "var(--color-accent)" : "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>#{idx + 1}</span>
        <div className="min-w-0">
          <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{prod.nombre}</p>
          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{[prod.marca, prod.modelo].filter(Boolean).join(" ")}</p>
        </div>
      </div>
      <p className="col-span-2 text-right font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>{tv.cantidadVendida}</p>
      <p className="col-span-2 text-right font-bold" style={{ color: stockColor, fontFamily: "var(--font-data)" }}>{prod.stock}</p>
      <p className="col-span-2 text-right" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>{stockMinimo}</p>
      <div className="col-span-1 flex justify-center">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
      </div>
      <div className="col-span-1 flex justify-end">
        {(stockCritico || stockBajoF) && (
          <button
            onClick={() => onResurtir(prod)}
            title="Solicitar resurtido"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-accent)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-light)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── StockSkeleton / EmptyState ────────────────────────────────────────────────

function StockSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}>
      {icon}
      <p className="mt-3 font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</p>
      <p className="text-sm mt-1 text-center max-w-xs" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AlertasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"stock" | "demanda" | "nuevos">("stock");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [stats, setStats] = useState<EstadisticasPOS | null>(null);
  const [alertas, setAlertas] = useState<AlertaProductoNuevoDetallada[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [filterAlertas, setFilterAlertas] = useState<"pending" | "all">("pending");

  // Selección para resurtido
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  // Modal resurtido
  const [resurtirModal, setResurtirModal] = useState(false);
  // Modal descontinuar
  const [descontinuarProducto, setDescontinuarProducto] = useState<Producto | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.role || !["admin", "super_admin"].includes(user.role)) { router.push("/dashboard"); return; }
    fetchProductos();
    fetchAlertas();
    fetchStats();
  }, [user, authLoading, router]);

  useEffect(() => { fetchAlertas(); }, [filterAlertas]);

  const fetchProductos = async () => {
    try {
      setLoadingProductos(true);
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (data.success) setProductos(data.data);
    } catch { /* silencioso */ }
    finally { setLoadingProductos(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/pos/stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* silencioso */ }
  };

  const fetchAlertas = async () => {
    try {
      setLoadingAlertas(true);
      const url = filterAlertas === "pending" ? "/api/inventario/alertas?pending=true" : "/api/inventario/alertas";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setAlertas(data.data);
    } catch { /* silencioso */ }
    finally { setLoadingAlertas(false); }
  };

  const handleUpdateAlerta = async (alertaId: string, estado: "revisado" | "registrado" | "descartado", notas?: string) => {
    try {
      const res = await fetch("/api/inventario/alertas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertaId, estado, notas }),
      });
      const data = await res.json();
      if (data.success) fetchAlertas();
    } catch { /* silencioso */ }
  };

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Agregar producto a selección + abrir modal si viene de botón individual
  const handleResurtir = useCallback((p: Producto) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.add(p.id);
      return next;
    });
    setResurtirModal(true);
  }, []);

  // Crear orden de compra
  const handleCrearOrden = async (items: LineaResurtido[], notas: string) => {
    // Agrupar por proveedor y crear una orden por proveedor (o una global si no hay proveedor)
    const grupos: Record<string, LineaResurtido[]> = {};
    for (const l of items) {
      const k = l.proveedor ?? "sin_proveedor";
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(l);
    }

    for (const gLineas of Object.values(grupos)) {
      const proveedorId = gLineas[0].proveedor
        ? productos.find((p) => p.nombre === gLineas[0].nombre)?.proveedorId
        : undefined;

      await fetch("/api/ordenes-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId: proveedorId ?? null,
          notas: notas || undefined,
          items: gLineas.map((l) => ({
            productoId: l.productoId,
            descripcion: l.nombre,
            cantidad: l.cantidad,
            precioUnitario: 0,
          })),
        }),
      });
    }

    setSeleccionados(new Set());
    setResurtirModal(false);
    router.push("/dashboard/compras");
  };

  // Descontinuar producto
  const handleDescontinuar = async () => {
    if (!descontinuarProducto) return;
    await fetch(`/api/productos/${descontinuarProducto.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false }),
    });
    await fetchProductos();
    setDescontinuarProducto(null);
  };

  // Clasificar productos
  const sinStock = productos.filter((p) => p.stock === 0 && p.activo !== false);
  const stockBajo = productos.filter((p) => p.stockMinimo !== undefined && p.stock > 0 && p.stock <= p.stockMinimo && p.activo !== false);
  const alertasPendientes = alertas.filter((a) => a.estado === "pendiente");

  const topVendidosConStock = (stats?.productosMasVendidos ?? [])
    .slice(0, 20)
    .map((tv) => ({ ...tv, producto: productos.find((p) => p.id === tv.productoId) ?? null }))
    .filter((tv) => tv.producto !== null);

  // Líneas para modal de resurtido
  const lineasResurtido: LineaResurtido[] = [...seleccionados]
    .map((id) => productos.find((p) => p.id === id))
    .filter((p): p is Producto => !!p)
    .map((p) => ({
      productoId: p.id,
      nombre: p.nombre,
      proveedor: undefined, // proveedor se resuelve via join si es necesario
      stock: p.stock,
      stockMinimo: p.stockMinimo,
      cantidad: suggeridoQty(p),
    }));

  // Seleccionar todos los productos de la sección actual
  const seleccionarTodos = () => {
    const todos = [...sinStock, ...stockBajo].map((p) => p.id);
    setSeleccionados(new Set(todos));
  };
  const limpiarSeleccion = () => setSeleccionados(new Set());

  if (!user?.role || !["admin", "super_admin"].includes(user.role)) return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: "var(--color-bg-base)" }}>
      {/* Modales */}
      {resurtirModal && lineasResurtido.length > 0 && (
        <ModalResurtido lineas={lineasResurtido} onClose={() => setResurtirModal(false)} onCrear={handleCrearOrden} />
      )}
      {descontinuarProducto && (
        <ModalDescontinuar producto={descontinuarProducto} onClose={() => setDescontinuarProducto(null)} onConfirm={handleDescontinuar} />
      )}

      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Alertas de Inventario</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Stock bajo · productos agotados · códigos desconocidos
            </p>
          </div>
          <button
            onClick={() => { fetchProductos(); fetchAlertas(); fetchStats(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* KPI strip — clicables */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={<PackageX className="w-5 h-5" />} label="Sin stock" value={sinStock.length} variant="danger"
            active={tab === "stock"} onClick={() => setTab("stock")} />
          <KpiCard icon={<TrendingDown className="w-5 h-5" />} label="Stock bajo" value={stockBajo.length} variant="warning"
            active={tab === "stock"} onClick={() => setTab("stock")} />
          <KpiCard icon={<Flame className="w-5 h-5" />} label="Alta demanda" value={topVendidosConStock.filter((tv) => tv.producto && tv.producto.stock <= (tv.producto.stockMinimo ?? 3)).length} variant="accent"
            active={tab === "demanda"} onClick={() => setTab("demanda")} />
          <KpiCard icon={<Barcode className="w-5 h-5" />} label="Códigos desconocidos" value={alertasPendientes.length} variant="info"
            active={tab === "nuevos"} onClick={() => setTab("nuevos")} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--color-bg-elevated)" }}>
          <TabBtn active={tab === "stock"} onClick={() => setTab("stock")}>
            Stock bajo / agotado
            {(sinStock.length + stockBajo.length) > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full font-bold" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}>
                {sinStock.length + stockBajo.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === "demanda"} onClick={() => setTab("demanda")}>
            Alta demanda
            {topVendidosConStock.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full font-bold" style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
                {topVendidosConStock.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === "nuevos"} onClick={() => setTab("nuevos")}>
            Códigos desconocidos
            {alertasPendientes.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full font-bold" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}>
                {alertasPendientes.length}
              </span>
            )}
          </TabBtn>
        </div>

        {/* ── TAB: Stock bajo / agotado ────────────────────────────────────── */}
        {tab === "stock" && (
          <div className="space-y-4">
            {loadingProductos ? (
              <StockSkeleton />
            ) : sinStock.length === 0 && stockBajo.length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="w-10 h-10" style={{ color: "var(--color-success)" }} />}
                title="¡Todo el inventario tiene stock suficiente!"
                subtitle="No hay productos agotados ni por debajo del mínimo configurado"
              />
            ) : (
              <>
                {/* Toolbar de selección */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={seleccionarTodos}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Seleccionar todos ({sinStock.length + stockBajo.length})
                  </button>
                  {seleccionados.size > 0 && (
                    <>
                      <button
                        onClick={limpiarSeleccion}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Limpiar selección
                      </button>
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {seleccionados.size} seleccionado{seleccionados.size !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>

                {/* Sin stock */}
                {sinStock.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: "var(--color-danger)" }}>
                      <PackageX className="w-4 h-4" />
                      Sin stock — {sinStock.length} producto{sinStock.length !== 1 ? "s" : ""}
                    </h2>
                    <div className="space-y-2">
                      {sinStock.map((p) => (
                        <ProductoAlertaRow
                          key={p.id} producto={p} tipo="agotado"
                          seleccionado={seleccionados.has(p.id)}
                          onToggle={() => toggleSeleccion(p.id)}
                          onResurtir={handleResurtir}
                          onDescontinuar={setDescontinuarProducto}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Stock bajo */}
                {stockBajo.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2 mt-6" style={{ color: "var(--color-warning)" }}>
                      <TrendingDown className="w-4 h-4" />
                      Stock bajo — {stockBajo.length} producto{stockBajo.length !== 1 ? "s" : ""}
                    </h2>
                    <div className="space-y-2">
                      {stockBajo.map((p) => (
                        <ProductoAlertaRow
                          key={p.id} producto={p} tipo="bajo"
                          seleccionado={seleccionados.has(p.id)}
                          onToggle={() => toggleSeleccion(p.id)}
                          onResurtir={handleResurtir}
                          onDescontinuar={setDescontinuarProducto}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Alta demanda ────────────────────────────────────────────── */}
        {tab === "demanda" && (
          <div className="space-y-4">
            {loadingProductos ? <StockSkeleton /> : topVendidosConStock.length === 0 ? (
              <EmptyState icon={<Flame className="w-10 h-10" style={{ color: "var(--color-accent)" }} />}
                title="Sin datos de ventas aún"
                subtitle="Realiza ventas en el POS para ver los productos más demandados" />
            ) : (
              <div className="rounded-xl overflow-hidden"
                style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}>
                <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <span className="col-span-4">Producto</span>
                  <span className="col-span-2 text-right">Vendidos</span>
                  <span className="col-span-2 text-right">Stock actual</span>
                  <span className="col-span-2 text-right">Mínimo</span>
                  <span className="col-span-1 text-center">Estado</span>
                  <span className="col-span-1" />
                </div>
                {topVendidosConStock.map((tv, idx) => (
                  <DemandaRow key={tv.productoId} tv={tv} idx={idx} total={topVendidosConStock.length} onResurtir={handleResurtir} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Códigos desconocidos ───────────────────────────────────── */}
        {tab === "nuevos" && (
          <div className="space-y-4">
            {/* Explicación */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info-bg)" }}>
              <Barcode className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--color-info)" }} />
              <p className="text-sm" style={{ color: "var(--color-info-text)" }}>
                Estos son códigos de barras escaneados durante verificaciones de inventario que <strong>no coinciden con ningún producto registrado</strong> en el sistema. Revísalos para registrar el producto o descartar el código.
              </p>
            </div>

            {/* Sub-filtro */}
            <div className="flex gap-2">
              <FilterBtn active={filterAlertas === "pending"} onClick={() => setFilterAlertas("pending")}>
                Pendientes {alertasPendientes.length > 0 && `(${alertasPendientes.length})`}
              </FilterBtn>
              <FilterBtn active={filterAlertas === "all"} onClick={() => setFilterAlertas("all")}>
                Todas
              </FilterBtn>
            </div>

            {loadingAlertas ? <StockSkeleton /> : alertas.length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="w-10 h-10" style={{ color: "var(--color-success)" }} />}
                title={filterAlertas === "pending" ? "No hay alertas pendientes" : "Sin alertas registradas"}
                subtitle={filterAlertas === "pending" ? "Todos los códigos escaneados están registrados en el sistema" : "No se han generado alertas de productos desconocidos"} />
            ) : (
              <div className="space-y-3">
                {alertas.map((alerta) => (
                  <AlertaDesconocidoRow key={alerta.id} alerta={alerta} onUpdate={handleUpdateAlerta} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra flotante de selección */}
      {seleccionados.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-2xl z-40"
          style={{ background: "var(--color-primary)", boxShadow: "var(--shadow-xl)", color: "#fff", minWidth: "340px" }}
        >
          <span className="text-sm font-medium">
            {seleccionados.size} producto{seleccionados.size !== 1 ? "s" : ""} seleccionado{seleccionados.size !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={limpiarSeleccion}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
            >
              Limpiar
            </button>
            <button
              onClick={() => setResurtirModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Solicitar resurtido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
