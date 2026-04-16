"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { obtenerUrlImagen } from "@/lib/storage";
import type { Producto } from "@/types";
import ImportRemisionModal from "@/components/productos/ImportRemisionModal";
import { BarcodeScanner } from "@/components/inventario/BarcodeScanner";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { useAuth } from "@/components/AuthProvider";
import { QRCodeSVG } from "qrcode.react";
import {
  Package, PackageCheck, AlertTriangle, TrendingUp,
  Pencil, Trash2, Search, Plus, Upload, Smartphone, Tag, RefreshCw, QrCode,
  History, ShoppingCart, Wrench, Warehouse, ChevronRight,
  Printer, Minus as MinusIcon, Plus as PlusIcon, CheckSquare, Square, CheckCircle, Zap,
} from "lucide-react";
import type { CSSProperties } from "react";
import { inferirCategoria, generarSKU, MARCAS_CELULARES, getNombresModelosPorMarca, getCapacidadesPorModelo } from "@/lib/catalog/celulares";

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
  const { user } = useAuth();
  // admin y super_admin pueden crear productos; vendedores solo editan (por defecto)
  const canCrearProducto = user?.role === "admin" || user?.role === "super_admin";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStock, setFiltroStock] = useState<"todos" | "en_stock" | "bajo" | "agotado">("todos");
  const [sortStock, setSortStock] = useState<"none" | "asc" | "desc">("none");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [productoToDelete, setProductoToDelete] = useState<Producto | null>(null);
  const [importRemisionOpen, setImportRemisionOpen]   = useState(false);
  const [imeiModalOpen, setImeiModalOpen]             = useState(false); // FASE 58
  const [etiquetaProducto, setEtiquetaProducto]       = useState<Producto | null>(null); // FASE 60
  const [seleccionados, setSeleccionados]             = useState<Set<string>>(new Set());
  const [etiquetasMasivasOpen, setEtiquetasMasivasOpen] = useState(false);
  const [imprimirTodasOpen, setImprimirTodasOpen]     = useState(false);

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
    if (filtroTipo === "__sin_tipo__") {
      result = result.filter((p) => !p.tipo);
    } else if (filtroTipo !== "todos") {
      result = result.filter((p) => p.tipo === filtroTipo);
    }
    if (filtroStock === "en_stock") {
      result = result.filter((p) => p.stock > 0 && !(p.stockMinimo !== undefined && p.stock <= p.stockMinimo));
    } else if (filtroStock === "bajo") {
      result = result.filter((p) => p.stockMinimo !== undefined && p.stock <= p.stockMinimo && p.stock > 0);
    } else if (filtroStock === "agotado") {
      result = result.filter((p) => p.stock === 0);
    }
    if (sortStock === "asc") {
      result = [...result].sort((a, b) => a.stock - b.stock);
    } else if (sortStock === "desc") {
      result = [...result].sort((a, b) => b.stock - a.stock);
    }
    setFilteredProductos(result);
  }, [searchQuery, filtroTipo, filtroStock, sortStock, productos]);

  const fetchProductos = async (): Promise<Producto[]> => {
    try {
      setLoading(true);
      const res = await fetch("/api/productos");
      const data = await res.json();
      if (data.success) { setProductos(data.data); setFilteredProductos(data.data); return data.data; }
    } catch (err) {
      console.error("Error al cargar productos:", err);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const handleCreate = () => { setModalMode("create"); setSelectedProducto(null); setIsModalOpen(true); };
  const handleEdit = (p: Producto) => { setModalMode("edit"); setSelectedProducto(p); setIsModalOpen(true); };
  const handleModalClose = () => { setIsModalOpen(false); setSelectedProducto(null); };
  const handleSuccess = async () => {
    const prevIds = new Set(productos.map((p) => p.id));
    const nuevaLista = await fetchProductos();
    handleModalClose();
    // Al crear producto nuevo → abrir modal etiqueta automáticamente
    if (modalMode === "create") {
      const nuevo = nuevaLista.find((p) => !prevIds.has(p.id));
      if (nuevo) setEtiquetaProducto(nuevo);
    }
  };
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
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          <Button variant="secondary" onClick={() => setImeiModalOpen(true)}>
            <History className="w-4 h-4 mr-2" />
            Historial IMEI
          </Button>
          <Button variant="secondary" onClick={() => setImportRemisionOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Remisión
          </Button>
          {filteredProductos.length > 0 && (
            <Button variant="secondary" onClick={() => setImprimirTodasOpen(true)}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir todas ({filteredProductos.length})
            </Button>
          )}
          {canCrearProducto && (
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          )}
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
          active={filtroStock === "todos"}
          onClick={() => setFiltroStock("todos")}
        />
        <StatCard
          icon={<PackageCheck className="w-5 h-5" />}
          label="En Stock"
          value={enStock}
          sub={`${total - enStock} sin stock`}
          iconColor="var(--color-success)"
          iconBg="var(--color-success-bg)"
          valColor="var(--color-success)"
          active={filtroStock === "en_stock"}
          onClick={() => setFiltroStock(filtroStock === "en_stock" ? "todos" : "en_stock")}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Stock Bajo"
          value={stockBajoList.length}
          alert={stockBajoList.length > 0 && filtroStock !== "bajo"}
          iconColor={stockBajoList.length > 0 ? "var(--color-warning)" : "var(--color-text-muted)"}
          iconBg={stockBajoList.length > 0 ? "var(--color-warning-bg)" : "var(--color-bg-elevated)"}
          valColor={stockBajoList.length > 0 ? "var(--color-warning)" : "var(--color-text-muted)"}
          active={filtroStock === "bajo"}
          onClick={() => setFiltroStock(filtroStock === "bajo" ? "todos" : "bajo")}
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
          {/* I8: pill para productos legacy sin tipo asignado */}
          {productos.some((p) => !p.tipo) && (
            <FilterBtn
              label="Sin tipo"
              active={filtroTipo === "__sin_tipo__"}
              count={productos.filter((p) => !p.tipo).length}
              onClick={() => setFiltroTipo(filtroTipo === "__sin_tipo__" ? "todos" : "__sin_tipo__")}
            />
          )}
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

        {/* Filtro por nivel de stock */}
        <div className="flex gap-2 flex-wrap items-center">
          <Warehouse className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
          {([
            { value: "todos",    label: "Todo el stock",  count: productos.length },
            { value: "en_stock", label: "En stock",       count: productos.filter((p) => p.stock > 0 && !(p.stockMinimo !== undefined && p.stock <= p.stockMinimo)).length },
            { value: "bajo",     label: "Stock bajo",     count: productos.filter((p) => p.stockMinimo !== undefined && p.stock <= p.stockMinimo && p.stock > 0).length },
            { value: "agotado",  label: "Agotado",        count: productos.filter((p) => p.stock === 0).length },
          ] as { value: "todos" | "en_stock" | "bajo" | "agotado"; label: string; count: number }[]).map((s) => (
            <FilterBtn
              key={s.value}
              label={s.label}
              active={filtroStock === s.value}
              count={s.value !== "todos" ? s.count : undefined}
              onClick={() => setFiltroStock(s.value)}
            />
          ))}
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
          <EmptyState query={searchQuery} tipo={filtroTipo} stock={filtroStock} onNew={canCrearProducto ? handleCreate : undefined} onImport={() => setImportRemisionOpen(true)} onClearStock={() => setFiltroStock("todos")} />
        ) : (
          <>
            {/* Banner de filtro activo */}
            {filtroStock !== "todos" && (
              <div
                className="flex items-center justify-between px-4 py-2.5 text-sm font-medium"
                style={{
                  background: filtroStock === "agotado" ? "var(--color-danger-bg)"
                    : filtroStock === "bajo" ? "var(--color-warning-bg)"
                    : "var(--color-success-bg)",
                  borderBottom: `1px solid ${
                    filtroStock === "agotado" ? "var(--color-danger)"
                    : filtroStock === "bajo" ? "var(--color-warning)"
                    : "var(--color-success)"
                  }`,
                  color: filtroStock === "agotado" ? "var(--color-danger-text)"
                    : filtroStock === "bajo" ? "var(--color-warning-text)"
                    : "var(--color-success-text)",
                }}
              >
                <span>
                  {filtroStock === "bajo" && `⚠ Mostrando ${filteredProductos.length} producto${filteredProductos.length !== 1 ? "s" : ""} con stock bajo — revisa y haz pedido si es necesario`}
                  {filtroStock === "agotado" && `🔴 Mostrando ${filteredProductos.length} producto${filteredProductos.length !== 1 ? "s" : ""} agotados — requieren reabastecimiento`}
                  {filtroStock === "en_stock" && `✓ Mostrando ${filteredProductos.length} producto${filteredProductos.length !== 1 ? "s" : ""} con stock disponible`}
                </span>
                <button
                  onClick={() => setFiltroStock("todos")}
                  className="text-xs px-2 py-0.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
                  style={{
                    background: filtroStock === "agotado" ? "var(--color-danger)" : filtroStock === "bajo" ? "var(--color-warning)" : "var(--color-success)",
                    color: "#fff",
                  }}
                >
                  ✕ Limpiar filtro
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}>
                    {[
                      { label: "Img",          align: "left",   w: "w-16",   sortable: false },
                      { label: "Producto",     align: "left",   w: "",       sortable: false },
                      { label: "Tipo",         align: "left",   w: "",       sortable: false },
                      { label: "Precio / Costo", align: "right", w: "",      sortable: false },
                      { label: "Stock",        align: "center", w: "",       sortable: true  },
                      { label: "Acciones",     align: "right",  w: "",       sortable: false },
                    ].map(({ label, align, w, sortable }) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-${align} ${w}`}
                        style={{
                          color: "var(--color-text-muted)",
                          cursor: sortable ? "pointer" : "default",
                          userSelect: sortable ? "none" : undefined,
                        }}
                        onClick={sortable ? () => setSortStock((s) => s === "asc" ? "desc" : "asc") : undefined}
                        title={sortable ? (sortStock === "asc" ? "Ordenar mayor a menor" : "Ordenar menor a mayor") : undefined}
                      >
                        {label}
                        {sortable && (
                          <span className="ml-1 inline-flex flex-col leading-none" style={{ verticalAlign: "middle" }}>
                            <span style={{ opacity: sortStock === "asc" ? 1 : 0.3, fontSize: "8px", lineHeight: 1 }}>▲</span>
                            <span style={{ opacity: sortStock === "desc" ? 1 : 0.3, fontSize: "8px", lineHeight: 1 }}>▼</span>
                          </span>
                        )}
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
                      onPrint={() => setEtiquetaProducto(producto)}
                      seleccionado={seleccionados.has(producto.id)}
                      onToggleSeleccion={() => {
                        setSeleccionados((prev) => {
                          const next = new Set(prev);
                          if (next.has(producto.id)) next.delete(producto.id);
                          else next.add(producto.id);
                          return next;
                        });
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer de tabla */}
            <div
              className="px-4 py-3 flex items-center justify-between text-xs gap-3 flex-wrap"
              style={{
                background: "var(--color-bg-elevated)",
                borderTop: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span>
                  Mostrando{" "}
                  <strong style={{ color: "var(--color-text-secondary)" }}>{filteredProductos.length}</strong>
                  {" "}de{" "}
                  <strong style={{ color: "var(--color-text-secondary)" }}>{productos.length}</strong> productos
                </span>
                {/* Seleccionar todos visibles */}
                <button
                  onClick={() => {
                    if (seleccionados.size === filteredProductos.length) {
                      setSeleccionados(new Set());
                    } else {
                      setSeleccionados(new Set(filteredProductos.map((p) => p.id)));
                    }
                  }}
                  className="flex items-center gap-1 font-medium"
                  style={{ color: "var(--color-accent)" }}
                >
                  {seleccionados.size === filteredProductos.length && filteredProductos.length > 0
                    ? <><CheckSquare className="w-3.5 h-3.5" /> Deseleccionar todos</>
                    : <><Square className="w-3.5 h-3.5" /> Seleccionar todos</>
                  }
                </button>
              </div>

              <div className="flex items-center gap-2">
                {seleccionados.size > 0 && (
                  <button
                    onClick={() => setEtiquetasMasivasOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{
                      background: "var(--color-primary)",
                      color: "#fff",
                      fontSize: "0.75rem",
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir etiquetas ({seleccionados.size})
                  </button>
                )}
                {filteredProductos.length !== productos.length && (
                  <button
                    onClick={() => { setSearchQuery(""); setFiltroTipo("todos"); setFiltroStock("todos"); }}
                    style={{ color: "var(--color-accent)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title={modalMode === "create" ? "Nuevo Producto" : "Editar Producto"} size="lg">
        <ProductoForm mode={modalMode} producto={selectedProducto} onSuccess={handleSuccess} onCancel={handleModalClose} productosExistentes={productos} />
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

      {/* FASE 60: Modal de Etiqueta Imprimible */}
      <EtiquetaModal producto={etiquetaProducto} onClose={() => setEtiquetaProducto(null)} />

      {/* FASE 63+: Modal etiquetas masivas — seleccionados */}
      <EtiquetasMasivasModal
        isOpen={etiquetasMasivasOpen}
        productos={filteredProductos.filter((p) => seleccionados.has(p.id))}
        onClose={() => setEtiquetasMasivasOpen(false)}
      />

      {/* Modal etiquetas masivas — todos los productos visibles */}
      <EtiquetasMasivasModal
        isOpen={imprimirTodasOpen}
        productos={filteredProductos}
        onClose={() => setImprimirTodasOpen(false)}
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
  icon, label, value, sub, alert, isText, iconColor, iconBg, valColor, onClick, active,
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
  onClick?: () => void;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isClickable = !!onClick;
  return (
    <div
      className="rounded-2xl p-4"
      onClick={onClick}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => isClickable && setHovered(false)}
      style={{
        background: "var(--color-bg-surface)",
        border: active
          ? "2px solid var(--color-accent)"
          : alert
          ? `1px solid var(--color-warning)`
          : "1px solid var(--color-border-subtle)",
        boxShadow: hovered ? "var(--shadow-md)" : "var(--shadow-sm)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "all 200ms var(--ease-spring)",
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-xl" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <div className="flex items-center gap-1">
          {alert && <AlertTriangle size={14} style={{ color: "var(--color-warning)" }} />}
          {active && isClickable && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}>
              Activo
            </span>
          )}
        </div>
      </div>
      <div
        className={`mt-3 font-bold ${isText ? "text-lg" : "text-3xl"}`}
        style={{ color: valColor, fontFamily: "var(--font-data)" }}
      >
        {value}
      </div>
      <div className="text-xs font-medium mt-0.5" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{sub}</div>}
      {isClickable && !active && (
        <div className="text-xs mt-1" style={{ color: "var(--color-accent)", opacity: 0.7 }}>
          Clic para filtrar
        </div>
      )}
    </div>
  );
}

// ─── Producto Row ─────────────────────────────────────────────────────────────

function ProductoRow({ producto, fmt, onEdit, onDelete, onPrint, seleccionado, onToggleSeleccion }: {
  producto: Producto; fmt: (n: number) => string; onEdit: () => void; onDelete: () => void; onPrint: () => void;
  seleccionado?: boolean; onToggleSeleccion?: () => void;
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
      {/* Checkbox de selección */}
      <td className="pl-3 pr-1 py-3 w-8">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSeleccion?.(); }}
          className="flex items-center justify-center"
          title={seleccionado ? "Deseleccionar" : "Seleccionar para imprimir etiqueta"}
        >
          {seleccionado
            ? <CheckSquare className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            : <Square className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
          }
        </button>
      </td>
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
        {/* Indicador de código asignado o sin código */}
        {(producto.codigoBarras || producto.sku) ? (
          <div className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--color-text-muted)" }}>
            {producto.codigoBarras || producto.sku}
          </div>
        ) : (
          <span
            className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
            title="Sin código de barras — se generará automáticamente al imprimir etiqueta"
          >
            sin código
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
        <div className="inline-flex flex-col items-center gap-1">
          <span
            className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg text-sm font-bold"
            style={
              agotado
                ? { background: "var(--color-danger-bg)", color: "var(--color-danger-text)", border: "1px solid var(--color-danger)" }
                : bajo
                ? { background: "var(--color-warning-bg)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning)" }
                : { background: "var(--color-success-bg)", color: "var(--color-success-text)", border: "1px solid var(--color-success)" }
            }
          >
            {agotado && <span className="mr-1 text-xs">!</span>}
            {producto.stock}
          </span>
          {/* Mini barra de nivel de stock */}
          {producto.stockMinimo !== undefined && producto.stockMinimo > 0 && (
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-elevated)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((producto.stock / (producto.stockMinimo * 3)) * 100))}%`,
                  background: agotado ? "var(--color-danger)" : bajo ? "var(--color-warning)" : "var(--color-success)",
                }}
              />
            </div>
          )}
          {bajo && (
            <div className="text-[10px] font-medium" style={{ color: "var(--color-warning)" }}>
              mín {producto.stockMinimo}
            </div>
          )}
          {agotado && (
            <div className="text-[10px] font-semibold" style={{ color: "var(--color-danger)" }}>
              AGOTADO
            </div>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onPrint}
            className="p-1.5 rounded-lg transition-colors"
            title="Imprimir etiqueta"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Printer className="w-4 h-4" />
          </button>
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

function EmptyState({ query, tipo, stock, onNew, onImport, onClearStock }: {
  query: string; tipo: string; stock: string; onNew?: () => void; onImport: () => void; onClearStock: () => void;
}) {
  const stockFiltered = stock !== "todos";
  const anyFiltered = query || tipo !== "todos" || stockFiltered;
  const stockLabel = stock === "bajo" ? "stock bajo" : stock === "agotado" ? "productos agotados" : stock === "en_stock" ? "productos en stock" : "";

  return (
    <div className="py-20 flex flex-col items-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--color-bg-elevated)" }}>
        <Package className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
          {stockFiltered && !query
            ? `No hay ${stockLabel}`
            : anyFiltered ? "Sin resultados" : "Sin productos"}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          {stockFiltered && !query
            ? `Ningún producto coincide con el filtro de ${stockLabel}.`
            : anyFiltered
            ? "Prueba con otro filtro o búsqueda"
            : "Agrega tu primer producto o importa un ticket de remisión"}
        </p>
      </div>
      {stockFiltered && (
        <Button variant="secondary" onClick={onClearStock}>
          Ver todos los productos
        </Button>
      )}
      {!anyFiltered && (
        <div className="flex gap-2 mt-2">
          <Button variant="secondary" onClick={onImport}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Remisión
          </Button>
          {onNew && (
            <Button onClick={onNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          )}
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
  /** FASE 66: productos existentes para autocompletar nombre */
  productosExistentes?: Producto[];
}

function ProductoForm({ mode, producto, onSuccess, onCancel, productosExistentes = [] }: ProductoFormProps) {
  // FASE 53b: necesitamos el distribuidor activo para pasar el header a /api/categorias y /api/proveedores
  const { distribuidorActivo } = useDistribuidor();

  const [formData, setFormData] = useState({
    nombre:          producto?.nombre              || "",
    marca:           producto?.marca               || "",
    modelo:          producto?.modelo              || "",
    precio:          producto?.precio?.toString()  || "",
    costo:           producto?.costo?.toString()   || "",
    stock:           producto?.stock?.toString()   || "0",
    stockMinimo:     producto?.stockMinimo?.toString() || "5",
    imagen:          producto?.imagen              || "",
    descripcion:     producto?.descripcion         || "",
    tipo:            producto?.tipo                || "",
    categoriaId:     producto?.categoriaId         || "",
    subcategoriaId:  producto?.subcategoriaId      || "", // FASE 57
    proveedorId:     producto?.proveedorId         || "",
    esSerializado:   producto?.esSerializado       || false,
    ubicacionFisica: producto?.ubicacionFisica     || "",
    ubicacionId:     producto?.ubicacionId         || "",
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [categorias, setCategorias]       = useState<{ id: string; nombre: string }[]>([]);
  const [subcategorias, setSubcategorias] = useState<{ id: string; nombre: string }[]>([]); // FASE 57
  const [proveedores, setProveedores]     = useState<{ id: string; nombre: string }[]>([]);
  const [ubicaciones, setUbicaciones]     = useState<{ id: string; nombre: string; codigo: string }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  // FASE 54: sugerencias de marca y modelo para autocompletado
  const [sugerenciasMarcas, setSugerenciasMarcas]   = useState<string[]>([]);
  const [sugerenciasModelos, setSugerenciasModelos] = useState<string[]>([]);
  // FASE 56: soporte escáner USB/Bluetooth — estado de foco y confirmación visual
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [barcodeFocused, setBarcodeFocused] = useState(false);
  // FASE 65: capacidades del catálogo para celulares
  const [capacidadesCatalogo, setCapacidadesCatalogo] = useState<string[]>([]);
  // FASE 66: autocompletar nombre desde productos existentes
  const [nombreSugs, setNombreSugs]           = useState<Producto[]>([]);
  const [showNombreSugs, setShowNombreSugs]   = useState(false);
  const [nombreSugIdx, setNombreSugIdx]       = useState(-1);
  const nombreRef = useRef<HTMLDivElement>(null);

  // FASE 53b: incluir X-Distribuidor-Id para que super_admin reciba las categorías del distribuidor activo
  useEffect(() => {
    const headers: HeadersInit = {};
    if (distribuidorActivo?.id) {
      headers["X-Distribuidor-Id"] = distribuidorActivo.id;
    }
    fetch("/api/categorias", { headers }).then((r) => r.json()).then((d) => { if (d.success) setCategorias(d.data); }).catch(() => {});
    fetch("/api/proveedores", { headers }).then((r) => r.json()).then((d) => { if (d.success) setProveedores(d.data); }).catch(() => {});
    // Cargar ubicaciones físicas de almacén — mismo header que categorías y proveedores
    fetch("/api/inventario/ubicaciones", { headers }).then((r) => r.json()).then((d) => { if (d.success) setUbicaciones(d.data ?? []); }).catch(() => {});
    // FASE 54: cargar marcas existentes + mezclar con catálogo estático (FASE 65)
    setSugerenciasMarcas(MARCAS_CELULARES); // precarga inmediata desde catálogo
    fetch("/api/productos/sugerencias?campo=marcas", { headers })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const merged = Array.from(new Set([...MARCAS_CELULARES, ...d.data])).sort();
          setSugerenciasMarcas(merged);
        }
      })
      .catch(() => {});
  }, [distribuidorActivo?.id]);

  // FASE 54 + FASE 65: cargar modelos cuando cambia la marca — mezcla DB + catálogo estático
  useEffect(() => {
    if (!formData.marca.trim()) { setSugerenciasModelos([]); setCapacidadesCatalogo([]); return; }
    // Precarga inmediata desde catálogo estático
    const catalogModelos = getNombresModelosPorMarca(formData.marca);
    setSugerenciasModelos(catalogModelos);
    const headers: HeadersInit = {};
    if (distribuidorActivo?.id) headers["X-Distribuidor-Id"] = distribuidorActivo.id;
    const marca = encodeURIComponent(formData.marca.trim());
    fetch(`/api/productos/sugerencias?campo=modelos&marca=${marca}`, { headers })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const merged = Array.from(new Set([...catalogModelos, ...d.data])).sort();
          setSugerenciasModelos(merged);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.marca]);

  // FASE 65: capacidades del catálogo cuando cambia marca+modelo
  useEffect(() => {
    if (!formData.marca || !formData.modelo) { setCapacidadesCatalogo([]); return; }
    const caps = getCapacidadesPorModelo(formData.marca, formData.modelo);
    setCapacidadesCatalogo(caps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.marca, formData.modelo]);

  // FASE 65: auto-sugerencia de categoría desde el nombre del producto (solo en modo crear)
  useEffect(() => {
    if (mode !== "create" || !formData.nombre.trim() || !categorias.length) return;
    const sugerida = inferirCategoria(formData.nombre);
    if (!sugerida) return;
    const cat = categorias.find((c) =>
      c.nombre.toLowerCase().includes(sugerida.toLowerCase()) ||
      sugerida.toLowerCase().includes(c.nombre.toLowerCase())
    );
    if (cat) {
      setFormData((prev) => ({ ...prev, categoriaId: prev.categoriaId || cat.id }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nombre, categorias]);

  // FASE 66: filtrar sugerencias de nombre desde productos existentes
  useEffect(() => {
    const term = formData.nombre.trim().toLowerCase();
    if (!term || term.length < 2 || productosExistentes.length === 0) {
      setNombreSugs([]);
      setShowNombreSugs(false);
      return;
    }
    const found = productosExistentes.filter((p) =>
      p.nombre.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term) ||
      p.modelo.toLowerCase().includes(term)
    ).slice(0, 8);
    setNombreSugs(found);
    setShowNombreSugs(found.length > 0);
    setNombreSugIdx(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nombre]);

  // FASE 66: cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (nombreRef.current && !nombreRef.current.contains(e.target as Node)) {
        setShowNombreSugs(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // FASE 66: pre-llenar formulario desde producto existente seleccionado
  const handleNombreSugSelect = (p: Producto) => {
    setFormData((prev) => ({
      ...prev,
      nombre:         p.nombre,
      marca:          p.marca,
      modelo:         p.modelo,
      precio:         p.precio?.toString() || prev.precio,
      costo:          p.costo?.toString()  || prev.costo,
      tipo:           p.tipo               || prev.tipo,
      categoriaId:    p.categoriaId        || prev.categoriaId,
      proveedorId:    p.proveedorId        || prev.proveedorId,
      descripcion:    p.descripcion        || prev.descripcion,
      imagen:         p.imagen             || prev.imagen,
      esSerializado:  p.esSerializado      ?? prev.esSerializado,
      color:          p.color              || prev.color,
      ram:            p.ram                || prev.ram,
      almacenamiento: p.almacenamiento     || prev.almacenamiento,
      ubicacionFisica: p.ubicacionFisica   || prev.ubicacionFisica,
      // stock y codigoBarras/sku/imei se limpian para ingreso nuevo
      stock:          "1",
      codigoBarras:   "",
      sku:            "",
      imei:           "",
    }));
    setShowNombreSugs(false);
  };

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

  // Handler especial para el selector de ubicación: guarda tanto el nombre (ubicacionFisica)
  // como el id (ubicacionId) para mantener la relación estructurada con ubicaciones_inventario.
  const handleUbicacionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const nombre = e.target.value;
    const ub = ubicaciones.find((u) => u.nombre === nombre);
    setFormData((prev) => ({
      ...prev,
      ubicacionFisica: nombre,
      ubicacionId:     ub?.id || "",
    }));
  }, [ubicaciones]);

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
    setSubmitError(null);
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
          stockMinimo:     formData.stockMinimo !== "" ? Number(formData.stockMinimo)  : undefined,
          tipo:            formData.tipo            || undefined,
          categoriaId:     formData.categoriaId     || undefined,
          subcategoriaId:  formData.subcategoriaId  || undefined, // FASE 57
          proveedorId:     formData.proveedorId     || undefined,
          ubicacionFisica: formData.ubicacionFisica || undefined,
          ubicacionId:     formData.ubicacionId     || undefined,
          codigoBarras:    formData.codigoBarras    || undefined,
          sku:             formData.sku             || undefined,
          // FASE 27: campos de equipo celular
          imei:            formData.imei            || undefined,
          color:           formData.color           || undefined,
          ram:             formData.ram             || undefined,
          almacenamiento:  formData.almacenamiento  || undefined,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        const mensaje = res.status === 403
          ? "No tienes permiso para realizar esta acción. Contacta al administrador."
          : res.status === 401
          ? "Tu sesión expiró. Recarga la página e inicia sesión de nuevo."
          : (data?.message || data?.error || `Error al guardar el producto (código ${res.status})`);
        setSubmitError(mensaje);
        console.error("Error al guardar producto:", res.status, data);
      }
    } catch (err) {
      setSubmitError("Error de conexión. Verifica tu internet e intenta de nuevo.");
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

  // FASE 66: teclado en el campo nombre para navegar sugerencias
  const handleNombreKeyDown = (e: React.KeyboardEvent) => {
    if (!showNombreSugs || nombreSugs.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setNombreSugIdx((i) => (i < nombreSugs.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setNombreSugIdx((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === "Enter" && nombreSugIdx >= 0) {
      e.preventDefault();
      handleNombreSugSelect(nombreSugs[nombreSugIdx]);
    } else if (e.key === "Escape") {
      setShowNombreSugs(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* FASE 66: Campo nombre con dropdown de autocompletar desde productos existentes */}
      <div ref={nombreRef} className="relative">
        <Input
          label="Nombre del Producto *"
          name="nombre"
          value={formData.nombre}
          onChange={(e) => { handleChange(e); }}
          onKeyDown={handleNombreKeyDown}
          onFocus={() => { if (nombreSugs.length > 0) setShowNombreSugs(true); }}
          error={errors.nombre}
          placeholder="Samsung Galaxy A17 128GB"
          required
          autoComplete="off"
        />
        {showNombreSugs && nombreSugs.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-lg)",
              maxHeight: "280px",
              overflowY: "auto",
            }}
          >
            <p
              className="px-3 py-1.5 text-xs font-semibold tracking-wide uppercase"
              style={{
                color: "var(--color-text-muted)",
                borderBottom: "1px solid var(--color-border-subtle)",
                background: "var(--color-bg-elevated)",
              }}
            >
              Basar en producto existente
            </p>
            {nombreSugs.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleNombreSugSelect(p); }}
                className="w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors"
                style={{
                  background: idx === nombreSugIdx ? "var(--color-accent-light)" : "transparent",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
                onMouseEnter={() => setNombreSugIdx(idx)}
                onMouseLeave={() => setNombreSugIdx(-1)}
              >
                {/* Miniatura */}
                {p.imagen ? (
                  <img
                    src={obtenerUrlImagen(p.imagen) || ""}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover shrink-0"
                    style={{ border: "1px solid var(--color-border-subtle)" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ background: "var(--color-accent-light)" }}
                  >
                    <Smartphone className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                    {p.nombre}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    {p.marca} {p.modelo}
                    {p.color && <span className="ml-1">· {p.color}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                    ${Number(p.precio).toFixed(2)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>×{p.stock}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
          <select name="categoriaId" value={formData.categoriaId} onChange={handleChange} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={selectStyle} disabled={categorias.length === 0 && !distribuidorActivo}>
            <option value="">— Sin categoría —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Aviso para super_admin en Vista Global sin distribuidor activo */}
      {!distribuidorActivo && categorias.length === 0 && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)", color: "var(--color-warning-text)" }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
          <span>
            Estás en <strong>Vista Global</strong>. Para ver categorías y proveedores, selecciona un distribuidor desde el selector del sidebar.
          </span>
        </div>
      )}

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
        <select name="proveedorId" value={formData.proveedorId} onChange={handleChange} className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none" style={selectStyle} disabled={proveedores.length === 0 && !distribuidorActivo}>
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
          {/* FASE 65: Chips de capacidad desde catálogo */}
          {capacidadesCatalogo.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-info-text)" }}>
                Capacidades del catálogo — selecciona una:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {capacidadesCatalogo.map((cap) => {
                  const [ram, alm] = cap.split("/");
                  const activo = formData.ram === ram && formData.almacenamiento === alm;
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, ram: ram || "", almacenamiento: alm || "" }))}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: activo ? "var(--color-info)" : "var(--color-bg-surface)",
                        color: activo ? "#fff" : "var(--color-info-text)",
                        border: `1px solid var(--color-info)${activo ? "" : "66"}`,
                      }}
                    >
                      {cap}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          <Zap size={14} />
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
              placeholder={barcodeFocused ? "● Listo — apunta el escáner aquí" : "Escanea, ingresa o genera el código"}
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

        {/* FASE 65: SKU con botón Auto-SKU */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
            SKU / Referencia
          </label>
          <div className="flex items-center gap-2">
            <input
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              placeholder="SKU-001"
              autoComplete="off"
              className="flex-1 h-10 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
              style={{
                background: "var(--color-bg-sunken)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            />
            {!formData.sku && (
              <button
                type="button"
                title="Generar SKU automático"
                onClick={() => setFormData((prev) => ({ ...prev, sku: generarSKU(prev.marca, prev.modelo) }))}
                className="shrink-0 px-3 h-10 rounded-md text-xs font-semibold transition-colors"
                style={{
                  background: "var(--color-accent-light)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent)44",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-accent-light)"; (e.currentTarget as HTMLElement).style.color = "var(--color-accent)"; }}
              >
                Auto-SKU
              </button>
            )}
            {formData.sku && (
              <button
                type="button"
                title="Borrar SKU"
                onClick={() => setFormData((prev) => ({ ...prev, sku: "" }))}
                className="shrink-0 px-2 h-10 rounded-md text-xs transition-colors"
                style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-danger)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-danger)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
              >✕</button>
            )}
          </div>
        </div>

        {showScanner && (
          <div className="p-4 rounded-xl" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-border)" }}>
            <p className="text-sm font-medium mb-3" style={{ color: "var(--color-info-text)" }}>
              Escanear código de barras
            </p>
            <BarcodeScanner
              onScan={(codigo) => {
                setFormData((prev) => ({ ...prev, codigoBarras: codigo }));
                setShowScanner(false);
                setBarcodeScanned(true);
                setTimeout(() => setBarcodeScanned(false), 2500);
              }}
              lastScannedCode={formData.codigoBarras}
            />
          </div>
        )}
      </div>

      {/* Selector de ubicación física: jala de inventario_ubicaciones */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
          Ubicación Física
        </label>
        {ubicaciones.length > 0 ? (
          <select
            name="ubicacionFisica"
            value={formData.ubicacionFisica}
            onChange={handleUbicacionChange}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: formData.ubicacionFisica ? "var(--color-text-primary)" : "var(--color-text-muted)",
              outline: "none",
            }}
          >
            <option value="">— Sin ubicación —</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.codigo} · {u.nombre}
              </option>
            ))}
          </select>
        ) : (
          // Fallback: no hay ubicaciones configuradas → input de texto libre
          <input
            type="text"
            name="ubicacionFisica"
            value={formData.ubicacionFisica}
            onChange={handleChange}
            placeholder="Ej: Estante A1 · Cajón 2 (configura ubicaciones en Inventario)"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--color-bg-sunken)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        )}
      </div>
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
        onImageUploaded={(_path, url) => setFormData((p) => ({ ...p, imagen: url }))}
        onImageRemoved={() => setFormData((p) => ({ ...p, imagen: "" }))}
        categoria="productos"
        label="Imagen del Producto"
      />

      {submitError && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            background: "var(--color-danger-bg)",
            color: "var(--color-danger-text)",
            border: "1px solid var(--color-danger)",
          }}
        >
          ⚠️ {submitError}
        </div>
      )}

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

// ─── Etiqueta Imprimible (FASE 60) ─────────────────────────────────────────────

type TamanoEtiqueta = "50x30" | "70x40" | "100x50";

const TAMANOS: { id: TamanoEtiqueta; label: string; width: number; height: number }[] = [
  { id: "50x30",  label: "50 × 30 mm",  width: 188, height: 113 },
  { id: "70x40",  label: "70 × 40 mm",  width: 264, height: 151 },
  { id: "100x50", label: "100 × 50 mm", width: 378, height: 189 },
];

/**
 * Genera un SVG de código de barras CODE128B sin dependencias externas.
 * Devuelve el elemento SVG como string (para usar en impresión) y como JSX.
 */
function Code128SVG({ value, width = 180, height = 32, showText = true }: { value: string; width?: number; height?: number; showText?: boolean }) {
  // Tabla CODE128B: caracteres ASCII 32-127
  const TABLE: Record<string, number> = {
    " ":64,"!":65,"\"":66,"#":67,"$":68,"%":69,"&":70,"'":71,"(":72,")":73,
    "*":74,"+":75,",":76,"-":77,".":78,"/":79,"0":80,"1":81,"2":82,"3":83,
    "4":84,"5":85,"6":86,"7":87,"8":88,"9":89,":":90,";":91,"<":92,"=":93,
    ">":94,"?":95,"@":96,"A":97,"B":98,"C":99,"D":100,"E":101,"F":102,"G":103,
    "H":104,"I":105,"J":106,"K":107,"L":108,"M":109,"N":110,"O":111,"P":112,
    "Q":113,"R":114,"S":115,"T":116,"U":117,"V":118,"W":119,"X":120,"Y":121,
    "Z":122,"[":123,"\\":124,"]":125,"^":126,"_":127,"`":64,"a":65,"b":66,
    "c":67,"d":68,"e":69,"f":70,"g":71,"h":72,"i":73,"j":74,"k":75,"l":76,
    "m":77,"n":78,"o":79,"p":80,"q":81,"r":82,"s":83,"t":84,"u":85,"v":86,
    "w":87,"x":88,"y":89,"z":90,"{":91,"|":92,"}":93,"~":94,
  };
  // Patrones de barras para valores 0-105 (11 bits por carácter)
  const PATTERNS = [
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100",
    "11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000",
    "10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110",
    "10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000",
    "11101000110","11100010110","11101101000","11101100010","11100011010",
    "11101111010","11001000010","11110001010","10100110000","10100001100",
    "10010110000","10010000110","10000101100","10000100110","10110010000",
    "10110000100","10011010000","10011000010","10000110100","10000110010",
    "11000010010","11001010000","11110111010","11000010100","10001111010",
    "10100111100","10010111100","10010011110","10111100100","10011110100",
    "10011110010","11110100100","11110010100","11110010010","11011011110",
    "11011110110","11110110110","10101111000","10100011110","10001011110",
    "10111101000","10111100010","11110101000","11110100010","10111011110",
    "10111101110","11101011110","11110101110","11010000100","11010010000",
    "11010011100","1100011101011",
  ];
  const START_B = 104;
  const STOP = 106;
  const QUIET = "0000000000"; // 10 quiet bars

  // Limpiar: solo caracteres CODE128B soportados (32-126)
  const safe = value.replace(/[^\x20-\x7E]/g, "").slice(0, 40);

  // Calcular checksum
  let checksum = START_B;
  for (let i = 0; i < safe.length; i++) {
    const code = TABLE[safe[i]];
    if (code !== undefined) checksum += code * (i + 1);
  }
  checksum = checksum % 103;

  // Construir patrón de barras
  let bits = QUIET + PATTERNS[START_B];
  for (const ch of safe) {
    const code = TABLE[ch];
    if (code !== undefined && PATTERNS[code]) {
      bits += PATTERNS[code];
    }
  }
  if (PATTERNS[checksum]) bits += PATTERNS[checksum];
  bits += PATTERNS[STOP] + QUIET;

  // Renderizar barras como rectángulos SVG
  const moduleWidth = width / bits.length;
  const rects: React.ReactNode[] = [];
  let x = 0;
  let i = 0;
  while (i < bits.length) {
    const bit = bits[i];
    let count = 1;
    while (i + count < bits.length && bits[i + count] === bit) count++;
    if (bit === "1") {
      rects.push(<rect key={`${i}`} x={x * moduleWidth} y={0} width={count * moduleWidth} height={showText ? height - 10 : height} fill="#000" />);
    }
    x += count;
    i += count;
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {rects}
      {showText && (
        <text x={width / 2} y={height} textAnchor="middle" fontSize={7} fontFamily="'Courier New', monospace" fill="#333" letterSpacing="0.5">
          {safe}
        </text>
      )}
    </svg>
  );
}

function EtiquetaModal({
  producto: productoInicial,
  onClose,
}: {
  producto: Producto | null;
  onClose: () => void;
}) {
  const [tamano, setTamano]     = useState<TamanoEtiqueta>("70x40");
  const [cantidad, setCantidad] = useState(1);
  const [mostrarPrecio, setMostrarPrecio]  = useState(true);
  const [mostrarIMEI, setMostrarIMEI]      = useState(false);
  const [mostrarBarras, setMostrarBarras]  = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  // Estado local para el código — se actualiza si se auto-genera
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);

  // Al abrir el modal: si el producto no tiene código, generar uno automáticamente
  useEffect(() => {
    setCodigoGenerado(null);
    if (!productoInicial) return;
    const tieneCodigo = productoInicial.codigoBarras?.trim() || productoInicial.sku?.trim();
    if (tieneCodigo) return; // ya tiene código, nada que hacer

    setGenerandoCodigo(true);
    fetch(`/api/productos/${productoInicial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generar_codigo" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.codigo) {
          setCodigoGenerado(data.codigo);
        }
      })
      .catch(console.error)
      .finally(() => setGenerandoCodigo(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoInicial?.id]);

  const cfg = TAMANOS.find((t) => t.id === tamano) ?? TAMANOS[1];

  function imprimir() {
    const contenido = printRef.current?.innerHTML ?? "";
    const ventana = window.open("", "_blank", "width=800,height=600");
    if (!ventana) return;
    ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta — ${producto?.nombre ?? ""}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; }
            @media print {
              @page { margin: 4mm; size: ${cfg.id === "50x30" ? "50mm 30mm" : cfg.id === "70x40" ? "70mm 40mm" : "100mm 50mm"}; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            .etiqueta-grid { display: flex; flex-wrap: wrap; gap: 3mm; }
            .etiqueta {
              width: ${cfg.id === "50x30" ? "50mm" : cfg.id === "70x40" ? "70mm" : "100mm"};
              height: ${cfg.id === "50x30" ? "30mm" : cfg.id === "70x40" ? "40mm" : "50mm"};
              border: 1.5pt solid #333;
              border-radius: 2mm;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: row;
              gap: 1.5mm;
              align-items: stretch;
              overflow: hidden;
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .col-left { flex: 1; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; min-width: 0; }
            .col-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .nombre { font-size: ${cfg.id === "50x30" ? "5pt" : cfg.id === "70x40" ? "6pt" : "8pt"}; font-weight: 700; line-height: 1.3; }
            .marca-modelo { font-size: 3.5pt; color: #666; margin-top: 0.3mm; }
            .precio { font-size: ${cfg.id === "50x30" ? "9pt" : cfg.id === "70x40" ? "12pt" : "16pt"}; font-weight: 900; letter-spacing: -0.5pt; color: #0d1e35; line-height: 1; }
            .qr-wrap svg { display: block; }
            .codigo-text { font-size: 3pt; font-family: 'Courier New', monospace; color: #666; margin-top: 0.3mm; text-align: center; overflow: hidden; white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="etiqueta-grid">${contenido}</div>
          <script>window.onload = () => { window.print(); }<\/script>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  // Usar productoInicial con el código generado superpuesto si aplica
  const producto = productoInicial;
  if (!producto) return null;

  const nombre       = producto.nombre ?? "";
  const marcaModelo  = [producto.marca, producto.modelo].filter(Boolean).join(" · ");
  const precio       = Number(producto.precio ?? 0);
  // Orden de prioridad: código guardado → código recién generado → SKU → (nunca el ID)
  const codigo       = producto.codigoBarras?.trim() || codigoGenerado || producto.sku?.trim() || "";
  const imei         = producto.imei;

  // Etiqueta individual (se repite cantidad veces)
  // Layout en dos columnas: izquierda = barcode+nombre+precio / derecha = QR a altura completa
  // El QR ocupa toda la altura de la etiqueta → más grande y escaneable
  const etiquetaStyle: CSSProperties = {
    width: cfg.width,
    height: cfg.height,
    border: "1.5px solid #333",
    borderRadius: 6,
    padding: "6px 8px",
    display: "flex",
    flexDirection: "row",
    gap: 6,
    alignItems: "stretch",
    background: "#fff",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    overflow: "hidden",
    flexShrink: 0,
    boxSizing: "border-box",
  };

  const nombreSize   = cfg.id === "50x30" ? "0.5rem"   : cfg.id === "70x40" ? "0.625rem" : "0.8125rem";
  const marcaSize    = cfg.id === "50x30" ? "0.375rem"  : cfg.id === "70x40" ? "0.45rem"  : "0.575rem";
  const precioSize   = cfg.id === "50x30" ? "1rem"      : cfg.id === "70x40" ? "1.5rem"   : "2rem";
  // QR ocupa la altura interna de la etiqueta (altura - padding vertical)
  const qrSize       = cfg.id === "50x30" ? cfg.height - 16 : cfg.id === "70x40" ? cfg.height - 18 : cfg.height - 20;
  // Ancho del barcode = ancho total - qrSize - padding - gap
  const barcodeW     = cfg.id === "70x40" ? cfg.width - qrSize - 28 : cfg.width - qrSize - 28;
  const barcodeH     = cfg.id === "70x40" ? 30 : 38;

  const EtiquetaEl = () => (
    <div style={etiquetaStyle}>
      {/* ── Columna izquierda: barcode → nombre → precio ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", minWidth: 0 }}>
        {/* Barcode arriba (solo 70x40 y 100x50) */}
        {mostrarBarras && cfg.id !== "50x30" && (
          <div style={{ overflow: "hidden" }}>
            <Code128SVG value={codigo} width={barcodeW} height={barcodeH} showText={false} />
          </div>
        )}
        {/* Nombre y marca en el medio */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ fontSize: nombreSize, fontWeight: 700, lineHeight: 1.3, color: "#111", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {nombre}
          </div>
          {marcaModelo && (
            <div style={{ fontSize: marcaSize, color: "#666", marginTop: 1 }}>
              {marcaModelo}
            </div>
          )}
          {mostrarIMEI && imei && (
            <div style={{ fontSize: marcaSize, color: "#888", fontFamily: "monospace", marginTop: 1 }}>
              {imei}
            </div>
          )}
        </div>
        {/* Precio abajo */}
        {mostrarPrecio && (
          <div style={{ fontSize: precioSize, fontWeight: 900, color: "#0d1e35", lineHeight: 1, letterSpacing: "-0.5px" }}>
            ${precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {/* ── Columna derecha: QR a altura completa ── */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <QRCodeSVG value={codigo} size={qrSize} level="M" />
        <div style={{ fontSize: "0.3rem", fontFamily: "monospace", color: "#777", marginTop: 1, maxWidth: qrSize, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {codigo.length > 12 ? codigo.slice(0, 12) + "…" : codigo}
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={!!producto} onClose={onClose} title="Imprimir Etiqueta" size="lg">
      <div className="space-y-5">

        {/* Banner: generando / código generado */}
        {generandoCodigo && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-info-bg)", color: "var(--color-info-text)" }}
          >
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            Generando código único para este producto…
          </div>
        )}
        {!generandoCodigo && codigoGenerado && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success-text)" }}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            Código generado y guardado: <strong style={{ fontFamily: "var(--font-mono)" }}>{codigoGenerado}</strong>
            <span className="ml-1 opacity-70">— ya escaneable en POS e inventario</span>
          </div>
        )}
        {!generandoCodigo && !codigoGenerado && !producto.codigoBarras && !producto.sku && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Este producto no tiene código de barras. Edítalo para agregarlo manualmente.
          </div>
        )}

        {/* Opciones */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {/* Tamaño */}
          <div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
              Tamaño de etiqueta
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {TAMANOS.map((t) => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="tamano"
                    checked={tamano === t.id}
                    onChange={() => setTamano(t.id)}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  <span style={{ fontSize: "0.875rem", color: "var(--color-text-primary)" }}>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Opciones de contenido */}
          <div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
              Contenido
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={mostrarPrecio} onChange={(e) => setMostrarPrecio(e.target.checked)} style={{ accentColor: "var(--color-accent)" }} />
                <span style={{ fontSize: "0.875rem", color: "var(--color-text-primary)" }}>Mostrar precio</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={mostrarBarras} onChange={(e) => setMostrarBarras(e.target.checked)} style={{ accentColor: "var(--color-accent)" }} disabled={cfg.id === "50x30"} />
                <span style={{ fontSize: "0.875rem", color: cfg.id === "50x30" ? "var(--color-text-muted)" : "var(--color-text-primary)" }}>
                  Código de barras CODE128
                  {cfg.id === "50x30" && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: 4 }}>(sólo 70×40 y 100×50)</span>}
                </span>
              </label>
              {imei && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={mostrarIMEI} onChange={(e) => setMostrarIMEI(e.target.checked)} style={{ accentColor: "var(--color-accent)" }} />
                  <span style={{ fontSize: "0.875rem", color: "var(--color-text-primary)" }}>Mostrar IMEI</span>
                </label>
              )}
            </div>

            {/* Cantidad */}
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginTop: "1rem", marginBottom: "0.5rem" }}>
              Copias
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                style={{
                  width: 32, height: 32, borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--color-text-primary)",
                }}
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: "1.125rem", minWidth: 32, textAlign: "center", color: "var(--color-text-primary)" }}>
                {cantidad}
              </span>
              <button
                onClick={() => setCantidad((c) => Math.min(50, c + 1))}
                style={{
                  width: 32, height: 32, borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--color-text-primary)",
                }}
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
            Vista previa
          </p>
          <div style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 120,
          }}>
            <EtiquetaEl />
          </div>
        </div>

        {/* Contenido oculto para imprimir (se pasa como HTML string) */}
        <div ref={printRef} style={{ display: "none" }}>
          {Array.from({ length: cantidad }).map((_, i) => (
            <div key={i} className="etiqueta" style={{
              width: cfg.id === "50x30" ? "50mm" : cfg.id === "70x40" ? "70mm" : "100mm",
              height: cfg.id === "50x30" ? "30mm" : cfg.id === "70x40" ? "40mm" : "50mm",
              border: "1.5pt solid #333",
              borderRadius: "2mm",
              padding: "1.5mm 2mm",
              display: "flex",
              flexDirection: "row",
              gap: "1.5mm",
              alignItems: "stretch",
              overflow: "hidden",
              pageBreakInside: "avoid",
              background: "#fff",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              boxSizing: "border-box",
            }}>
              {/* Columna izquierda: barcode → nombre → precio */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", minWidth: 0 }}>
                {mostrarBarras && cfg.id !== "50x30" && (
                  <div>
                    <Code128SVG value={codigo} width={cfg.id === "70x40" ? 130 : 200} height={cfg.id === "70x40" ? 28 : 36} showText={false} />
                  </div>
                )}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: cfg.id === "50x30" ? "5pt" : cfg.id === "70x40" ? "6pt" : "8pt", fontWeight: 700, lineHeight: 1.3 }}>
                    {nombre}
                  </div>
                  {marcaModelo && <div style={{ fontSize: "3.5pt", color: "#666", marginTop: "0.3mm" }}>{marcaModelo}</div>}
                  {mostrarIMEI && imei && <div style={{ fontSize: "3.5pt", color: "#888", fontFamily: "monospace" }}>{imei}</div>}
                </div>
                {mostrarPrecio && (
                  <div style={{ fontSize: cfg.id === "50x30" ? "9pt" : cfg.id === "70x40" ? "12pt" : "16pt", fontWeight: 900, color: "#0d1e35", letterSpacing: "-0.5pt", lineHeight: 1 }}>
                    ${precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              {/* Columna derecha: QR a altura completa */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <QRCodeSVG value={codigo} size={cfg.id === "50x30" ? 68 : cfg.id === "70x40" ? 96 : 130} level="M" />
                <div style={{ fontSize: "3pt", fontFamily: "monospace", color: "#666", marginTop: "0.3mm", textAlign: "center", maxWidth: cfg.id === "50x30" ? "18mm" : cfg.id === "70x40" ? "25mm" : "34mm", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {codigo}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--color-border-subtle)" }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={imprimir}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir {cantidad > 1 ? `${cantidad} copias` : ""}
          </Button>
        </div>
      </div>
    </Modal>
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
                placeholder={scanFocused ? "● Listo — apunta el escáner aquí" : "Ej: 356938035643809"}
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
            <span className="flex items-center gap-1.5"><AlertTriangle size={14} />{errorSearch}</span>
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

// ─── Modal Etiquetas Masivas (carta) ──────────────────────────────────────────

/**
 * Calcula cuántas etiquetas de tamaño `mmW x mmH` caben en carta (216×279mm)
 * con márgenes de 8mm y gap de 3mm entre etiquetas.
 */
function calcularGridCarta(mmW: number, mmH: number) {
  const pageW = 206; // 216 - 2*5mm margen carta
  const pageH = 269; // 279 - 2*5mm margen carta
  const gap = 3;
  const cols = Math.floor((pageW + gap) / (mmW + gap));
  const rows = Math.floor((pageH + gap) / (mmH + gap));
  return { cols: Math.max(cols, 1), rows: Math.max(rows, 1), porPagina: Math.max(cols, 1) * Math.max(rows, 1) };
}

const MM_SIZES: Record<TamanoEtiqueta, { w: number; h: number }> = {
  "50x30":  { w: 50,  h: 30  },
  "70x40":  { w: 70,  h: 40  },
  "100x50": { w: 100, h: 50  },
};

function EtiquetasMasivasModal({
  isOpen,
  productos,
  onClose,
}: {
  isOpen: boolean;
  productos: Producto[];
  onClose: () => void;
}) {
  const [tamano, setTamano]               = useState<TamanoEtiqueta>("70x40");
  const [mostrarPrecio, setMostrarPrecio] = useState(true);
  const [mostrarBarras, setMostrarBarras] = useState(true);
  const [copiasPorProducto, setCopias]    = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || productos.length === 0) return null;

  const mm  = MM_SIZES[tamano];
  const cfg = TAMANOS.find((t) => t.id === tamano) ?? TAMANOS[1];
  const { cols, porPagina } = calcularGridCarta(mm.w, mm.h);

  // Etiquetas expandidas (copias por producto)
  const etiquetas: Producto[] = [];
  for (const p of productos) {
    for (let i = 0; i < copiasPorProducto; i++) etiquetas.push(p);
  }
  const totalEtiquetas = etiquetas.length;
  const totalPaginas   = Math.ceil(totalEtiquetas / porPagina);

  // Dimensiones SVG — iguales al modal individual para máxima fidelidad
  const qrSize   = cfg.id === "50x30" ? 68  : cfg.id === "70x40" ? 96  : 130;
  const barcodeW = cfg.id === "70x40" ? 130 : 200;
  const barcodeH = cfg.id === "70x40" ? 28  : 36;

  // ── Render de una etiqueta (preview en pantalla, con px de cfg) ──────────────
  function renderPreview(p: Producto, key: React.Key) {
    const codigo = p.codigoBarras?.trim() || p.sku?.trim() || p.id.slice(-8).toUpperCase();
    const marcaModelo = [p.marca, p.modelo].filter(Boolean).join(" · ");
    const precio = Number(p.precio ?? 0);
    return (
      <div key={key} style={{
        width: cfg.width, height: cfg.height,
        border: "1.5px solid #333", borderRadius: 6,
        padding: "6px 8px", display: "flex", flexDirection: "row",
        gap: 6, alignItems: "stretch", background: "#fff",
        overflow: "hidden", boxSizing: "border-box", flexShrink: 0,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", minWidth: 0 }}>
          {mostrarBarras && tamano !== "50x30" && (
            <div style={{ overflow: "hidden" }}>
              <Code128SVG value={codigo || "SIN-CODIGO"} width={barcodeW} height={barcodeH} showText={false} />
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ fontSize: cfg.id === "50x30" ? "0.5rem" : cfg.id === "70x40" ? "0.625rem" : "0.8125rem", fontWeight: 700, lineHeight: 1.3, color: "#111", overflow: "hidden" }}>
              {p.nombre}
            </div>
            {marcaModelo && (
              <div style={{ fontSize: cfg.id === "50x30" ? "0.375rem" : "0.45rem", color: "#666", marginTop: 1 }}>{marcaModelo}</div>
            )}
          </div>
          {mostrarPrecio && (
            <div style={{ fontSize: cfg.id === "50x30" ? "1rem" : cfg.id === "70x40" ? "1.5rem" : "2rem", fontWeight: 900, color: "#0d1e35", lineHeight: 1, letterSpacing: "-0.5px" }}>
              ${precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <QRCodeSVG value={codigo || "SIN-CODIGO"} size={qrSize} level="M" />
          <div style={{ fontSize: "0.3rem", fontFamily: "monospace", color: "#777", marginTop: 1, maxWidth: qrSize, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {codigo.length > 12 ? codigo.slice(0, 12) + "…" : codigo}
          </div>
        </div>
      </div>
    );
  }

  // ── Render para imprimir (mm-based, mismo enfoque que EtiquetaModal) ─────────
  function renderPrint(p: Producto, key: React.Key) {
    const codigo = p.codigoBarras?.trim() || p.sku?.trim() || p.id.slice(-8).toUpperCase();
    const marcaModelo = [p.marca, p.modelo].filter(Boolean).join(" · ");
    const precio = Number(p.precio ?? 0);
    return (
      <div key={key} className="etiqueta" style={{
        width: `${mm.w}mm`, height: `${mm.h}mm`,
        border: "1.5pt solid #333", borderRadius: "2mm",
        padding: "1.5mm 2mm", display: "flex", flexDirection: "row",
        gap: "1.5mm", alignItems: "stretch", background: "#fff",
        overflow: "hidden", boxSizing: "border-box", pageBreakInside: "avoid",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", minWidth: 0 }}>
          {mostrarBarras && tamano !== "50x30" && (
            <div>
              <Code128SVG value={codigo || "SIN-CODIGO"} width={barcodeW} height={barcodeH} showText={false} />
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: cfg.id === "50x30" ? "5pt" : cfg.id === "70x40" ? "6pt" : "8pt", fontWeight: 700, lineHeight: 1.3, color: "#111" }}>
              {p.nombre}
            </div>
            {marcaModelo && (
              <div style={{ fontSize: "3.5pt", color: "#666", marginTop: "0.3mm" }}>{marcaModelo}</div>
            )}
          </div>
          {mostrarPrecio && (
            <div style={{ fontSize: cfg.id === "50x30" ? "9pt" : cfg.id === "70x40" ? "12pt" : "16pt", fontWeight: 900, color: "#0d1e35", letterSpacing: "-0.5pt", lineHeight: 1 }}>
              ${precio.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <QRCodeSVG value={codigo || "SIN-CODIGO"} size={qrSize} level="M" />
          <div style={{ fontSize: "3pt", fontFamily: "monospace", color: "#666", marginTop: "0.3mm", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
            {codigo.length > 16 ? codigo.slice(0, 16) + "…" : codigo}
          </div>
        </div>
      </div>
    );
  }

  function imprimir() {
    const labels = printRef.current?.innerHTML ?? "";
    if (!labels) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    // body padding garantiza margen visible en pantalla Y en impresión
    // @page margin: 0 evita doble margen al imprimir
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiquetas — ${productos.length} productos</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; padding: 5mm; }
.labels-grid { display: flex; flex-wrap: wrap; gap: 3mm; align-content: flex-start; }
@media print {
  @page { size: letter; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 5mm; }
  .etiqueta { break-inside: avoid; }
}
</style>
</head>
<body>
<div class="labels-grid">${labels}</div>
<script>window.onload = () => window.print();<\/script>
</body>
</html>`);
    win.document.close();
  }

  function exportarSVG() {
    // Usa los mismos SVGs inline del printRef (Code128 + QR reales)
    // envueltos en foreignObject — idéntico al resultado de imprimir
    const labels = printRef.current?.innerHTML ?? "";
    if (!labels) return;

    const SCALE  = 3.7795;          // px/mm a 96dpi
    const pageWpx = Math.round(216 * SCALE); // 816px
    const pageHpx = Math.round(279 * SCALE); // 1054px
    const padPx   = Math.round(5 * SCALE);   // 5mm → ~19px

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml"
     width="${pageWpx}" height="${pageHpx}" viewBox="0 0 ${pageWpx} ${pageHpx}">
  <rect width="100%" height="100%" fill="white"/>
  <foreignObject x="${padPx}" y="${padPx}" width="${pageWpx - padPx * 2}" height="${pageHpx - padPx * 2}">
    <xhtml:div style="display:flex;flex-wrap:wrap;gap:11px;align-content:flex-start;font-family:'Helvetica Neue',Arial,sans-serif;">
      ${labels}
    </xhtml:div>
  </foreignObject>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `etiquetas-carta-${productos.length}prods.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const previewLabels = etiquetas.slice(0, Math.min(4, etiquetas.length));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Imprimir etiquetas — ${productos.length} producto${productos.length !== 1 ? "s" : ""}`} size="lg">
      <div className="space-y-5">

        {/* Configuración */}
        <div className="grid grid-cols-2 gap-4">
          {/* Tamaño */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Tamaño de etiqueta</p>
            <div className="space-y-1.5">
              {TAMANOS.map((t) => {
                const m = MM_SIZES[t.id];
                const g = calcularGridCarta(m.w, m.h);
                return (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tamano-masivo" checked={tamano === t.id} onChange={() => setTamano(t.id)} style={{ accentColor: "var(--color-accent)" }} />
                    <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{t.label}</span>
                    <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>{g.cols}×{g.rows} = {g.porPagina}/pág</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Opciones + copias */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Contenido</p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mostrarPrecio} onChange={(e) => setMostrarPrecio(e.target.checked)} style={{ accentColor: "var(--color-accent)" }} />
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>Mostrar precio</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mostrarBarras} onChange={(e) => setMostrarBarras(e.target.checked)} style={{ accentColor: "var(--color-accent)" }} disabled={tamano === "50x30"} />
                <span className="text-sm" style={{ color: tamano === "50x30" ? "var(--color-text-muted)" : "var(--color-text-primary)" }}>
                  Código de barras CODE128
                  {tamano === "50x30" && <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: 4 }}>(solo 70×40 y 100×50)</span>}
                </span>
              </label>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Copias por producto</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCopias((c) => Math.max(1, c - 1))} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", cursor: "pointer" }}>
                <MinusIcon className="w-3 h-3" style={{ color: "var(--color-text-primary)" }} />
              </button>
              <span className="text-sm font-bold w-6 text-center" style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>{copiasPorProducto}</span>
              <button onClick={() => setCopias((c) => Math.min(20, c + 1))} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", cursor: "pointer" }}>
                <PlusIcon className="w-3 h-3" style={{ color: "var(--color-text-primary)" }} />
              </button>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-6 text-sm flex-wrap" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
          <div><span style={{ color: "var(--color-text-muted)" }}>Total etiquetas </span><strong style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>{totalEtiquetas}</strong></div>
          <div><span style={{ color: "var(--color-text-muted)" }}>Páginas carta </span><strong style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>{totalPaginas}</strong></div>
          <div><span style={{ color: "var(--color-text-muted)" }}>Por página </span><strong style={{ fontFamily: "var(--font-data)", color: "var(--color-text-primary)" }}>{porPagina}</strong><span style={{ color: "var(--color-text-muted)" }}> ({cols} col)</span></div>
        </div>

        {/* Vista previa */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
            Vista previa {etiquetas.length > previewLabels.length ? `(primeras ${previewLabels.length} de ${etiquetas.length})` : ""}
          </p>
          <div style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "flex-start",
            minHeight: cfg.height + 32,
            border: "1px solid var(--color-border-subtle)",
          }}>
            {previewLabels.map((p, i) => renderPreview(p, `prev-${i}`))}
            {etiquetas.length > previewLabels.length && (
              <div style={{
                width: cfg.width, height: cfg.height,
                border: "1.5px dashed var(--color-border)",
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-muted)",
                fontSize: "0.75rem",
                fontWeight: 600,
                gap: 4,
              }}>
                <span style={{ fontSize: "1.25rem", fontFamily: "var(--font-data)" }}>+{etiquetas.length - previewLabels.length}</span>
                <span>más</span>
              </div>
            )}
          </div>
        </div>

        {/* Lista de productos */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Productos ({productos.length})</p>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border-subtle)", maxHeight: 150, overflowY: "auto" }}>
            {productos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: "var(--color-bg-elevated)" }}>
                  {p.imagen ? <img src={obtenerUrlImagen(p.imagen) ?? ""} alt="" className="w-7 h-7 object-cover rounded" /> : <Smartphone className="w-3.5 h-3.5" style={{ color: "var(--color-text-muted)" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{p.nombre}</p>
                  <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{[p.marca, p.modelo].filter(Boolean).join(" · ") || "Sin marca/modelo"}</p>
                </div>
                <span className="text-xs shrink-0" style={{ fontFamily: "var(--font-data)", color: "var(--color-text-secondary)" }}>
                  ${Number(p.precio).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Div oculto para capturar SVGs inline — mismo enfoque que EtiquetaModal */}
        <div ref={printRef} style={{ display: "none" }}>
          {etiquetas.map((p, i) => renderPrint(p, `print-${i}`))}
        </div>

        {/* Acciones */}
        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={exportarSVG}>
            <Tag className="w-4 h-4 mr-2" />
            Exportar SVG
          </Button>
          <Button onClick={imprimir}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / PDF ({totalEtiquetas} etiquetas)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
