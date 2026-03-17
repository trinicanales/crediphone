"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench, Phone, FileText, Stethoscope, Tag,
  Plus, Search, AlertCircle, DollarSign,
} from "lucide-react";
import type { Servicio, CategoriaServicio } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIAS: { value: CategoriaServicio; label: string; icon: React.ReactNode }[] = [
  { value: "telefonia", label: "Telefonía", icon: <Phone className="w-4 h-4" /> },
  { value: "papeleria", label: "Papelería", icon: <FileText className="w-4 h-4" /> },
  { value: "diagnostico", label: "Diagnóstico", icon: <Stethoscope className="w-4 h-4" /> },
  { value: "reparacion", label: "Reparación", icon: <Wrench className="w-4 h-4" /> },
  { value: "otro", label: "Otro", icon: <Tag className="w-4 h-4" /> },
];

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

// ─── Interfaz pública ─────────────────────────────────────────────────────────

export interface ServicioPOSItem {
  /** ID del servicio base (null si es ad-hoc creado en el momento) */
  servicioId: string | null;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
  esVarible: boolean;
}

interface ServiciosPOSPanelProps {
  onAgregarServicio: (item: ServicioPOSItem) => void;
}

// ─── Modal precio variable ────────────────────────────────────────────────────

interface ModalPrecioVariableProps {
  servicio: Servicio;
  onConfirm: (precio: number) => void;
  onCancel: () => void;
}

