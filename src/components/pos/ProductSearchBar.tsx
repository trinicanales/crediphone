"use client";

import { useState, useEffect, useRef } from "react";
import { Search, QrCode, X, Smartphone } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { BarcodeScanner } from "@/components/inventario/BarcodeScanner";
import { obtenerUrlImagen } from "@/lib/storage";
import type { Producto } from "@/types";

interface ProductSearchBarProps {
  onSelectProduct: (producto: Producto) => void;
  /** FASE 29: incrementar para enfocar el input desde el padre (F3) */
  focusTrigger?: number;
  /** FASE 29: IDs de productos más vendidos para acceso rápido */
  topProductIds?: string[];
}

export function ProductSearchBar({ onSelectProduct, focusTrigger, topProductIds }: ProductSearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loadError, setLoadError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchProductos = async () => {
    try {
      setLoadError("");
      const response = await fetch("/api/productos");
      const data = await response.json();
      if (data.success) {
        setProductos(data.data);
      } else {
        setLoadError(data.error || "Error al cargar productos");
      }
    } catch {
      setLoadError("No se pudo conectar con el servidor");
    }
  };

  // FASE 29: focus al recibir señal de F3
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      const input = searchRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
  }, [focusTrigger]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProductos();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilteredProductos([]);
      setShowResults(false);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term) ||
        p.modelo.toLowerCase().includes(term) ||
        (p as any).codigo_barras?.toLowerCase().includes(term) ||
        (p as any).sku?.toLowerCase().includes(term) ||
        p.codigoBarras?.toLowerCase().includes(term)
    );

    setFilteredProductos(filtered);
    setShowResults(true);
    setSelectedIndex(-1);
  }, [searchTerm, productos]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (producto: Producto) => {
    onSelectProduct(producto);
    setSearchTerm("");
    setShowResults(false);
    setScanMsg("");
    // FASE 29: re-enfocar para siguiente búsqueda rápida
    setTimeout(() => {
      const input = searchRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    }, 0);
  };

  // FASE 29: productos de acceso rápido (top vendidos)
  const topProductos = topProductIds
    ? topProductIds
        .map((id) => productos.find((p) => p.id === id))
        .filter((p): p is Producto => !!p && p.stock > 0)
    : [];

  // Cuando se escanea un código de barras
  const handleBarcodeScan = (codigo: string) => {
    setScanMsg("");
    const term = codigo.toLowerCase();
    const matches = productos.filter(
      (p) =>
        (p as any).codigo_barras?.toLowerCase() === term ||
        p.codigoBarras?.toLowerCase() === term ||
        (p as any).sku?.toLowerCase() === term
    );

    if (matches.length === 1) {
      // Coincidencia exacta única → agregar directamente al carrito
      setShowScanner(false);
      handleSelect(matches[0]);
    } else if (matches.length > 1) {
      // Varios resultados → mostrar dropdown
      setSearchTerm(codigo);
      setShowScanner(false);
    } else {
      // Sin coincidencia exacta por código, buscar por nombre/marca
      setSearchTerm(codigo);
      setShowScanner(false);
      const fuzzy = productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          p.marca.toLowerCase().includes(term) ||
          p.modelo.toLowerCase().includes(term)
      );
      if (fuzzy.length === 0) {
        setScanMsg(`No se encontró producto con código: ${codigo}`);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || filteredProductos.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredProductos.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredProductos.length) {
        handleSelect(filteredProductos[selectedIndex]);
      } else if (filteredProductos.length > 0) {
        handleSelect(filteredProductos[0]);
      }
    } else if (e.key === "Escape") {
      setShowResults(false);
      setShowScanner(false);
    }
  };

  return (
    <div ref={searchRef} className="relative">
      {loadError && (
        <div
          className="mb-2 p-2 rounded-lg"
          style={{
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger)",
            color: "var(--color-danger-text)",
          }}
        >
          <p className="text-xs">{loadError}</p>
        </div>
      )}

      {/* FASE 29: Accesos rápidos — productos más vendidos */}
      {topProductos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {topProductos.map((producto) => (
            <TopProductChip key={producto.id} producto={producto} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {/* Barra de búsqueda + botón QR */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre, marca, modelo o código de barras..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setScanMsg(""); }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchTerm && filteredProductos.length > 0) setShowResults(true);
            }}
            className="pl-10"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowScanner((v) => !v)}
          title="Escanear código de barras"
          className="px-3 rounded-xl border transition-colors"
          style={
            showScanner
              ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "#fff" }
              : { borderColor: "var(--color-border)", color: "var(--color-text-secondary)", background: "transparent" }
          }
          onMouseEnter={(e) => {
            if (!showScanner) {
              (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
            }
          }}
          onMouseLeave={(e) => {
            if (!showScanner) {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }
          }}
        >
          {showScanner ? <X className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
        </button>
      </div>

      {/* Panel del escáner */}
      {showScanner && (
        <div
          className="mt-2 p-4 rounded-xl"
          style={{
            background: "var(--color-info-bg)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-info-text)" }}>
            Escanear código de barras — el producto se agrega automáticamente
          </p>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            lastScannedCode={searchTerm || undefined}
          />
        </div>
      )}

      {/* Mensaje de no encontrado por escaneo */}
      {scanMsg && !showScanner && (
        <div
          className="mt-2 p-2 rounded-lg"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning)",
            color: "var(--color-warning-text)",
          }}
        >
          <p className="text-xs">{scanMsg}</p>
        </div>
      )}

      {/* Dropdown de resultados */}
      {showResults && filteredProductos.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 rounded-lg max-h-96 overflow-y-auto"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {filteredProductos.map((producto, index) => (
            <ProductDropdownItem
              key={producto.id}
              producto={producto}
              isSelected={index === selectedIndex}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {showResults && filteredProductos.length === 0 && searchTerm.trim() !== "" && (
        <div
          className="absolute z-50 w-full mt-2 rounded-lg p-4"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <p className="text-sm text-center" style={{ color: "var(--color-text-muted)" }}>
            No se encontraron productos
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Feature 1: Ítem de dropdown con miniatura de producto ─── */
function ProductDropdownItem({
  producto,
  isSelected,
  onSelect,
}: {
  producto: Producto;
  isSelected: boolean;
  onSelect: (p: Producto) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = obtenerUrlImagen(producto.imagen);
  const tieneImagen = Boolean(imageUrl) && !imgError;

  return (
    <button
      onClick={() => onSelect(producto)}
      className="w-full px-3 py-2.5 text-left transition-colors flex items-center gap-3"
      style={{
        borderBottom: "1px solid var(--color-border-subtle)",
        background: isSelected ? "var(--color-accent-light)" : "transparent",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          isSelected ? "var(--color-accent-light)" : "transparent";
      }}
    >
      {/* Thumbnail */}
      <div
        className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
        style={{
          width: "44px",
          height: "44px",
          background: "var(--color-accent-light)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {tieneImagen ? (
          <Image
            src={imageUrl!}
            alt={producto.nombre}
            width={44}
            height={44}
            className="object-cover w-full h-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <Smartphone className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm" style={{ color: "var(--color-text-primary)" }}>
          {producto.nombre}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
          {producto.marca} {producto.modelo}
          {producto.codigoBarras && (
            <span className="ml-2 font-mono" style={{ color: "var(--color-text-muted)" }}>
              {producto.codigoBarras}
            </span>
          )}
        </p>
      </div>

      {/* Precio + Stock */}
      <div className="text-right shrink-0">
        <p className="font-semibold text-sm" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
          ${producto.precio.toFixed(2)}
        </p>
        <p
          className="text-xs"
          style={{ color: producto.stock > 0 ? "var(--color-success)" : "var(--color-danger)" }}
        >
          ×{producto.stock}
        </p>
      </div>
    </button>
  );
}

/* ── FASE 29: chip de acceso rápido ───────────────────── */
function TopProductChip({
  producto,
  onSelect,
}: {
  producto: Producto;
  onSelect: (p: Producto) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(producto)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${producto.nombre} — $${producto.precio.toFixed(2)} (stock: ${producto.stock})`}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
      style={{
        background: hover ? "var(--color-accent)" : "var(--color-accent-light)",
        color: hover ? "#fff" : "var(--color-accent)",
        border: `1px solid ${hover ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
        boxShadow: hover ? "var(--shadow-sm)" : "none",
      }}
    >
      <span className="truncate max-w-30">{producto.nombre}</span>
      <span
        className="shrink-0 font-mono text-xs"
        style={{ opacity: 0.75 }}
      >
        ×{producto.stock}
      </span>
    </button>
  );
}
