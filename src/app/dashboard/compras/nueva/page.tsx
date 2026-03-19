"use client";

/**
 * FASE 46 — Formulario para crear nueva Orden de Compra
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus, Trash2, ShoppingCart, ArrowLeft } from "lucide-react";
import type { Proveedor, Producto } from "@/types";
import Link from "next/link";

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
