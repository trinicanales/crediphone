"use client";

/**
 * /dashboard/servicios — Página de Servicios sin Inventario
 *
 * Diseño: lista de servicios (izquierda 65%) + panel de categorías (derecha 35%)
 * Todo en una sola pantalla, sin modales separados para categorías.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Wrench, Phone, FileText, Stethoscope, Tag, X, Check,
  DollarSign, AlertCircle, FolderOpen, Loader2,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Servicio, ServicioFormData, CategoriaServicioConfig } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoriaIcon(value: string, size = 14): React.ReactNode {
  const cls = `w-[${size}px] h-[${size}px]`;
  switch (value) {
    case "telefonia":   return <Phone   size={size} />;
    case "papeleria":   return <FileText size={size} />;
    case "diagnostico": return <Stethoscope size={size} />;
    case "reparacion":  return <Wrench  size={size} />;
    default:            return <Tag     size={size} />;
  }
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg ${className}`}
      style={{ background: "var(--color-bg-elevated)" }} />
  );
}

const DEFAULTS_VALUES = ["telefonia", "papeleria", "diagnostico", "reparacion", "otro"];

const EMPTY_FORM: ServicioFormData = {
  nombre: "", descripcion: "", precioBase: 0,
  precioFijo: true, precioMin: undefined, precioMax: undefined,
  categoria: "otro", activo: true,
};

// ─── Modal crear/editar servicio ──────────────────────────────────────────────

interface ModalServicioProps {
  isOpen: boolean;
  onClose: () => void;
  servicio: Servicio | null;
  onSave: (data: ServicioFormData) => Promise<void>;
  categorias: CategoriaServicioConfig[];
}

function ModalServicio({ isOpen, onClose, servicio, onSave, categorias }: ModalServicioProps) {
  const [form, setForm] = useState<ServicioFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(servicio ? {
        nombre:      servicio.nombre,
        descripcion: servicio.descripcion ?? "",
        precioBase:  servicio.precioBase,
        precioFijo:  servicio.precioFijo,
        precioMin:   servicio.precioMin,
        precioMax:   servicio.precioMax,
        categoria:   servicio.categoria,
        activo:      servicio.activo,
      } : EMPTY_FORM);
      setError("");
    }
  }, [isOpen, servicio]);

  const set = (k: keyof ServicioFormData, v: unknown) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es requerido"); return; }
    if (form.precioBase < 0) { setError("El precio no puede ser negativo"); return; }
    if (!form.precioFijo && form.precioMin != null && form.precioMax != null &&
        form.precioMin > form.precioMax) {
      setError("El precio mínimo no puede ser mayor al máximo"); return;
    }
    setSaving(true); setError("");
    try { await onSave(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={servicio ? "Editar servicio" : "Nuevo servicio"} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">

        <Input label="Nombre del servicio *" value={form.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej: Recarga Telcel, Diagnóstico básico, Copia simple" />

        <div>
          <label className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text-secondary)" }}>
            Descripción <span style={{ color: "var(--color-text-muted)" }}>(opcional)</span>
          </label>
          <textarea value={form.descripcion}
            onChange={e => set("descripcion", e.target.value)}
            placeholder="Descripción corta del servicio"
            rows={2} className="w-full rounded-md px-3 py-2 text-sm resize-none outline-none"
            style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)" }} />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium mb-2"
            style={{ color: "var(--color-text-secondary)" }}>Categoría</label>
          <div className="flex flex-wrap gap-2">
            {categorias.map(cat => (
              <button key={cat.value} type="button"
                onClick={() => set("categoria", cat.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: form.categoria === cat.value ? "var(--color-accent)" : "var(--color-bg-elevated)",
                  color:      form.categoria === cat.value ? "#fff" : "var(--color-text-secondary)",
                  border:     `1px solid ${form.categoria === cat.value ? "var(--color-accent)" : "var(--color-border)"}`,
                }}>
                {getCategoriaIcon(cat.value, 13)}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Precio */}
        <div className="rounded-lg p-3 space-y-3"
          style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Tipo de precio
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {form.precioFijo
                  ? "Fijo — el empleado no puede modificarlo en POS"
                  : "Variable — el empleado puede ajustar dentro del rango"}
              </p>
            </div>
            <button type="button" onClick={() => set("precioFijo", !form.precioFijo)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md"
              style={{
                background: form.precioFijo ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                color:      form.precioFijo ? "var(--color-success)" : "var(--color-warning)",
                border:     `1px solid ${form.precioFijo ? "var(--color-success)" : "var(--color-warning)"}`,
              }}>
              {form.precioFijo ? <><ToggleRight size={14} />Fijo</> : <><ToggleLeft size={14} />Variable</>}
            </button>
          </div>

          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-text-muted)" }} />
            <input type="number" min="0" step="0.50" value={form.precioBase}
              onChange={e => set("precioBase", parseFloat(e.target.value) || 0)}
              placeholder="0.00" className="w-full rounded-md pl-9 pr-3 py-2 text-sm"
              style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)", outline: "none", fontFamily: "var(--font-mono)" }} />
          </div>

          {!form.precioFijo && (
            <div className="grid grid-cols-2 gap-2">
              {(["Min","Max"] as const).map(t => (
                <div key={t}>
                  <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                    Precio {t === "Min" ? "mínimo" : "máximo"}
                  </label>
                  <input type="number" min="0" step="0.50"
                    value={t === "Min" ? (form.precioMin ?? "") : (form.precioMax ?? "")}
                    onChange={e => set(t === "Min" ? "precioMin" : "precioMax",
                      e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="Sin límite" className="w-full rounded-md px-3 py-2 text-sm"
                    style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)", outline: "none", fontFamily: "var(--font-mono)" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)",
              border: "1px solid var(--color-danger)" }}>
            <AlertCircle size={14} />{error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : servicio ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ServiciosPage() {
  const { user } = useAuth();
  const router    = useRouter();

  const [servicios,  setServicios]  = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaServicioConfig[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editando,     setEditando]     = useState<Servicio | null>(null);
  const [confirmDel,   setConfirmDel]   = useState<Servicio | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);
  const [filtro,       setFiltro]       = useState<string>("todas");

  // Categorías inline
  const [newCatLabel,  setNewCatLabel]  = useState("");
  const [savingCat,    setSavingCat]    = useState(false);
  const [deletingCat,  setDeletingCat]  = useState<string | null>(null);
  const [catError,     setCatError]     = useState("");

  // ── Permisos ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role ?? "")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchCategorias = useCallback(async () => {
    const res  = await fetch("/api/servicios/categorias");
    const json = await res.json();
    if (json.success) setCategorias(json.data ?? []);
  }, []);

  const fetchServicios = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/servicios");
      const json = await res.json();
      if (json.success) setServicios(json.data ?? []);
      else setError(json.error ?? "Error al cargar");
    } catch { setError("Error de conexión"); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCategorias();
    fetchServicios();
  }, [fetchCategorias, fetchServicios]);

  // ── Categorías ────────────────────────────────────────────────────────────
  const handleAddCat = async () => {
    const label = newCatLabel.trim();
    if (!label) { setCatError("Escribe un nombre"); return; }
    setSavingCat(true); setCatError("");
    try {
      const res  = await fetch("/api/servicios/categorias", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error");
      setNewCatLabel("");
      await fetchCategorias();
    } catch (err) { setCatError(err instanceof Error ? err.message : "Error"); }
    finally { setSavingCat(false); }
  };

  const handleDeleteCat = async (value: string) => {
    setDeletingCat(value);
    try {
      await fetch("/api/servicios/categorias", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (filtro === value) setFiltro("todas");
      await fetchCategorias();
    } finally { setDeletingCat(null); }
  };

  // ── Servicios ─────────────────────────────────────────────────────────────
  const handleSave = async (form: ServicioFormData) => {
    if (editando) {
      await fetch(`/api/servicios/${editando.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/servicios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    await fetchServicios();
  };

  const handleToggle = async (s: Servicio) => {
    setTogglingId(s.id);
    try {
      await fetch(`/api/servicios/${s.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !s.activo }),
      });
      await fetchServicios();
    } finally { setTogglingId(null); }
  };

  const handleDelete = async (s: Servicio) => {
    await fetch(`/api/servicios/${s.id}`, { method: "DELETE" });
    setConfirmDel(null);
    await fetchServicios();
  };

  const getCatLabel = (v: string) => categorias.find(c => c.value === v)?.label ?? v;

  const filtrados = filtro === "todas" ? servicios
    : servicios.filter(s => s.categoria === filtro);

  const custom   = categorias.filter(c => !DEFAULTS_VALUES.includes(c.value));
  const defaults = categorias.filter(c => DEFAULTS_VALUES.includes(c.value));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto app-bg min-h-screen">

      {/* ── Topbar ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-ui)" }}>
            Servicios
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Servicios sin inventario: recargas, copias, diagnósticos — aparecen en el POS
          </p>
        </div>
        <Button variant="primary"
          onClick={() => { setEditando(null); setModalOpen(true); }}
          className="flex items-center gap-2 shrink-0">
          <Plus size={16} />Nuevo servicio
        </Button>
      </div>

      {/* ── Layout 2 columnas ── */}
      <div className="flex gap-5 items-start flex-col lg:flex-row">

        {/* ════ COLUMNA IZQUIERDA: Lista de servicios ════ */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Filtros de categoría */}
          <div className="flex flex-wrap gap-2">
            {[{ value: "todas", label: "Todos" }, ...categorias.map(c => ({ value: c.value, label: c.label }))].map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setFiltro(opt.value)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                style={{
                  background: filtro === opt.value ? "var(--color-primary)" : "var(--color-bg-elevated)",
                  color:      filtro === opt.value ? "#fff" : "var(--color-text-secondary)",
                  border:     `1px solid ${filtro === opt.value ? "var(--color-primary)" : "var(--color-border)"}`,
                }}>
                {opt.value !== "todas" && getCategoriaIcon(opt.value, 12)}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-lg p-4 flex items-center gap-3"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
              <Button variant="secondary" onClick={fetchServicios} className="ml-auto">Reintentar</Button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtrados.length === 0 && (
            <div className="rounded-xl p-10 text-center"
              style={{ background: "var(--color-bg-surface)", border: "2px dashed var(--color-border)" }}>
              <ShoppingBag size={36} className="mx-auto mb-3" style={{ color: "var(--color-border-strong)" }} />
              <p className="font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {filtro === "todas" ? "Aún no hay servicios" : `Sin servicios en "${getCatLabel(filtro)}"`}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                Crea servicios que aparecerán en el área Servicios del POS
              </p>
              <Button variant="secondary" onClick={() => { setEditando(null); setModalOpen(true); }}
                className="mt-4 flex items-center gap-2 mx-auto">
                <Plus size={14} />Crear primer servicio
              </Button>
            </div>
          )}

          {/* Tabla */}
          {!loading && !error && filtrados.length > 0 && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-xs)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg-elevated)" }}>
                    {["Servicio","Categoría","Precio","Tipo","Estado",""].map((h,i) => (
                      <th key={i}
                        className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${i===1?"hidden sm:table-cell":""} ${i===3?"hidden md:table-cell":""} ${i===4?"text-center":""} ${i===5?"w-20":""}`}
                        style={{ color: "var(--color-text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((s, idx) => (
                    <tr key={s.id}
                      style={{
                        background: idx % 2 === 0 ? "var(--color-bg-surface)" : "var(--color-bg-base)",
                        borderTop:  "1px solid var(--color-border-subtle)",
                        opacity:    s.activo ? 1 : 0.5,
                      }}>

                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{s.nombre}</p>
                        {s.descripcion && (
                          <p className="text-xs mt-0.5 truncate max-w-[200px]"
                            style={{ color: "var(--color-text-muted)" }}>{s.descripcion}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="flex items-center gap-1.5 text-xs"
                          style={{ color: "var(--color-text-secondary)" }}>
                          {getCategoriaIcon(s.categoria, 13)}
                          {getCatLabel(s.categoria)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
                          {fmtPrecio(s.precioBase)}
                        </span>
                        {!s.precioFijo && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>
                            {s.precioMin != null ? fmtPrecio(s.precioMin) : "—"} – {s.precioMax != null ? fmtPrecio(s.precioMax) : "—"}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <Badge variant={s.precioFijo ? "default" : "warning"}>
                          {s.precioFijo ? "Fijo" : "Variable"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggle(s)} disabled={togglingId === s.id}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-all"
                          title={s.activo ? "Desactivar" : "Activar"}
                          style={{
                            background: s.activo ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                            color:      s.activo ? "var(--color-success)" : "var(--color-text-muted)",
                          }}>
                          {togglingId === s.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : s.activo ? <Check size={14} /> : <X size={14} />}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditando(s); setModalOpen(true); }}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: "var(--color-text-muted)" }} title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDel(s)}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: "var(--color-danger)" }} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ════ COLUMNA DERECHA: Panel de categorías (inline, sin modal) ════ */}
        <div className="w-full lg:w-72 shrink-0 sticky top-4">
          <div className="rounded-xl overflow-hidden"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)",
              boxShadow: "var(--shadow-sm)" }}>

            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <FolderOpen size={15} style={{ color: "var(--color-accent)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Categorías
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Predeterminadas */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "var(--color-text-muted)" }}>Predeterminadas</p>
                <div className="space-y-1">
                  {defaults.map(cat => (
                    <div key={cat.value}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: "var(--color-bg-elevated)" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {getCategoriaIcon(cat.value, 13)}
                      </span>
                      <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                        {cat.label}
                      </span>
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "var(--color-bg-sunken)", color: "var(--color-text-muted)" }}>
                        {servicios.filter(s => s.categoria === cat.value).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personalizadas */}
              {custom.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: "var(--color-text-muted)" }}>Personalizadas</p>
                  <div className="space-y-1">
                    {custom.map(cat => (
                      <div key={cat.value}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-border-subtle)" }}>
                        <Tag size={13} style={{ color: "var(--color-accent)" }} />
                        <span className="text-sm flex-1" style={{ color: "var(--color-text-primary)" }}>
                          {cat.label}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "var(--color-bg-surface)", color: "var(--color-text-muted)" }}>
                          {servicios.filter(s => s.categoria === cat.value).length}
                        </span>
                        <button onClick={() => handleDeleteCat(cat.value)}
                          disabled={deletingCat === cat.value}
                          className="p-0.5 rounded transition-opacity hover:opacity-70"
                          style={{ color: "var(--color-text-muted)" }} title="Eliminar categoría">
                          {deletingCat === cat.value
                            ? <Loader2 size={13} className="animate-spin" />
                            : <X size={13} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar categoría */}
              <div className="pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "var(--color-text-muted)" }}>Nueva categoría</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatLabel}
                    onChange={e => { setNewCatLabel(e.target.value); setCatError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCat(); } }}
                    placeholder="Ej: Recargas, Impresión..."
                    className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)" }} />
                  <button onClick={handleAddCat} disabled={savingCat || !newCatLabel.trim()}
                    className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                    style={{ background: "var(--color-accent)", color: "#fff",
                      opacity: (!newCatLabel.trim() || savingCat) ? 0.5 : 1 }}>
                    {savingCat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
                {catError && <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>{catError}</p>}
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  El nombre se convierte automáticamente en ID único.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modales ─── */}
      <ModalServicio
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null); }}
        servicio={editando}
        onSave={handleSave}
        categorias={categorias}
      />

      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)}
        title="Eliminar servicio" size="sm">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          ¿Eliminar <strong style={{ color: "var(--color-text-primary)" }}>{confirmDel?.nombre}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => confirmDel && handleDelete(confirmDel)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
