"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useCarritoStore } from "@/store/carritoStore";
import { CarritoFlotante } from "@/components/ecommerce/CarritoFlotante";
import { FormularioCotizacion } from "@/components/ecommerce/FormularioCotizacion";
import { obtenerUrlImagen } from "@/lib/storage";
import type { Producto } from "@/types";
import {
  Search,
  Smartphone,
  Battery,
  Camera,
  Droplets,
  Cpu,
  Package,
  ShoppingCart,
  MessageCircle,
  Star,
  Shield,
  Clock,
  CheckCircle2,
  Zap,
  ChevronRight,
  FileText,
  Wrench,
  X,
  Loader2,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATOS ESTÁTICOS — Servicios y categorías
───────────────────────────────────────────── */

const CATEGORIAS_SERVICIO = [
  { id: "todos",     label: "Todo",             icon: Package },
  { id: "pantalla",  label: "Pantalla",         icon: Smartphone },
  { id: "bateria",   label: "Batería",          icon: Battery },
  { id: "camara",    label: "Cámara",           icon: Camera },
  { id: "agua",      label: "Daño por Agua",    icon: Droplets },
  { id: "software",  label: "Software",         icon: Cpu },
  { id: "accesorios",label: "Accesorios",       icon: Package },
];

const MARCAS_POPULARES = [
  "todas", "Apple", "Samsung", "Xiaomi", "Motorola", "Huawei", "OPPO", "Vivo",
];

const SERVICIOS_REPARACION = [
  {
    id: "s1",
    categoria: "pantalla",
    nombre: "Cambio de Pantalla",
    descripcion: "Reparación o reemplazo de display, vidrio o digitalizador.",
    precioDesde: 599,
    tiempoEstimado: "2–4 horas",
    garantia: "90 días",
    popular: true,
    marcas: ["Apple", "Samsung", "Xiaomi", "Motorola"],
  },
  {
    id: "s2",
    categoria: "bateria",
    nombre: "Cambio de Batería",
    descripcion: "Reemplazo con batería original o de alta capacidad certificada.",
    precioDesde: 349,
    tiempoEstimado: "1–2 horas",
    garantia: "90 días",
    popular: true,
    marcas: ["Apple", "Samsung", "Xiaomi", "Motorola", "Huawei"],
  },
  {
    id: "s3",
    categoria: "camara",
    nombre: "Reparación de Cámara",
    descripcion: "Reparación de cámara delantera, trasera o módulo completo.",
    precioDesde: 449,
    tiempoEstimado: "2–3 horas",
    garantia: "90 días",
    popular: false,
    marcas: ["Apple", "Samsung", "Xiaomi"],
  },
  {
    id: "s4",
    categoria: "agua",
    nombre: "Recuperación de Daño por Agua",
    descripcion: "Limpieza ultrasónica y recuperación de dispositivos con daño por líquido.",
    precioDesde: 299,
    tiempoEstimado: "24–48 horas",
    garantia: "30 días",
    popular: false,
    marcas: ["Apple", "Samsung", "Xiaomi", "Motorola", "Huawei"],
  },
  {
    id: "s5",
    categoria: "software",
    nombre: "Reparación de Software",
    descripcion: "Liberación, actualización, eliminación de virus y restauración de sistema.",
    precioDesde: 199,
    tiempoEstimado: "1–3 horas",
    garantia: "30 días",
    popular: false,
    marcas: ["Apple", "Samsung", "Xiaomi", "Motorola", "Huawei", "OPPO"],
  },
  {
    id: "s6",
    categoria: "pantalla",
    nombre: "Cambio de Vidrio Trasero",
    descripcion: "Reemplazo del cristal trasero con material original.",
    precioDesde: 499,
    tiempoEstimado: "3–5 horas",
    garantia: "90 días",
    popular: false,
    marcas: ["Apple", "Samsung"],
  },
  {
    id: "s7",
    categoria: "pantalla",
    nombre: "Reparación de Puerto de Carga",
    descripcion: "Limpieza o reemplazo del puerto USB/Lightning/Type-C.",
    precioDesde: 249,
    tiempoEstimado: "1–2 horas",
    garantia: "60 días",
    popular: false,
    marcas: ["Apple", "Samsung", "Xiaomi", "Motorola", "Huawei"],
  },
  {
    id: "s8",
    categoria: "pantalla",
    nombre: "Reparación de Bocina / Micrófono",
    descripcion: "Limpieza o reemplazo de bocina principal, auricular o micrófono.",
    precioDesde: 299,
    tiempoEstimado: "1–2 horas",
    garantia: "60 días",
    popular: false,
    marcas: ["Apple", "Samsung", "Xiaomi", "Motorola"],
  },
];

const RESENAS = [
  {
    nombre: "María G.",
    iniciales: "MG",
    calificacion: 5,
    texto: "Llevé mi iPhone 14 con pantalla rota y en 3 horas lo tenía como nuevo. Excelente servicio.",
    servicio: "Cambio de pantalla iPhone 14",
  },
  {
    nombre: "Carlos R.",
    iniciales: "CR",
    calificacion: 5,
    texto: "El mejor lugar para reparar celulares. Técnicos certificados y precio justo.",
    servicio: "Batería Samsung S23",
  },
  {
    nombre: "Ana L.",
    iniciales: "AL",
    calificacion: 5,
    texto: "Me dieron tracking en tiempo real del progreso. Se nota que son profesionales.",
    servicio: "Daño por agua Xiaomi 13",
  },
];

/* ─────────────────────────────────────────────
   UTILIDADES
───────────────────────────────────────────── */
function formatPrice(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/* ─────────────────────────────────────────────
   SKELETON — Tarjeta de producto
───────────────────────────────────────────── */
function ProductCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: "var(--color-bg-surface)",
        border:     "1px solid var(--color-border-subtle)",
        boxShadow:  "var(--shadow-sm)",
      }}
    >
      <div className="h-52" style={{ background: "var(--color-bg-elevated)" }} />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded w-3/4" style={{ background: "var(--color-bg-elevated)" }} />
        <div className="h-3 rounded w-1/2" style={{ background: "var(--color-bg-elevated)" }} />
        <div className="h-3 rounded w-full" style={{ background: "var(--color-bg-elevated)" }} />
        <div className="h-6 rounded w-1/3 mt-2" style={{ background: "var(--color-bg-elevated)" }} />
        <div className="h-10 rounded-lg w-full mt-3" style={{ background: "var(--color-bg-elevated)" }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TARJETA DE PRODUCTO
───────────────────────────────────────────── */
function ProductCard({
  producto,
  onAgregar,
}: {
  producto: Producto;
  onAgregar: (p: Producto) => void;
}) {
  const [agregado, setAgregado] = useState(false);
  const imgUrl = obtenerUrlImagen(producto.imagen || "");

  function handleClick() {
    onAgregar(producto);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1800);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col group"
      style={{
        background:  "var(--color-bg-surface)",
        border:      "1px solid var(--color-border-subtle)",
        boxShadow:   "var(--shadow-sm)",
        transition:  "box-shadow 200ms ease, transform 200ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Imagen */}
      <div
        className="relative h-52 overflow-hidden"
        style={{ background: "var(--color-bg-elevated)" }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={producto.nombre}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Smartphone
              className="w-16 h-16"
              style={{ color: "var(--color-border)" }}
            />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {producto.stock > 0 && producto.stock < 5 && (
            <span
              className="text-xs font-bold px-2 py-1 rounded-full"
              style={{
                background: "var(--color-warning-bg)",
                color:      "var(--color-warning-text)",
              }}
            >
              Últimas unidades
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-ui)" }}
          >
            {producto.marca} · {producto.modelo}
          </p>
          <h3
            className="text-sm font-semibold leading-snug line-clamp-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            {producto.nombre}
          </h3>
          {producto.descripcion && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              {producto.descripcion}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span
            className="text-xl font-bold tabular"
            style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}
          >
            {formatPrice(Number(producto.precio))}
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {producto.stock} disp.
          </span>
        </div>

        <button
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold mt-1"
          style={{
            background:  agregado ? "var(--color-success)" : "var(--color-primary)",
            color:       "var(--color-primary-text)",
            border:      "none",
            transition:  "background 300ms ease",
          }}
          onMouseEnter={(e) => {
            if (!agregado) (e.currentTarget as HTMLElement).style.background = "var(--color-primary-mid)";
          }}
          onMouseLeave={(e) => {
            if (!agregado) (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
          }}
        >
          {agregado ? (
            <><CheckCircle2 className="w-4 h-4" /> Agregado</>
          ) : (
            <><ShoppingCart className="w-4 h-4" /> Agregar al carrito</>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TARJETA DE SERVICIO
───────────────────────────────────────────── */
function ServiceCard({
  servicio,
  onSolicitar,
}: {
  servicio: typeof SERVICIOS_REPARACION[0];
  onSolicitar: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 group"
      style={{
        background:  "var(--color-bg-surface)",
        border:      "1px solid var(--color-border-subtle)",
        boxShadow:   "var(--shadow-sm)",
        transition:  "box-shadow 200ms ease, transform 200ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {servicio.nombre}
            </h3>
            {servicio.popular && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--color-accent-light)",
                  color:      "var(--color-accent)",
                }}
              >
                Popular
              </span>
            )}
          </div>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {servicio.descripcion}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {servicio.tiempoEstimado}
        </span>
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Garantía {servicio.garantia}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 mt-auto" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Desde</p>
          <p
            className="text-lg font-bold tabular"
            style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}
          >
            {formatPrice(servicio.precioDesde)}
          </p>
        </div>

        <button
          onClick={onSolicitar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: "var(--color-primary-light)",
            color:      "var(--color-primary)",
            border:     "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
            (e.currentTarget as HTMLElement).style.color      = "var(--color-primary-text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-primary-light)";
            (e.currentTarget as HTMLElement).style.color      = "var(--color-primary)";
          }}
        >
          Solicitar
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHIP DE FILTRO
───────────────────────────────────────────── */
function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: typeof Package;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0"
      style={
        active
          ? {
              background: "var(--color-primary)",
              color:      "var(--color-primary-text)",
              border:     "none",
            }
          : {
              background: "var(--color-bg-surface)",
              color:      "var(--color-text-secondary)",
              border:     "1px solid var(--color-border)",
            }
      }
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-strong)";
          (e.currentTarget as HTMLElement).style.color       = "var(--color-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          (e.currentTarget as HTMLElement).style.color       = "var(--color-text-secondary)";
        }
      }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   PÁGINA PRINCIPAL
───────────────────────────────────────────── */
export default function CatalogoPage() {
  const [productos, setProductos]               = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [searchQuery, setSearchQuery]           = useState("");
  const [categoriaActiva, setCategoriaActiva]   = useState("todos");
  const [marcaActiva, setMarcaActiva]           = useState("todas");
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [errorProductos, setErrorProductos]     = useState(false);
  const [mostrarCotizacion, setMostrarCotizacion] = useState(false);
  const [tabActivo, setTabActivo]               = useState<"productos" | "servicios">("servicios");
  const searchRef                               = useRef<HTMLInputElement>(null);

  const agregarProducto = useCarritoStore((s) => s.agregarProducto);

  /* ── Fetch productos ─────────────────────── */
  const fetchProductos = useCallback(async () => {
    try {
      setLoadingProductos(true);
      setErrorProductos(false);
      const res  = await fetch("/api/public/productos");
      const data = await res.json();
      if (data.success) {
        // El endpoint ya filtra stock > 0, pero lo dejamos por seguridad
        const disponibles = data.data.filter((p: Producto) => p.stock > 0);
        setProductos(disponibles);
        setFilteredProductos(disponibles);
      } else {
        setErrorProductos(true);
      }
    } catch {
      setErrorProductos(true);
    } finally {
      setLoadingProductos(false);
    }
  }, []);

  useEffect(() => { fetchProductos(); }, [fetchProductos]);

  /* ── Filtrado reactivo ───────────────────── */
  useEffect(() => {
    let result = productos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.marca.toLowerCase().includes(q) ||
          p.modelo.toLowerCase().includes(q) ||
          p.descripcion?.toLowerCase().includes(q),
      );
    }
    if (marcaActiva !== "todas") {
      result = result.filter((p) => p.marca === marcaActiva);
    }
    setFilteredProductos(result);
  }, [searchQuery, marcaActiva, productos]);

  /* ── Servicios filtrados ─────────────────── */
  const serviciosFiltrados = SERVICIOS_REPARACION.filter(
    (s) => categoriaActiva === "todos" || s.categoria === categoriaActiva,
  );

  const marcasUnicas = ["todas", ...Array.from(new Set(productos.map((p) => p.marca))).sort()];

  function scrollToSearch() {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div style={{ background: "var(--color-bg-base)", minHeight: "100vh", fontFamily: "var(--font-ui)" }}>
      <Header />

      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--color-sidebar-bg)" }}
      >
        {/* Textura */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,184,217,0.05) 1px, transparent 1px)",
            backgroundSize:  "28px 28px",
          }}
        />
        {/* Brillo */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(0,153,184,0.15) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{
              background: "var(--color-sidebar-surface)",
              border:     "1px solid var(--color-sidebar-border)",
              color:      "var(--color-sidebar-active)",
            }}
          >
            <Zap className="w-3 h-3" />
            Técnicos certificados · Garantía real
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-4"
            style={{ color: "var(--color-text-inverted)" }}
          >
            Repara tu celular
            <br />
            <span style={{ color: "var(--color-sidebar-active)" }}>con expertos</span>
          </h1>

          <p
            className="text-base sm:text-lg mb-10 max-w-xl mx-auto"
            style={{ color: "var(--color-sidebar-text)" }}
          >
            Garantía de 90 días · Técnicos certificados · Precios transparentes
          </p>

          {/* Barra de búsqueda */}
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-center gap-3 px-5 py-4 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.06)",
                border:     "1px solid var(--color-sidebar-border)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Search className="w-5 h-5 shrink-0" style={{ color: "var(--color-sidebar-text-dim)" }} />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setTabActivo("productos"); }}
                placeholder="Busca por modelo o problema (ej: pantalla rota iPhone 15)"
                className="flex-1 bg-transparent text-base outline-none placeholder:opacity-50"
                style={{
                  color:       "var(--color-text-inverted)",
                  fontFamily:  "var(--font-ui)",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ color: "var(--color-sidebar-text-dim)", background: "none", border: "none" }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sugerencias rápidas */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {["Pantalla rota", "Batería iPhone", "Agua Samsung", "Puerto carga"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setSearchQuery(s); setTabActivo("productos"); scrollToSearch(); }}
                  className="px-3 py-1.5 rounded-full text-xs"
                  style={{
                    background: "var(--color-sidebar-surface)",
                    border:     "1px solid var(--color-sidebar-border)",
                    color:      "var(--color-sidebar-text)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div
          className="relative z-10 border-t"
          style={{ borderColor: "var(--color-sidebar-border)" }}
        >
          <div className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-3 gap-4">
            {[
              { num: "12,450+", label: "Reparaciones exitosas" },
              { num: "90 días", label: "Garantía incluida" },
              { num: "4.9 ★",   label: "Calificación promedio" },
            ].map(({ num, label }) => (
              <div key={label} className="text-center">
                <p
                  className="text-xl sm:text-2xl font-bold tabular"
                  style={{ fontFamily: "var(--font-data)", color: "var(--color-sidebar-active)" }}
                >
                  {num}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-sidebar-text-dim)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          BARRA DE NAVEGACIÓN / FILTROS
      ═══════════════════════════════════════ */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: "var(--color-bg-surface)",
          borderBottom: "1px solid var(--color-border-subtle)",
          boxShadow:    "var(--shadow-sm)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Tabs principales */}
          <div className="flex gap-0 border-b" style={{ borderColor: "transparent" }}>
            {([
              { id: "servicios", label: "Reparaciones",  icon: Wrench },
              { id: "productos", label: "Accesorios",    icon: Package },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTabActivo(id)}
                className="flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors"
                style={{
                  borderBottomColor: tabActivo === id ? "var(--color-accent)" : "transparent",
                  color: tabActivo === id ? "var(--color-accent)" : "var(--color-text-muted)",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${tabActivo === id ? "var(--color-accent)" : "transparent"}`,
                  cursor: "pointer",
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Chips de filtro — Categorías (servicios) o Marcas (productos) */}
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            {tabActivo === "servicios" ? (
              CATEGORIAS_SERVICIO.map(({ id, label, icon }) => (
                <FilterChip
                  key={id}
                  label={label}
                  icon={icon}
                  active={categoriaActiva === id}
                  onClick={() => setCategoriaActiva(id)}
                />
              ))
            ) : (
              MARCAS_POPULARES.concat(
                marcasUnicas.filter((m) => m !== "todas" && !MARCAS_POPULARES.includes(m)),
              )
                .filter((m, i, a) => a.indexOf(m) === i)
                .map((marca) => (
                  <FilterChip
                    key={marca}
                    label={marca === "todas" ? "Todas las marcas" : marca}
                    active={marcaActiva === marca}
                    onClick={() => setMarcaActiva(marca)}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          CONTENIDO PRINCIPAL
      ═══════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* ── TAB: SERVICIOS ─────────────────── */}
        {tabActivo === "servicios" && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {categoriaActiva === "todos"
                    ? "Todos los servicios"
                    : CATEGORIAS_SERVICIO.find((c) => c.id === categoriaActiva)?.label}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {serviciosFiltrados.length} servicio{serviciosFiltrados.length !== 1 ? "s" : ""} disponible{serviciosFiltrados.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {serviciosFiltrados.length === 0 ? (
              <div
                className="flex flex-col items-center gap-4 py-20 rounded-2xl text-center"
                style={{
                  background: "var(--color-bg-surface)",
                  border:     "1px solid var(--color-border-subtle)",
                }}
              >
                <Wrench className="w-12 h-12 opacity-30" style={{ color: "var(--color-text-muted)" }} />
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    No hay servicios para esta categoría
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                    Contáctanos, podemos ayudarte igualmente
                  </p>
                </div>
                <button
                  onClick={() => setCategoriaActiva("todos")}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--color-primary-light)",
                    color:      "var(--color-primary)",
                    border:     "none",
                  }}
                >
                  Ver todos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {serviciosFiltrados.map((s) => (
                  <ServiceCard
                    key={s.id}
                    servicio={s}
                    onSolicitar={() => setMostrarCotizacion(true)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── TAB: PRODUCTOS ─────────────────── */}
        {tabActivo === "productos" && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {searchQuery ? `Resultados para "${searchQuery}"` : "Accesorios y Refacciones"}
                </h2>
                {!loadingProductos && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {filteredProductos.length} de {productos.length} producto{productos.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-sm flex items-center gap-1"
                  style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer" }}
                >
                  <X className="w-3.5 h-3.5" /> Limpiar
                </button>
              )}
            </div>

            {/* Loading */}
            {loadingProductos && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            )}

            {/* Error */}
            {!loadingProductos && errorProductos && (
              <div
                className="flex flex-col items-center gap-4 py-20 rounded-2xl text-center"
                style={{
                  background: "var(--color-danger-bg)",
                  border:     "1px solid var(--color-danger)",
                }}
              >
                <p className="font-semibold" style={{ color: "var(--color-danger-text)" }}>
                  No se pudo cargar el catálogo
                </p>
                <button
                  onClick={fetchProductos}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--color-danger)",
                    color:      "white",
                    border:     "none",
                  }}
                >
                  <Loader2 className="w-4 h-4" /> Reintentar
                </button>
              </div>
            )}

            {/* Empty */}
            {!loadingProductos && !errorProductos && filteredProductos.length === 0 && (
              <div
                className="flex flex-col items-center gap-4 py-20 rounded-2xl text-center"
                style={{
                  background: "var(--color-bg-surface)",
                  border:     "1px solid var(--color-border-subtle)",
                }}
              >
                <Package className="w-12 h-12 opacity-30" style={{ color: "var(--color-text-muted)" }} />
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    No encontramos productos para &quot;{searchQuery}&quot;
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                    Prueba con otros términos o contáctanos directo
                  </p>
                </div>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--color-primary-light)",
                    color:      "var(--color-primary)",
                    border:     "none",
                  }}
                >
                  Ver todos los productos
                </button>
              </div>
            )}

            {/* Grid */}
            {!loadingProductos && !errorProductos && filteredProductos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProductos.map((p) => (
                  <ProductCard
                    key={p.id}
                    producto={p}
                    onAgregar={agregarProducto}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ═══════════════════════════════════════
          RESEÑAS
      ═══════════════════════════════════════ */}
      <section
        className="py-16"
        style={{ background: "var(--color-bg-surface)", borderTop: "1px solid var(--color-border-subtle)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Más de 12,450 reparaciones exitosas este año
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {RESENAS.map((r) => (
              <div
                key={r.nombre}
                className="rounded-2xl p-5"
                style={{
                  background: "var(--color-bg-base)",
                  border:     "1px solid var(--color-border-subtle)",
                }}
              >
                {/* Estrellas */}
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: r.calificacion }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" style={{ color: "var(--color-warning)" }} />
                  ))}
                </div>

                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  &quot;{r.texto}&quot;
                </p>

                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: "var(--color-primary-light)",
                      color:      "var(--color-primary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {r.iniciales}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {r.nombre}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {r.servicio}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TRUST SIGNALS — Marcas
      ═══════════════════════════════════════ */}
      <section
        className="py-12"
        style={{ background: "var(--color-bg-base)", borderTop: "1px solid var(--color-border-subtle)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: "var(--color-text-muted)" }}>
            Marcas que reparamos
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {["Apple", "Samsung", "Xiaomi", "Motorola", "Huawei", "OPPO", "Vivo", "OnePlus"].map((marca) => (
              <span
                key={marca}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--color-bg-surface)",
                  border:     "1px solid var(--color-border-subtle)",
                  color:      "var(--color-text-secondary)",
                  boxShadow:  "var(--shadow-xs)",
                }}
              >
                {marca}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA FINAL — WhatsApp
      ═══════════════════════════════════════ */}
      <section
        className="py-16 relative overflow-hidden"
        style={{ background: "var(--color-sidebar-bg)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,184,217,0.05) 1px, transparent 1px)",
            backgroundSize:  "28px 28px",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--color-sidebar-text-dim)" }}
          >
            ¿No encuentras tu modelo?
          </p>
          <h2
            className="text-3xl font-bold tracking-tight mb-3"
            style={{ color: "var(--color-text-inverted)" }}
          >
            Háblanos por WhatsApp
          </h2>
          <p
            className="text-base mb-8"
            style={{ color: "var(--color-sidebar-text)" }}
          >
            Nuestros técnicos te responden en minutos. Diagnóstico sin costo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391"}?text=${encodeURIComponent("Hola CREDIPHONE, necesito ayuda con la reparación de mi celular.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold"
              style={{
                background: "#25D366",
                color:      "white",
                boxShadow:  "0 4px 20px rgba(37,211,102,0.3)",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#1ebe5d"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "#25D366"}
            >
              <MessageCircle className="w-5 h-5" />
              Chatear ahora
            </a>

            <button
              onClick={() => setMostrarCotizacion(true)}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold"
              style={{
                background: "var(--color-sidebar-surface)",
                color:      "var(--color-text-inverted)",
                border:     "1px solid var(--color-sidebar-border)",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-sidebar-active)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-sidebar-border)"}
            >
              <FileText className="w-5 h-5" />
              Solicitar cotización
            </button>
          </div>
        </div>
      </section>

      <Footer />

      {/* Carrito flotante */}
      <CarritoFlotante />

      {/* Modal cotización */}
      {mostrarCotizacion && (
        <div
          onClick={() => setMostrarCotizacion(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(5,12,22,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <FormularioCotizacion onClose={() => setMostrarCotizacion(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
