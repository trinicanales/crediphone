import { Badge } from "@/components/ui/Badge";
import type { EstadoOrdenReparacion } from "@/types";

interface EstadoBadgeProps {
  estado: EstadoOrdenReparacion;
  className?: string;
}

const estadoConfig: Record<
  EstadoOrdenReparacion,
  { variant: "default" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  recibido: {
    variant: "info",
    label: "Recibido",
  },
  diagnostico: {
    variant: "warning",
    label: "En Diagnóstico",
  },
  esperando_piezas: {
    variant: "warning",
    label: "Esperando Piezas",
  },
  presupuesto: {
    variant: "warning",
    label: "Presupuesto Pendiente",
  },
  aprobado: {
    variant: "success",
    label: "Aprobado",
  },
  en_reparacion: {
    variant: "info",
    label: "En Reparación",
  },
  completado: {
    variant: "success",
    label: "Completado",
  },
  listo_entrega: {
    variant: "success",
    label: "Listo para Entrega",
  },
  entregado: {
    variant: "default",
    label: "Entregado",
  },
  no_reparable: {
    variant: "danger",
    label: "No Reparable",
  },
  cancelado: {
    variant: "danger",
    label: "Cancelado",
  },
};

export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  const config = estadoConfig[estado];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

/**
 * Componente para mostrar badge de prioridad
 */
interface PrioridadBadgeProps {
  prioridad: "baja" | "normal" | "alta" | "urgente";
  className?: string;
}

export function PrioridadBadge({ prioridad, className }: PrioridadBadgeProps) {
  const prioridadConfig: Record<
    "baja" | "normal" | "alta" | "urgente",
    { variant: "default" | "success" | "warning" | "danger" | "info"; label: string; emoji?: string }
  > = {
    baja: {
      variant: "default",
      label: "Baja",
    },
    normal: {
      variant: "info",
      label: "Normal",
    },
    alta: {
      variant: "warning",
      label: "Alta",
      emoji: "⚠️",
    },
    urgente: {
      variant: "danger",
      label: "Urgente",
      emoji: "🔴",
    },
  };

  const config = prioridadConfig[prioridad];

  return (
    <Badge variant={config.variant} className={className}>
      {config.emoji && <span className="mr-1">{config.emoji}</span>}
      {config.label}
    </Badge>
  );
}
