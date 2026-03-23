"use client";

/**
 * FASE 46 — Formulario para crear nueva Orden de Compra
 * FASE 67 — Sugerencias de reabastecimiento: stock bajo + flujo de ventas + filtro por proveedor
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, ShoppingCart, ArrowLeft, AlertTriangle, TrendingUp, PackageX, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { Proveedor, Producto } from "@/types";
import Link from "next/link";

// FASE 67: Tipos para sugerencias
interface SugerenciaProducto {
  id: string;
  nombre: string;
  marca: string;
  modelo: string;
  sku: string | null;
  stock: number;
  stock_minimo: number | null;
  costo: number | null;
  precio: number;
  proveedor_id: string | null;
  imagen: string | null;
  estado: "SIN_STOCK" | "STOCK_BAJO" | "CON_VENTAS";
  unidadesVendidas60d: number;
  numVentas60d: number;
  cantidadSugerida: number;
}

const labelSt: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
  marginBottom: "0.5rem",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

interface ItemForm {
  productoId: string;
  descripcion: string;
  sku: string;
  marca: string;
  modelo: string;
  cantidad: number;
  precioUnitario: number;
  descuentoPct: number;
}

const ITEM_DEFAULT: ItemForm = {
  productoId: "",
  descripcion: "",
  sku: "",
  marca: "",
  modelo: "",
  cantidad: 1,
  precioUnitario: 0,
  descuentoPct: 0,
};

export default function NuevaOrdenCompraPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FASE 67: estado de sugerencias
  const [sugerencias, setSugerencias] = useState<{
    sinStock: SugerenciaProducto[];
    stockBajo: SugerenciaProducto[];
    conVentas: SugerenciaProducto[];
    totalUrgentes: number;
  } | null>(null);
  const [loadingSugs, setLoadingSugs] = useState(false);
  const [showSugs, setShowSugs]       = useState(true);
  const [agregados, setAgregados]     = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    proveedorId: "",
    fechaOrden: new Date().toISOString().split("T")[0],
    fechaEsperada: "",
    condicionesPago: "",
    notas: "",
    descuento: 0,
  });

  const [items, setItems] = useState<ItemForm[]>([{ ...ITEM_DEFAULT }]);

  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/proveedores").then(r => r.json()).catch(() => ({ success: false })),
      fetch("/api/productos").then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([p, prod]) => {
      if (p.success) setProveedores(p.data ?? []);
      if (prod.success) setProductos(prod.data ?? []);
    });
  }, []);

  // FASE 67: cargar sugerencias cuando cambia el proveedor (o al inicio)
  const cargarSugerencias = useCallback(async (proveedorId: string) => {
    setLoadingSugs(true);
    try {
      const qs = proveedorId ? `?proveedorId=${encodeURIComponent(proveedorId)}` : "";
      const res = await fetch(`/api/ordenes-compra/sugerencias${qs}`);
      const d = await res.json();
      if (d.success) setSugerencias(d.data);
    } catch {
      // silencioso
    } finally {
      setLoadingSugs(false);
    }
  }, []);

  // Carga inicial de sugerencias (sin filtro de proveedor)
  useEffect(() => { cargarSugerencias(""); }, [cargarSugerencias]);

  // Cuando cambia el proveedor, recargar sugerencias filtradas
  useEffect(() => {
    cargarSugerencias(form.proveedorId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.proveedorId]);

  // FASE 67: agregar sugerencia como nuevo ítem en la orden
  const agregarSugerencia = (s: SugerenciaProducto) => {
    const yaEnItems = items.findIndex(
      (it) => it.productoId === s.id || (it.descripcion === s.nombre && !it.productoId)
    );
    if (yaEnItems >= 0) {
      // Si ya está, solo actualiza cantidad
      setItems((prev) => {
        const next = [...prev];
        next[yaEnItems] = {
          ...next[yaEnItems],
          cantidad: next[yaEnItems].cantidad + s.cantidadSugerida,
        };
        return next;
      });
    } else {
      const nuevo: ItemForm = {
        productoId: s.id,
        descripcion: s.nombre,
        sku: s.sku ?? "",
        marca: s.marca ?? "",
        modelo: s.modelo ?? "",
        cantidad: s.cantidadSugerida,
        precioUnitario: s.costo ?? s.precio ?? 0,
        descuentoPct: 0,
      };
      // Reemplaza el primer ítem vacío, si existe
      const primerVacio = items.findIndex((it) => !it.descripcion.trim() && !it.productoId);
      if (primerVacio >= 0) {
        setItems((prev) => { const next = [...prev]; next[primerVacio] = nuevo; return next; });
      } else {
        setItems((prev) => [...prev, nuevo]);
      }
    }
    setAgregados((prev) => new Set(prev).add(s.id));
  };

  // Calcular totales
  const subtotal = items.reduce((acc, it) => {
    return acc + it.cantidad * it.precioUnitario * (1 - it.descuentoPct / 100);
  }, 0);
  const total = Math.max(0, subtotal - form.descuento);

  const updateItem = (idx: number, field: keyof ItemForm, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Al seleccionar un producto del catálogo, autorellenar campos del ítem
  const onSelectProducto = (idx: number, productoId: string) => {
    const prod = productos.find((p) => p.id === productoId);
    if (!prod) {
      updateItem(idx, "productoId", productoId);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        productoId,
        descripcion: prod.nombre,
        sku: prod.sku ?? "",
        marca: prod.marca ?? "",
        modelo: prod.modelo ?? "",
        precioUnitario: prod.costo ?? prod.precio ?? 0,
      };
      return next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { ...ITEM_DEFAULT }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError("Agrega al menos un producto a la orden");
      return;
    }
    for (const it of items) {
      if (!it.descripcion.trim()) {
        setError("Todos los ítems deben tener descripción");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ordenes-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Error al crear");
      router.push(`/dashboard/compras/${d.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/dashboard/compras">
          <button
            className="p-2 rounded-lg"
            style={{
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-muted)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Nueva Orden de Compra
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            Pedido a proveedor · el folio se genera automáticamente
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-xl text-sm font-medium"
          style={{ background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }}
        >
          ✕ {error}
        </div>
      )}

      {/* Datos generales */}
      <Card className="mb-6">
        <h3 className="text-base font-semibold mb-5" style={{ color: "var(--color-text-primary)" }}>
          Datos generales
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Proveedor */}
          <div>
            <label style={labelSt}>Proveedor</label>
            <select
              value={form.proveedorId}
              onChange={(e) => setForm((f) => ({ ...f, proveedorId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="">Sin proveedor seleccionado</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Fecha de orden */}
          <div>
            <label style={labelSt}>Fecha de orden</label>
            <Input
              type="date"
              value={form.fechaOrden}
              onChange={(e) => setForm((f) => ({ ...f, fechaOrden: e.target.value }))}
            />
          </div>

          {/* Fecha esperada */}
          <div>
            <label style={labelSt}>Fecha esperada de entrega</label>
            <Input
              type="date"
              value={form.fechaEsperada}
              onChange={(e) => setForm((f) => ({ ...f, fechaEsperada: e.target.value }))}
            />
          </div>

          {/* Condiciones de pago */}
          <div>
            <label style={labelSt}>Condiciones de pago</label>
            <Input
              value={form.condicionesPago}
              onChange={(e) => setForm((f) => ({ ...f, condicionesPago: e.target.value }))}
              placeholder="Ej: Contado, 30 días, 50% anticipo"
            />
          </div>

          {/* Notas */}
          <div className="sm:col-span-2">
            <label style={labelSt}>Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
              placeholder="Instrucciones especiales, referencia de cotización..."
            />
          </div>
        </div>
      </Card>

      {/* FASE 67: Panel de sugerencias de reabastecimiento */}
      {(sugerencias || loadingSugs) && (
        <Card className="mb-6" style={{ border: "1px solid var(--color-warning-bg)" }}>
          {/* Header del panel */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
              <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Productos para reabastecer
                {sugerencias && sugerencias.totalUrgentes > 0 && (
                  <span
                    className="ml-2 text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
                  >
                    {sugerencias.totalUrgentes} urgente{sugerencias.totalUrgentes !== 1 ? "s" : ""}
                  </span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cargarSugerencias(form.proveedorId)}
                className="p-1.5 rounded-lg"
                style={{ color: "var(--color-text-muted)", background: "var(--color-bg-elevated)" }}
                title="Recargar sugerencias"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSugs ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowSugs((v) => !v)}
                className="p-1.5 rounded-lg flex items-center gap-1 text-xs"
                style={{ color: "var(--color-text-muted)", background: "var(--color-bg-elevated)" }}
              >
                {showSugs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showSugs ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
            {form.proveedorId
              ? `Productos de ${proveedores.find((p) => p.id === form.proveedorId)?.nombre ?? "este proveedor"} · últimos 60 días`
              : "Todos los proveedores · últimos 60 días — selecciona un proveedor para filtrar"}
          </p>

          {showSugs && (
            <>
              {loadingSugs && (
                <div className="flex items-center gap-2 py-4" style={{ color: "var(--color-text-muted)" }}>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Cargando sugerencias...</span>
                </div>
              )}

              {!loadingSugs && sugerencias && (
                <div className="space-y-4">
                  {/* Sin stock */}
                  {sugerencias.sinStock.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--color-danger)" }}>
                        <PackageX className="w-3.5 h-3.5" /> Sin stock ({sugerencias.sinStock.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sugerencias.sinStock.map((s) => (
                          <SugerenciaCard key={s.id} sug={s} onAgregar={agregarSugerencia} agregado={agregados.has(s.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stock bajo */}
                  {sugerencias.stockBajo.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--color-warning)" }}>
                        <AlertTriangle className="w-3.5 h-3.5" /> Stock bajo ({sugerencias.stockBajo.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sugerencias.stockBajo.map((s) => (
                          <SugerenciaCard key={s.id} sug={s} onAgregar={agregarSugerencia} agregado={agregados.has(s.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Con ventas recientes */}
                  {sugerencias.conVentas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--color-success)" }}>
                        <TrendingUp className="w-3.5 h-3.5" /> Con flujo de ventas ({sugerencias.conVentas.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sugerencias.conVentas.slice(0, 9).map((s) => (
                          <SugerenciaCard key={s.id} sug={s} onAgregar={agregarSugerencia} agregado={agregados.has(s.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {sugerencias.sinStock.length === 0 && sugerencias.stockBajo.length === 0 && sugerencias.conVentas.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                      ✓ Todo el inventario está en niveles óptimos
                      {form.proveedorId ? " para este proveedor" : ""}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Items */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Productos a ordenar
          </h3>
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: "var(--color-accent-light)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)40",
            }}
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => {
            const itemSubtotal = item.cantidad * item.precioUnitario * (1 - item.descuentoPct / 100);
            return (
              <div
                key={idx}
                className="p-4 rounded-xl"
                style={{
                  background: "var(--color-bg-base)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
                  >
                    Ítem {idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1 rounded"
                      style={{ color: "var(--color-danger)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Producto del catálogo */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label style={{ ...labelSt, fontSize: "0.75rem" }}>Del catálogo (opcional)</label>
                    <select
                      value={item.productoId}
                      onChange={(e) => onSelectProducto(idx, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: "var(--color-bg-sunken)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <option value="">Seleccionar producto...</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.sku ? `(${p.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Descripción */}
                  <div className="sm:col-span-2">
                    <label style={{ ...labelSt, fontSize: "0.75rem" }}>Descripción *</label>
                    <Input
                      value={item.descripcion}
                      onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                      placeholder="Nombre del producto"
                    />
                  </div>

                  {/* SKU */}
                  <div>
                    <label style={{ ...labelSt, fontSize: "0.75rem" }}>SKU / Código</label>
                    <Input
                      value={item.sku}
                      onChange={(e) => updateItem(idx, "sku", e.target.value)}
                      placeholder="SKU-001"
                    />
                  </div>

                  {/* Cantidad */}
                  <div>
                    <label style={{ ...labelSt, fontSize: "0.75rem" }}>Cantidad *</label>
                    <Input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => updateItem(idx, "cantidad", parseInt(e.target.value) || 1)}
                    />
                  </div>

                  {/* Precio unitario */}
                  <div>
                    <label style={{ ...labelSt, fontSize: "0.75rem" }}>Precio unitario *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precioUnitario}
                      onChange={(e) => updateItem(idx, "precioUnitario", parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Descuento */}
                  <div>
                    <label style={{ ...labelSt, fontSize: "0.75rem" }}>Descuento (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={item.descuentoPct}
                      onChange={(e) => updateItem(idx, "descuentoPct", parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="flex items-end">
                    <div>
                      <label style={{ ...labelSt, fontSize: "0.75rem" }}>Subtotal</label>
                      <p
                        className="text-base font-bold"
                        style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}
                      >
                        {fmt(itemSubtotal)}
                      </p>
                    </div>
                  </div>
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
            <span style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>
              {fmt(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm gap-4">
            <span style={{ color: "var(--color-text-muted)" }}>Descuento global</span>
            <div className="w-32">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.descuento}
                onChange={(e) => setForm((f) => ({ ...f, descuento: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div
            className="flex justify-between text-base font-bold pt-2"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Total</span>
            <span style={{ fontFamily: "var(--font-data)", color: "var(--color-accent)" }}>
              {fmt(total)}
            </span>
          </div>
        </div>
      </Card>

      {/* Acciones */}
      <div className="flex gap-3 justify-end">
        <Link href="/dashboard/compras">
          <Button variant="secondary">Cancelar</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={saving}>
          <ShoppingCart className="w-4 h-4 mr-2" />
          {saving ? "Guardando..." : "Crear orden en borrador"}
        </Button>
      </div>
    </div>
  );
}

// ─── FASE 67: Tarjeta de sugerencia de reabastecimiento ───────────────────────

function SugerenciaCard({
  sug,
  onAgregar,
  agregado,
}: {
  sug: SugerenciaProducto;
  onAgregar: (s: SugerenciaProducto) => void;
  agregado: boolean;
}) {
  const estadoStyle: Record<string, React.CSSProperties> = {
    SIN_STOCK:  { background: "var(--color-danger-bg)",  color: "var(--color-danger-text)",  border: "1px solid rgba(185,28,28,0.15)" },
    STOCK_BAJO: { background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid rgba(180,83,9,0.15)" },
    CON_VENTAS: { background: "var(--color-success-bg)", color: "var(--color-success-text)", border: "1px solid rgba(21,128,61,0.15)" },
  };
  const badgeLabel = {
    SIN_STOCK:  "Sin stock",
    STOCK_BAJO: `Stock: ${sug.stock}/${sug.stock_minimo ?? "—"}`,
    CON_VENTAS: "Con ventas",
  };

  return (
    <div
      className="p-3 rounded-xl flex flex-col gap-2"
      style={estadoStyle[sug.estado] || estadoStyle.CON_VENTAS}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug truncate" style={{ color: "var(--color-text-primary)" }}>
            {sug.nombre}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
            {sug.marca} {sug.modelo}{sug.sku ? ` · ${sug.sku}` : ""}
          </p>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
          style={{ background: "rgba(0,0,0,0.08)" }}
        >
          {badgeLabel[sug.estado]}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs flex gap-3" style={{ color: "var(--color-text-muted)" }}>
          {sug.unidadesVendidas60d > 0 && (
            <span title="Unidades vendidas en 60 días">
              📦 {sug.unidadesVendidas60d} vendidas
            </span>
          )}
          {sug.costo ? (
            <span style={{ fontFamily: "var(--font-data)" }}>
              Costo: ${Number(sug.costo).toFixed(2)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onAgregar(sug)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all"
          style={
            agregado
              ? { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
              : { background: "var(--color-primary)", color: "var(--color-primary-text)" }
          }
        >
          {agregado ? (
            <>✓ Agregado</>
          ) : (
            <><Plus className="w-3 h-3" /> Pedir {sug.cantidadSugerida}</>
          )}
        </button>
      </div>
    </div>
  );
}
