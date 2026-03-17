"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Wrench, Phone, FileText, Stethoscope, Tag, X, Check,
  DollarSign, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Servicio, CategoriaServicio, ServicioFormData } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIAS: { value: CategoriaServicio; label: string; icon: React.ReactNode }[] = [
  { value: "telefonia", label: "Telefonía", icon: <Phone className="w-4 h-4" /> },
  { value: "papeleria", label: "Papelería", icon: <FileText className="w-4 h-4" /> },
  { value: "diagnostico", label: "Diagnóstico", icon: <Stethoscope className="w-4 h-4" /> },
  { value: "reparacion", label: "Reparación", icon: <Wrench className="w-4 h-4" /> },
  { value: "otro", label: "Otro", icon: <Tag className="w-4 h-4" /> },
];

function getCategoriaLabel(cat: CategoriaServicio) {
  return CATEGORIAS.find((c) => c.value === cat)?.label ?? cat;
}

function getCategoriaIcon(cat: CategoriaServicio) {
  return CATEGORIAS.find((c) => c.value === cat)?.icon ?? <Tag className="w-4 h-4" />;
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

// ─── Modal de Creación/Edición ────────────────────────────────────────────────

interface ModalServicioProps {
  isOpen: boolean;
  onClose: () => void;
  servicio: Servicio | null; // null = crear nuevo
  onSave: (data: ServicioFormData) => Promise<void>;
}

const EMPTY_FORM: ServicioFormData = {
  nombre: "",
  descripcion: "",
  precioBase: 0,
  precioFijo: true,
  precioMin: undefined,
  precioMax: undefined,
  categoria: "otro",
  activo: true,
};

function ModalServicio({ isOpen, onClose, servicio, onSave }: ModalServicioProps) {
  const [form, setForm] = useState<ServicioFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (servicio) {
        setForm({
          nombre: servicio.nombre,
          descripcion: servicio.descripcion ?? "",
          precioBase: servicio.precioBase,
          precioFijo: servicio.precioFijo,
          precioMin: servicio.precioMin,
          precioMax: servicio.precioMax,
          categoria: servicio.categoria,
          activo: servicio.activo,
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setError("");
    }
  }, [isOpen, servicio]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    if (form.precioBase < 0) { setError("El precio no puede ser negativo"); return; }
    if (!form.precioFijo && form.precioMin != null && form.precioMax != null) {
      if (form.precioMin > form.precioMax) {
        setError("El precio mínimo no puede ser mayor al máximo");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ServicioFormData, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={servicio ? "Editar servicio" : "Nuevo servicio"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre */}
        <Input
          label="Nombre del servicio *"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          placeholder="Ej: Recarga Telcel, Copia simple, Diagnóstico básico"
        />

        {/* Descripción */}
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Descripción (opcional)
          </label>
          <textarea
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            placeholder="Descripción corta del servicio"
            rows={2}
            className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {/* Categoría */}
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Categoría
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => set("categoria", cat.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background:
                    form.categoria === cat.value
                      ? "var(--color-accent)"
                      : "var(--color-bg-elevated)",
                  color:
                    form.categoria === cat.value
                      ? "var(--color-primary-text)"
                      : "var(--color-text-secondary)",
                  border: `1px solid ${
                    form.categoria === cat.value
                      ? "var(--color-accent)"
                      : "var(--color-border)"
                  }`,
                }}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Precio fijo / variable */}
        <div
          className="rounded-lg p-3"
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Tipo de precio
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {form.precioFijo
                  ? "Fijo — el empleado no puede modificarlo en POS"
                  : "Variable — el empleado puede ajustar dentro del rango"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("precioFijo", !form.precioFijo)}
              className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md"
              style={{
                background: form.precioFijo
                  ? "var(--color-success-bg)"
                  : "var(--color-warning-bg)",
                color: form.precioFijo
                  ? "var(--color-success)"
                  : "var(--color-warning)",
                border: `1px solid ${form.precioFijo ? "var(--color-success)" : "var(--color-warning)"}`,
              }}
            >
              {form.precioFijo ? (
                <><ToggleRight className="w-4 h-4" /> Fijo</>
              ) : (
                <><ToggleLeft className="w-4 h-4" /> Variable</>
              )}
            </button>
          </div>

          {/* Precio base — siempre visible */}
          <div className="relative">
            <DollarSign
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="number"
              min="0"
              step="0.50"
              value={form.precioBase}
              onChange={(e) => set("precioBase", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full rounded-md pl-9 pr-3 py-2 text-sm font-mono"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            {form.precioFijo
              ? "Precio que se cobra siempre, sin cambios"
              : "Precio base sugerido (punto de partida del empleado)"}
          </p>

          {/* Rango solo si variable */}
          {!form.precioFijo && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                  Precio mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={form.precioMin ?? ""}
                  onChange={(e) =>
                    set("precioMin", e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="Sin mínimo"
                  className="w-full rounded-md px-3 py-2 text-sm font-mono"
                  style={{
                    background: "var(--color-bg-sunken)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                  Precio máximo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={form.precioMax ?? ""}
                  onChange={(e) =>
                    set("precioMax", e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="Sin máximo"
                  className="w-full rounded-md px-3 py-2 text-sm font-mono"
                  style={{
                    background: "var(--color-bg-sunken)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            style={{
              background: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              border: "1px solid var(--color-danger)",
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : servicio ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ServiciosManager() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Servicio | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Servicio | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaServicio | "todas">("todas");

  const fetchServicios = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/servicios");
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

  const handleSave = async (form: ServicioFormData) => {
    if (editando) {
      await fetch(`/api/servicios/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    await fetchServicios();
  };

  const handleToggle = async (s: Servicio) => {
    setTogglingId(s.id);
    try {
      await fetch(`/api/servicios/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !s.activo }),
      });
      await fetchServicios();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (s: Servicio) => {
    await fetch(`/api/servicios/${s.id}`, { method: "DELETE" });
    setConfirmDelete(null);
    await fetchServicios();
  };

  const serviciosFiltrados =
    filtroCategoria === "todas"
      ? servicios
      : servicios.filter((s) => s.categoria === filtroCategoria);

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg animate-pulse"
            style={{ background: "var(--color-bg-elevated)" }}
          />
        ))}
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div
        className="rounded-lg p-4 flex items-center gap-3"
        style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
      >
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-medium">Error al cargar servicios</p>
          <p className="text-sm">{error}</p>
        </div>
        <Button variant="secondary" onClick={fetchServicios} className="ml-auto">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header de sección */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Servicios sin inventario
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Recargas, copias, diagnósticos y cualquier servicio que no descuenta stock
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => { setEditando(null); setModalOpen(true); }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo servicio
        </Button>
      </div>

      {/* Filtros de categoría */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "todas" as const, label: "Todos" }, ...CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFiltroCategoria(opt.value)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
            style={{
              background:
                filtroCategoria === opt.value
                  ? "var(--color-primary)"
                  : "var(--color-bg-elevated)",
              color:
                filtroCategoria === opt.value
                  ? "var(--color-primary-text)"
                  : "var(--color-text-secondary)",
              border: `1px solid ${filtroCategoria === opt.value ? "var(--color-primary)" : "var(--color-border)"}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista vacía */}
      {serviciosFiltrados.length === 0 && (
        <div
          className="rounded-lg p-8 text-center"
          style={{ border: "2px dashed var(--color-border)", background: "var(--color-bg-surface)" }}
        >
          <Wrench className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-border-strong)" }} />
          <p className="font-medium" style={{ color: "var(--color-text-secondary)" }}>
            {filtroCategoria === "todas" ? "Aún no hay servicios" : `No hay servicios en "${getCategoriaLabel(filtroCategoria as CategoriaServicio)}"`}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Crea servicios que aparecerán en la sección Servicios del POS
          </p>
          <Button
            variant="secondary"
            onClick={() => { setEditando(null); setModalOpen(true); }}
            className="mt-4 flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" /> Crear primer servicio
          </Button>
        </div>
      )}

      {/* Tabla de servicios */}
      {serviciosFiltrados.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-bg-elevated)" }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Servicio
                </th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell" style={{ color: "var(--color-text-secondary)" }}>
                  Categoría
                </th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Precio
                </th>
                <th className="text-center px-4 py-2.5 font-medium hidden md:table-cell" style={{ color: "var(--color-text-secondary)" }}>
                  Tipo
                </th>
                <th className="text-center px-4 py-2.5 font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Estado
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {serviciosFiltrados.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{
                    background: idx % 2 === 0 ? "var(--color-bg-surface)" : "var(--color-bg-elevated)",
                    borderTop: "1px solid var(--color-border-subtle)",
                    opacity: s.activo ? 1 : 0.55,
                  }}
                >
                  {/* Nombre + descripción */}
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {s.nombre}
                    </p>
                    {s.descripcion && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {s.descripcion}
                      </p>
                    )}
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {getCategoriaIcon(s.categoria)}
                      {getCategoriaLabel(s.categoria)}
                    </span>
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {fmtPrecio(s.precioBase)}
                    </span>
                    {!s.precioFijo && (
                      <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {s.precioMin != null ? fmtPrecio(s.precioMin) : "—"} –{" "}
                        {s.precioMax != null ? fmtPrecio(s.precioMax) : "—"}
                      </p>
                    )}
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <Badge variant={s.precioFijo ? "default" : "warning"}>
                      {s.precioFijo ? "Fijo" : "Variable"}
                    </Badge>
                  </td>

                  {/* Activo toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(s)}
                      disabled={togglingId === s.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-all"
                      title={s.activo ? "Desactivar" : "Activar"}
                      style={{
                        background: s.activo ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                        color: s.activo ? "var(--color-success)" : "var(--color-text-muted)",
                      }}
                    >
                      {s.activo ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditando(s); setModalOpen(true); }}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: "var(--color-danger)" }}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      <ModalServicio
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        servicio={editando}
        onSave={handleSave}
      />

      {/* Modal confirmar eliminación */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar servicio"
        size="sm"
      >
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          ¿Seguro que quieres eliminar{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>
            {confirmDelete?.nombre}
          </strong>
          ? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
