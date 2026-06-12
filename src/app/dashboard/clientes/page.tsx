"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { CapturaDocumento } from "@/components/clientes/CapturaDocumento";
import { DashboardScoring } from "@/components/scoring/DashboardScoring";
import ImportPayjoyModal from "@/components/clientes/ImportPayjoyModal";
import type { Cliente } from "@/types";
import { ExportButton } from "@/components/ui/ExportButton";
import type { ColumnaExport } from "@/hooks/useExportCSV";
import { Zap, BarChart2, Camera, Pencil, Trash2, X, Wrench, Star, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface ClienteResumen {
  ordenesActivas: number;
  saldoPendiente: number;
  puntos: number;
}

// ─── ClienteRow ────────────────────────────────────────────────────────────────
// Definido FUERA del componente padre para evitar desmontaje en cada render.
function ClienteRow({
  cliente,
  onEdit,
  onDelete,
  onVerScoring,
}: {
  cliente: Cliente;
  onEdit: (c: Cliente) => void;
  onDelete: (c: Cliente) => void;
  onVerScoring: (c: Cliente) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [btnHover, setBtnHover] = useState<"scoring" | "edit" | "delete" | "actividad" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [resumen, setResumen] = useState<ClienteResumen | null>(null);
  const [loadingResumen, setLoadingResumen] = useState(false);

  const handleToggleActividad = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && !resumen) {
      setLoadingResumen(true);
      try {
        const res = await fetch(`/api/clientes/${cliente.id}/resumen`);
        const data = await res.json();
        if (data.success) setResumen(data.data);
      } catch { /* silencioso */ }
      finally { setLoadingResumen(false); }
    }
    setExpanded((v) => !v);
  };

  const fmtMXN = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

  return (
    <>
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setBtnHover(null); }}
      onClick={() => onEdit(cliente)}
      style={{
        borderBottom: expanded ? "none" : "1px solid var(--color-border-subtle)",
        background: hovered ? "var(--color-bg-elevated)" : "transparent",
        cursor: "pointer",
        transition: "background 150ms ease",
      }}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <a
          href={`/dashboard/clientes/${cliente.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium hover:underline"
          style={{ color: "var(--color-text-primary)" }}
        >
          {cliente.nombre} {cliente.apellido}
        </a>
        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          INE: <span style={{ fontFamily: "var(--font-mono)" }}>{cliente.ine}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>{cliente.telefono}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{cliente.email}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant="info">{cliente.curp}</Badge>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm max-w-xs truncate" style={{ color: "var(--color-text-primary)" }}>
          {cliente.direccion}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onVerScoring(cliente); }}
            onMouseEnter={() => setBtnHover("scoring")}
            onMouseLeave={() => setBtnHover(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              color: "var(--color-accent)",
              background: btnHover === "scoring" ? "var(--color-accent-light)" : "transparent",
              transition: "background 150ms ease",
            }}
          >
            <BarChart2 size={12} />Scoring
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(cliente); }}
            onMouseEnter={() => setBtnHover("edit")}
            onMouseLeave={() => setBtnHover(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              color: "var(--color-info)",
              background: btnHover === "edit" ? "var(--color-info-bg)" : "transparent",
              transition: "background 150ms ease",
            }}
          >
            <Pencil size={12} />Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(cliente); }}
            onMouseEnter={() => setBtnHover("delete")}
            onMouseLeave={() => setBtnHover(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              color: "var(--color-danger)",
              background: btnHover === "delete" ? "var(--color-danger-bg)" : "transparent",
              transition: "background 150ms ease",
            }}
          >
            <Trash2 size={12} />Eliminar
          </button>
          <button
            onClick={handleToggleActividad}
            onMouseEnter={() => setBtnHover("actividad")}
            onMouseLeave={() => setBtnHover(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              color: "var(--color-text-muted)",
              background: btnHover === "actividad" ? "var(--color-bg-elevated)" : "transparent",
              transition: "background 150ms ease",
            }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </td>
    </tr>
    {expanded && (
      <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
        <td colSpan={5} className="px-6 pb-3 pt-0">
          {loadingResumen ? (
            <div className="flex gap-6 py-2 animate-pulse">
              {[1,2,3].map((i) => (
                <div key={i} className="h-8 w-28 rounded-lg" style={{ background: "var(--color-bg-elevated)" }} />
              ))}
            </div>
          ) : resumen ? (
            <div className="flex flex-wrap items-center gap-4 py-2">
              <a
                href={`/dashboard/reparaciones?clienteId=${cliente.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: resumen.ordenesActivas > 0 ? "var(--color-accent-light)" : "var(--color-bg-elevated)",
                  color: resumen.ordenesActivas > 0 ? "var(--color-accent)" : "var(--color-text-muted)",
                  border: `1px solid ${resumen.ordenesActivas > 0 ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                  textDecoration: "none",
                }}
              >
                <Wrench size={12} />
                {resumen.ordenesActivas} orden{resumen.ordenesActivas !== 1 ? "es" : ""} activa{resumen.ordenesActivas !== 1 ? "s" : ""}
                <ExternalLink size={10} style={{ opacity: 0.6 }} />
              </a>
              {resumen.saldoPendiente > 0 && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-warning-bg)",
                    color: "var(--color-warning-text)",
                    border: "1px solid var(--color-warning-bg)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  Saldo pendiente: {fmtMXN(resumen.saldoPendiente)}
                </span>
              )}
              {resumen.puntos > 0 && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-success-bg)",
                    color: "var(--color-success-text)",
                    border: "1px solid var(--color-success-bg)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  <Star size={11} />
                  {resumen.puntos} puntos
                </span>
              )}
              {resumen.ordenesActivas === 0 && resumen.saldoPendiente === 0 && resumen.puntos === 0 && (
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Sin actividad activa
                </span>
              )}
            </div>
          ) : null}
        </td>
      </tr>
    )}
    </>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

const COLUMNAS_CLIENTES_CSV: ColumnaExport<Cliente>[] = [
  { header: "ID", accessor: "id" },
  { header: "Nombre", accessor: "nombre" },
  { header: "Apellido", accessor: "apellido" },
  { header: "Teléfono", accessor: "telefono" },
  { header: "Email", accessor: (r) => r.email ?? "" },
  { header: "CURP", accessor: "curp" },
  { header: "INE", accessor: "ine" },
  { header: "Dirección", accessor: "direccion" },
  { header: "Colonia", accessor: (r) => r.colonia ?? "" },
  { header: "Municipio", accessor: (r) => r.municipio ?? "" },
  { header: "Estado", accessor: (r) => r.estado ?? "" },
  { header: "CP", accessor: (r) => r.codigoPostal ?? "" },
  { header: "Notif WhatsApp", accessor: (r) => r.aceptaNotificacionesWhatsapp ? "Sí" : "No" },
  { header: "Fecha Registro", accessor: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-MX") : "" },
];

export default function ClientesPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [scoringModal, setScoringModal] = useState(false);
  const [clienteScoring, setClienteScoring] = useState<Cliente | null>(null);
  const [importPayjoyModal, setImportPayjoyModal] = useState(false);

  // Cargar clientes — espera a que auth resuelva para evitar request innecesario
  useEffect(() => {
    if (!user) return;
    fetchClientes();
  }, [user]);

  // Filtrar clientes cuando cambia la búsqueda
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredClientes(clientes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clientes.filter(
        (cliente) =>
          cliente.nombre.toLowerCase().includes(query) ||
          cliente.apellido.toLowerCase().includes(query) ||
          cliente.telefono.includes(query) ||
          cliente.email?.toLowerCase().includes(query) ||
          cliente.curp.toLowerCase().includes(query)
      );
      setFilteredClientes(filtered);
    }
  }, [searchQuery, clientes]);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/clientes");
      const data = await response.json();

      if (data.success) {
        setClientes(data.data);
        setFilteredClientes(data.data);
      }
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode("create");
    setSelectedCliente(null);
    setIsModalOpen(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setModalMode("edit");
    setSelectedCliente(cliente);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (cliente: Cliente) => {
    setClienteToDelete(cliente);
    setDeleteConfirmModal(true);
  };

  const handleVerScoring = (cliente: Cliente) => {
    setClienteScoring(cliente);
    setScoringModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clienteToDelete) return;

    try {
      const response = await fetch(`/api/clientes/${clienteToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchClientes();
        setDeleteConfirmModal(false);
        setClienteToDelete(null);
      }
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCliente(null);
  };

  const handleSuccess = () => {
    fetchClientes();
    handleModalClose();
  };

  const handleImportPayjoy = (clienteData: any) => {
    setModalMode("create");
    setSelectedCliente({
      id: "",
      nombre: clienteData.nombre || "",
      apellido: clienteData.apellido || "",
      telefono: clienteData.telefono || "",
      email: clienteData.email || "",
      direccion: clienteData.direccion || "",
      curp: "",
      ine: "",
      createdAt: new Date(),
    } as Cliente);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Clientes</h1>
        <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Gestiona la información de tus clientes
        </p>
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-96">
            <Input
              type="search"
              placeholder="Buscar por nombre, teléfono, CURP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <ExportButton<Cliente>
              datos={filteredClientes}
              columnas={COLUMNAS_CLIENTES_CSV}
              nombreArchivo="clientes"
              label="Exportar CSV"
            />
            <Button
              variant="secondary"
              onClick={() => setImportPayjoyModal(true)}
            >
              <Zap size={14} className="mr-1.5 inline-block" />Importar Payjoy
            </Button>
            <Button onClick={handleCreate}>
              + Nuevo Cliente
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Total Clientes</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
            {clientes.length}
          </div>
        </Card>
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Resultados</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
            {filteredClientes.length}
          </div>
        </Card>
        <Card interactive>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Buscando</div>
          <div className="text-lg font-medium mt-2 truncate" style={{ color: "var(--color-text-primary)" }}>
            {searchQuery || "Todos"}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "var(--color-accent)" }} />
            <p className="mt-4" style={{ color: "var(--color-text-muted)" }}>Cargando clientes...</p>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: "var(--color-text-muted)" }}>
              {searchQuery ? "No se encontraron clientes" : "No hay clientes registrados"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>CURP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Dirección</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.map((cliente) => (
                  <ClienteRow
                    key={cliente.id}
                    cliente={cliente}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onVerScoring={handleVerScoring}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Formulario */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={modalMode === "create" ? "Nuevo Cliente" : "Editar Cliente"}
        size="lg"
      >
        <ClienteForm
          mode={modalMode}
          cliente={selectedCliente}
          onSuccess={handleSuccess}
          onCancel={handleModalClose}
        />
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal
        isOpen={deleteConfirmModal}
        onClose={() => setDeleteConfirmModal(false)}
        title="Confirmar Eliminación"
      >
        <div className="space-y-4">
          <p style={{ color: "var(--color-text-primary)" }}>
            ¿Estás seguro de que deseas eliminar al cliente{" "}
            <strong>
              {clienteToDelete?.nombre} {clienteToDelete?.apellido}
            </strong>
            ?
          </p>
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Scoring Crediticio */}
      <Modal
        isOpen={scoringModal}
        onClose={() => setScoringModal(false)}
        title={`Scoring Crediticio - ${clienteScoring?.nombre} ${clienteScoring?.apellido}`}
        size="lg"
      >
        {clienteScoring && <DashboardScoring clienteId={clienteScoring.id} />}
      </Modal>

      {/* FASE 20: Modal Importar Payjoy */}
      <ImportPayjoyModal
        isOpen={importPayjoyModal}
        onClose={() => setImportPayjoyModal(false)}
        onImport={handleImportPayjoy}
      />
    </div>
  );
}

