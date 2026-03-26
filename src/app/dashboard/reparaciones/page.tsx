"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalOrden } from "@/components/reparaciones/ModalOrden";
import { ModalDiagnostico } from "@/components/reparaciones/ModalDiagnostico";
import { ModalCambiarEstado } from "@/components/reparaciones/ModalCambiarEstado";
import { OrdenCard } from "@/components/reparaciones/cards/OrdenCard";
import { OrdenDrawer } from "@/components/reparaciones/drawer/OrdenDrawer";
import { useAuth } from "@/components/AuthProvider";
import type {
  OrdenReparacionDetallada,
  EstadoOrdenReparacion,
} from "@/types";
import { ExportButton } from "@/components/ui/ExportButton";
import type { ColumnaExport } from "@/hooks/useExportCSV";
import { Wrench, Trash2 } from "lucide-react";

const COLUMNAS_REPARACIONES_CSV: ColumnaExport<OrdenReparacionDetallada>[] = [
  { header: "Folio", accessor: "folio" },
  { header: "Cliente", accessor: (r) => [r.clienteNombre, r.clienteApellido].filter(Boolean).join(" ") },
  { header: "Teléfono", accessor: (r) => r.clienteTelefono ?? "" },
  { header: "Dispositivo", accessor: (r) => `${r.marcaDispositivo} ${r.modeloDispositivo}` },
  { header: "IMEI", accessor: (r) => r.imei ?? "" },
  { header: "Problema", accessor: "problemaReportado" },
  { header: "Estado", accessor: "estado" },
  { header: "Técnico", accessor: "tecnicoNombre" },
  { header: "Costo Reparación ($)", accessor: (r) => Number(r.costoReparacion ?? 0).toFixed(2) },
  { header: "Costo Partes ($)", accessor: (r) => Number(r.costoPartes ?? 0).toFixed(2) },
  { header: "Costo Total ($)", accessor: (r) => Number(r.costoTotal ?? 0).toFixed(2) },
  { header: "Prioridad", accessor: "prioridad" },
  { header: "Garantía", accessor: (r) => r.esGarantia ? "Sí" : "No" },
  { header: "Aprobado Cliente", accessor: (r) => r.aprobadoPorCliente ? "Sí" : "No" },
  { header: "Fecha Recepción", accessor: (r) => r.fechaRecepcion ? new Date(r.fechaRecepcion).toLocaleDateString("es-MX") : "" },
  { header: "Fecha Est. Entrega", accessor: (r) => r.fechaEstimadaEntrega ? new Date(r.fechaEstimadaEntrega).toLocaleDateString("es-MX") : "" },
  { header: "Fecha Completado", accessor: (r) => r.fechaCompletado ? new Date(r.fechaCompletado).toLocaleDateString("es-MX") : "" },
];

// Estados que requieren confirmación (abren ModalCambiarEstado)
const ESTADOS_CRITICOS: EstadoOrdenReparacion[] = ["cancelado", "no_reparable"];

