"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Pago, Credito, Cliente, DetallePagoMixto } from "@/types";
import { Printer } from "lucide-react";
import { ExportButton } from "@/components/ui/ExportButton";
import type { ColumnaExport } from "@/hooks/useExportCSV";
import { generarTicketPagoCredito, abrirReporte } from "@/lib/utils/reportes";

interface PagoConDetalles extends Pago {
  clienteNombre?: string;
  clienteApellido?: string;
  creditoMonto?: number;
  creditoFolio?: string;
}

const COLUMNAS_PAGOS_CSV: ColumnaExport<PagoConDetalles>[] = [
  { header: "ID Pago", accessor: (r) => r.id },
  { header: "Folio Crédito", accessor: (r) => r.creditoFolio ?? r.creditoId },
  { header: "Cliente", accessor: (r) => [r.clienteNombre, r.clienteApellido].filter(Boolean).join(" ") },
  { header: "Monto ($)", accessor: (r) => Number(r.monto).toFixed(2) },
  { header: "Fecha Pago", accessor: (r) => r.fechaPago ? new Date(r.fechaPago).toLocaleDateString("es-MX") : "" },
  { header: "Método Pago", accessor: "metodoPago" },
  { header: "Referencia", accessor: (r) => r.referencia ?? "" },
  { header: "Payjoy TX ID", accessor: (r) => r.payjoyTransactionId ?? "" },
  { header: "Fecha Registro", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-MX") : "" },
];

export default function PagosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pagos, setPagos] = useState<PagoConDetalles[]>([]);
  const [filteredPagos, setFilteredPagos] = useState<PagoConDetalles[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchDate, setSearchDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [pagoToDelete, setPagoToDelete] = useState<Pago | null>(null);
  const [fetchError, setFetchError] = useState(false);

  // SEGURIDAD: técnico no tiene acceso a pagos/créditos
  useEffect(() => {
    if (user && user.role === "tecnico") {
      router.push("/dashboard");
    }
  }, [user, router]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (searchDate === "") {
      setFilteredPagos(pagos);
    } else {
      const filtered = pagos.filter((pago) => {
        const pagoDate = new Date(pago.fechaPago).toISOString().split("T")[0];
        return pagoDate === searchDate;
      });
      setFilteredPagos(filtered);
    }
  }, [searchDate, pagos]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(false);
      const [pagosRes, creditosRes, clientesRes] = await Promise.all([
        fetch("/api/pagos"),
        fetch("/api/creditos"),
        fetch("/api/clientes"),
      ]);
      const [pagosData, creditosData, clientesData] = await Promise.all([
        pagosRes.json(),
        creditosRes.json(),
        clientesRes.json(),
      ]);
      if (pagosData.success && creditosData.success && clientesData.success) {
        const creditosMap = new Map(creditosData.data.map((c: Credito) => [c.id, c]));
        const clientesMap = new Map(clientesData.data.map((c: Cliente) => [c.id, c]));
        const pagosConDetalles = pagosData.data.map((pago: Pago) => {
          const credito = creditosMap.get(pago.creditoId) as Credito | undefined;
          const cliente = credito ? (clientesMap.get(credito.clienteId) as Cliente | undefined) : null;
          return {
            ...pago,
            clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : "Desconocido",
            clienteApellido: cliente?.apellido,
            creditoMonto: credito ? Number(credito.monto) : 0,
            creditoFolio: credito?.folio,
          };
        });
        setPagos(pagosConDetalles);
        setFilteredPagos(pagosConDetalles);
        setCreditos(creditosData.data);
        setClientes(clientesData.data);
      } else {
        setFetchError(true);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => { setModalMode("create"); setSelectedPago(null); setIsModalOpen(true); };
  const handleEdit = (pago: Pago) => { setModalMode("edit"); setSelectedPago(pago); setIsModalOpen(true); };
  const handleDeleteClick = (pago: Pago) => { setPagoToDelete(pago); setDeleteConfirmModal(true); };

  const handleDeleteConfirm = async () => {
    if (!pagoToDelete) return;
    try {
      const response = await fetch(`/api/pagos/${pagoToDelete.id}`, { method: "DELETE" });
      if (response.ok) {
        await fetchData();
        setDeleteConfirmModal(false);
        setPagoToDelete(null);
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.error || "Error al eliminar el pago. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error al eliminar pago:", error);
      alert("Error de conexión al eliminar el pago. Verifica tu internet e intenta de nuevo.");
    }
  };

  const handleModalClose = () => { setIsModalOpen(false); setSelectedPago(null); };
  const handleSuccess = () => { fetchData(); handleModalClose(); };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(price);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

  const getMetodoLabel = (metodo: string) => {
    const labels: Record<string, string> = {
      efectivo: "Efectivo", transferencia: "Transferencia", deposito: "Depósito", mixto: "Mixto",
    };
    return labels[metodo] || metodo;
  };

  const today = new Date().toISOString().split("T")[0];
  const pagosHoy = pagos.filter((p) => new Date(p.fechaPago).toISOString().split("T")[0] === today);
  const totalCobradoHoy = pagosHoy.reduce((sum, p) => sum + Number(p.monto), 0);
  const totalCobradoGeneral = pagos.reduce((sum, p) => sum + Number(p.monto), 0);

  if (fetchError) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div
          className="rounded-xl p-6 text-center max-w-sm"
          style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}
        >
          <p className="font-semibold mb-1" style={{ color: "var(--color-danger-text)" }}>
            Error al cargar los pagos
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--color-danger-text)" }}>
            No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.
          </p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--color-danger)", color: "#fff" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>Pagos</h1>
        <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Gestiona los pagos y cobros de créditos
        </p>
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-96">
            <Input type="date" label="Filtrar por fecha" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            {searchDate && (
              <Button variant="secondary" onClick={() => setSearchDate("")}>Limpiar Filtro</Button>
            )}
            <ExportButton<PagoConDetalles>
              datos={filteredPagos}
              columnas={COLUMNAS_PAGOS_CSV}
              nombreArchivo="pagos"
              label="Exportar CSV"
            />
            <Button onClick={handleCreate}>+ Registrar Pago</Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Total Pagos</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
            {pagos.length}
          </div>
        </Card>
        <Card>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Pagos Hoy</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
            {pagosHoy.length}
          </div>
        </Card>
        <Card>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Cobrado Hoy</div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
            {formatPrice(totalCobradoHoy)}
          </div>
        </Card>
        <Card>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Total Cobrado</div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-info)", fontFamily: "var(--font-data)" }}>
            {formatPrice(totalCobradoGeneral)}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "var(--color-accent)" }}></div>
            <p className="mt-4" style={{ color: "var(--color-text-secondary)" }}>Cargando pagos...</p>
          </div>
        ) : filteredPagos.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: "var(--color-text-secondary)" }}>
              {searchDate ? "No se encontraron pagos para esta fecha" : "No hay pagos registrados"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}>
                <tr>
                  {["Fecha", "Cliente", "Monto", "Método", "Detalle", "Acciones"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-xs font-medium uppercase tracking-wider ${i === 5 ? "text-right" : "text-left"}`}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPagos.map((pago) => (
                  <PagoRow
                    key={pago.id}
                    pago={pago}
                    formatPrice={formatPrice}
                    formatDate={formatDate}
                    getMetodoLabel={getMetodoLabel}
                    onEdit={() => handleEdit(pago)}
                    onDelete={() => handleDeleteClick(pago)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Formulario */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title={modalMode === "create" ? "Registrar Pago" : "Editar Pago"} size="lg">
        <PagoForm mode={modalMode} pago={selectedPago} creditos={creditos} clientes={clientes} onSuccess={handleSuccess} onCancel={handleModalClose} />
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal isOpen={deleteConfirmModal} onClose={() => setDeleteConfirmModal(false)} title="Confirmar Eliminación">
        <div className="space-y-4">
          <p style={{ color: "var(--color-text-primary)" }}>
            ¿Estás seguro de que deseas eliminar este pago de{" "}
            <strong>{formatPrice(Number(pagoToDelete?.monto || 0))}</strong>?
          </p>
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            Esta acción no se puede deshacer.
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

function PagoRow({
  pago, formatPrice, formatDate, getMetodoLabel, onEdit, onDelete,
}: {
  pago: PagoConDetalles;
  formatPrice: (n: number) => string;
  formatDate: (d: Date) => string;
  getMetodoLabel: (m: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
          {formatDate(pago.fechaPago)}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm" style={{ color: "var(--color-text-primary)" }}>{pago.clienteNombre}</div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Crédito: {formatPrice(pago.creditoMonto || 0)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-bold" style={{ color: "var(--color-success)", fontFamily: "var(--font-data)" }}>
          {formatPrice(Number(pago.monto))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge
          variant={
            pago.metodoPago === "efectivo" ? "success"
            : pago.metodoPago === "transferencia" ? "info"
            : pago.metodoPago === "mixto" ? "warning"
            : "default"
          }
        >
          {getMetodoLabel(pago.metodoPago)}
        </Badge>
      </td>
      <td className="px-6 py-4">
        {pago.metodoPago === "mixto" && pago.detallePago ? (
          <div className="text-xs space-y-1">
            {pago.detallePago.map((detalle, idx) => (
              <div key={idx} style={{ color: "var(--color-text-secondary)" }}>
                {getMetodoLabel(detalle.metodo)}: {formatPrice(detalle.monto)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {pago.referencia || "-"}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {/* FASE 32: Ticket 58mm */}
        <button
          onClick={() => {
            const html = generarTicketPagoCredito({
              pagoId: pago.id,
              fechaPago: pago.fechaPago,
              monto: Number(pago.monto),
              metodoPago: pago.metodoPago,
              referencia: pago.referencia,
              creditoFolio: pago.creditoFolio,
              saldoPendiente: 0,
              clienteNombre: pago.clienteNombre || "Cliente",
              clienteApellido: pago.clienteApellido,
            });
            abrirReporte(html, `Pago ${pago.id.slice(0, 8).toUpperCase()}`);
          }}
          className="mr-4"
          style={{ color: "var(--color-text-muted)" }}
          title="Imprimir ticket de pago"
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
        >
          <Printer className="w-4 h-4" />
        </button>
        <button
          onClick={onEdit}
          className="mr-4"
          style={{ color: "var(--color-info)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-info)")}
        >
          Editar
        </button>
        <button
          onClick={onDelete}
          style={{ color: "var(--color-danger)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-danger-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-danger)")}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

// Componente de Formulario
interface PagoFormProps {
  mode: "create" | "edit";
  pago: Pago | null;
  creditos: Credito[];
  clientes: Cliente[];
  onSuccess: () => void;
  onCancel: () => void;
}

function PagoForm({ mode, pago, creditos, clientes, onSuccess, onCancel }: PagoFormProps) {
  const [formData, setFormData] = useState({
    creditoId: pago?.creditoId || "",
    monto: pago?.monto?.toString() || "",
    fechaPago: pago?.fechaPago
      ? new Date(pago.fechaPago).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    metodoPago: pago?.metodoPago || "efectivo",
    referencia: pago?.referencia || "",
    cobradorId: pago?.cobradorId || "00000000-0000-0000-0000-000000000000",
  });

  const [detallePago, setDetallePago] = useState<DetallePagoMixto[]>(
    pago?.detallePago || [{ metodo: "efectivo", monto: 0 }, { metodo: "transferencia", monto: 0 }]
  );

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clientesMap = new Map(clientes.map((c) => [c.id, c]));
  const creditosActivos = creditos.filter((c) => c.estado === "activo");
  const esPagoMixto = formData.metodoPago === "mixto";

  useEffect(() => {
    if (esPagoMixto) {
      const total = detallePago.reduce((sum, d) => sum + Number(d.monto || 0), 0);
      setFormData((prev) => ({ ...prev, monto: total.toFixed(2) }));
    }
  }, [detallePago, esPagoMixto]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleDetalleChange = (index: number, field: keyof DetallePagoMixto, value: string | number) => {
    setDetallePago((prev) => {
      const newDetalle = [...prev];
      newDetalle[index] = { ...newDetalle[index], [field]: field === "monto" ? Number(value) : value };
      return newDetalle;
    });
  };

  const agregarDetalle = () => setDetallePago((prev) => [...prev, { metodo: "efectivo", monto: 0 }]);
  const eliminarDetalle = (index: number) => {
    if (detallePago.length > 1) setDetallePago((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.creditoId) newErrors.creditoId = "Selecciona un crédito";
    if (!formData.monto || Number(formData.monto) <= 0) newErrors.monto = "El monto debe ser mayor a 0";
    if (!formData.fechaPago) newErrors.fechaPago = "La fecha es requerida";
    if (esPagoMixto) {
      const totalDetalle = detallePago.reduce((sum, d) => sum + Number(d.monto || 0), 0);
      if (totalDetalle <= 0) newErrors.detallePago = "El total de los pagos mixtos debe ser mayor a 0";
      if (detallePago.some((d) => !d.monto || Number(d.monto) <= 0)) newErrors.detallePago = "Todos los montos deben ser mayores a 0";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/pagos" : `/api/pagos/${pago?.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const payload: any = {
        creditoId: formData.creditoId,
        monto: Number(formData.monto),
        fechaPago: formData.fechaPago,
        metodoPago: formData.metodoPago,
        referencia: formData.referencia,
        cobradorId: formData.cobradorId,
      };
      if (esPagoMixto) payload.detallePago = detallePago;
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (response.ok) { onSuccess(); } else { const data = await response.json(); console.error("Error:", data); }
    } catch (error) {
      console.error("Error al guardar pago:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = {
    background: "var(--color-bg-sunken)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
  };
  const labelStyle = { color: "var(--color-text-secondary)" };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={labelStyle}>
          Crédito <span style={{ color: "var(--color-danger)" }}>*</span>
        </label>
        <select
          name="creditoId"
          value={formData.creditoId}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
          style={selectStyle}
          required
        >
          <option value="">Selecciona un crédito</option>
          {creditosActivos.map((credito) => {
            const cliente = clientesMap.get(credito.clienteId);
            return (
              <option key={credito.id} value={credito.id}>
                {cliente?.nombre} {cliente?.apellido} - ${Number(credito.monto).toLocaleString()} ({credito.estado})
              </option>
            );
          })}
        </select>
        {errors.creditoId && <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>{errors.creditoId}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={labelStyle}>
          Método de Pago <span style={{ color: "var(--color-danger)" }}>*</span>
        </label>
        <select
          name="metodoPago"
          value={formData.metodoPago}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
          style={selectStyle}
          required
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="deposito">Depósito</option>
          <option value="mixto">Pago Mixto (Combinado)</option>
        </select>
      </div>

      {!esPagoMixto ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Monto" name="monto" type="number" step="0.01" value={formData.monto} onChange={handleChange} error={errors.monto} placeholder="1000.00" required />
            <Input label="Fecha de Pago" name="fechaPago" type="date" value={formData.fechaPago} onChange={handleChange} error={errors.fechaPago} required />
          </div>
          <Input label="TAG / Nombre (opcional)" name="referencia" value={formData.referencia} onChange={handleChange} placeholder="Etiqueta o nombre para identificar el pago" />
        </>
      ) : (
        <>
          <div className="pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium" style={labelStyle}>
                Desglose del Pago Mixto <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <button
                type="button"
                onClick={agregarDetalle}
                className="text-sm"
                style={{ color: "var(--color-accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
              >
                + Agregar método
              </button>
            </div>

            <div className="space-y-3">
              {detallePago.map((detalle, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-start rounded-md p-3"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <div className="flex-1">
                    <select
                      value={detalle.metodo}
                      onChange={(e) => handleDetalleChange(index, "metodo", e.target.value as "efectivo" | "transferencia" | "deposito")}
                      className="w-full px-3 py-2 rounded-md text-sm focus:outline-none"
                      style={selectStyle}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="deposito">Depósito</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      value={detalle.monto}
                      onChange={(e) => handleDetalleChange(index, "monto", e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-md text-sm focus:outline-none"
                      style={selectStyle}
                    />
                  </div>
                  {detallePago.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarDetalle(index)}
                      className="p-2"
                      style={{ color: "var(--color-danger)" }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.detallePago && <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>{errors.detallePago}</p>}
          </div>

          <div className="rounded-md p-3" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-border)" }}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Total del Pago:
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
                ${Number(formData.monto).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <Input label="Fecha de Pago" name="fechaPago" type="date" value={formData.fechaPago} onChange={handleChange} error={errors.fechaPago} required />
          <Input label="TAG / Nombre (opcional)" name="referencia" value={formData.referencia} onChange={handleChange} placeholder="Etiqueta o nombre para identificar el pago" />
        </>
      )}

      <div className="flex gap-3 justify-end pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : mode === "create" ? "Registrar Pago" : "Guardar Cambios"}
        </Button>
      </div>
    </form>
  );
}
