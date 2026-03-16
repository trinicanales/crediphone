"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { EstadoOrdenReparacion } from "@/types";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  Wrench,
  DollarSign,
  ThumbsUp,
  Settings,
  ShoppingBag,
  Truck,
  Ban,
  Loader2,
} from "lucide-react";

interface HistorialItem {
  id: string;
  orden_id: string;
  estado_anterior: EstadoOrdenReparacion | null;
  estado_nuevo: EstadoOrdenReparacion;
  notas?: string;
  usuario?: { name: string };
  created_at: string;
}

interface TimelineOrdenProps {
  ordenId: string;
  estadoActual: EstadoOrdenReparacion;
}

const estadoConfig: Record<
  EstadoOrdenReparacion,
  { icon: any; color: string; label: string }
> = {
  recibido: {
    icon: Package,
    color: "var(--color-accent)",
    label: "Recibido",
  },
  diagnostico: {
    icon: Wrench,
    color: "var(--color-warning)",
    label: "En Diagnóstico",
  },
  esperando_piezas: {
    icon: Package,
    color: "var(--color-warning)",
    label: "Esperando Piezas",
  },
  presupuesto: {
    icon: DollarSign,
    color: "var(--color-warning)",
    label: "Presupuesto Pendiente",
  },
  aprobado: {
    icon: ThumbsUp,
    color: "var(--color-success)",
    label: "Aprobado",
  },
  en_reparacion: {
    icon: Settings,
    color: "var(--color-info)",
    label: "En Reparación",
  },
  completado: {
    icon: CheckCircle,
    color: "var(--color-success)",
    label: "Completado",
  },
  listo_entrega: {
    icon: ShoppingBag,
    color: "var(--color-accent)",
    label: "Listo para Entrega",
  },
  entregado: {
    icon: Truck,
    color: "var(--color-text-muted)",
    label: "Entregado",
  },
  no_reparable: {
    icon: XCircle,
    color: "var(--color-danger)",
    label: "No Reparable",
  },
  cancelado: {
    icon: Ban,
    color: "var(--color-text-muted)",
    label: "Cancelado",
  },
};

export function TimelineOrden({ ordenId, estadoActual }: TimelineOrdenProps) {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistorial = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/reparaciones/${ordenId}/historial`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Error al cargar historial");
        }

        setHistorial(result.data || []);
        setError(null);
      } catch (err) {
        console.error("Error al cargar historial:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    if (ordenId) {
      fetchHistorial();
    }
  }, [ordenId]);

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card title="📅 Historial de Estados">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="ml-2" style={{ color: "var(--color-text-secondary)" }}>Cargando historial...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="📅 Historial de Estados">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" style={{ color: "var(--color-danger)" }} />
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>
        </div>
      </Card>
    );
  }

  if (historial.length === 0) {
    return (
      <Card title="📅 Historial de Estados">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay historial de cambios</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="📅 Historial de Estados">
      <div className="relative">
        {/* Línea vertical del timeline */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5" style={{ background: "var(--color-border-subtle)" }} />

        {/* Items del timeline */}
        <div className="space-y-6">
          {historial.map((item, index) => {
            const config = estadoConfig[item.estado_nuevo];
            const Icon = config.icon;
            const isActual = item.estado_nuevo === estadoActual;

            return (
              <div key={item.id} className="relative flex gap-4">
                {/* Icono */}
                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: config.color,
                      ...(isActual ? { outline: "4px solid var(--color-accent-light)", outlineOffset: "2px" } : {}),
                    }}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Contenido */}
                <div className="flex-1 pb-6">
                  <div
                    className="rounded-lg p-4"
                    style={{
                      background: "var(--color-bg-surface)",
                      border: isActual
                        ? "1px solid var(--color-accent)"
                        : "1px solid var(--color-border-subtle)",
                      boxShadow: isActual ? "var(--shadow-md)" : "var(--shadow-xs)",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {config.label}
                          {isActual && (
                            <span
                              className="ml-2 text-xs px-2 py-1 rounded"
                              style={{ background: "var(--color-accent-light)", color: "var(--color-accent)" }}
                            >
                              Estado Actual
                            </span>
                          )}
                        </h4>
                        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                          {formatFecha(item.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Usuario que hizo el cambio */}
                    {item.usuario?.name && (
                      <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Por: {item.usuario.name}
                      </p>
                    )}

                    {/* Transición */}
                    {item.estado_anterior && (
                      <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
                        {estadoConfig[item.estado_anterior]?.label} →{" "}
                        {config.label}
                      </p>
                    )}

                    {/* Notas */}
                    {item.notas && (
                      <div className="mt-3 p-2 rounded" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)" }}>
                        <p className="text-xs mb-1 font-medium" style={{ color: "var(--color-text-muted)" }}>
                          Notas:
                        </p>
                        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{item.notas}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