export default function ReparacionesPage() {
  const { user, loading: authLoading } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenReparacionDetallada[]>([]);
  const [filteredOrdenes, setFilteredOrdenes] = useState<OrdenReparacionDetallada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<EstadoOrdenReparacion | "todas" | "garantias">("todas");
  const [stats, setStats] = useState({
    total: 0,
    activas: 0,
    diagnostico: 0,
    esperandoPiezas: 0,
    enReparacion: 0,
    listasEntrega: 0,
    garantiasActivas: 0,
  });

  // Modal states
  const [modalOrdenOpen, setModalOrdenOpen] = useState(false);
  const [modalDiagnosticoOpen, setModalDiagnosticoOpen] = useState(false);
  const [modalCambiarEstadoOpen, setModalCambiarEstadoOpen] = useState(false);
  const [selectedOrdenForEstado, setSelectedOrdenForEstado] = useState<OrdenReparacionDetallada | null>(null);
  const [selectedOrden, setSelectedOrden] = useState<OrdenReparacionDetallada | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmFolio, setDeleteConfirmFolio] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  // Drawer lateral
  const [drawerOrdenId, setDrawerOrdenId] = useState<string | null>(null);
  const [drawerDefaultTab, setDrawerDefaultTab] = useState("resumen");

  // Todos los roles autenticados pueden ver reparaciones
  useEffect(() => {
    if (!authLoading && user) {
      fetchOrdenes();
    }
  }, [authLoading, user]);

  // Filtrar órdenes cuando cambian filtros o búsqueda
  useEffect(() => {
    filterOrdenes();
  }, [ordenes, searchQuery, filterEstado]);

  // Calcular stats cuando cambian las órdenes
  useEffect(() => {
    calculateStats();
  }, [ordenes]);

  async function fetchOrdenes() {
    try {
      setLoading(true);
      const response = await fetch("/api/reparaciones?detalladas=true");
      const data = await response.json();

      if (data.success) {
        setOrdenes(data.data);
      } else {
        console.error("Error al obtener órdenes:", data.error);
      }
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats() {
    const total = ordenes.length;
    const activas = ordenes.filter(
      (o) => !["entregado", "cancelado", "no_reparable"].includes(o.estado)
    ).length;
    const diagnostico = ordenes.filter((o) => o.estado === "diagnostico").length;
    const esperandoPiezas = ordenes.filter((o) => o.estado === "esperando_piezas").length;
    const enReparacion = ordenes.filter((o) => o.estado === "en_reparacion").length;
    const listasEntrega = ordenes.filter((o) => o.estado === "listo_entrega").length;
    const garantiasActivas = ordenes.filter(
      (o) => o.esGarantia && !["entregado", "cancelado"].includes(o.estado)
    ).length;

    setStats({
      total,
      activas,
      diagnostico,
      esperandoPiezas,
      enReparacion,
      listasEntrega,
      garantiasActivas,
    });
  }

  function filterOrdenes() {
    let filtered = ordenes;

    // Filtro por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (orden) =>
          orden.folio.toLowerCase().includes(query) ||
          orden.clienteNombre.toLowerCase().includes(query) ||
          (orden.clienteApellido && orden.clienteApellido.toLowerCase().includes(query)) ||
          orden.marcaDispositivo.toLowerCase().includes(query) ||
          orden.modeloDispositivo.toLowerCase().includes(query) ||
          (orden.imei && orden.imei.toLowerCase().includes(query))
      );
    }

    // Filtro por estado
    if (filterEstado === "garantias") {
      filtered = filtered.filter(
        (o) => o.esGarantia && !["entregado", "cancelado"].includes(o.estado)
      );
    } else if (filterEstado !== "todas") {
      filtered = filtered.filter((o) => o.estado === filterEstado);
    }

    setFilteredOrdenes(filtered);
  }

  function formatFecha(fecha: Date | undefined): string {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  }

  function handleCambiarEstado(orden: OrdenReparacionDetallada) {
    setSelectedOrdenForEstado(orden);
    setModalCambiarEstadoOpen(true);
  }

  // Desde la tarjeta: cambio inline de estado
  async function handleCambiarEstadoInline(
    orden: OrdenReparacionDetallada,
    nuevoEstado: EstadoOrdenReparacion
  ) {
    // Estados críticos → abrir modal con confirmación
    if (ESTADOS_CRITICOS.includes(nuevoEstado)) {
      setSelectedOrdenForEstado(orden);
      setModalCambiarEstadoOpen(true);
      return;
    }
    // Transición directa via API
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrdenes();
      } else {
        alert(data.error || "Error al cambiar estado");
      }
    } catch {
      alert("Error al cambiar estado");
    }
  }

  function handleOpenDrawer(orden: OrdenReparacionDetallada, tab = "resumen") {
    setDrawerOrdenId(orden.id);
    setDrawerDefaultTab(tab);
  }

  async function handleEliminarOrden() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reparaciones/${deleteConfirmId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirmId(null);
        await fetchOrdenes();
      } else {
        alert(data.error || "Error al eliminar");
      }
    } catch {
      alert("Error al eliminar la orden");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Gestión de Reparaciones
          </h1>
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Sistema de órdenes de servicio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton<OrdenReparacionDetallada>
            datos={filteredOrdenes}
            columnas={COLUMNAS_REPARACIONES_CSV}
            nombreArchivo="reparaciones"
            label="Exportar CSV"
          />
          {user && (
            <Button variant="primary" onClick={() => setModalOrdenOpen(true)}>
              + Nueva Orden
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, bg: "var(--color-bg-surface)", color: "var(--color-text-primary)" },
          { label: "Activas", value: stats.activas, bg: "var(--color-info-bg)", color: "var(--color-info-text)" },
          { label: "Diagnóstico", value: stats.diagnostico, bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
          { label: "Esp. Piezas", value: stats.esperandoPiezas, bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
          { label: "En Reparación", value: stats.enReparacion, bg: "var(--color-accent-light)", color: "var(--color-accent)" },
          { label: "Listas Entrega", value: stats.listasEntrega, bg: "var(--color-success-bg)", color: "var(--color-success-text)" },
          { label: "Garantías", value: stats.garantiasActivas, bg: "var(--color-warning-bg)", color: "var(--color-warning-text)" },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className="p-4 rounded-xl" style={{ background: bg, boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-medium" style={{ color }}>{label}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color, fontFamily: "var(--font-data)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por folio, cliente, dispositivo, IMEI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 rounded-xl text-sm"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value as EstadoOrdenReparacion | "todas" | "garantias")}
          className="w-full md:w-52 px-4 py-2 rounded-xl text-sm"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <option value="todas">Todas las órdenes</option>
          <option value="garantias">Solo Garantías</option>
          <option value="recibido">Recibido</option>
          <option value="diagnostico">En Diagnóstico</option>
          <option value="presupuesto">Presupuesto Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="esperando_piezas">Esperando Piezas</option>
          <option value="en_reparacion">En Reparación</option>
          <option value="completado">Completado</option>
          <option value="listo_entrega">Listo para Entrega</option>
          <option value="entregado">Entregado</option>
          <option value="no_reparable">No Reparable</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Grid de Tarjetas */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--color-text-muted)" }}>
          Cargando órdenes de reparación...
        </div>
      ) : filteredOrdenes.length === 0 ? (
        <div className="text-center py-16">
          <Wrench size={40} className="mx-auto mb-3" style={{ color: "var(--color-border-strong)" }} />
          <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
            {searchQuery || filterEstado !== "todas" ? "Sin resultados para este filtro" : "No hay órdenes de reparación"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {!searchQuery && filterEstado === "todas" && "Crea la primera orden con el botón + Nueva Orden"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrdenes.map((orden) => (
              <OrdenCard
                key={orden.id}
                orden={orden}
                userRole={user?.role || ""}
                onOpenDrawer={(o) => handleOpenDrawer(o)}
                onDiagnostico={(o) => {
                  setSelectedOrden(o);
                  setModalDiagnosticoOpen(true);
                }}
                onCambiarEstado={handleCambiarEstadoInline}
                onEliminar={(o) => {
                  setDeleteConfirmId(o.id);
                  setDeleteConfirmFolio(o.folio);
                }}
                onRefresh={fetchOrdenes}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
            {filteredOrdenes.length} de {ordenes.length} órdenes
          </p>
        </>
      )}

      {/* ── Drawer lateral ── */}
      <OrdenDrawer
        ordenId={drawerOrdenId}
        onClose={() => setDrawerOrdenId(null)}
        onRefresh={fetchOrdenes}
        defaultTab={drawerDefaultTab}
      />

      {/* ── Modales existentes ── */}
      <ModalOrden
        isOpen={modalOrdenOpen}
        onClose={() => setModalOrdenOpen(false)}
        onSuccess={fetchOrdenes}
      />

      {selectedOrden && (
        <ModalDiagnostico
          isOpen={modalDiagnosticoOpen}
          onClose={() => { setModalDiagnosticoOpen(false); setSelectedOrden(null); }}
          onSuccess={fetchOrdenes}
          ordenId={selectedOrden.id}
          ordenFolio={selectedOrden.folio}
          dispositivo={`${selectedOrden.marcaDispositivo} ${selectedOrden.modeloDispositivo}`}
        />
      )}

      {selectedOrdenForEstado && (
        <ModalCambiarEstado
          isOpen={modalCambiarEstadoOpen}
          onClose={() => { setModalCambiarEstadoOpen(false); setSelectedOrdenForEstado(null); }}
          onSuccess={fetchOrdenes}
          ordenId={selectedOrdenForEstado.id}
          folio={selectedOrdenForEstado.folio}
          estadoActual={selectedOrdenForEstado.estado}
        />
      )}

      {/* Confirmación eliminar — solo super_admin */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl p-8 max-w-sm w-full mx-4" style={{ background: "var(--color-bg-surface)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--color-border)" }}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--color-danger-bg)" }}>
                <Trash2 size={24} style={{ color: "var(--color-danger)" }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
                Eliminar orden de servicio
              </h3>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                ¿Eliminar la orden{" "}
                <span className="font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  {deleteConfirmFolio}
                </span>
                ? Esta acción es permanente.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarOrden}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--color-danger)", color: "#fff", opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
