"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Empleado, UserRole } from "@/types";
import type { CSSProperties } from "react";

interface Distribuidor {
  id: string;
  nombre: string;
  activo: boolean;
}

interface EmpleadoStats {
  total: number;
  activos: number;
  inactivos: number;
  porRol: { admin: number; vendedor: number; cobrador: number; tecnico: number };
}

export default function EmpleadosPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !["admin", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [filteredEmpleados, setFilteredEmpleados] = useState<Empleado[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRol, setFilterRol] = useState<UserRole | "todos">("todos");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activo" | "inactivo">("activo");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmpleadoStats | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [empleadoToDelete, setEmpleadoToDelete] = useState<Empleado | null>(null);
  const [distribuidores, setDistribuidores] = useState<Distribuidor[]>([]);

  const [formData, setFormData] = useState({
    email: "", name: "", role: "vendedor" as UserRole,
    telefono: "", direccion: "",
    fechaIngreso: new Date().toISOString().split("T")[0],
    sueldoBase: 0, comisionPorcentaje: 0, activo: true, notas: "",
    distribuidorId: "",
  });

  useEffect(() => {
    fetchEmpleados();
    fetchStats();
  }, []);

  // Cargar distribuidores solo para super_admin
  useEffect(() => {
    if (user?.role === "super_admin") {
      fetch("/api/admin/distribuidores")
        .then((r) => r.json())
        .then((d) => { if (d.success) setDistribuidores(d.data || []); })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    let filtered = empleados;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.name.toLowerCase().includes(query) ||
          emp.email.toLowerCase().includes(query) ||
          emp.telefono?.toLowerCase().includes(query)
      );
    }
    if (filterRol !== "todos") filtered = filtered.filter((emp) => emp.role === filterRol);
    if (filterEstado !== "todos") {
      const activo = filterEstado === "activo";
      filtered = filtered.filter((emp) => emp.activo === activo);
    }
    setFilteredEmpleados(filtered);
  }, [searchQuery, filterRol, filterEstado, empleados]);

  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/empleados");
      const data = await response.json();
      if (data.success) setEmpleados(data.data);
    } catch (error) {
      console.error("Error al cargar empleados:", error);
      alert("Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/empleados?stats=true");
      const data = await response.json();
      if (data.success) setStats(data.data);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  };

  const handleCreate = () => {
    setModalMode("create");
    setSelectedEmpleado(null);
    setFormData({ email: "", name: "", role: "vendedor", telefono: "", direccion: "", fechaIngreso: new Date().toISOString().split("T")[0], sueldoBase: 0, comisionPorcentaje: 0, activo: true, notas: "", distribuidorId: "" });
    setIsModalOpen(true);
  };

  const handleEdit = (empleado: Empleado) => {
    setModalMode("edit");
    setSelectedEmpleado(empleado);
    setFormData({
      email: empleado.email, name: empleado.name, role: empleado.role,
      telefono: empleado.telefono || "", direccion: empleado.direccion || "",
      fechaIngreso: empleado.fechaIngreso ? new Date(empleado.fechaIngreso).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      sueldoBase: empleado.sueldoBase || 0, comisionPorcentaje: empleado.comisionPorcentaje || 0,
      activo: empleado.activo, notas: empleado.notas || "",
      distribuidorId: empleado.distribuidorId || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (empleado: Empleado) => { setEmpleadoToDelete(empleado); setDeleteConfirmModal(true); };

  const handleDeleteConfirm = async () => {
    if (!empleadoToDelete) return;
    try {
      const response = await fetch(`/api/empleados/${empleadoToDelete.id}`, { method: "DELETE" });
      if (response.ok) {
        await fetchEmpleados(); await fetchStats();
        setDeleteConfirmModal(false); setEmpleadoToDelete(null);
        alert("Empleado desactivado correctamente");
      } else { alert("Error al desactivar empleado"); }
    } catch (error) {
      console.error("Error al desactivar empleado:", error);
      alert("Error al desactivar empleado");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      alert("Por favor complete los campos obligatorios");
      return;
    }
    try {
      const url = modalMode === "create" ? "/api/empleados" : `/api/empleados/${selectedEmpleado?.id}`;
      const method = modalMode === "create" ? "POST" : "PUT";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const result = await response.json();
      if (result.success) {
        await fetchEmpleados(); await fetchStats();
        setIsModalOpen(false);
        if (modalMode === "create" && result.tempPassword) {
          alert(`✅ Empleado creado exitosamente.\n\n📧 Email: ${formData.email}\n🔑 Contraseña temporal: ${result.tempPassword}\n\nComparte estos datos con el empleado. Deberá cambiar su contraseña al iniciar sesión.`);
        } else {
          alert(modalMode === "create" ? "Empleado creado exitosamente" : "Empleado actualizado exitosamente");
        }
      } else {
        alert(result.error || result.message || "Error al guardar empleado");
      }
    } catch (error) {
      console.error("Error al guardar empleado:", error);
      alert("Error al guardar empleado");
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    const variants: Record<UserRole, "success" | "warning" | "info" | "danger"> = {
      super_admin: "danger", admin: "danger", vendedor: "success", cobrador: "warning", tecnico: "info",
    };
    return variants[role];
  };

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      super_admin: "Super Admin", admin: "Administrador", vendedor: "Vendedor", cobrador: "Cobrador", tecnico: "Técnico",
    };
    return labels[role];
  };

  const getRoleIcon = (role: UserRole) => {
    const icons: Record<UserRole, string> = {
      super_admin: "🌐", admin: "👑", vendedor: "💼", cobrador: "💰", tecnico: "🔧",
    };
    return icons[role];
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const selectStyle: CSSProperties = {
    background: "var(--color-bg-sunken)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
  };
  const labelStyle: CSSProperties = { color: "var(--color-text-secondary)" };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" style={{ borderColor: "var(--color-accent)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Cargando empleados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Gestión de Empleados
        </h1>
        <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Administra tu equipo: vendedores, cobradores, técnicos y administradores
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {[
          { emoji: "👥", label: "Total", value: stats?.total || 0, sub: `${stats?.activos || 0} activos`, color: "var(--color-info)", bg: "var(--color-info-bg)" },
          { emoji: "👑", label: "Admin", value: stats?.porRol.admin || 0, color: "var(--color-danger)", bg: "var(--color-danger-bg)" },
          { emoji: "💼", label: "Vendedores", value: stats?.porRol.vendedor || 0, color: "var(--color-success)", bg: "var(--color-success-bg)" },
          { emoji: "💰", label: "Cobradores", value: stats?.porRol.cobrador || 0, color: "var(--color-warning)", bg: "var(--color-warning-bg)" },
          { emoji: "🔧", label: "Técnicos", value: stats?.porRol.tecnico || 0, color: "var(--color-accent)", bg: "var(--color-accent-light)" },
        ].map((s) => (
          <Card key={s.label} style={{ background: s.bg }}>
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: s.color }}>
                {s.emoji} {s.label}
              </p>
              <p className="text-4xl font-bold" style={{ color: s.color, fontFamily: "var(--font-data)" }}>
                {s.value}
              </p>
              {s.sub && <p className="text-xs mt-1" style={{ color: s.color, opacity: 0.7 }}>{s.sub}</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 flex flex-col md:flex-row gap-3 w-full">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterRol}
                onChange={(e) => setFilterRol(e.target.value as UserRole | "todos")}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={selectStyle}
              >
                <option value="todos">Todos los roles</option>
                <option value="admin">Administrador</option>
                <option value="vendedor">Vendedor</option>
                <option value="cobrador">Cobrador</option>
                <option value="tecnico">Técnico</option>
              </select>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value as "todos" | "activo" | "inactivo")}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={selectStyle}
              >
                <option value="activo">Solo activos</option>
                <option value="todos">Todos</option>
                <option value="inactivo">Solo inactivos</option>
              </select>
            </div>
          </div>
          <Button variant="primary" onClick={handleCreate}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Empleado
          </Button>
        </div>

        {(searchQuery || filterRol !== "todos" || filterEstado !== "todos") && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Mostrando {filteredEmpleados.length} de {empleados.length} empleados
            </p>
          </div>
        )}
      </Card>

      {/* Tabla */}
      <Card>
        {filteredEmpleados.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 mb-3" style={{ color: "var(--color-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              No se encontraron empleados
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery || filterRol !== "todos" || filterEstado !== "todos"
                ? "Intenta ajustar los filtros de búsqueda"
                : "Comienza agregando un nuevo empleado"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}>
                <tr>
                  {["Empleado", "Contacto", "Rol", "Sueldo", "Estado", "Acciones"].map((h, i) => (
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
                {filteredEmpleados.map((empleado) => (
                  <EmpleadoRow
                    key={empleado.id}
                    empleado={empleado}
                    getInitials={getInitials}
                    getRoleIcon={getRoleIcon}
                    getRoleLabel={getRoleLabel}
                    getRoleBadgeVariant={getRoleBadgeVariant}
                    onEdit={() => handleEdit(empleado)}
                    onDelete={() => handleDeleteClick(empleado)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Crear/Editar */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === "create" ? "Nuevo Empleado" : "Editar Empleado"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>
                Nombre completo <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>
                Email <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>
                Rol <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={selectStyle}
                required
              >
                <option value="vendedor">Vendedor</option>
                <option value="cobrador">Cobrador</option>
                <option value="tecnico">Técnico</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>Teléfono</label>
              <Input type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>Dirección</label>
            <Input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} />
          </div>

          {/* Selector de sucursal — solo para super_admin */}
          {user?.role === "super_admin" && distribuidores.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>Sucursal / Distribuidor</label>
              <select
                value={formData.distribuidorId}
                onChange={(e) => setFormData({ ...formData, distribuidorId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={selectStyle}
              >
                <option value="">— Sin asignar (global) —</option>
                {distribuidores.filter((d) => d.activo).map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Asigna este empleado a una sucursal específica
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>Fecha de ingreso</label>
              <Input type="date" value={formData.fechaIngreso} onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>Sueldo base (MXN)</label>
              <Input type="number" min="0" step="0.01" value={formData.sueldoBase} onChange={(e) => setFormData({ ...formData, sueldoBase: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>Comisión (%)</label>
              <Input type="number" min="0" max="100" step="0.1" value={formData.comisionPorcentaje} onChange={(e) => setFormData({ ...formData, comisionPorcentaje: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>Notas</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={selectStyle}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="activo"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4 rounded"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <label htmlFor="activo" className="ml-2 block text-sm" style={{ color: "var(--color-text-primary)" }}>
              Empleado activo
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{modalMode === "create" ? "Crear" : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmación */}
      <Modal isOpen={deleteConfirmModal} onClose={() => setDeleteConfirmModal(false)} title="Confirmar Desactivación">
        <div className="space-y-4">
          <p style={{ color: "var(--color-text-primary)" }}>
            ¿Estás seguro que deseas desactivar al empleado{" "}
            <strong>{empleadoToDelete?.name}</strong>?
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            El empleado no será eliminado, solo se marcará como inactivo. Puedes reactivarlo en cualquier momento.
          </p>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <Button variant="secondary" onClick={() => setDeleteConfirmModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>Desactivar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EmpleadoRow({ empleado, getInitials, getRoleIcon, getRoleLabel, getRoleBadgeVariant, onEdit, onDelete }: {
  empleado: Empleado;
  getInitials: (n: string) => string;
  getRoleIcon: (r: UserRole) => string;
  getRoleLabel: (r: UserRole) => string;
  getRoleBadgeVariant: (r: UserRole) => "success" | "warning" | "info" | "danger";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--color-bg-elevated)" : "transparent",
        borderBottom: "1px solid var(--color-border-subtle)",
        transition: "background 150ms ease",
      }}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div
            className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-accent-light)" }}
          >
            <span className="font-semibold text-sm" style={{ color: "var(--color-accent)" }}>
              {getInitials(empleado.name)}
            </span>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              {empleado.name}
            </div>
            <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {empleado.email}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm" style={{ color: "var(--color-text-primary)" }}>{empleado.telefono || "—"}</div>
        <div className="text-sm truncate max-w-xs" style={{ color: "var(--color-text-muted)" }}>{empleado.direccion || "—"}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getRoleIcon(empleado.role)}</span>
          <Badge variant={getRoleBadgeVariant(empleado.role)}>{getRoleLabel(empleado.role)}</Badge>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
          {empleado.sueldoBase ? fmt(empleado.sueldoBase) : "—"}
        </div>
        {empleado.role === "vendedor" && empleado.comisionPorcentaje ? (
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            +{empleado.comisionPorcentaje}% comisión
          </div>
        ) : null}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={empleado.activo ? "success" : "default"}>
          {empleado.activo ? "Activo" : "Inactivo"}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
          {empleado.activo && (
            <Button variant="danger" size="sm" onClick={onDelete}>Desactivar</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
