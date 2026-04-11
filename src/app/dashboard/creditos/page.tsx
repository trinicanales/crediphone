"use client";

import { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { CreditoFormMejorado } from "@/components/creditos/CreditoFormMejorado";
import { PayjoyPanel } from "@/components/creditos/PayjoyPanel";
import { useRouter } from "next/navigation";
import { Download, Zap, AlertTriangle, RefreshCw, Loader2, Eye } from "lucide-react";
import type { Credito, Cliente } from "@/types";
import { ExportButton } from "@/components/ui/ExportButton";
import type { ColumnaExport } from "@/hooks/useExportCSV";

interface CreditoConDetalles extends Credito {
  clienteNombre?: string;
}

const COLUMNAS_CREDITOS_CSV: ColumnaExport<CreditoConDetalles>[] = [
  { header: "Folio", accessor: (r) => r.folio ?? r.id },
  { header: "Cliente", accessor: (r) => r.clienteNombre ?? "" },
  { header: "Monto ($)", accessor: (r) => Number(r.monto).toFixed(2) },
  { header: "Monto Original ($)", accessor: (r) => r.montoOriginal ? Number(r.montoOriginal).toFixed(2) : "" },
  { header: "Enganche ($)", accessor: (r) => r.enganche ? Number(r.enganche).toFixed(2) : "" },
  { header: "Plazo (meses)", accessor: "plazo" },
  { header: "Frecuencia Pago", accessor: (r) => r.frecuenciaPago ?? "" },
  { header: "Monto por Pago ($)", accessor: (r) => r.montoPago ? Number(r.montoPago).toFixed(2) : "" },
  { header: "Tasa Interés (%)", accessor: "tasaInteres" },
  { header: "Estado", accessor: "estado" },
  { header: "Días Mora", accessor: (r) => r.diasMora ?? 0 },
  { header: "Monto Mora ($)", accessor: (r) => r.montoMora ? Number(r.montoMora).toFixed(2) : "0.00" },
  { header: "Fecha Inicio", accessor: (r) => r.fechaInicio ? new Date(r.fechaInicio).toLocaleDateString("es-MX") : "" },
  { header: "Fecha Fin", accessor: (r) => r.fechaFin ? new Date(r.fechaFin).toLocaleDateString("es-MX") : "" },
  { header: "Fecha Registro", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-MX") : "" },
];

export default function CreditosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [creditos, setCreditos] = useState<CreditoConDetalles[]>([]);
  const [filteredCreditos, setFilteredCreditos] = useState<CreditoConDetalles[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedCredito, setSelectedCredito] = useState<Credito | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [creditoToDelete, setCreditoToDelete] = useState<Credito | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [payjoyExpandedId, setPayjoyExpandedId] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [recalculoMsg, setRecalculoMsg] = useState<string | null>(null);

  // Espera a que auth resuelva para evitar requests innecesarios (PAGES-002)
  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  useEffect(() => {
    let filtered = creditos;
    if (filterEstado !== "todos") {
      filtered = filtered.filter((c) => c.estado === filterEstado);
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (credito) =>
          credito.clienteNombre?.toLowerCase().includes(query) ||
          credito.id.toLowerCase().includes(query)
      );
    }
    setFilteredCreditos(filtered);
  }, [searchQuery, filterEstado, creditos]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [creditosRes, clientesRes] = await Promise.all([
        fetch("/api/creditos"),
        fetch("/api/clientes"),
      ]);
      const [creditosData, clientesData] = await Promise.all([
        creditosRes.json(),
        clientesRes.json(),
      ]);
      if (creditosData.success && clientesData.success) {
        const clientesMap = new Map(clientesData.data.map((c: Cliente) => [c.id, c]));
        const creditosConDetalles = creditosData.data.map((credito: Credito) => {
          const cliente = clientesMap.get(credito.clienteId) as Cliente | undefined;
          return {
            ...credito,
            clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : "Desconocido",
          };
        });
        setCreditos(creditosConDetalles);
        setFilteredCreditos(creditosConDetalles);
        setClientes(clientesData.data);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => { setModalMode("create"); setSelectedCredito(null); setIsModalOpen(true); };
  const handleEdit = (credito: Credito) => { setModalMode("edit"); setSelectedCredito(credito); setIsModalOpen(true); };
  const handleDeleteClick = (credito: Credito) => { setCreditoToDelete(credito); setDeleteConfirmModal(true); };

  const handleDeleteConfirm = async () => {
    if (!creditoToDelete) return;
    try {
      const response = await fetch(`/api/creditos/${creditoToDelete.id}`, { method: "DELETE" });
      if (response.ok) { await fetchData(); setDeleteConfirmModal(false); setCreditoToDelete(null); }
    } catch (error) { console.error("Error al eliminar crédito:", error); }
  };

  const handleModalClose = () => { setIsModalOpen(false); setSelectedCredito(null); };
  const handleSuccess = () => { fetchData(); handleModalClose(); };

  const handleDownloadPdf = async (creditoId: string) => {
    try {
      setDownloadingPdf(creditoId);
      const response = await fetch(`/api/creditos/${creditoId}/pdf`, { method: "POST" });
      if (!response.ok) throw new Error("Error al generar PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "credito.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando PDF:", error);
    } finally {
      setDownloadingPdf(null);
    }
  };

  const recalcularMora = async () => {
    setRecalculando(true);
    setRecalculoMsg(null);
    try {
      const res = await fetch("/api/creditos/recalcular-mora", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRecalculoMsg(`Mora actualizada: ${data.data.enMora} con mora, ${data.data.actualizados} cambios`);
      await fetchData();
    } catch (err) {
      console.error("Error recalculando mora:", err);
    } finally {
      setRecalculando(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(price);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, "success" | "warning" | "danger" | "default"> = {
      activo: "success", pagado: "default", vencido: "danger", cancelado: "warning",
    };
    return variants[estado] || "default";
  };

  const creditosActivos = creditos.filter((c) => c.estado === "activo").length;
  const creditosPagados = creditos.filter((c) => c.estado === "pagado").length;
  const creditosVencidos = creditos.filter((c) => c.estado === "vencido").length;
  const montoTotalCreditos = creditos.reduce((sum, c) => sum + Number(c.monto), 0);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>Créditos</h1>
            <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
              Gestiona los créditos otorgados a clientes
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {recalculoMsg && (
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: "var(--color-success-bg)",
                  color: "var(--color-success-text)",
                }}
              >
                {recalculoMsg}
              </span>
            )}
            <Button variant="secondary" onClick={recalcularMora} disabled={recalculando}>
              {recalculando ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Calculando...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-1.5" /> Recalcular mora</>
              )}
            </Button>
            {creditosVencidos > 0 && (
              <Button variant="danger" onClick={() => router.push("/dashboard/creditos/cartera-vencida")}>
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Cartera vencida ({creditosVencidos})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-4 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Input
                type="search"
                placeholder="Buscar por cliente o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="pagado">Pagados</option>
                <option value="vencido">Vencidos</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton<CreditoConDetalles>
              datos={filteredCreditos}
              columnas={COLUMNAS_CREDITOS_CSV}
              nombreArchivo="creditos"
              label="Exportar CSV"
            />
            <Button onClick={handleCreate}>+ Nuevo Crédito</Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Total Créditos</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
            {creditos.length}
          </div>
        </Card>
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Activos</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
            {creditosActivos}
          </div>
        </Card>
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Vencidos</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-danger)", fontFamily: "var(--font-data)" }}>
            {creditosVencidos}
          </div>
        </Card>
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Monto Total</div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
            {formatPrice(montoTotalCreditos)}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "var(--color-accent)" }}></div>
            <p className="mt-4" style={{ color: "var(--color-text-secondary)" }}>Cargando créditos...</p>
          </div>
        ) : filteredCreditos.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: "var(--color-text-secondary)" }}>
              {searchQuery || filterEstado !== "todos"
                ? "No se encontraron créditos con los filtros aplicados"
                : "No hay créditos registrados"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}>
                <tr>
                  {["Cliente", "Monto", "Plazo", "Pago Quincenal", "Fechas", "Estado", "Acciones"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-xs font-medium uppercase tracking-wider ${i === 6 ? "text-right" : i === 5 ? "text-center" : "text-left"}`}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCreditos.map((credito) => (
                  <Fragment key={credito.id}>
                    <TableRow
                      credito={credito}
                      formatPrice={formatPrice}
                      formatDate={formatDate}
                      getEstadoBadge={getEstadoBadge}
                      downloadingPdf={downloadingPdf}
                      payjoyExpandedId={payjoyExpandedId}
                      onView={() => router.push(`/dashboard/creditos/${credito.id}`)}
                      onDownload={() => handleDownloadPdf(credito.id)}
                      onEdit={() => handleEdit(credito)}
                      onDelete={() => handleDeleteClick(credito)}
                      onPayjoyToggle={() => setPayjoyExpandedId(payjoyExpandedId === credito.id ? null : credito.id)}
                    />
                    {payjoyExpandedId === credito.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-3" style={{ background: "var(--color-bg-elevated)" }}>
                          <PayjoyPanel credito={credito} onRefresh={fetchData} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Formulario */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title={modalMode === "create" ? "Nuevo Crédito" : "Editar Crédito"} size="lg">
        <CreditoFormMejorado mode={modalMode} credito={selectedCredito} clientes={clientes} onSuccess={handleSuccess} onCancel={handleModalClose} />
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal isOpen={deleteConfirmModal} onClose={() => setDeleteConfirmModal(false)} title="Confirmar Eliminación">
        <div className="space-y-4">
          <p style={{ color: "var(--color-text-primary)" }}>
            ¿Estás seguro de que deseas eliminar este crédito de{" "}
            <strong>{formatPrice(Number(creditoToDelete?.monto || 0))}</strong>?
          </p>
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            Esta acción no se puede deshacer y eliminará también todos los pagos asociados.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteConfirmModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Eliminar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Row component para evitar repetir onMouseEnter/Leave inline en cada fila
function TableRow({
  credito, formatPrice, formatDate, getEstadoBadge, downloadingPdf, payjoyExpandedId,
  onView, onDownload, onEdit, onDelete, onPayjoyToggle,
}: {
  credito: CreditoConDetalles;
  formatPrice: (n: number) => string;
  formatDate: (d: Date) => string;
  getEstadoBadge: (e: string) => "success" | "warning" | "danger" | "default";
  downloadingPdf: string | null;
  payjoyExpandedId: string | null;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPayjoyToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [btnHover, setBtnHover] = useState<"view" | "download" | "edit" | "delete" | "payjoy" | null>(null);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <td className="px-6 py-4">
        <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          {credito.clienteNombre}
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
          {credito.folio ? `Folio: ${credito.folio}` : `ID: ${credito.id.substring(0, 8)}...`}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-bold" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
          {formatPrice(Number(credito.monto))}
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {credito.tasaInteres}% interés
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm" style={{ color: "var(--color-text-primary)" }}>
          {credito.plazo} meses
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
          {formatPrice(Number(credito.pagoQuincenal))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-xs" style={{ color: "var(--color-text-primary)" }}>
          Inicio: {formatDate(credito.fechaInicio)}
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Fin: {formatDate(credito.fechaFin)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <Badge variant={getEstadoBadge(credito.estado)}>{credito.estado}</Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={onView}
          className="mr-3"
          title="Ver detalle"
          onMouseEnter={() => setBtnHover("view")}
          onMouseLeave={() => setBtnHover(null)}
          style={{ color: btnHover === "view" ? "var(--color-accent)" : "var(--color-text-muted)" }}
        >
          <Eye className="w-4 h-4 inline" />
        </button>
        <button
          onClick={onDownload}
          disabled={downloadingPdf === credito.id}
          className="mr-3"
          title="Descargar PDF"
          onMouseEnter={() => setBtnHover("download")}
          onMouseLeave={() => setBtnHover(null)}
          style={{ color: btnHover === "download" ? "var(--color-accent)" : "var(--color-text-muted)" }}
        >
          <Download className={`w-4 h-4 inline ${downloadingPdf === credito.id ? "animate-pulse" : ""}`} />
        </button>
        <button
          onClick={onEdit}
          className="mr-4"
          onMouseEnter={() => setBtnHover("edit")}
          onMouseLeave={() => setBtnHover(null)}
          style={{ color: btnHover === "edit" ? "var(--color-accent)" : "var(--color-info)" }}
        >
          Editar
        </button>
        <button
          onClick={onDelete}
          className="mr-4"
          onMouseEnter={() => setBtnHover("delete")}
          onMouseLeave={() => setBtnHover(null)}
          style={{ color: btnHover === "delete" ? "var(--color-danger-text)" : "var(--color-danger)" }}
        >
          Eliminar
        </button>
        <button
          onClick={onPayjoyToggle}
          title="Payjoy"
          onMouseEnter={() => setBtnHover("payjoy")}
          onMouseLeave={() => setBtnHover(null)}
          style={{ color: (btnHover === "payjoy" || credito.payjoyFinanceOrderId) ? "var(--color-warning)" : "var(--color-text-muted)" }}
        >
          <Zap className="w-4 h-4 inline" />
        </button>
      </td>
    </tr>
  );
}
