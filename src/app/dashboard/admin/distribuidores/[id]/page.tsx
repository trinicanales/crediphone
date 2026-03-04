"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2, ArrowLeft, Users, CreditCard, Package,
  ShoppingCart, DollarSign, ToggleLeft, ToggleRight,
  Pencil, RefreshCw, CheckCircle, XCircle, UserCheck, UserPlus, Copy, Check,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Distribuidor } from "@/types";

interface Stats {
  totalClientes: number;
  totalCreditos: number;
  creditosActivos: number;
  totalProductos: number;
  totalEmpleados: number;
  ventasHoy: number;
  montoTotalCreditos: number;
  montoActivosCreditos: number;
  empleados: Array<{ id: string; name: string; role: string; activo: boolean; created_at: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  vendedor: "Vendedor",
  cobrador: "Cobrador",
  tecnico: "Técnico",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  vendedor: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  cobrador: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  tecnico: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  super_admin: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function DistribuidorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [distribuidor, setDistribuidor] = useState<Distribuidor | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editForm, setEditForm] = useState({ nombre: "", slug: "", logoUrl: "", activo: true });

  // Modal asignar empleados existentes
  const [showAsignarEmpleado, setShowAsignarEmpleado] = useState(false);
  const [todosEmpleados, setTodosEmpleados] = useState<{ id: string; name: string; role: string; distribuidorId: string | null }[]>([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);
  const [busquedaEmpleado, setBusquedaEmpleado] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [asignando, setAsignando] = useState(false);
  const [asignarError, setAsignarError] = useState("");

  // Modal crear empleado
  const [showCrearEmpleado, setShowCrearEmpleado] = useState(false);
  const [empleadoForm, setEmpleadoForm] = useState({ name: "", email: "", role: "vendedor" });
  const [creandoEmpleado, setCreandoEmpleado] = useState(false);
  const [empleadoError, setEmpleadoError] = useState("");
  const [tempPasswordMostrado, setTempPasswordMostrado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDistribuidor();
      fetchStats();
    }
  }, [id]);

  const fetchDistribuidor = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/distribuidores/${id}`);
      const data = await res.json();
      if (data.success) {
        setDistribuidor(data.data);
        setEditForm({
          nombre: data.data.nombre,
          slug: data.data.slug,
          logoUrl: data.data.logoUrl || "",
          activo: data.data.activo,
        });
      } else {
        router.push("/dashboard/admin/distribuidores");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch(`/api/admin/distribuidores/${id}/stats`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleToggleActivo = async () => {
    if (!distribuidor) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/distribuidores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !distribuidor.activo }),
      });
      const data = await res.json();
      if (data.success) setDistribuidor(data.data);
    } finally {
      setToggling(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/distribuidores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setDistribuidor(data.data);
        setShowEdit(false);
      } else {
        setError(data.error || "Error al guardar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const fetchTodosEmpleados = async () => {
    setCargandoEmpleados(true);
    try {
      const res = await fetch("/api/empleados");
      const data = await res.json();
      if (data.success) {
        // Excluir super_admin y los que ya pertenecen a ESTE distribuidor
        const disponibles = data.data.filter(
          (e: { role: string; distribuidorId: string | null }) =>
            e.role !== "super_admin" && e.distribuidorId !== id
        );
        setTodosEmpleados(disponibles);
      }
    } finally {
      setCargandoEmpleados(false);
    }
  };

  const toggleSeleccion = (empId: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const handleAsignarEmpleados = async () => {
    if (seleccionados.size === 0) {
      setAsignarError("Selecciona al menos un empleado");
      return;
    }
    setAsignando(true);
    setAsignarError("");
    try {
      const res = await fetch(`/api/admin/distribuidores/${id}/asignar-empleado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empleadoIds: Array.from(seleccionados) }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAsignarEmpleado(false);
        setSeleccionados(new Set());
        setBusquedaEmpleado("");
        fetchStats(); // Refrescar lista de empleados
        alert(`✓ ${data.message}`);
      } else {
        setAsignarError(data.error || "Error al asignar");
      }
    } catch {
      setAsignarError("Error de conexión");
    } finally {
      setAsignando(false);
    }
  };

  const handleCrearEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empleadoForm.name || !empleadoForm.email || !empleadoForm.role) {
      setEmpleadoError("Nombre, email y rol son obligatorios");
      return;
    }
    setCreandoEmpleado(true);
    setEmpleadoError("");
    try {
      const res = await fetch("/api/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...empleadoForm,
          distribuidorId: id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTempPasswordMostrado(data.tempPassword);
        setEmpleadoForm({ name: "", email: "", role: "vendedor" });
        fetchStats(); // refrescar lista de empleados
      } else {
        setEmpleadoError(data.error || data.message || "Error al crear empleado");
      }
    } catch {
      setEmpleadoError("Error de conexión");
    } finally {
      setCreandoEmpleado(false);
    }
  };

  const handleCopyPassword = () => {
    if (tempPasswordMostrado) {
      navigator.clipboard.writeText(tempPasswordMostrado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!distribuidor) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin/distribuidores">
            <button className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            {distribuidor.logoUrl ? (
              <img src={distribuidor.logoUrl} alt={distribuidor.nombre} className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-700" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{distribuidor.nombre}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
                  {distribuidor.slug}
                </span>
                <Badge variant={distribuidor.activo ? "success" : "default"}>
                  {distribuidor.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchDistribuidor(); fetchStats(); }}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? "animate-spin" : ""}`} />
          </button>
          <Button variant="secondary" onClick={() => setShowEdit(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <button
            onClick={handleToggleActivo}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
              distribuidor.activo
                ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                : "border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
            }`}
          >
            {distribuidor.activo ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
            {distribuidor.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>

      {/* Info básica */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">ID</p>
            <p className="font-mono text-gray-700 dark:text-gray-300 mt-1 text-xs">{distribuidor.id}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Slug</p>
            <p className="font-mono text-gray-700 dark:text-gray-300 mt-1">{distribuidor.slug}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Creado</p>
            <p className="text-gray-700 dark:text-gray-300 mt-1">
              {new Date(distribuidor.createdAt).toLocaleDateString("es-MX")}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Logo URL</p>
            <p className="text-gray-700 dark:text-gray-300 mt-1 truncate text-xs">
              {distribuidor.logoUrl || "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Clientes", value: stats.totalClientes, icon: Users, color: "text-blue-600" },
            { label: "Créditos totales", value: stats.totalCreditos, icon: CreditCard, color: "text-indigo-600" },
            { label: "Créditos activos", value: stats.creditosActivos, icon: CreditCard, color: "text-green-600" },
            { label: "Productos", value: stats.totalProductos, icon: Package, color: "text-orange-600" },
            { label: "Empleados activos", value: stats.totalEmpleados, icon: UserCheck, color: "text-purple-600" },
            { label: "Ventas hoy", value: stats.ventasHoy, icon: ShoppingCart, color: "text-teal-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-4 text-center">
              <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Montos */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Cartera total en créditos</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white ml-8">
              {fmt(stats.montoTotalCreditos)}
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <DollarSign className="w-5 h-5 text-green-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Cartera activa (por cobrar)</p>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 ml-8">
              {fmt(stats.montoActivosCreditos)}
            </p>
          </Card>
        </div>
      )}

      {/* Lista de Empleados */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Empleados de esta tienda
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{stats?.empleados?.length ?? 0} registrados</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowAsignarEmpleado(true);
                setSeleccionados(new Set());
                setBusquedaEmpleado("");
                setAsignarError("");
                fetchTodosEmpleados();
              }}
            >
              <Users className="w-3.5 h-3.5 mr-1" />
              Asignar existentes
            </Button>
            <Button
              size="sm"
              onClick={() => { setShowCrearEmpleado(true); setEmpleadoError(""); setTempPasswordMostrado(null); }}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              Nuevo empleado
            </Button>
          </div>
        </div>

        {!stats || stats.empleados.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay empleados registrados en esta tienda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registrado</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {stats.empleados.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!emp.activo ? "opacity-50" : ""}`}>
                    <td className="px-6 py-3">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{emp.name}</p>
                      <p className="text-xs font-mono text-gray-400">{emp.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[emp.role] || "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[emp.role] || emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {emp.activo
                        ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-gray-400 mx-auto" />
                      }
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(emp.created_at).toLocaleDateString("es-MX")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Asignar Empleados Existentes */}
      <Modal
        isOpen={showAsignarEmpleado}
        onClose={() => { setShowAsignarEmpleado(false); setSeleccionados(new Set()); }}
        title={`Asignar empleados a — ${distribuidor.nombre}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Selecciona los empleados que ya existen en el sistema y quieres asignar a esta tienda.
          </p>

          {/* Buscador */}
          <input
            type="text"
            placeholder="Buscar por nombre o rol..."
            value={busquedaEmpleado}
            onChange={(e) => setBusquedaEmpleado(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Lista de empleados */}
          {cargandoEmpleados ? (
            <div className="py-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 mt-2">Cargando empleados...</p>
            </div>
          ) : todosEmpleados.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay empleados disponibles para asignar</p>
              <p className="text-xs mt-1">Todos los empleados ya pertenecen a esta tienda o son super_admin</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {todosEmpleados
                .filter((emp) =>
                  busquedaEmpleado === "" ||
                  emp.name.toLowerCase().includes(busquedaEmpleado.toLowerCase()) ||
                  emp.role.toLowerCase().includes(busquedaEmpleado.toLowerCase())
                )
                .map((emp) => {
                  const sel = seleccionados.has(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleSeleccion(emp.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        sel
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {/* Checkbox visual */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        sel
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {sel && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Datos del empleado */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{emp.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[emp.role] || "bg-gray-100 text-gray-600"}`}>
                            {ROLE_LABELS[emp.role] || emp.role}
                          </span>
                          {emp.distribuidorId ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              (actualmente en otra tienda)
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Sin tienda asignada</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {seleccionados.size > 0 && (
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              {seleccionados.size} empleado(s) seleccionado(s)
            </p>
          )}

          {asignarError && <p className="text-sm text-red-600 dark:text-red-400">{asignarError}</p>}

          <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowAsignarEmpleado(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={asignando || seleccionados.size === 0}
              onClick={handleAsignarEmpleados}
            >
              {asignando ? "Asignando..." : `Asignar ${seleccionados.size > 0 ? `(${seleccionados.size})` : ""} a esta tienda`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Crear Empleado */}
      <Modal
        isOpen={showCrearEmpleado}
        onClose={() => { setShowCrearEmpleado(false); setTempPasswordMostrado(null); setEmpleadoError(""); }}
        title={`Agregar Empleado — ${distribuidor.nombre}`}
      >
        {tempPasswordMostrado ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">
                ✓ Empleado creado exitosamente
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Guarda la contraseña temporal. El empleado deberá cambiarla en su primer inicio de sesión.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Contraseña temporal
              </label>
              <div className="flex gap-2">
                <code className="flex-1 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-900 font-mono text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 tracking-widest">
                  {tempPasswordMostrado}
                </code>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Copiar contraseña"
                >
                  {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button
                type="button"
                onClick={() => { setTempPasswordMostrado(null); }}
              >
                Agregar otro empleado
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setShowCrearEmpleado(false); setTempPasswordMostrado(null); }}
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCrearEmpleado} className="space-y-4">
            <Input
              label="Nombre completo *"
              value={empleadoForm.name}
              onChange={(e) => setEmpleadoForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Juan Pérez"
              required
            />
            <Input
              label="Correo electrónico *"
              type="email"
              value={empleadoForm.email}
              onChange={(e) => setEmpleadoForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="juan@tienda.com"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rol *
              </label>
              <select
                value={empleadoForm.role}
                onChange={(e) => setEmpleadoForm((p) => ({ ...p, role: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Admin — Control total de la tienda</option>
                <option value="vendedor">Vendedor — POS, créditos y clientes</option>
                <option value="cobrador">Cobrador — Pagos y cartera vencida</option>
                <option value="tecnico">Técnico — Solo módulo de reparaciones</option>
              </select>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
              Se generará una contraseña temporal automáticamente. Tienda asignada: <strong>{distribuidor.nombre}</strong>
            </div>
            {empleadoError && <p className="text-sm text-red-600 dark:text-red-400">{empleadoError}</p>}
            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => setShowCrearEmpleado(false)}>Cancelar</Button>
              <Button type="submit" disabled={creandoEmpleado}>
                {creandoEmpleado ? "Creando..." : "Crear Empleado"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Editar: ${distribuidor.nombre}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Nombre de la empresa *"
            value={editForm.nombre}
            onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
            required
          />
          <div>
            <Input
              label="Slug *"
              value={editForm.slug}
              onChange={(e) => setEditForm((p) => ({ ...p, slug: slugify(e.target.value) }))}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Cambiar el slug puede afectar referencias internas.</p>
          </div>
          <Input
            label="URL del Logo (opcional)"
            value={editForm.logoUrl}
            onChange={(e) => setEditForm((p) => ({ ...p, logoUrl: e.target.value }))}
            placeholder="https://..."
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.activo}
              onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Distribuidor activo</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar Cambios"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
