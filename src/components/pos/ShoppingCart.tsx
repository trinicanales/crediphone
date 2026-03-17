"use client";

import { Minus, Plus, Trash2, ShoppingCart as CartIcon, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Producto } from "@/types";

export interface CartItem {
  // ── Producto (cuando esServicio = false/undefined) ─────────────────────────
  producto?: Producto;

  // ── Servicio (cuando esServicio = true) ────────────────────────────────────
  esServicio?: boolean;
  servicioId?: string;      // ID real del servicio en DB
  servicioNombre?: string;  // snapshot del nombre

  // ── Común ──────────────────────────────────────────────────────────────────
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  imei?: string;  // FASE 30
  notas?: string; // FASE 30
}

/** Devuelve el identificador único del slot en el carrito */
function getItemKey(item: CartItem): string {
  return item.esServicio ? `svc_${item.servicioId}` : (item.producto?.id ?? "");
}

interface ShoppingCartProps {
  items: CartItem[];
  descuento: number;
  onUpdateQuantity: (itemKey: string, cantidad: number) => void;
  onRemoveItem: (itemKey: string) => void;
  onClear?: () => void;
}

export function ShoppingCart({
  items,
  descuento,
  onUpdateQuantity,
  onRemoveItem,
  onClear,
}: ShoppingCartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal - descuento;

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
          const maxCantidad = item.esServicio ? Infinity : (item.producto?.stock ?? 0);
          const displayNombre = item.esServicio
            ? (item.servicioNombre ?? "Servicio")
            : (item.producto?.nombre ?? "");
          const displaySub = item.esServicio
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
                  {item.esServicio && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Servicio sin inventario
                    </p>
                  )}
                  <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-data)" }}>
                    ${item.precioUnitario.toFixed(2)} c/u
                  </p>
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

                    <span
                      className="w-12 text-center font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {item.cantidad}
                    </span>

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
