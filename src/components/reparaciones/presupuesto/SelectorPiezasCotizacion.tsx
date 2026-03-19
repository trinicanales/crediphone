"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Package, Plus, Trash2, AlertTriangle, CheckCircle, PenLine } from "lucide-react";
import type { PiezaCotizacion, Producto } from "@/types";

interface SelectorPiezasCotizacionProps {
  piezas: PiezaCotizacion[];
  onChange: (piezas: PiezaCotizacion[]) => void;
}

const formatMXN = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

export function SelectorPiezasCotizacion({
  piezas,
  onChange,
}: SelectorPiezasCotizacionProps) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [modoLibre, setModoLibre] = useState(false);
  const [piezaLibre, setPiezaLibre] = useState({
    nombre: "",
    cantidad: 1,
    precioUnitario: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMostrarDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Buscar con debounce
  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([]);
      setMostrarDropdown(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/productos?q=${encodeURIComponent(busqueda)}&limit=10`);
        const data = await res.json();
        if (data.success) {
          setResultados(data.data ?? []);
          setMostrarDropdown(true);
        }
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [busqueda]);

  const agregarDesdeInventario = (producto: Producto) => {
    const existente = piezas.find((p) => p.productoId === producto.id);
    if (existente) {
      // Incrementar cantidad
      onChange(
        piezas.map((p) =>
          p.productoId === producto.id
            ? {
                ...p,
                cantidad: p.cantidad + 1,
                precioTotal: p.precioUnitario * (p.cantidad + 1),
              }
            : p
        )
      );
    } else {
      const precio = Number(producto.precio ?? 0);
      const nueva: PiezaCotizacion = {
        id: `cot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productoId: producto.id,
        nombre: [producto.nombre, producto.marca, producto.modelo]
          .filter(Boolean)
          .join(" — "),
        cantidad: 1,
        precioUnitario: precio,
        precioTotal: precio,
        tieneStock: (producto.stock ?? 0) > 0,
        stockActual: producto.stock ?? 0,
        esLibre: false,
      };
      onChange([...piezas, nueva]);
    }
    setBusqueda("");
    setMostrarDropdown(false);
  };

  const agregarLibre = () => {
    if (!piezaLibre.nombre.trim() || piezaLibre.precioUnitario <= 0) return;
    const nueva: PiezaCotizacion = {
      id: `cot-libre-${Date.now()}`,
      nombre: piezaLibre.nombre.trim(),
      cantidad: piezaLibre.cantidad,
      precioUnitario: piezaLibre.precioUnitario,
      precioTotal: piezaLibre.cantidad * piezaLibre.precioUnitario,
      tieneStock: false,
      esLibre: true,
    };
    onChange([...piezas, nueva]);
    setPiezaLibre({ nombre: "", cantidad: 1, precioUnitario: 0 });
    setModoLibre(false);
  };

  const actualizarCantidad = (id: string, cant: number) => {
    if (cant <= 0) return;
    onChange(
      piezas.map((p) =>
        p.id === id
          ? { ...p, cantidad: cant, precioTotal: p.precioUnitario * cant }
          : p
      )
    );
  };

  const eliminar = (id: string) => {
    onChange(piezas.filter((p) => p.id !== id));
  };

  const totalPiezas = piezas.reduce((s, p) => s + p.precioTotal, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4
          className="text-sm font-bold flex items-center gap-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          <Package className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
          Piezas y Refacciones
          {piezas.length > 0 && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--color-accent-light)",
                color: "var(--color-accent)",
              }}
            >
              {piezas.length}
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => setModoLibre(!modoLibre)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
          style={{
            border: "1px solid var(--color-border)",
            background: modoLibre ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
            color: "var(--color-text-secondary)",
          }}
        >
          <PenLine className="w-3 h-3" />
          Agregar libre
        </button>
      </div>

      {/* Buscador del catálogo */}
      <div className="relative" ref={dropdownRef}>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: "var(--color-text-muted)" }}
        />
        {buscando && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
          />
        )}
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar pantalla, batería, pieza... (mín. 2 letras)"
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
          style={{
            background: "var(--color-bg-sunken)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-accent)";
            if (resultados.length > 0) setMostrarDropdown(true);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
          }}
        />

        {/* Dropdown de resultados */}
        {mostrarDropdown && resultados.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-surface)",
              boxShadow: "var(--shadow-lg)",
              maxHeight: "260px",
              overflowY: "auto",
            }}
          >
            {resultados.map((prod) => {
              const conStock = (prod.stock ?? 0) > 0;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => agregarDesdeInventario(prod)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--color-bg-elevated)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {/* Ícono stock */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: conStock
                        ? "var(--color-success-bg)"
                        : "var(--color-warning-bg)",
                    }}
                  >
                    {conStock ? (
                      <CheckCircle
                        className="w-4 h-4"
                        style={{ color: "var(--color-success)" }}
                      />
                    ) : (
                      <AlertTriangle
                        className="w-4 h-4"
                        style={{ color: "var(--color-warning)" }}
                      />
                    )}
                  </div>

                  {/* Nombre y detalles */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {prod.nombre}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {[prod.marca, prod.modelo].filter(Boolean).join(" ")}
                      {" · "}
                      <span
                        style={{
                          color: conStock
                            ? "var(--color-success)"
                            : "var(--color-warning)",
                        }}
                      >
                        {conStock ? `Stock: ${prod.stock}` : "Sin existencia"}
                      </span>
                    </p>
                  </div>

                  {/* Precio */}
                  <span
                    className="text-sm font-bold shrink-0"
                    style={{
                      color: "var(--color-accent)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {formatMXN(Number(prod.precio))}
                  </span>
                </button>
              );
            })}
            {resultados.length === 0 && !buscando && (
              <div
                className="px-4 py-6 text-center text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Sin resultados — usa "Agregar libre" para cotizar
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulario pieza libre */}
      {modoLibre && (
        <div
          className="rounded-lg p-3 space-y-2"
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px dashed var(--color-border-strong)",
          }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            Cotización sin pieza en catálogo
          </p>
          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              value={piezaLibre.nombre}
              onChange={(e) => setPiezaLibre({ ...piezaLibre, nombre: e.target.value })}
              placeholder="Nombre de la pieza (ej: Pantalla iPhone 14 OLED)"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                  Precio unitario
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    value={piezaLibre.precioUnitario || ""}
                    onChange={(e) =>
                      setPiezaLibre({
                        ...piezaLibre,
                        precioUnitario: parseFloat(e.target.value) || 0,
                      })
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-bg-surface)",
                      color: "var(--color-text-primary)",
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                  Cantidad
                </label>
                <input
                  type="number"
                  value={piezaLibre.cantidad}
                  onChange={(e) =>
                    setPiezaLibre({
                      ...piezaLibre,
                      cantidad: parseInt(e.target.value) || 1,
                    })
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  min="1"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-surface)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={agregarLibre}
              disabled={!piezaLibre.nombre.trim() || piezaLibre.precioUnitario <= 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background:
                  piezaLibre.nombre.trim() && piezaLibre.precioUnitario > 0
                    ? "var(--color-accent)"
                    : "var(--color-bg-elevated)",
                color:
                  piezaLibre.nombre.trim() && piezaLibre.precioUnitario > 0
                    ? "#fff"
                    : "var(--color-text-muted)",
                cursor:
                  piezaLibre.nombre.trim() && piezaLibre.precioUnitario > 0
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              <Plus className="w-4 h-4" />
              Agregar cotización
            </button>
            <button
              type="button"
              onClick={() => setModoLibre(false)}
              className="px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-surface)",
                color: "var(--color-text-secondary)",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de piezas agregadas */}
      {piezas.length > 0 && (
        <div className="space-y-1.5">
          {piezas.map((pieza) => (
            <div
              key={pieza.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: pieza.tieneStock
                  ? "var(--color-success-bg)"
                  : pieza.esLibre
                  ? "var(--color-info-bg)"
                  : "var(--color-warning-bg)",
                border: `1px solid ${
                  pieza.tieneStock
                    ? "var(--color-success)"
                    : pieza.esLibre
                    ? "var(--color-info)"
                    : "var(--color-warning)"
                }`,
              }}
            >
              {/* Badge estado */}
              <div
                className="shrink-0"
                title={
                  pieza.tieneStock
                    ? `En inventario (${pieza.stockActual} disponibles)`
                    : pieza.esLibre
                    ? "Cotización libre"
                    : "Sin existencia en inventario"
                }
              >
                {pieza.tieneStock ? (
                  <CheckCircle
                    className="w-4 h-4"
                    style={{ color: "var(--color-success)" }}
                  />
                ) : pieza.esLibre ? (
                  <PenLine
                    className="w-4 h-4"
                    style={{ color: "var(--color-info)" }}
                  />
                ) : (
                  <AlertTriangle
                    className="w-4 h-4"
                    style={{ color: "var(--color-warning)" }}
                  />
                )}
              </div>

              {/* Nombre */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {pieza.nombre}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {pieza.esLibre
                    ? "Cotización"
                    : pieza.tieneStock
                    ? `Stock disponible: ${pieza.stockActual}`
                    : "Sin existencia — solo cotización"}
                </p>
              </div>

              {/* Control de cantidad */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => actualizarCantidad(pieza.id, pieza.cantidad - 1)}
                  className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  −
                </button>
                <span
                  className="text-xs font-bold w-6 text-center"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {pieza.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => actualizarCantidad(pieza.id, pieza.cantidad + 1)}
                  className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  +
                </button>
              </div>

              {/* Precio total de la pieza */}
              <span
                className="text-sm font-bold shrink-0 w-20 text-right"
                style={{
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-data)",
                }}
              >
                {formatMXN(pieza.precioTotal)}
              </span>

              {/* Eliminar */}
              <button
                type="button"
                onClick={() => eliminar(pieza.id)}
                className="shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all"
                style={{
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Subtotal piezas */}
          <div
            className="flex justify-between items-center px-3 py-2 rounded-lg font-semibold text-sm"
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span style={{ color: "var(--color-text-secondary)" }}>
              Total piezas ({piezas.length})
            </span>
            <span
              style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}
            >
              {formatMXN(totalPiezas)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
