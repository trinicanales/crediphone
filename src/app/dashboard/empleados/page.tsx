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
import { RolIcon } from "@/components/icons";
import { Users, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import PermisosEmpleadoPanel from "@/components/empleados/PermisosEmpleadoPanel";

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
  const [showPassword, setShowPassword] = useState(false);
  const [credencialesModal, setCredencialesModal] = useState(false);
  const [credenciales, setCredenciales] = useState({ email: "", password: "", name: "" });

  // FASE 56 — Modal de permisos
  const [permisosModal, setPermisosModal]       = useState(false);
  const [empleadoPermisos, setEmpleadoPermisos] = useState<Empleado | null>(null);

  const [formData, setFormData] = useState({
    email: "", name: "", role: "vendedor" as UserRole,
    telefono: "", direccion: "",
    fechaIngreso: new Date().toISOString().split("T")[0],
    sueldoBase: 0, comisionPorcentaje: 0, activo: true, notas: "",
    distribuidorId: "", password: "",
  });

  // PAGES-002: Esperar a que el user esté cargado y tenga permisos antes de hacer fetch
  // (evita requests 403 durante la carga inicial de auth)
  useEffect(() => {
    if (!user) return;
    if (!["admin", "super_admin"].includes(user.role)) return;
    fetchEmpleados();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    setShowPassword(false);
    setFormData({ email: "", name: "", role: "vendedor", telefono: "", direccion: "", fechaIngreso: new Date().toISOString().split("T")[0], sueldoBase: 0, comisionPorcentaje: 0, activo: true, notas: "", distribuidorId: "", password: "" });
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
      distribuidorId: empleado.distribuidorId || "", password: "",
    });
    setShowPassword(false);
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
          setCredenciales({ email: formData.email, password: result.tempPassword, name: formData.name });
          setCredencialesModal(true);
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

  // getRoleIcon eliminado — se usa <RolIcon rol={...} /> directamente

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
          { rol: null,          Icon: Users,  label: "Total",      value: stats?.total || 0,            sub: `${stats?.activos || 0} activos`, color: "var(--color-info)",    bg: "var(--color-info-bg)" },
          { rol: "admin",       Icon: null,   label: "Admin",      value: stats?.porRol.admin || 0,     sub: undefined,                        color: "var(--color-danger)",  bg: "var(--color-danger-bg)" },
          { rol: "vendedor",    Icon: null,   label: "Vendedores", value: stats?.porRol.vendedor || 0,  sub: undefined,                        color: "var(--color-success)", bg: "var(--color-success-bg)" },
          { rol: "cobrador",    Icon: null,   label: "Cobradores", value: stats?.porRol.cobrador || 0,  sub: undefined,                        color: "var(--color-warning)", bg: "var(--color-warning-bg)" },
          { rol: "tecnico",     Icon: null,   label: "Técnicos",   value: stats?.porRol.tecnico || 0,   sub: undefined,                        color: "var(--color-accent)",  bg: "var(--color-accent-light)" },
        ].map((s) => (
          <Card key={s.label} style={{ background: s.bg }}>
            <div className="text-center">
              <p className="text-sm font-medium mb-1 flex items-center justify-center gap-1.5" style={{ color: s.color }}>
                {s.rol
                  ? <RolIcon rol={s.rol} size={14} />
                  : s.Icon && <s.Icon size={14} />
                }
                {s.label}
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
                    getRoleLabel={getRoleLabel}
                    getRoleBadgeVariant={getRoleBadgeVariant}
                    onEdit={() => handleEdit(empleado)}
                    onDelete={() => handleDeleteClick(empleado)}
                    onPermisos={["vendedor","cobrador","tecnico"].includes(empleado.role)
                      ? () => { setEmpleadoPermisos(empleado); setPermisosModal(true); }
                      : undefined}
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

          {/* Campo contraseña — solo al crear */}
          {modalMode === "create" && (
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>
                Contraseña de acceso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Dejar vacío para generar automáticamente"
                  className="w-full px-3 py-2 pr-10 rounded-lg text-sm focus:outline-none"
                  style={selectStyle}
                  minLength={formData.password ? 8 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Mínimo 8 caracteres. Si lo dejas vacío se genera una contraseña segura automáticamente.
              </p>
            </div>
          )}

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
            <Button type="submit" variant="primary">{modalMode === "create" ? "Crear Empleado" : "Guardar Cambios"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Credenciales — se muestra tras crear empleado */}
      <Modal isOpen={credencialesModal} onClose={() => setCredencialesModal(false)} title="Empleado creado exitosamente">
        <div className="space-y-5">
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Comparte estas credenciales con <strong style={{ color: "var(--color-text-primary)" }}>{credenciales.name}</strong> para que pueda iniciar sesión.
          </p>

          {/* Email */}
          <div className="rounded-xl p-4" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Email</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                {credenciales.email}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(credenciales.email)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              >
                Copiar
              </button>
            </div>
          </div>

          {/* Contraseña */}
          <div className="rounded-xl p-4" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Contraseña</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold tracking-widest" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                {credenciales.password}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(credenciales.password)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
              >
                Copiar
              </button>
            </div>
          </div>

          <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
            <p className="text-xs" style={{ color: "var(--color-warning-text)" }}>
              Guarda esta contraseña ahora — no podrás verla de nuevo después de cerrar este mensaje.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${credenciales.email}\nContraseña: ${credenciales.password}`);
              }}
            >
              Copiar todo
            </Button>
            <Button type="button" variant="primary" className="flex-1" onClick={() => setCredencialesModal(false)}>
              Entendido
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Permisos — FASE 56 */}
      <Modal
        isOpen={permisosModal}
        onClose={() => { setPermisosModal(false); setEmpleadoPermisos(null); }}
        title={`Permisos de ${empleadoPermisos?.name ?? ""}`}
        size="lg"
      >
        {empleadoPermisos && (
          <PermisosEmpleadoPanel
            empleadoId={empleadoPermisos.id}
            empleadoRol={empleadoPermisos.role}
            empleadoNombre={empleadoPermisos.name}
            canEdit={["admin","super_admin"].includes(user?.role ?? "")}
          />
        )}
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

function EmpleadoRow({ empleado, getInitials, getRoleLabel, getRoleBadgeVariant, onEdit, onDelete, onPermisos }: {
  empleado: Empleado;
  getInitials: (n: string) => string;
  getRoleLabel: (r: UserRole) => string;
  getRoleBadgeVariant: (r: UserRole) => "success" | "warning" | "info" | "danger";
  onEdit: () => void;
  onDelete: () => void;
  onPermisos?: () => void;
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
          <RolIcon rol={empleado.role} size={16} badge />
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
          {onPermisos && empleado.role !== "admin" && empleado.role !== "super_admin" && (
            <Button variant="ghost" size="sm" onClick={onPermisos}>
              <Shield size={14} className="mr-1" />Permisos
            </Button>
          )}
          {empleado.activo && (
            <Button variant="danger" size="sm" onClick={onDelete}>Desactivar</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
