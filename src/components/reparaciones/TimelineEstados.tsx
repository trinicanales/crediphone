"use client";

import { motion } from "framer-motion";
import {
  Package,
  Search,
  DollarSign,
  CheckCircle,
  Wrench,
  Star,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
} from "lucide-react";

interface HistorialEstado {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario?: { name: string } | null;
  comentario?: string | null;
  created_at: string;
}

interface TimelineEstadosProps {
  historial: HistorialEstado[];
}

// Mapeo de estados a iconos (colores via CSS tokens)
const ICONOS_ESTADO: Record<string, React.ReactNode> = {
  recibido: <Package className="w-5 h-5" style={{ color: "var(--color-accent)" }} />,
  diagnostico: <Search className="w-5 h-5" style={{ color: "var(--color-info)" }} />,
  presupuesto: <DollarSign className="w-5 h-5" style={{ color: "var(--color-warning)" }} />,
  aprobado: <CheckCircle className="w-5 h-5" style={{ color: "var(--color-success)" }} />,
  en_reparacion: <Wrench className="w-5 h-5" style={{ color: "var(--color-warning)" }} />,
  completado: <Star className="w-5 h-5" style={{ color: "var(--color-success)" }} />,
  listo_entrega: <PackageCheck className="w-5 h-5" style={{ color: "var(--color-accent)" }} />,
  entregado: <CheckCircle2 className="w-5 h-5" style={{ color: "var(--color-success)" }} />,
  no_reparable: <XCircle className="w-5 h-5" style={{ color: "var(--color-danger)" }} />,
  cancelado: <Ban className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />,
};

// Mapeo de estados a colores de borde (CSS tokens como valores)
const COLORES_ESTADO: Record<string, string> = {
  recibido: "var(--color-accent)",
  diagnostico: "var(--color-info)",
  presupuesto: "var(--color-warning)",
  aprobado: "var(--color-success)",
  en_reparacion: "var(--color-warning)",
  completado: "var(--color-success)",
  listo_entrega: "var(--color-accent)",
  entregado: "var(--color-success)",
  no_reparable: "var(--color-danger)",
  cancelado: "var(--color-text-muted)",
};

// Mapeo de estados a nombres legibles
const NOMBRES_ESTADO: Record<string, string> = {
  recibido: "Recibido",
  diagnostico: "En Diagnóstico",
  presupuesto: "Presupuesto Pendiente",
  aprobado: "Presupuesto Aprobado",
  en_reparacion: "En Reparación",
  completado: "Reparación Completada",
  listo_entrega: "Listo para Entrega",
  entregado: "Entregado",
  no_reparable: "No Reparable",
  cancelado: "Cancelado",
};

/**
 * Formatea fecha en español con formato legible
 */
function formatearFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const opciones: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return fecha.toLocaleDateString("es-MX", opciones);
}

/**
 * Obtiene el nombre del usuario, manejando diferentes formatos
 */
function obtenerNombreUsuario(usuario: { name: string } | null | undefined): string {
  if (!usuario || !usuario.name) {
    return "Sistema Automático";
  }
  return usuario.name;
}

export function TimelineEstados({ historial }: TimelineEstadosProps) {
  // Estado vacío
  if (!historial || historial.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Clock className="w-16 h-16 mb-4" style={{ color: "var(--color-text-muted)" }} />
        <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
          Sin Historial de Estados
        </h3>
        <p className="text-sm text-center max-w-md" style={{ color: "var(--color-text-muted)" }}>
          Esta orden aún no tiene cambios de estado registrados. Los cambios
          aparecerán aquí automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 py-4">
      {/* Línea vertical del timeline */}
      <div
        className="absolute left-4 top-0 bottom-0 w-0.5"
        style={{ background: "var(--color-border-subtle)", zIndex: 0 }}
      />

      {/* Eventos del historial */}
      {historial.map((evento, index) => {
        const estadoColor = COLORES_ESTADO[evento.estado_nuevo] || "var(--color-text-muted)";
        const nombreEstado = NOMBRES_ESTADO[evento.estado_nuevo] || evento.estado_nuevo;
        const icono = ICONOS_ESTADO[evento.estado_nuevo] || (
          <Package className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
        );

        return (
          <motion.div
            key={evento.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            className="relative pl-12"
            style={{ zIndex: 1 }}
          >
            {/* Punto en la línea con icono */}
            <div
              className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
              style={{ background: "var(--color-bg-surface)", border: `4px solid ${estadoColor}`, zIndex: 2 }}
            >
              {icono}
            </div>

            {/* Contenido del evento */}
            <motion.div
              whileHover={{ scale: 1.01, boxShadow: "var(--shadow-md)" }}
              className="rounded-lg p-4"
              style={{ background: "var(--color-bg-surface)", border: "2px solid var(--color-border-subtle)", boxShadow: "var(--shadow-sm)", transition: "all 200ms ease" }}
            >
              {/* Header con estado y fecha */}
              <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                <h4 className="font-bold text-base" style={{ color: "var(--color-text-primary)" }}>
                  {nombreEstado}
                </h4>
                <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  {formatearFecha(evento.created_at)}
                </span>
              </div>

              {/* Usuario que realizó el cambio */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: "var(--color-primary)" }}
                >
                  {obtenerNombreUsuario(evento.usuario).charAt(0).toUpperCase()}
                </div>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  <span className="font-medium">por</span>{" "}
                  <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {obtenerNombreUsuario(evento.usuario)}
                  </span>
                </p>
              </div>

              {/* Estado anterior (si existe) */}
              {evento.estado_anterior && (
                <div className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
                  <span className="font-medium">Estado anterior:</span>{" "}
                  {NOMBRES_ESTADO[evento.estado_anterior] || evento.estado_anterior}
                </div>
              )}

              {/* Comentario (si existe) */}
              {evento.comentario && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                  <p className="text-sm italic" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="font-semibold not-italic">💬 Comentario:</span> "
                    {evento.comentario}"
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        );
      })}

      {/* Indicador de inicio */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: historial.length * 0.08 + 0.2 }}
        className="relative pl-12"
      >
        <div
          className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
          style={{ background: "var(--color-bg-elevated)", border: "4px solid var(--color-border)", zIndex: 2 }}
        >
          <div className="w-3 h-3 rounded-full" style={{ background: "var(--color-bg-surface)" }} />
        </div>
        <div className="text-sm font-medium italic py-2" style={{ color: "var(--color-text-muted)" }}>
          Inicio del registro
        </div>
      </motion.div>
    </div>
  );
}
