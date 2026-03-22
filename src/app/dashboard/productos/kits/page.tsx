"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Package2, Plus, Pencil, Trash2, RefreshCw,
  Search, ChevronDown, ChevronUp, X, AlertTriangle,
} from "lucide-react";
import type { Kit, Producto } from "@/types";

// ─── Tipos de formulario ────────────────────────────────────────────────────────

interface KitFormItem {
  productoId: string;
  nombre:     string;
  marca:      string;
  stock:      number;
  precio:     number;
  cantidad:   number;
}

interface KitFormData {
  nombre:       string;
  descripcion:  string;
  precio:       string;
  items:        KitFormItem[];
}

const FORM_EMPTY: KitFormData = {
  nombre: "", descripcion: "", precio: "", items: [],
};

// ─── Página ─────────────────────────────────────────────────────────────────────

export default function KitsPage() {
  const { user, loading: authLoading } = useAuth();
  const { distribuidorActivo } = useDistribuidor();
  const router = useRouter();

  const [kits, setKits]           = useState<Kit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busqueda, setBusqueda]   = useState("");

  // Modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalMode, setModalMode]   = useState<"create" | "edit">("create");
  const [kitEditar, setKitEditar]   = useState<Kit | null>(null);
  const [formData, setFormData]     = useState<KitFormData>(FORM_EMPTY);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  // Búsqueda de productos para agregar al kit
  const [productoQuery, setProductoQuery]   = useState("");
  const [productosFound, setProductosFound] = useState<Producto[]>([]);
  const [buscandoProducto, setBuscandoProducto] = useState(false);

  // Confirm delete
  const [deleteModal, setDeleteModal] = useState(false);
  const [kitDelete, setKitDelete]     = useState<Kit | null>(null);

  useEffect(() => {
    if (!authLoading && user && !["admin", "super_admin"].includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const hdrs = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (distribuidorActivo?.id) h["X-Distribuidor-Id"] = distribuidorActivo.id;
    return h;
  }, [distribuidorActivo]);

  const fetchKits = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/kits", { headers: hdrs() });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setKits(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [hdrs]);

  useEffect(() => { fetchKits(); }, [fetchKits]);

  // ── Búsqueda de productos ────────────────────────────────────────────────────
  useEffect(() => {
    const q = productoQuery.trim();
    if (q.length < 2) { setProductosFound([]); return; }
    const t = setTimeout(async () => {
      setBuscandoProducto(true);
      try {
        const res  = await fetch(`/api/productos?q=${encodeURIComponent(q)}&limit=8`, { headers: hdrs() });
        const json = await res.json();
        setProductosFound((json.data ?? json.productos ?? []).slice(0, 8));
      } catch { setProductosFound([]); }
      finally { setBuscandoProducto(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [productoQuery, hdrs]);

  function agregarProductoAlKit(p: Producto) {
    if (formData.items.some((i) => i.productoId === p.id)) {
      setProductoQuery(""); setProductosFound([]); return;
    }
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, {
        productoId: p.id,
        nombre:     p.nombre,
        marca:      p.marca ?? "",
        stock:      p.stock,
        precio:     Number(p.precio),
        cantidad:   1,
      }],
    }));
    setProductoQuery(""); setProductosFound([]);
  }

  function quitarItemDelKit(productoId: string) {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((i) => i.productoId !== productoId) }));
  }

  function updateCantidadItem(productoId: string, cantidad: number) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((i) => i.productoId === productoId ? { ...i, cantidad: Math.max(1, cantidad) } : i),
    }));
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  function handleCreate() {
    setModalMode("create");
    setKitEditar(null);
    setFormData(FORM_EMPTY);
    setFormError(null);
    setModalOpen(true);
  }

  function handleEdit(kit: Kit) {
    setModalMode("edit");
    setKitEditar(kit);
    setFormData({
      nombre:      kit.nombre,
      descripcion: kit.descripcion ?? "",
      precio:      String(kit.precio),
      items:       (kit.items ?? []).map((i) => ({
        productoId: i.productoId,
        nombre:     i.producto?.nombre ?? i.productoId,
        marca:      i.producto?.marca ?? "",
        stock:      i.producto?.stock ?? 0,
        precio:     Number(i.producto?.precio ?? 0),
        cantidad:   i.cantidad,
      })),
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!formData.nombre.trim()) { setFormError("El nombre es requerido"); return; }
    if (formData.items.length < 2) { setFormError("Un kit debe tener al menos 2 productos"); return; }
    if (!formData.precio || Number(formData.precio) <= 0) { setFormError("El precio debe ser mayor a 0"); return; }

    setSaving(true);
    try {
      const body = {
        nombre:      formData.nombre.trim(),
        descripcion: formData.descripcion || undefined,
        precio:      Number(formData.precio),
        items:       formData.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      };
      const url    = modalMode === "create" ? "/api/kits" : `/api/kits/${kitEditar!.id}`;
      const method = modalMode === "create" ? "POST" : "PUT";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...hdrs() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setModalOpen(false);
      fetchKits();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo(kit: Kit) {
    try {
      await fetch(`/api/kits/${kit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...hdrs() },
        body: JSON.stringify({ activo: !kit.activo }),
      });
      fetchKits();
    } catch { /* silent */ }
  }

  async function handleDelete() {
    if (!kitDelete) return;
    try {
      await fetch(`/api/kits/${kitDelete.id}`, { method: "DELETE", headers: hdrs() });
      setDeleteModal(false);
      setKitDelete(null);
      fetchKits();
    } catch { /* silent */ }
  }

  // ── Precio sugerido (suma de precios de items) ──────────────────────────────
  const precioSugerido = formData.items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const filtrados = kits.filter((k) =>
    !busqueda || k.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ padding: "1.5rem", background: "var(--color-bg-base)", minHeight: "100vh" }} className="app-bg">

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            Kits y Bundles
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Agrupa productos para vender como paquete en el POS
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button
            onClick={fetchKits}
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", fontSize: "0.875rem", cursor: "pointer" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Kit
          </Button>
        </div>
      </div>

      {/* Búsqueda */}
      <div style={{ position: "relative", maxWidth: 320, marginBottom: "1rem" }}>
        <Search style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--color-text-muted)", pointerEvents: "none" }} />
        <input
          type="text" placeholder="Buscar kit..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ width: "100%", paddingLeft: "2.25rem", paddingRight: "0.875rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", fontSize: "0.875rem", outline: "none" }}
        />
      </div>

      {/* Estados */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse" style={{ height: 72, background: "var(--color-bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-subtle)" }} />)}
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: "1rem", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)", borderRadius: "var(--radius-md)", color: "var(--color-danger-text)", fontSize: "0.875rem" }}><span className="flex items-center gap-1.5"><AlertTriangle size={14} />{error}</span></div>
      )}
      {!loading && !error && filtrados.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}>
          <Package2 className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>
            {busqueda ? "Sin resultados" : "No hay kits creados"}
          </p>
          {!busqueda && <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>Crea tu primer kit con el botón "Nuevo Kit"</p>}
        </div>
      )}

      {/* Lista de kits */}
      {!loading && !error && filtrados.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filtrados.map((kit) => {
            const isExp = expandido === kit.id;
            return (
              <div key={kit.id} style={{ background: "var(--color-bg-surface)", border: `1px solid ${isExp ? "var(--color-border-strong)" : "var(--color-border-subtle)"}`, borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1.125rem" }}>
                  {/* Ícono */}
                  <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--color-accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Package2 style={{ width: 20, height: 20, color: "var(--color-accent)" }} />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <p style={{ fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {kit.nombre}
                      </p>
                      <span style={{ padding: "0.1rem 0.5rem", background: kit.activo ? "var(--color-success-bg)" : "var(--color-bg-elevated)", color: kit.activo ? "var(--color-success-text)" : "var(--color-text-muted)", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 600, flexShrink: 0 }}>
                        {kit.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                      {(kit.items ?? []).length} productos
                      {kit.descripcion && ` · ${kit.descripcion}`}
                    </p>
                  </div>
                  {/* Precio */}
                  <p style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: "1.125rem", color: "var(--color-text-primary)", flexShrink: 0 }}>
                    ${kit.precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                  {/* Acciones */}
                  <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                    <button onClick={() => setExpandido(isExp ? null : kit.id)} style={{ padding: "0.375rem", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", borderRadius: "var(--radius-md)" }}>
                      {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleToggleActivo(kit)} style={{ padding: "0.375rem 0.75rem", background: kit.activo ? "var(--color-warning-bg)" : "var(--color-success-bg)", color: kit.activo ? "var(--color-warning-text)" : "var(--color-success-text)", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                      {kit.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button onClick={() => handleEdit(kit)} style={{ padding: "0.375rem", background: "none", border: "none", cursor: "pointer", color: "var(--color-info)" }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setKitDelete(kit); setDeleteModal(true); }} style={{ padding: "0.375rem", background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExp && (
                  <div style={{ borderTop: "1px solid var(--color-border-subtle)", padding: "0.875rem 1.125rem", background: "var(--color-bg-base)" }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                      Productos incluidos
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {(kit.items ?? []).map((ki) => (
                        <div key={ki.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                          <p style={{ fontSize: "0.8125rem", color: "var(--color-text-primary)" }}>
                            {ki.producto?.marca} {ki.producto?.nombre}
                          </p>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>×{ki.cantidad}</span>
                            <span style={{ fontFamily: "var(--font-data)", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                              ${Number(ki.producto?.precio ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Crear / Editar ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalMode === "create" ? "Nuevo Kit" : "Editar Kit"} size="lg">
        <div className="space-y-4">
          {formError && (
            <div style={{ padding: "0.75rem", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)", borderRadius: "var(--radius-md)", color: "var(--color-danger-text)", fontSize: "0.875rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {formError}
            </div>
          )}

          <Input
            label="Nombre del kit *"
            value={formData.nombre}
            onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
            placeholder="Ej: Kit Básico Samsung A54"
          />
          <Input
            label="Descripción (opcional)"
            value={formData.descripcion}
            onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Descripción breve del bundle"
          />

          {/* Precio */}
          <div>
            <Input
              label="Precio del kit *"
              type="number"
              value={formData.precio}
              onChange={(e) => setFormData((p) => ({ ...p, precio: e.target.value }))}
              placeholder="0.00"
            />
            {precioSugerido > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.375rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  Precio individual sumado: <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, color: "var(--color-text-primary)" }}>${precioSugerido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, precio: String(precioSugerido) }))}
                  style={{ fontSize: "0.75rem", color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Usar este precio
                </button>
              </div>
            )}
            {precioSugerido > 0 && Number(formData.precio) > 0 && Number(formData.precio) < precioSugerido && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-success)", marginTop: "0.25rem" }}>
                ✓ Descuento de ${(precioSugerido - Number(formData.precio)).toLocaleString("es-MX", { minimumFractionDigits: 2 })} vs precio individual
              </p>
            )}
          </div>

          {/* Agregar productos */}
          <div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "0.375rem" }}>
              Productos del kit * (mínimo 2)
            </p>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--color-text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                value={productoQuery}
                onChange={(e) => setProductoQuery(e.target.value)}
                placeholder="Buscar producto para agregar..."
                style={{ width: "100%", paddingLeft: "2.25rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", background: "var(--color-bg-sunken)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", fontSize: "0.875rem", outline: "none" }}
              />
              {/* Dropdown resultados */}
              {productosFound.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", zIndex: 50, overflow: "hidden" }}>
                  {productosFound.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregarProductoAlKit(p)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "0.625rem 0.875rem", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <div>
                        <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-primary)" }}>{p.nombre}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{p.marca} {p.modelo} · Stock: {p.stock}</p>
                      </div>
                      <p style={{ fontFamily: "var(--font-data)", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", flexShrink: 0, marginLeft: "0.5rem" }}>
                        ${Number(p.precio).toLocaleString("es-MX")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {buscandoProducto && <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>Buscando...</p>}
            </div>
          </div>

          {/* Items seleccionados */}
          {formData.items.length > 0 && (
            <div style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {formData.items.map((item) => (
                <div key={item.productoId} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.marca} {item.nombre}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Stock: {item.stock}</p>
                  </div>
                  {/* Cantidad */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <button type="button" onClick={() => updateCantidadItem(item.productoId, item.cantidad - 1)} style={{ width: 24, height: 24, borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, minWidth: 20, textAlign: "center", color: "var(--color-text-primary)" }}>{item.cantidad}</span>
                    <button type="button" onClick={() => updateCantidadItem(item.productoId, item.cantidad + 1)} style={{ width: 24, height: 24, borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: "0.875rem", color: "var(--color-text-secondary)", minWidth: 64, textAlign: "right" }}>
                    ${(item.precio * item.cantidad).toLocaleString("es-MX")}
                  </span>
                  <button type="button" onClick={() => quitarItemDelKit(item.productoId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)", padding: "0.25rem" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : modalMode === "create" ? "Crear Kit" : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar Kit">
        <div className="space-y-4">
          <p style={{ color: "var(--color-text-primary)" }}>
            ¿Eliminar el kit <strong>{kitDelete?.nombre}</strong>? Esta acción no se puede deshacer.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setDeleteModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
