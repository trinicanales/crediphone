"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { obtenerUrlImagen } from "@/lib/storage";
import type { Producto } from "@/types";
import ImportRemisionModal from "@/components/productos/ImportRemisionModal";
import { BarcodeScanner } from "@/components/inventario/BarcodeScanner";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import {
  Package, PackageCheck, AlertTriangle, TrendingUp,
  Pencil, Trash2, Search, Plus, Upload, Smartphone, Tag, RefreshCw, QrCode,
  History, ShoppingCart, Wrench, Warehouse, ChevronRight,
} from "lucide-react";
import type { CSSProperties } from "react";

// ─── Tipos y constantes ────────────────────────────────────────────────────────

const TIPOS_PRODUCTO = [
  { value: "equipo_nuevo",     label: "Equipo Nuevo" },
  { value: "equipo_usado",     label: "Equipo Usado" },
  { value: "accesorio",        label: "Accesorio" },
  { value: "pieza_reparacion", label: "Refacción" },
  { value: "servicio",         label: "Servicio" },
] as const;

const TIPO_BADGE_STYLE: Record<string, CSSProperties> = {
  equipo_nuevo:     { background: "var(--color-info-bg)",    color: "var(--color-info-text)" },
  equipo_usado:     { background: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
  accesorio:        { background: "var(--color-accent-light)", color: "var(--color-accent)" },
  pieza_reparacion: { background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" },
  servicio:         { background: "var(--color-success-bg)", color: "var(--color-success-text)" },
};

const TIPOS_MAP = Object.fromEntries(TIPOS_PRODUCTO.map((t) => [t.value, t]));

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [productoToDelete, setProductoToDelete] = useState<Producto | null>(null);
  const [importRemisionOpen, setImportRemisionOpen]   = useState(false);
  const [imeiModalOpen, setImeiModalOpen]             = useState(false); // FASE 58

  useEffect(() => { fetchProductos(); }, []);

  useEffect(() => {
    let result = productos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.marca.toLowerCase().includes(q) ||
          p.modelo.toLowerCase().includes(q) ||
          (p.descripcion?.toLowerCase().includes(q))
      );
    }
    if (filtroTipo !== "todos") result = result.filter((p) => p.tipo === filtroTipo);
    setFilteredProductos(result);
  }, [searchQuery, filtroTipo, productos]);

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (data.success) { setProductos(data.data); setFilteredProductos(data.data); }
    } catch (err) {
      console.error("Error al cargar productos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => { setModalMode("create"); setSelectedProducto(null); setIsModalOpen(true); };
  const handleEdit = (p: Producto) => { setModalMode("edit"); setSelectedProducto(p); setIsModalOpen(true); };
  const handleModalClose = () => { setIsModalOpen(false); setSelectedProducto(null); };
  const handleSuccess = () => { fetchProductos(); handleModalClose(); };
  const handleDeleteClick = (p: Producto) => { setProductoToDelete(p); setDeleteConfirmModal(true); };

  const handleDeleteConfirm = async () => {
    if (!productoToDelete) return;
    try {
      const res = await fetch(`/api/productos/${productoToDelete.id}`, { method: "DELETE" });
      if (res.ok) { await fetchProductos(); setDeleteConfirmModal(false); setProductoToDelete(null); }
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  const total = productos.length;
  const enStock = productos.filter((p) => p.stock > 0).length;
  const stockBajoList = productos.filter((p) => p.stockMinimo !== undefined && p.stock <= p.stockMinimo && p.stock > 0);
  const valorInventario = productos.reduce((s, p) => s + Number(p.precio) * p.stock, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Inventario de Productos</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Gestiona equipos, accesorios y servicios
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="secondary" onClick={() => setImeiModalOpen(true)}>
            <History className="w-4 h-4 mr-2" />
            Historial IMEI
          </Button>
          <Button variant="secondary" onClick={() => setImportRemisionOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Remisión
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Total Productos"
          value={total}
          iconColor="var(--color-info)"
          iconBg="var(--color-info-bg)"
          valColor="var(--color-info)"
        />
        <StatCard
          icon={<PackageCheck className="w-5 h-5" />}
          label="En Stock"
          value={enStock}
          sub={`${total - enStock} sin stock`}
          iconColor="var(--color-success)"
          iconBg="var(--color-success-bg)"
          valColor="var(--color-success)"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Stock Bajo"
          value={stockBajoList.length}
          alert={stockBajoList.length > 0}
          iconColor={stockBajoList.length > 0 ? "var(--color-warning)" : "var(--color-text-muted)"}
          iconBg={stockBajoList.length > 0 ? "var(--color-warning-bg)" : "var(--color-bg-elevated)"}
          valColor={stockBajoList.length > 0 ? "var(--color-warning)" : "var(--color-text-muted)"}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Valor Inventario"
          value={fmt(valorInventario)}
          iconColor="var(--color-accent)"
          iconBg="var(--color-accent-light)"
          valColor="var(--color-accent)"
          isText
        />
      </div>

      {/* Toolbar / Filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="search"
            placeholder="Buscar por nombre, marca, modelo o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <Tag className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
          {[{ value: "todos", label: "Todos" }, ...TIPOS_PRODUCTO].map((t) => (
            <FilterBtn
              key={t.value}
              label={t.label}
              active={filtroTipo === t.value}
              count={t.value !== "todos" ? productos.filter((p) => p.tipo === t.value).length : undefined}
              onClick={() => setFiltroTipo(t.value)}
            />
          ))}
          <button
            onClick={fetchProductos}
            className="ml-auto p-1 rounded-lg transition-colors"
            title="Actualizar lista"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
              (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Cargando inventario...</p>
          </div>
        ) : filteredProductos.length === 0 ? (
          <EmptyState query={searchQuery} tipo={filtroTipo} onNew={handleCreate} onImport={() => setImportRemisionOpen(true)} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}>
                    {["Img", "Producto", "Tipo", "Precio / Costo", "Stock", "Acciones"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${
                          i === 0 ? "text-left w-16"
                          : i === 3 ? "text-right"
                          : i === 4 ? "text-center"
                          : i === 5 ? "text-right"
                          : "text-left"
                        }`}
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProductos.map((producto) => (
                    <ProductoRow
                      key={producto.id}
                      producto={producto}
                      fmt={fmt}
                      onEdit={() => handleEdit(producto)}
                      onDelete={() => handleDeleteClick(producto)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer de tabla */}
            <div
              className="px-4 py-3 flex items-center justify-between text-xs"
              style={{
                background: "var(--color-bg-elevated)",
                borderTop: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <span>
                Mostrando{" "}
                <strong style={{ color: "var(--color-text-secondary)" }}>{filteredProductos.length}</strong>
                {" "}de{" "}
                <strong style={{ color: "var(--color-text-secondary)" }}>{productos.length}</strong> productos
              </span>
              {filteredProductos.length !== productos.length && (
                <button
                  onClick={() => { setSearchQuery(""); setFiltroTipo("todos"); }}
                  style={{ color: "var(--color-accent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title={modalMode === "create" ? "Nuevo Producto" : "Editar Producto"} size="lg">
        <ProductoForm mode={modalMode} producto={selectedProducto} onSuccess={handleSuccess} onCancel={handleModalClose} />
      </Modal>

      <Modal isOpen={deleteConfirmModal} onClose={() => setDeleteConfirmModal(false)} title="Confirmar Eliminación">
        <div className="space-y-4">
          <p style={{ color: "var(--color-text-primary)" }}>
            ¿Eliminar <strong>{productoToDelete?.nombre}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteConfirmModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Eliminar</Button>
          </div>
        </div>
      </Modal>

      <ImportRemisionModal
        isOpen={importRemisionOpen}
        onClose={() => setImportRemisionOpen(false)}
        onImportado={() => { fetchProductos(); setImportRemisionOpen(false); }}
      />

      {/* FASE 58: Modal de Historial IMEI */}
      <HistorialImeiModal isOpen={imeiModalOpen} onClose={() => setImeiModalOpen(false)} />
    </div>
  );
}

// ─── Filter Button ─────────────────────────────────────────────────────────────

function FilterBtn({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="px-3 py-1 rounded-full text-xs font-medium transition-all"
      style={
        active
          ? { background: "var(--color-primary)", color: "var(--color-primary-text)" }
          : hovered
          ? { background: "var(--color-bg-sunken)", color: "var(--color-text-primary)" }
          : { background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }
      }
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
    </button>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, alert, isText, iconColor, iconBg, valColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
  isText?: boolean;
  iconColor: string;
  iconBg: string;
  valColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--color-bg-surface)",
        border: `1px solid ${alert ? "var(--color-warning)" : "var(--color-border-subtle)"}`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-xl" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        {alert && <span style={{ color: "var(--color-warning)" }}>⚠️</span>}
      </div>
      <div
        className={`mt-3 font-bold ${isText ? "text-lg" : "text-3xl"}`}
        style={{ color: valColor, fontFamily: "var(--font-data)" }}
      >
        {value}
      </div>
      <div className="text-xs font-medium mt-0.5" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{sub}</div>}
    </div>
  );
}

// ─── Producto Row ─────────────────────────────────────────────────────────────

function ProductoRow({ producto, fmt, onEdit, onDelete }: {
  producto: Producto; fmt: (n: number) => string; onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const bajo = producto.stockMinimo !== undefined && producto.stock <= producto.stockMinimo && producto.stock > 0;
  const agotado = producto.stock === 0;
  const margen = producto.costo && Number(producto.costo) > 0
    ? Math.round(((Number(producto.precio) - Number(producto.costo)) / Number(producto.precio)) * 100)
    : null;
  const tipo = TIPOS_MAP[producto.tipo || ""];

  let rowBg = "transparent";
  if (hovered) rowBg = "var(--color-bg-elevated)";
  else if (bajo) rowBg = "var(--color-warning-bg)";
  else if (agotado) rowBg = "var(--color-danger-bg)";

  return (
    <tr
      className="group transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: rowBg, borderBottom: "1px solid var(--color-border-subtle)" }}
    >
      {/* Imagen */}
      <td className="px-4 py-3">
        {producto.imagen ? (
          <img
            src={obtenerUrlImagen(producto.imagen) || ""}
            alt={producto.nombre}
            className="w-12 h-12 object-cover rounded-xl"
            style={{ border: "1px solid var(--color-border)" }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
          >
            <Smartphone className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
          </div>
        )}
      </td>

      {/* Nombre + detalles */}
      <td className="px-4 py-3 min-w-[200px]">
        <div className="font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>
          {producto.nombre}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {[producto.marca, producto.modelo].filter(Boolean).join(" · ")}
        </div>
        {producto.ubicacionFisica && (
          <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            📍 {producto.ubicacionFisica}
          </div>
        )}
        {producto.esSerializado && (
          <span
            className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)", border: "1px solid var(--color-border)" }}
          >
            IMEI/Serie
          </span>
        )}
      </td>

      {/* Tipo */}
      <td className="px-4 py-3 whitespace-nowrap">
        {tipo ? (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
            style={TIPO_BADGE_STYLE[producto.tipo || ""] || { background: "var(--color-bg-elevated)", color: "var(--color-text-muted)" }}
          >
            {tipo.label}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
        )}
      </td>

      {/* Precio / Costo / Margen */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="font-semibold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
          {fmt(Number(producto.precio))}
        </div>
        {producto.costo && Number(producto.costo) > 0 && (
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Costo: {fmt(Number(producto.costo))}
          </div>
        )}
        {margen !== null && (
          <div className="text-xs font-medium mt-0.5" style={{ color: margen >= 20 ? "var(--color-success)" : "var(--color-warning)" }}>
            Margen: {margen}%
          </div>
        )}
      </td>

      {/* Stock */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span
          className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg text-sm font-bold"
          style={
            agotado
              ? { background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }
              : bajo
              ? { background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }
              : { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
          }
        >
          {producto.stock}
        </span>
        {bajo && (
          <div className="text-[10px] font-medium mt-0.5" style={{ color: "var(--color-warning)" }}>
            mín {producto.stockMinimo}
          </div>
        )}
        {agotado && (
          <div className="text-[10px] font-medium mt-0.5" style={{ color: "var(--color-danger)" }}>
            Agotado
          </div>
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-colors"
            title="Editar"
            style={{ color: "var(--color-info)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-info-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg transition-colors"
            title="Eliminar"
            style={{ color: "var(--color-danger)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-danger-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ query, tipo, onNew, onImport }: {
  query: string; tipo: string; onNew: () => void; onImport: () => void;
}) {
  const filtered = query || tipo !== "todos";
  return (
    <div className="py-20 flex flex-col items-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--color-bg-elevated)" }}>
        <Package className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
          {filtered ? "Sin resultados" : "Sin productos"}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          {filtered
            ? "Prueba con otro filtro o búsqueda"
            : "Agrega tu primer producto o importa un ticket de remisión"}
        </p>
      </div>
      {!filtered && (
        <div className="flex gap-2 mt-2">
          <Button variant="secondary" onClick={onImport}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Remisión
          </Button>
          <Button onClick={onNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Formulario de Producto ────────────────────────────────────────────────────

interface ProductoFormProps {
  mode: "create" | "edit";
  producto: Producto | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function ProductoForm({ mode, producto, onSuccess, onCancel }: ProductoFormProps) {
  // FASE 53b: necesitamos el distribuidor activo para pasar el header a /api/categorias y /api/proveedores
  const { distribuidorActivo } = useDistribuidor();

  const [formData, setFormData] = useState({
    nombre:          producto?.nombre              || "",
    marca:           producto?.marca               || "",
    modelo:          producto?.modelo              || "",
    precio:          producto?.precio?.toString()  || "",
    costo:           producto?.costo?.toString()   || "",
    stock:           producto?.stock?.toString()   || "0",
    stockMinimo:     producto?.stockMinimo?.toString() || "0",
    imagen:          producto?.imagen              || "",
    descripcion:     producto?.descripcion         || "",
    tipo:            producto?.tipo                || "",
    categoriaId:     producto?.categoriaId         || "",
    subcategoriaId:  producto?.subcategoriaId      || "", // FASE 57
    proveedorId:     producto?.proveedorId         || "",
    esSerializado:   producto?.esSerializado       || false,
    ubicacionFisica: producto?.ubicacionFisica     || "",
    codigoBarras:    producto?.codigoBarras        || "",
    sku:             producto?.sku                 || "",
    // FASE 27: campos de equipo celular
    imei:            producto?.imei               || "",
    color:           producto?.color              || "",
    ram:             producto?.ram                || "",
    almacenamiento:  producto?.almacenamiento     || "",
  });
  const [loading, setLoading]       = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [categorias, setCategorias]       = useState<{ id: string; nombre: string }[]>([]);
  const [subcategorias, setSubcategorias] = useState<{ id: string; nombre: string }[]>([]); // FASE 57
  const [proveedores, setProveedores]     = useState<{ id: string; nombre: string }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  // FASE 54: sugerencias de marca y modelo para autocompletado
  const [sugerenciasMarcas, setSugerenciasMarcas]   = useState<string[]>([]);
  const [sugerenciasModelos, setSugerenciasModelos] = useState<string[]>([]);
  // FASE 56: soporte escáner USB/Bluetooth — estado de foco y confirmación visual
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [barcodeFocused, setBarcodeFocused] = useState(false);

  // FASE 53b: incluir X-Distribuidor-Id para que super_admin reciba las categorías del distribuidor activo
  useEffect(() => {
    const headers: HeadersInit = {};
    if (distribuidorActivo?.id) {
      headers["X-Distribuidor-Id"] = distribuidorActivo.id;
    }
    fetch("/api/categorias", { headers }).then((r) => r.json()).then((d) => { if (d.success) setCategorias(d.data); }).catch(() => {});
    fetch("/api/proveedores", { headers }).then((r) => r.json()).then((d) => { if (d.success) setProveedores(d.data); }).catch(() => {});
    // FASE 54: cargar marcas existentes al abrir el formulario
    fetch("/api/productos/sugerencias?campo=marcas", { headers })
      .then((r) => r.json())
      .then((d) => { if (d.success) setSugerenciasMarcas(d.data); })
      .catch(() => {});
  }, [distribuidorActivo?.id]);

  // FASE 54: cargar modelos cuando cambia la marca seleccionada
  useEffect(() => {
    if (!formData.marca.trim()) { setSugerenciasModelos([]); return; }
    const headers: HeadersInit = {};
    if (distribuidorActivo?.id) headers["X-Distribuidor-Id"] = distribuidorActivo.id;
    const marca = encodeURIComponent(formData.marca.trim());
    fetch(`/api/productos/sugerencias?campo=modelos&marca=${marca}`, { headers })
      .then((r) => r.json())
      .then((d) => { if (d.success) setSugerenciasModelos(d.data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.marca]);

  // FASE 57: cargar subcategorías cuando cambia la categoría seleccionada
  useEffect(() => {
    if (!formData.categoriaId) { setSubcategorias([]); setFormData((p) => ({ ...p, subcategoriaId: "" })); return; }
    const headers: HeadersInit = {};
    if (distribuidorActivo?.id) headers["X-Distribuidor-Id"] = distribuidorActivo.id;
    fetch(`/api/subcategorias?categoria_id=${formData.categoriaId}`, { headers })
      .then((r) => r.json())
      .then((d) => { if (d.success) setSubcategorias(d.data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.categoriaId]);

  // FASE 53d: auto-marcar esSerializado cuando el tipo es equipo celular
  useEffect(() => {
    const esEquipo = formData.tipo === "equipo_nuevo" || formData.tipo === "equipo_usado";
    if (esEquipo && !formData.esSerializado) {
      setFormData((prev) => ({ ...prev, esSerializado: true }));
    }
  // Solo reaccionar al cambio de tipo, no al valor de esSerializado (para no crear loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.tipo]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    const value = type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }, [errors]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.nombre.trim())                          e.nombre  = "El nombre es requerido";
    if (!formData.marca.trim())                           e.marca   = "La marca es requerida";
    if (!formData.modelo.trim())                          e.modelo  = "El modelo es requerido";
    if (!formData.precio || Number(formData.precio) <= 0) e.precio  = "El precio debe ser mayor a 0";
    // FASE 53d: los servicios no tienen stock físico, no validar
    if (formData.tipo !== "servicio" && Number(formData.stock) < 0) e.stock = "El stock no puede ser negativo";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/productos" : `/api/productos/${producto?.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          precio:          Number(formData.precio),
          costo:           formData.costo          ? Number(formData.costo)          : undefined,
          stock:           Number(formData.stock),
          stockMinimo:     formData.stockMinimo    ? Number(formData.stockMinimo)    : undefined,
          tipo:            formData.tipo            || undefined,
          categoriaId:     formData.categoriaId     || undefined,
          subcategoriaId:  formData.subcategoriaId  || undefined, // FASE 57
          proveedorId:     formData.proveedorId     || undefined,
          ubicacionFisica: formData.ubicacionFisica || undefined,
          codigoBarras:    formData.codigoBarras    || undefined,
          sku:             formData.sku             || undefined,
          // FASE 27: campos de equipo celular
          imei:            formData.imei            || undefined,
          color:           formData.color           || undefined,
          ram:             formData.ram             || undefined,
          almacenamiento:  formData.almacenamiento  || undefined,
        }),
      });
      if (res.ok) { onSuccess(); } else { const data = await res.json(); console.error("Error al guardar:", data); }
    } catch (err) {
      console.error("Error al guardar producto:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectStyle: CSSProperties = {
    background: "var(--color-bg-sunken)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
  };
  const labelStyle: CSSProperties = { color: "var(--color-text-secondary)" };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <Input label="Nombre del Producto *" name="nombre" value={formData.nombre} onChange={handleChange} error={errors.nombre} placeholder="Samsung Galaxy A17" required />

      {/* FASE 54: Autocompletado de marca y modelo desde productos existentes */}
      <datalist id="dl-marcas">
        {sugerenciasMarcas.map((m) => <option key={m} value={m} />)}
      </datalist>
      <datalist id="dl-modelos">
        {sugerenciasModelos.map((m) => <option key={m} value={m} />)}
      </datalist>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Marca *" name="marca" value={formData.marca} onChange={handleChange} error={errors.marca} placeholder="Samsung" required list="dl-marcas" autoComplete="off" />
        <Input label="Modelo *" name="modelo" value={formData.modelo} onChange={handleChange} error={errors.modelo} placeholder="A17 128GB" required list="dl-modelos" autoComplete="off" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={labelStyle}>Tipo</label>
          <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={selectStyle}>
            <option value="">— Sin tipo —</option>
            {TIPOS_PRODUCTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={labelStyle}>Categoría</label>
          <select name="categoriaId" value={formData.categoriaId} onChange={handleChange} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={selectStyle}>
            <option value="">— Sin categoría —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* FASE 57: Subcategoría — visible solo si la categoría tiene subcategorías cargadas */}
      {formData.categoriaId && subcategorias.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={labelStyle}>Subcategoría</label>
          <select name="subcategoriaId" value={formData.subcategoriaId} onChange={handleChange} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={selectStyle}>
            <option value="">— Sin subcategoría —</option>
            {subcategorias.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" style={labelStyle}>Proveedor</label>
        <select name="proveedorId" value={formData.proveedorId} onChange={handleChange} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={selectStyle}>
          <option value="">— Sin proveedor —</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* FASE 27: Campos exclusivos para equipos celulares */}
      {(formData.tipo === "equipo_nuevo" || formData.tipo === "equipo_usado") && (
        <div
          className="p-4 rounded-xl space-y-3"
          style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-info-text)" }}>
            Datos del Equipo Celular
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="IMEI"
              name="imei"
              value={formData.imei}
              onChange={handleChange}
              placeholder="123456789012345"
              maxLength={15}
            />
            <Input
              label="Color"
              name="color"
              value={formData.color}
              onChange={handleChange}
              placeholder="Negro, Azul, Verde..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="RAM"
              name="ram"
              value={formData.ram}
              onChange={handleChange}
              placeholder="4GB, 6GB, 8GB..."
            />
            <Input
              label="Almacenamiento"
              name="almacenamiento"
              value={formData.almacenamiento}
              onChange={handleChange}
              placeholder="64GB, 128GB, 256GB..."
            />
          </div>
        </div>
      )}

      {/* FASE 53c: Costo primero → Precio de Venta, con margen en tiempo real */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Costo / Precio Compra" name="costo" type="number" step="0.01" value={formData.costo} onChange={handleChange} placeholder="2050.00" />
          <Input label="Precio de Venta *" name="precio" type="number" step="0.01" value={formData.precio} onChange={handleChange} error={errors.precio} placeholder="2999.00" required />
        </div>
        {/* Indicador de margen en tiempo real */}
        {(() => {
          const costo  = parseFloat(formData.costo  || "0");
          const precio = parseFloat(formData.precio || "0");
          if (!costo || !precio) return null;
          const utilidad  = precio - costo;
          const margenPct = (utilidad / costo) * 100;
          const positivo  = utilidad >= 0;
          return (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: positivo ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                color:      positivo ? "var(--color-success-text)" : "var(--color-danger-text)",
                border:     `1px solid ${positivo ? "var(--color-success)" : "var(--color-danger)"}22`,
              }}
            >
              <span>{positivo ? "↑" : "↓"} Margen: {margenPct.toFixed(1)}%</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span>Utilidad: ${utilidad.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          );
        })()}
      </div>

      {/* FASE 53d: servicios no tienen inventario físico */}
      {formData.tipo === "servicio" ? (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
          style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)22" }}
        >
          <span>⚡</span>
          <span>Los servicios no tienen inventario físico — el stock se ignora al vender.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Stock Actual *" name="stock" type="number" value={formData.stock} onChange={handleChange} error={errors.stock} placeholder="1" required />
          <Input label="Stock Mínimo" name="stockMinimo" type="number" value={formData.stockMinimo} onChange={handleChange} placeholder="3" />
        </div>
      )}

      {/* FASE 55: Código de barras con generación automática + escaneo por cámara */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Código de Barras
          </label>
          <div className="flex items-center gap-2">
            <input
              name="codigoBarras"
              value={formData.codigoBarras}
              onChange={handleChange}
              placeholder={barcodeFocused ? "🔴 Listo — apunta el escáner aquí" : "Escanea, ingresa o genera el código"}
              autoComplete="off"
              onFocus={() => { setBarcodeFocused(true); setBarcodeScanned(false); }}
              onBlur={() => setBarcodeFocused(false)}
              onKeyDown={(e) => {
                // FASE 56: Enter desde escáner USB/Bluetooth — no submitear el form
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (formData.codigoBarras.trim()) {
                    setBarcodeScanned(true);
                    setBarcodeFocused(false);
                    // Auto-ocultar confirmación tras 2.5s
                    setTimeout(() => setBarcodeScanned(false), 2500);
                  }
                }
              }}
              className="flex-1 h-10 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
              style={{
                background: barcodeScanned ? "var(--color-success-bg)" : "var(--color-bg-sunken)",
                border: `1px solid ${barcodeScanned ? "var(--color-success)" : barcodeFocused ? "var(--color-accent)" : "var(--color-border)"}`,
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
                transition: "border-color 150ms ease, background 150ms ease",
              }}
            />
            {/* Botón Generar — visible solo si el campo está vacío */}
            {!formData.codigoBarras && (
              <button
                type="button"
                title="Generar código de barras interno"
                onClick={() => {
                  const now = new Date();
                  const fecha = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
                  const aleatorio = Math.random().toString(36).slice(2, 7).toUpperCase();
                  setFormData((prev) => ({ ...prev, codigoBarras: `CP-${fecha}-${aleatorio}` }));
                }}
                className="shrink-0 px-3 h-10 rounded-md text-xs font-semibold transition-colors"
                style={{
                  background: "var(--color-accent-light)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent)44",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent-light)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
              >
                Generar
              </button>
            )}
            {/* Botón Limpiar — visible solo si el campo tiene valor */}
            {formData.codigoBarras && (
              <button
                type="button"
                title="Borrar código"
                onClick={() => setFormData((prev) => ({ ...prev, codigoBarras: "" }))}
                className="shrink-0 px-2 h-10 rounded-md text-xs transition-colors"
                style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-danger)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-danger)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
              >
                ✕
              </button>
            )}
            {/* Botón abrir escáner de cámara */}
            <button
              type="button"
              onClick={() => setShowScanner((v) => !v)}
              title="Escanear código de barras con cámara"
              className="shrink-0 p-2 h-10 rounded-md transition-colors"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)"; }}
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
          {/* FASE 56: confirmación visual tras scan USB/Bluetooth */}
          {barcodeScanned && (
            <p className="mt-1 text-xs font-medium" style={{ color: "var(--color-success)" }}>
              ✓ Código capturado: {formData.codigoBarras}
            </p>
          )}
          {/* Ayuda: indica si el código fue generado automáticamente */}
          {!barcodeScanned && formData.codigoBarras?.startsWith("CP-") && (
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              ✦ Código interno generado — compatible con escáneres Code 128 / QR
            </p>
          )}
        </div>

        <Input label="SKU / Referencia" name="sku" value={formData.sku} onChange={handleChange} placeholder="SKU-001" />

        {showScanner && (
          <div className="p-4 rounded-xl" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-border)" }}>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--color-info-text)" }}>
              Escanear código de barras
            </p>
            <BarcodeScanner
              onScan={(codigo) => { setFormData((prev) => ({ ...prev, codigoBarras: codigo })); setShowScanner(false); }}
              lastScannedCode={formData.codigoBarras}
            />
          </div>
        )}
      </div>

      <Input label="Ubicación Física" name="ubicacionFisica" value={formData.ubicacionFisica} onChange={handleChange} placeholder="Estante A1 · Cajón 2" />
      <Input label="Descripción" name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Detalles adicionales del producto" />

      {/* FASE 53d: los servicios no requieren serialización */}
      {formData.tipo !== "servicio" && (
        <label className="flex items-center gap-3 cursor-pointer select-none py-1">
          <input
            type="checkbox"
            id="esSerializado"
            name="esSerializado"
            checked={formData.esSerializado}
            onChange={handleChange}
            className="w-4 h-4 rounded"
            style={{ accentColor: "var(--color-accent)" }}
          />
          <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Requiere número de serie / IMEI al vender
            {(formData.tipo === "equipo_nuevo" || formData.tipo === "equipo_usado") && (
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)" }}>
                Auto
              </span>
            )}
          </span>
        </label>
      )}

      <ImageUpload
        currentImage={formData.imagen}
        onImageUploaded={(path) => setFormData((p) => ({ ...p, imagen: path }))}
        onImageRemoved={() => setFormData((p) => ({ ...p, imagen: "" }))}
        categoria="productos"
        label="Imagen del Producto"
      />

      <div
        className="sticky bottom-0 -mx-6 px-6 py-4 mt-2 flex gap-3 justify-end"
        style={{
          background: "var(--color-bg-surface)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : mode === "create" ? "Crear Producto" : "Guardar Cambios"}
        </Button>
      </div>
    </form>
  );
}

// ─── Historial IMEI Modal (FASE 58) ────────────────────────────────────────────

interface EventoTimeline {
  tipo:        "inventario" | "venta" | "reparacion";
  fecha:       string;
  titulo:      string;
  descripcion: string;
  referencia?: string;
  enlace?:     string;
  monto?:      number;
  estado?:     string;
}

function HistorialImeiModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { distribuidorActivo } = useDistribuidor();
  const [imeiInput, setImeiInput]       = useState("");
  const [imeiSearch, setImeiSearch]     = useState("");
  const [eventos, setEventos]           = useState<EventoTimeline[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch]   = useState<string | null>(null);
  const [searched, setSearched]         = useState(false);
  const [scanFocused, setScanFocused]   = useState(false);
  const [scanned, setScanned]           = useState(false);

  // Reset al cerrar
  useEffect(() => {
    if (!isOpen) {
      setImeiInput("");
      setImeiSearch("");
      setEventos([]);
      setErrorSearch(null);
      setSearched(false);
      setScanned(false);
    }
  }, [isOpen]);

  const buscar = useCallback(async (imeiOverride?: string) => {
    const target = (imeiOverride ?? imeiInput).trim();
    if (!target || target.length < 6) return;

    setLoadingSearch(true);
    setErrorSearch(null);
    setSearched(false);

    try {
      const hdrs: Record<string, string> = {};
      if (distribuidorActivo?.id) hdrs["X-Distribuidor-Id"] = distribuidorActivo.id;

      const res  = await fetch(
        `/api/productos/historial-imei?imei=${encodeURIComponent(target)}`,
        { headers: hdrs }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Error al buscar");

      setEventos(json.data ?? []);
      setImeiSearch(target);
      setSearched(true);
    } catch (e) {
      setErrorSearch(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoadingSearch(false);
    }
  }, [imeiInput, distribuidorActivo]);

  const EVENTO_CFG = {
    inventario: { Icon: Warehouse,    color: "var(--color-info-text)",    bg: "var(--color-info-bg)",    label: "Inventario" },
    venta:      { Icon: ShoppingCart, color: "var(--color-success-text)", bg: "var(--color-success-bg)", label: "Venta"      },
    reparacion: { Icon: Wrench,       color: "var(--color-warning-text)", bg: "var(--color-warning-bg)", label: "Reparación" },
  } as const;

  function fmtFecha(f: string) {
    return new Date(f).toLocaleString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Historial de IMEI / Serie" size="lg">
      <div className="space-y-5">

        {/* ── Campo de búsqueda ── */}
        <div>
          <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: "0.375rem" }}>
            IMEI / Número de Serie
          </label>
          <div className="flex gap-2">
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value)}
                onFocus={() => setScanFocused(true)}
                onBlur={() => setScanFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (imeiInput.trim().length >= 6) {
                      setScanned(true);
                      setScanFocused(false);
                      setTimeout(() => setScanned(false), 2200);
                      buscar(imeiInput.trim());
                    }
                  }
                }}
                placeholder={scanFocused ? "🔴 Listo — apunta el escáner aquí" : "Ej: 356938035643809"}
                style={{
                  width: "100%",
                  padding: "0.5625rem 0.875rem",
                  background: scanned ? "var(--color-success-bg)" : "var(--color-bg-sunken)",
                  border: `1.5px solid ${scanFocused ? "var(--color-accent)" : scanned ? "var(--color-success)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.08em",
                  fontSize: "0.875rem",
                  outline: "none",
                  boxShadow: scanFocused ? "0 0 0 3px rgba(0,153,184,0.15)" : "none",
                  transition: "border 150ms ease, background 150ms ease, box-shadow 150ms ease",
                }}
              />
              {scanned && (
                <span style={{
                  position: "absolute", right: "0.75rem", top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-success)", fontSize: "0.75rem", fontWeight: 600,
                }}>
                  ✓ Capturado
                </span>
              )}
            </div>
            <Button
              onClick={() => buscar()}
              disabled={loadingSearch || imeiInput.trim().length < 6}
            >
              {loadingSearch
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
            </Button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>
            Compatible con escáner USB/Bluetooth — Enter busca automáticamente
          </p>
        </div>

        {/* ── Skeleton de carga ── */}
        {loadingSearch && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-bg-elevated)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: "35%", background: "var(--color-bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 11, width: "65%", background: "var(--color-bg-elevated)", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {errorSearch && !loadingSearch && (
          <div style={{
            padding: "0.875rem 1rem",
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-danger-text)",
            fontSize: "0.875rem",
          }}>
            ⚠️ {errorSearch}
          </div>
        )}

        {/* ── Empty ── */}
        {searched && !loadingSearch && !errorSearch && eventos.length === 0 && (
          <div style={{
            textAlign: "center", padding: "2.5rem 1rem",
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
          }}>
            <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
            <p style={{ fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>
              Sin historial para este IMEI
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
              {imeiSearch}
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
              No aparece en inventario, ventas ni reparaciones
            </p>
          </div>
        )}

        {/* ── Timeline ── */}
        {searched && !loadingSearch && !errorSearch && eventos.length > 0 && (
          <div>
            {/* Header de resultados */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "1.25rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.125rem" }}>
                  Trazabilidad del equipo
                </p>
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.9375rem",
                  fontWeight: 700, color: "var(--color-text-primary)",
                  letterSpacing: "0.08em",
                }}>
                  {imeiSearch}
                </p>
              </div>
              <span style={{
                padding: "0.25rem 0.875rem",
                background: "var(--color-accent-light)",
                color: "var(--color-accent)",
                borderRadius: "var(--radius-full)",
                fontSize: "0.75rem", fontWeight: 700,
              }}>
                {eventos.length} evento{eventos.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Línea de tiempo */}
            <div style={{ position: "relative" }}>
              {/* Línea vertical */}
              <div style={{
                position: "absolute",
                left: 17, top: 18,
                bottom: 18,
                width: 2,
                background: "var(--color-border-subtle)",
              }} />

              <div className="space-y-4">
                {eventos.map((ev, idx) => {
                  const cfg = EVENTO_CFG[ev.tipo] ?? EVENTO_CFG.inventario;
                  const { Icon } = cfg;
                  return (
                    <div key={idx} style={{ display: "flex", gap: "0.75rem", position: "relative" }}>
                      {/* Círculo con ícono */}
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: cfg.bg,
                        border: `2px solid ${cfg.color}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, position: "relative", zIndex: 1,
                      }}>
                        <Icon style={{ width: 16, height: 16, color: cfg.color }} />
                      </div>

                      {/* Tarjeta de evento */}
                      <div style={{
                        flex: 1,
                        background: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "0.75rem 1rem",
                        boxShadow: "var(--shadow-xs)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Título + badge tipo */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
                                {ev.titulo}
                              </span>
                              <span style={{
                                padding: "0.1rem 0.5rem",
                                background: cfg.bg, color: cfg.color,
                                borderRadius: "var(--radius-full)",
                                fontSize: "0.6875rem", fontWeight: 600,
                              }}>
                                {cfg.label}
                              </span>
                            </div>
                            {/* Descripción */}
                            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "0.375rem", lineHeight: 1.4 }}>
                              {ev.descripcion}
                            </p>
                            {/* Meta: fecha, ref, estado */}
                            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                                {fmtFecha(ev.fecha)}
                              </span>
                              {ev.referencia && (
                                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                                  Ref: {ev.referencia}
                                </span>
                              )}
                              {ev.estado && (
                                <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                                  [{ev.estado}]
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Monto + enlace */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem", flexShrink: 0 }}>
                            {ev.monto != null && (
                              <span style={{
                                fontFamily: "var(--font-data)",
                                fontSize: "0.9375rem",
                                fontWeight: 700,
                                color: ev.tipo === "venta" ? "var(--color-success)" : "var(--color-text-primary)",
                              }}>
                                ${Number(ev.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                            {ev.enlace && (
                              <a
                                href={ev.enlace}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--color-accent)",
                                  display: "flex", alignItems: "center", gap: "0.25rem",
                                  textDecoration: "none",
                                }}
                              >
                                Ver detalle
                                <ChevronRight style={{ width: 12, height: 12 }} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