function ModalPrecioVariable({ servicio, onConfirm, onCancel }: ModalPrecioVariableProps) {
  const [precio, setPrecio] = useState(servicio.precioBase);
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (precio < 0) { setError("El precio no puede ser negativo"); return; }
    if (servicio.precioMin != null && precio < servicio.precioMin) {
      setError(`El mínimo permitido es ${fmtPrecio(servicio.precioMin)}`);
      return;
    }
    if (servicio.precioMax != null && precio > servicio.precioMax) {
      setError(`El máximo permitido es ${fmtPrecio(servicio.precioMax)}`);
      return;
    }
    onConfirm(precio);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {servicio.nombre}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Ingresa el precio para este servicio
            {servicio.precioMin != null && servicio.precioMax != null
              ? ` (${fmtPrecio(servicio.precioMin)} – ${fmtPrecio(servicio.precioMax)})`
              : servicio.precioMin != null
              ? ` (mín. ${fmtPrecio(servicio.precioMin)})`
              : servicio.precioMax != null
              ? ` (máx. ${fmtPrecio(servicio.precioMax)})`
              : ""}
          </p>
        </div>

        {/* Input de precio */}
        <div className="relative">
          <DollarSign
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="number"
            min={servicio.precioMin ?? 0}
            max={servicio.precioMax ?? undefined}
            step="0.50"
            value={precio}
            onChange={(e) => { setPrecio(parseFloat(e.target.value) || 0); setError(""); }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") onCancel(); }}
            className="w-full rounded-xl pl-9 pr-4 py-3 text-xl font-mono font-bold text-right"
            style={{
              background: "var(--color-bg-sunken)",
              border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function ServiciosPOSPanel({ onAgregarServicio }: ServiciosPOSPanelProps) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaServicio | "todas">("todas");
  const [modalVariable, setModalVariable] = useState<Servicio | null>(null);

  const fetchServicios = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/servicios?activos=true");
      const data = await res.json();
      if (data.success) setServicios(data.data);
      else setError(data.error ?? "Error al cargar servicios");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServicios(); }, [fetchServicios]);

  const serviciosFiltrados = servicios.filter((s) => {
    const matchCat = filtroCategoria === "todas" || s.categoria === filtroCategoria;
    const matchBusq =
      !busqueda ||
      s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (s.descripcion ?? "").toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  });

  // Agrupa por categoría para la vista de cuadrícula
  const categoriasTienenServicios = CATEGORIAS.filter((cat) =>
    serviciosFiltrados.some((s) => s.categoria === cat.value)
  );

  const handleClickServicio = (s: Servicio) => {
    if (!s.precioFijo) {
      setModalVariable(s);
      return;
    }
    // Precio fijo → agrega directo
    onAgregarServicio({
      servicioId: s.id,
      nombre: s.nombre,
      precioUnitario: s.precioBase,
      cantidad: 1,
      subtotal: s.precioBase,
      esVarible: false,
    });
  };

  const handleConfirmPrecio = (precio: number) => {
    if (!modalVariable) return;
    onAgregarServicio({
      servicioId: modalVariable.id,
      nombre: modalVariable.nombre,
      precioUnitario: precio,
      cantidad: 1,
      subtotal: precio,
      esVarible: true,
    });
    setModalVariable(null);
  };

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl animate-pulse"
            style={{ background: "var(--color-bg-elevated)" }}
          />
        ))}
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="p-4">
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Error al cargar servicios</p>
            <p className="text-xs">{error}</p>
          </div>
          <button
            onClick={fetchServicios}
            className="ml-auto text-xs underline"
            style={{ color: "var(--color-danger)" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Búsqueda */}
        <div className="p-3 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar servicio..."
              className="w-full rounded-lg pl-9 pr-3 py-2 text-sm"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Filtros de categoría */}
        <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          {[{ value: "todas" as const, label: "Todos" }, ...CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))].map(
            (opt) => (
              <button
                key={opt.value}
                onClick={() => setFiltroCategoria(opt.value)}
                className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all shrink-0"
                style={{
                  background:
                    filtroCategoria === opt.value
                      ? "var(--color-accent)"
                      : "var(--color-bg-elevated)",
                  color:
                    filtroCategoria === opt.value
                      ? "#fff"
                      : "var(--color-text-secondary)",
                  border: `1px solid ${filtroCategoria === opt.value ? "var(--color-accent)" : "var(--color-border)"}`,
                }}
              >
                {opt.label}
              </button>
            )
          )}
        </div>

        {/* Lista de servicios */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
          {serviciosFiltrados.length === 0 && (
            <div className="py-10 text-center">
              <Wrench
                className="w-10 h-10 mx-auto mb-3"
                style={{ color: "var(--color-border-strong)" }}
              />
              <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {busqueda ? `Sin resultados para "${busqueda}"` : "No hay servicios activos"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Configura servicios en Configuración → Servicios
              </p>
            </div>
          )}

          {/* Agrupa por categoría si no hay búsqueda ni filtro */}
          {serviciosFiltrados.length > 0 && filtroCategoria === "todas" && !busqueda ? (
            categoriasTienenServicios.map((cat) => {
              const items = serviciosFiltrados.filter((s) => s.categoria === cat.value);
              if (!items.length) return null;
              return (
                <div key={cat.value}>
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {cat.icon}
                    {cat.label}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((s) => (
                      <ServicioCard key={s.id} servicio={s} onClick={handleClickServicio} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="space-y-1.5">
              {serviciosFiltrados.map((s) => (
                <ServicioCard key={s.id} servicio={s} onClick={handleClickServicio} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal precio variable */}
      {modalVariable && (
        <ModalPrecioVariable
          servicio={modalVariable}
          onConfirm={handleConfirmPrecio}
          onCancel={() => setModalVariable(null)}
        />
      )}
    </>
  );
}

// ─── Card individual de servicio ──────────────────────────────────────────────

function ServicioCard({
  servicio,
  onClick,
}: {
  servicio: Servicio;
  onClick: (s: Servicio) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onClick(servicio)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all"
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
        border: `1px solid ${hovered ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--color-accent-light)" }}
        >
          {CATEGORIAS.find((c) => c.value === servicio.categoria)?.icon ?? (
            <Tag className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          )}
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {servicio.nombre}
          </p>
          {servicio.descripcion && (
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              {servicio.descripcion}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        <div className="text-right">
          <p className="text-sm font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {servicio.precioFijo
              ? fmtPrecio(servicio.precioBase)
              : servicio.precioMin != null || servicio.precioMax != null
              ? `${servicio.precioMin != null ? fmtPrecio(servicio.precioMin) : "—"} – ${servicio.precioMax != null ? fmtPrecio(servicio.precioMax) : "—"}`
              : "Precio libre"}
          </p>
          {!servicio.precioFijo && (
            <p className="text-xs" style={{ color: "var(--color-warning)" }}>
              Variable
            </p>
          )}
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: hovered ? "var(--color-accent)" : "var(--color-bg-elevated)",
            color: hovered ? "#fff" : "var(--color-text-muted)",
          }}
        >
          <Plus className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