// Componente de Formulario
interface ClienteFormProps {
  mode: "create" | "edit";
  cliente: Cliente | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function ClienteForm({ mode, cliente, onSuccess, onCancel }: ClienteFormProps) {
  const [formData, setFormData] = useState({
    nombre: cliente?.nombre || "",
    apellido: cliente?.apellido || "",
    telefono: cliente?.telefono || "",
    email: cliente?.email || "",
    direccion: cliente?.direccion || "",
    curp: cliente?.curp || "",
    ine: cliente?.ine || "",
    fotoIneFrontal: cliente?.fotoIneFrontal || "",
    fotoIneReverso: cliente?.fotoIneReverso || "",
    fotoComprobanteDomicilio: cliente?.fotoComprobanteDomicilio || "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Limpiar error del campo
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) newErrors.nombre = "El nombre es requerido";
    if (!formData.apellido.trim()) newErrors.apellido = "El apellido es requerido";
    if (!formData.telefono.trim()) newErrors.telefono = "El teléfono es requerido";
    if (!formData.direccion.trim()) newErrors.direccion = "La dirección es requerida";

    // CURP e INE son OPCIONALES ahora
    // Solo validar formato si se proporcionan
    if (formData.curp && formData.curp.length !== 18) {
      newErrors.curp = "El CURP debe tener 18 caracteres (si se proporciona)";
    }

    // Validar formato de teléfono (10 dígitos)
    if (formData.telefono && !/^\d{10}$/.test(formData.telefono)) {
      newErrors.telefono = "El teléfono debe tener 10 dígitos";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      const url = mode === "create" ? "/api/clientes" : `/api/clientes/${cliente?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        console.error("Error:", data);
      }
    } catch (error) {
      console.error("Error al guardar cliente:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          error={errors.nombre}
          required
        />
        <Input
          label="Apellido"
          name="apellido"
          value={formData.apellido}
          onChange={handleChange}
          error={errors.apellido}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Teléfono"
          name="telefono"
          value={formData.telefono}
          onChange={handleChange}
          error={errors.telefono}
          placeholder="10 dígitos"
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />
      </div>

      <Input
        label="Dirección"
        name="direccion"
        value={formData.direccion}
        onChange={handleChange}
        error={errors.direccion}
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="CURP (opcional)"
          name="curp"
          value={formData.curp}
          onChange={handleChange}
          error={errors.curp}
          placeholder="18 caracteres (opcional)"
          maxLength={18}
        />
        <Input
          label="INE (opcional)"
          name="ine"
          value={formData.ine}
          onChange={handleChange}
          error={errors.ine}
          placeholder="Número de INE (opcional)"
        />
      </div>

      {/* Sección de Documentos */}
      <div className="pt-4 mt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          <Camera size={18} className="inline-block mr-2 align-middle" style={{ color: "var(--color-accent)" }} />Documentos (Opcional)
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Si el cliente trae documentos, toma fotos. Se comprimen automáticamente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CapturaDocumento
            label="INE Frontal"
            tipoDocumento="ine_frontal"
            imagenActual={formData.fotoIneFrontal}
            onImagenCargada={(_path, url) => {
              setFormData({ ...formData, fotoIneFrontal: url });
            }}
            onImagenEliminada={() => {
              setFormData({ ...formData, fotoIneFrontal: "" });
            }}
            descripcion="Foto del frente de la credencial INE"
          />

          <CapturaDocumento
            label="INE Reverso"
            tipoDocumento="ine_reverso"
            imagenActual={formData.fotoIneReverso}
            onImagenCargada={(_path, url) => {
              setFormData({ ...formData, fotoIneReverso: url });
            }}
            onImagenEliminada={() => {
              setFormData({ ...formData, fotoIneReverso: "" });
            }}
            descripcion="Foto del reverso de la credencial INE"
          />
        </div>

        <div className="mt-4">
          <CapturaDocumento
            label="Comprobante de Domicilio"
            tipoDocumento="comprobante"
            imagenActual={formData.fotoComprobanteDomicilio}
            onImagenCargada={(_path, url) => {
              setFormData({ ...formData, fotoComprobanteDomicilio: url });
            }}
            onImagenEliminada={() => {
              setFormData({ ...formData, fotoComprobanteDomicilio: "" });
            }}
            descripcion="Recibo de luz, agua, predial, etc."
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 mt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : mode === "create" ? "Crear Cliente" : "Guardar Cambios"}
        </Button>
      </div>
    </form>
  );
}
