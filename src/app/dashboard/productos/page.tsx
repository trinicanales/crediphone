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
  const [importRemisionOpen, setImportRemisionOpen] = useState(false);

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
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  // FASE 53b: incluir X-Distribuidor-Id para que super_admin reciba las categorías del distribuidor activo
  useEffect(() => {
    const headers: HeadersInit = {};
    if (distribuidorActivo?.id) {
      headers["X-Distribuidor-Id"] = distribuidorActivo.id;
    }
    fetch("/api/categorias", { headers }).then((r) => r.json()).then((d) => { if (d.success) setCategorias(d.data); }).catch(() => {});
    fetch("/api/proveedores", { headers }).then((r) => r.json()).then((d) => { if (d.success) setProveedores(d.data); }).catch(() => {});
  }, [distribuidorActivo?.id]);

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
    if (Number(formData.stock) < 0)                       e.stock   = "El stock no puede ser negativo";
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

      <div className="grid grid-cols-2 gap-3">
        <Input label="Marca *" name="marca" value={formData.marca} onChange={handleChange} error={errors.marca} placeholder="Samsung" required />
        <Input label="Modelo *" name="modelo" value={formData.modelo} onChange={handleChange} error={errors.modelo} placeholder="A17 128GB" required />
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

      <div className="grid grid-cols-2 gap-3">
        <Input label="Precio de Venta *" name="precio" type="number" step="0.01" value={formData.precio} onChange={handleChange} error={errors.precio} placeholder="2999.00" required />
        <Input label="Costo / Precio Compra" name="costo" type="number" step="0.01" value={formData.costo} onChange={handleChange} placeholder="2050.00" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Stock Actual *" name="stock" type="number" value={formData.stock} onChange={handleChange} error={errors.stock} placeholder="1" required />
        <Input label="Stock Mínimo" name="stockMinimo" type="number" value={formData.stockMinimo} onChange={handleChange} placeholder="3" />
      </div>

      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Código de Barras" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} placeholder="Escanea o ingresa el código" />
          </div>
          <div className="flex-1">
            <Input label="SKU / Referencia" name="sku" value={formData.sku} onChange={handleChange} placeholder="SKU-001" />
          </div>
          <button
            type="button"
            onClick={() => setShowScanner((v) => !v)}
            title="Escanear código de barras con cámara"
            className="mb-0.5 p-2 rounded-xl transition-colors"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--color-bg-elevated)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
            }}
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>

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
        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Requiere número de serie / IMEI al vender</span>
      </label>

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
