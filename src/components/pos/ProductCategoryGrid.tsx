"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Smartphone, Package, Search, QrCode, X } from "lucide-react";
import { BarcodeScanner } from "@/components/inventario/BarcodeScanner";
import { obtenerUrlImagen } from "@/lib/storage";
import type { Producto, Categoria } from "@/types";

interface ProductCategoryGridProps {
  onSelectProduct: (producto: Producto) => void;
}

export function ProductCategoryGrid({ onSelectProduct }: ProductCategoryGridProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const [resProd, resCat] = await Promise.all([
          fetch("/api/productos"),
          fetch("/api/categorias"),
        ]);
        const [dataProd, dataCat] = await Promise.all([resProd.json(), resCat.json()]);
        if (dataProd.success) setProductos(dataProd.data);
        if (dataCat.success) setCategorias(dataCat.data);
      } catch (err) {
        console.error("Error cargando productos/categorias:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const productosFiltrados = productos.filter((p) => {
    const matchCategoria =
      categoriaActiva === "todos" || p.categoriaId === categoriaActiva;
    const matchBusqueda =
      busqueda.trim() === "" ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.marca ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.modelo ?? "").toLowerCase().includes(busqueda.toLowerCase());
    return matchCategoria && matchBusqueda;
  });

  // Escaneo de código de barras en modo visual
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
      setShowScanner(false);
      onSelectProduct(matches[0]);
    } else if (matches.length > 1) {
      setBusqueda(codigo);
      setShowScanner(false);
    } else {
      const fuzzy = productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          (p.marca ?? "").toLowerCase().includes(term)
      );
      if (fuzzy.length === 0) {
        setScanMsg(`Sin producto con código: ${codigo}`);
      } else {
        setBusqueda(codigo);
      }
      setShowScanner(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {/* Skeleton categorías */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-lg animate-pulse shrink-0"
              style={{ background: "var(--color-bg-elevated)" }}
            />
          ))}
        </div>
        {/* Skeleton grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl animate-pulse"
              style={{ background: "var(--color-bg-elevated)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Búsqueda rápida + escáner QR */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setScanMsg(""); }}
            placeholder="Filtrar por nombre, marca, código..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </div>
        {/* Botón escaneo QR */}
        <button
          type="button"
          onClick={() => { setShowScanner((v) => !v); setScanMsg(""); }}
          title="Escanear código de barras"
          className="px-3 rounded-xl border transition-colors shrink-0"
          style={
            showScanner
              ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "#fff" }
              : { borderColor: "var(--color-border)", color: "var(--color-text-secondary)", background: "transparent" }
          }
        >
          {showScanner ? <X className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
        </button>
      </div>

      {/* Panel escáner */}
      {showScanner && (
        <div
          className="p-3 rounded-xl"
          style={{
            background: "var(--color-info-bg)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-info-text)" }}>
            Escanear código de barras — agrega al carrito automáticamente
          </p>
          <BarcodeScanner onScan={handleBarcodeScan} lastScannedCode={busqueda || undefined} />
        </div>
      )}

      {/* Mensaje sin coincidencia por escaneo */}
      {scanMsg && (
        <div
          className="p-2 rounded-lg text-xs"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning)",
            color: "var(--color-warning-text)",
          }}
        >
          {scanMsg}
        </div>
      )}

      {/* Tabs de categorías */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <CatTab
          label="Todos"
          activo={categoriaActiva === "todos"}
          onClick={() => setCategoriaActiva("todos")}
          count={productos.filter((p) => p.stock > 0).length}
        />
        {categorias.map((cat) => (
          <CatTab
            key={cat.id}
            label={cat.nombre}
            activo={categoriaActiva === cat.id}
            onClick={() => setCategoriaActiva(cat.id)}
            count={productos.filter((p) => p.categoriaId === cat.id && p.stock > 0).length}
          />
        ))}
      </div>

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 rounded-xl"
          style={{ background: "var(--color-bg-elevated)" }}
        >
          <Package className="w-10 h-10 mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
            Sin productos en esta categoría
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
          {productosFiltrados.map((producto) => (
            <ProductCard
              key={producto.id}
              producto={producto}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-componentes ─────────────────────────────── */

function CatTab({
  label,
  activo,
  onClick,
  count,
}: {
  label: string;
  activo: boolean;
  onClick: () => void;
  count: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-all"
      style={{
        background: activo
          ? "var(--color-accent)"
          : hover
          ? "var(--color-bg-elevated)"
          : "var(--color-bg-surface)",
        color: activo ? "#fff" : "var(--color-text-secondary)",
        border: activo
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-border-subtle)",
      }}
    >
      {label}
      <span
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{
          background: activo ? "rgba(255,255,255,0.25)" : "var(--color-bg-elevated)",
          color: activo ? "#fff" : "var(--color-text-muted)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ProductCard({
  producto,
  onSelect,
}: {
  producto: Producto;
  onSelect: (p: Producto) => void;
}) {
  const [hover, setHover] = useState(false);
  const [imgError, setImgError] = useState(false);
  const sinStock = producto.stock <= 0;
  const imageUrl = obtenerUrlImagen(producto.imagen);
  const tieneImagen = Boolean(imageUrl) && !imgError;

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <button
      onClick={() => !sinStock && onSelect(producto)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={sinStock}
      className="relative flex flex-col items-start rounded-xl text-left transition-all overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: `1px solid ${hover && !sinStock ? "var(--color-border-strong)" : "var(--color-border-subtle)"}`,
        boxShadow: hover && !sinStock ? "var(--shadow-md)" : "var(--shadow-xs)",
        opacity: sinStock ? 0.45 : 1,
        cursor: sinStock ? "not-allowed" : "pointer",
        transform: hover && !sinStock ? "translateY(-1px)" : "none",
      }}
    >
      {/* Zona de imagen (si tiene foto) o icono */}
      {tieneImagen ? (
        <div className="relative w-full h-24 overflow-hidden">
          <Image
            src={imageUrl!}
            alt={producto.nombre}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
            onError={() => setImgError(true)}
            style={{
              filter: sinStock ? "grayscale(0.6)" : "none",
              transition: "transform 200ms ease",
              transform: hover && !sinStock ? "scale(1.05)" : "scale(1)",
            }}
          />
          {/* Overlay sutil al hover */}
          {hover && !sinStock && (
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,153,184,0.12)" }}
            />
          )}
        </div>
      ) : (
        <div
          className="w-full flex items-center justify-center py-4"
          style={{ background: "var(--color-accent-light)" }}
        >
          <Smartphone className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
        </div>
      )}

      {/* Info del producto */}
      <div className="flex flex-col w-full p-2.5 gap-0.5">
        {/* Nombre */}
        <p
          className="text-xs font-semibold line-clamp-2 leading-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {producto.nombre}
        </p>

        {/* Marca/modelo */}
        {(producto.marca || producto.modelo) && (
          <p className="text-xs line-clamp-1" style={{ color: "var(--color-text-muted)" }}>
            {[producto.marca, producto.modelo].filter(Boolean).join(" ")}
          </p>
        )}

        {/* Precio */}
        <p
          className="text-sm font-bold mt-1"
          style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}
        >
          {formatPrice(Number(producto.precio))}
        </p>
      </div>

      {/* Badge stock — siempre sobre la imagen o icono */}
      <span
        className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium"
        style={{
          background: sinStock
            ? "var(--color-danger-bg)"
            : producto.stock <= 3
            ? "var(--color-warning-bg)"
            : "var(--color-success-bg)",
          color: sinStock
            ? "var(--color-danger-text)"
            : producto.stock <= 3
            ? "var(--color-warning-text)"
            : "var(--color-success-text)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        {sinStock ? "Agotado" : `×${producto.stock}`}
      </span>
    </button>
  );
}
