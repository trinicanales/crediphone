"use client";

import { Minus, Plus, Trash2, ShoppingCart as CartIcon, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Producto } from "@/types";

export interface CartItem {
  // ── Producto (cuando esServicio = false/undefined y esKit = false/undefined) ─
  producto?: Producto;

  // ── Servicio (cuando esServicio = true) ────────────────────────────────────
  esServicio?: boolean;
  servicioId?: string;      // ID real del servicio en DB
  servicioNombre?: string;  // snapshot del nombre

  // ── Kit / Bundle (FASE 61) ─────────────────────────────────────────────────
  esKit?: boolean;
  kitId?: string;
  kitNombre?: string;
  kitItems?: { productoId: string; nombre: string; marca: string; cantidad: number; stock: number }[];

  // ── Común ──────────────────────────────────────────────────────────────────
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  imei?: string;  // FASE 30
  notas?: string; // FASE 30
}

/** Devuelve el identificador único del slot en el carrito */
function getItemKey(item: CartItem): string {
  if (item.esKit)      return `kit_${item.kitId}`;
  if (item.esServicio) return `svc_${item.servicioId}`;
  return item.producto?.id ?? "";
}

interface ShoppingCartProps {
  items: CartItem[];
  descuento: number;
  onUpdateQuantity: (itemKey: string, cantidad: number) => void;
  onRemoveItem: (itemKey: string) => void;
  onClear?: () => void;
  onUpdatePrice?: (itemKey: string, precio: number) => void;  // Feature 3: precio editable
  propina?: number;                                            // Feature 6: propina
  onPropinaChange?: (v: number) => void;                      // Feature 6: propina
}

export function ShoppingCart({
  items,
  descuento,
  onUpdateQuantity,
  onRemoveItem,
  onClear,
  onUpdatePrice,
  propina = 0,
  onPropinaChange,
}: ShoppingCartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal - descuento + propina;

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg p-6"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <CartIcon className="w-16 h-16 mb-4" style={{ color: "var(--color-border)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Carrito vacío
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Busca productos o servicios para agregar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <CartIcon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
          <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Carrito ({items.length} {items.length === 1 ? "ítem" : "ítems"})
          </h3>
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            style={{ color: "var(--color-danger)" }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Items */}
      <div className="max-h-96 overflow-y-auto">
        {items.map((item) => {
          const key = getItemKey(item);
          const maxCantidad = (item.esServicio || item.esKit) ? Infinity : (item.producto?.stock ?? 0);
          const displayNombre = item.esKit
            ? (item.kitNombre ?? "Kit")
            : item.esServicio
              ? (item.servicioNombre ?? "Servicio")
              : (item.producto?.nombre ?? "");
          const displaySub = item.esKit
            ? null
            : item.esServicio
              ? null
              : `${item.producto?.marca ?? ""} ${item.producto?.modelo ?? ""}`.trim();

          return (
            <div
              key={key}
              className="p-4 transition-colors"
              style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.esKit && (
                      <span style={{ fontSize: "0.75rem", padding: "0.1rem 0.4rem", background: "var(--color-accent-light)", color: "var(--color-accent)", borderRadius: "9999px", fontWeight: 700, flexShrink: 0 }}>
                        KIT
                      </span>
                    )}
                    {item.esServicio && (
                      <Wrench className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                    )}
                    <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {displayNombre}
                    </p>
                  </div>
                  {displaySub && (
                    <p className="text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>
                      {displaySub}
                    </p>
                  )}
                  {item.esKit && item.kitItems && item.kitItems.length > 0 && (
                    <div style={{ marginTop: "0.25rem" }}>
                      {item.kitItems.map((ki, idx) => (
                        <p key={idx} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          · {ki.nombre} ×{ki.cantidad}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.esServicio && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Servicio sin inventario
                    </p>
                  )}
                  {onUpdatePrice ? (
                    <div className="flex items-center gap-0.5 mt-1">
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.precioUnitario}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 0) onUpdatePrice(key, v);
                        }}
                        onFocus={(e) => e.target.select()}
                        title="Editar precio unitario"
                        style={{
                          width: "72px",
                          background: "var(--color-bg-sunken)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-muted)",
                          fontFamily: "var(--font-data)",
                          fontSize: "0.75rem",
                          padding: "1px 4px",
                          textAlign: "right",
                          borderRadius: "4px",
                          outline: "none",
                        }}
                      />
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>c/u</span>
                    </div>
                  ) : (
                    <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>
                      ${item.precioUnitario.toFixed(2)} c/u
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p
                    className="text-lg font-semibold"
                    style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}
                  >
                    ${item.subtotal.toFixed(2)}
                  </p>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(key, item.cantidad - 1)}
                      disabled={item.cantidad <= 1}
                      className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                    </button>

                    <input
                      type="number"
                      min={1}
                      max={maxCantidad === Infinity ? undefined : maxCantidad}
                      value={item.cantidad}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1) {
                          onUpdateQuantity(key, maxCantidad === Infinity ? v : Math.min(v, maxCantidad));
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="text-center font-medium rounded-md"
                      style={{
                        width: "3rem",
                        background: "var(--color-bg-sunken)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-data)",
                        fontSize: "0.875rem",
                        padding: "2px 4px",
                        outline: "none",
                      }}
                    />

                    <button
                      onClick={() => onUpdateQuantity(key, item.cantidad + 1)}
                      disabled={item.cantidad >= maxCantidad}
                      className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <Plus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                    </button>

                    <button
                      onClick={() => onRemoveItem(key)}
                      className="p-1 rounded ml-2 transition-colors"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--color-danger-bg)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div
        className="p-4 space-y-2"
        style={{
          background: "var(--color-bg-elevated)",
          borderTop: "1px solid var(--color-border-subtle)",
        }}
      >
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--color-text-secondary)" }}>Subtotal:</span>
          <span className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
            ${subtotal.toFixed(2)}
          </span>
        </div>

        {descuento > 0 && (
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--color-text-secondary)" }}>Descuento:</span>
            <span className="font-medium" style={{ color: "var(--color-danger)", fontFamily: "var(--font-data)" }}>
              -${descuento.toFixed(2)}
            </span>
          </div>
        )}

        {/* Feature 6: Propina */}
        {onPropinaChange !== undefined && (
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: "var(--color-text-secondary)" }}>Propina:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>$</span>
              <input
                type="number"
                min={0}
                step={5}
                value={propina}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onPropinaChange(!isNaN(v) && v >= 0 ? v : 0);
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                style={{
                  width: "68px",
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: propina > 0 ? "var(--color-success)" : "var(--color-text-muted)",
                  fontFamily: "var(--font-data)",
                  fontSize: "0.875rem",
                  padding: "2px 4px",
                  textAlign: "right",
                  borderRadius: "4px",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}

        <div className="pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="flex justify-between">
            <span className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Total:
            </span>
            <span
              className="text-2xl font-bold"
              style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}
            >
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
