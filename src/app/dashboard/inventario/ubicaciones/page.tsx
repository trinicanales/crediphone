"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useDistribuidor } from "@/components/DistribuidorProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Package,
  QrCode,
  X,
} from "lucide-react";
import type { UbicacionInventario, TipoUbicacion } from "@/types";

export default function UbicacionesPage() {
  const { user } = useAuth();
  const { distribuidorActivo } = useDistribuidor();
  const router = useRouter();

  const [ubicaciones, setUbicaciones] = useState<
    Array<UbicacionInventario & { productosCount?: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formNombre, setFormNombre] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formTipo, setFormTipo] = useState<TipoUbicacion>("estante");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formCapacidad, setFormCapacidad] = useState("");

  useEffect(() => {
    if (user && !["admin", "vendedor", "super_admin"].includes(user.role)) {
      router.push("/dashboard");
    } else if (user) {
      fetchUbicaciones();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, distribuidorActivo?.id]);

  const fetchUbicaciones = async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {};
      if (distribuidorActivo?.id) {
        headers["X-Distribuidor-Id"] = distribuidorActivo.id;
      }
      const response = await fetch(
        "/api/inventario/ubicaciones?withCounts=true",
        { headers }
      );
      const data = await response.json();

      if (data.success) {
        setUbicaciones(data.data);
      }
    } catch (error) {
      console.error("Error fetching ubicaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (ubicacion?: UbicacionInventario) => {
    if (ubicacion) {
      setEditingId(ubicacion.id);
      setFormNombre(ubicacion.nombre);
      setFormCodigo(ubicacion.codigo);
      setFormTipo(ubicacion.tipo);
      setFormDescripcion(ubicacion.descripcion || "");
      setFormCapacidad(
        ubicacion.capacidadMaxima?.toString() || ""
      );
    } else {
      setEditingId(null);
      setFormNombre("");
      setFormCodigo("");
      setFormTipo("estante");
      setFormDescripcion("");
      setFormCapacidad("");
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormNombre("");
    setFormCodigo("");
    setFormTipo("estante");
    setFormDescripcion("");
    setFormCapacidad("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formNombre || !formTipo) {
      alert("Nombre y tipo son requeridos");
      return;
    }

    const body = {
      nombre: formNombre,
      codigo: formCodigo || undefined,
      tipo: formTipo,
      descripcion: formDescripcion || undefined,
      capacidadMaxima: formCapacidad ? parseInt(formCapacidad) : undefined,
    };

    try {
      let response;
      if (editingId) {
        response = await fetch(`/api/inventario/ubicaciones/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(distribuidorActivo?.id ? { "X-Distribuidor-Id": distribuidorActivo.id } : {}),
          },
          body: JSON.stringify(body),
        });
      } else {
        response = await fetch("/api/inventario/ubicaciones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(distribuidorActivo?.id ? { "X-Distribuidor-Id": distribuidorActivo.id } : {}),
          },
          body: JSON.stringify(body),
        });
      }

      const data = await response.json();

      if (data.success) {
        fetchUbicaciones();
        handleCloseModal();
      } else {
        alert(data.error || "Error al guardar ubicación");
      }
    } catch (error) {
      console.error("Error saving ubicacion:", error);
      alert("Error al guardar ubicación");
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (
      !confirm(
        `¿Eliminar ubicación "${nombre}"?\n\nSi hay productos asignados, primero deberá reubicarlos.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/inventario/ubicaciones/${id}`, {
        method: "DELETE",
        headers: {
          ...(distribuidorActivo?.id ? { "X-Distribuidor-Id": distribuidorActivo.id } : {}),
        },
      });

      const data = await response.json();

      if (data.success) {
        fetchUbicaciones();
      } else {
        alert(data.error || "Error al eliminar ubicación");
      }
    } catch (error) {
      console.error("Error deleting ubicacion:", error);
      alert("Error al eliminar ubicación");
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      estante: "Estante",
      vitrina: "Vitrina",
      bodega: "Bodega",
      mostrador: "Mostrador",
    };
    return labels[tipo] || tipo;
  };

  const getTipoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      estante: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      vitrina:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      bodega:
        "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
      mostrador:
        "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    };
    return colors[tipo] || colors.estante;
  };

  if (!user || !["admin", "vendedor", "super_admin"].includes(user.role)) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Gestión de Ubicaciones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Administre las ubicaciones físicas de su inventario
          </p>
        </div>

        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Ubicación
        </Button>
      </div>

      {/* Locations Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Cargando ubicaciones...
        </div>
      ) : ubicaciones.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay ubicaciones
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Cree su primera ubicación para organizar su inventario
          </p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Ubicación
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ubicaciones.map((ubicacion) => (
            <Card key={ubicacion.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {ubicacion.nombre}
                  </h3>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${getTipoColor(
                    ubicacion.tipo
                  )}`}
                >
                  {getTipoLabel(ubicacion.tipo)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-500">
                    Código:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {ubicacion.codigo}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {ubicacion.productosCount || 0} producto
                    {ubicacion.productosCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {ubicacion.descripcion && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {ubicacion.descripcion}
                  </p>
                )}

                {ubicacion.qrCode && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                    <QrCode className="w-3.5 h-3.5" />
                    <span className="font-mono">{ubicacion.qrCode}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleOpenModal(ubicacion)}
                  variant="secondary"
                  className="flex-1"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar
                </Button>

                {(user.role === "admin" || user.role === "super_admin") && (
                  <Button
                    onClick={() => handleDelete(ubicacion.id, ubicacion.nombre)}
                    variant="danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleCloseModal}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <Card className="max-w-md w-full pointer-events-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingId ? "Editar Ubicación" : "Nueva Ubicación"}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre *
                    </label>
                    <Input
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Ej: Estante A1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Código
                    </label>
                    <Input
                      value={formCodigo}
                      onChange={(e) => setFormCodigo(e.target.value)}
                      placeholder="Ej: A1 (opcional, se genera automáticamente)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo *
                    </label>
                    <select
                      value={formTipo}
                      onChange={(e) =>
                        setFormTipo(e.target.value as TipoUbicacion)
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="estante">Estante</option>
                      <option value="vitrina">Vitrina</option>
                      <option value="bodega">Bodega</option>
                      <option value="mostrador">Mostrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción
                    </label>
                    <Input
                      value={formDescripcion}
                      onChange={(e) => setFormDescripcion(e.target.value)}
                      placeholder="Descripción opcional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Capacidad Máxima
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={formCapacidad}
                      onChange={(e) => setFormCapacidad(e.target.value)}
                      placeholder="Número de productos (opcional)"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1">
                      {editingId ? "Guardar Cambios" : "Crear Ubicación"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCloseModal}
                      variant="secondary"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
