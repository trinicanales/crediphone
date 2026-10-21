"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { formatMXN as formatCurrency } from "@/lib/format";
import {
  Package,
  Clock,
  DollarSign,
  Wrench,
  FileText,
} from "lucide-react";

interface KPIsReparacionesProps {
  estadisticas: {
    totalOrdenes: number;
    ordenesActivas: number;
    ingresosMes: number;
    trendIngresosMes: number;
    promedioReparacion: number;
    presupuestosPendientes: number;
  };
}

export function KPIsReparaciones({ estadisticas }: KPIsReparacionesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      <StatCard
        title="Total Órdenes"
        value={estadisticas.totalOrdenes}
        icon={<Package className="w-6 h-6" />}
        color="blue"
        subtitle="Todas las órdenes"
      />

      <StatCard
        title="Órdenes Activas"
        value={estadisticas.ordenesActivas}
        icon={<Wrench className="w-6 h-6" />}
        color="purple"
        subtitle="En proceso"
      />

      <StatCard
        title="Ingresos del Mes"
        value={formatCurrency(estadisticas.ingresosMes)}
        icon={<DollarSign className="w-6 h-6" />}
        color="green"
        trend={
          estadisticas.trendIngresosMes !== 0
            ? {
                value: Math.abs(estadisticas.trendIngresosMes),
                isPositive: estadisticas.trendIngresosMes > 0,
              }
            : undefined
        }
      />

      <StatCard
        title="Tiempo Promedio"
        value={`${estadisticas.promedioReparacion.toFixed(1)} días`}
        icon={<Clock className="w-6 h-6" />}
        color="blue"
        subtitle="Reparación"
      />

      <StatCard
        title="Presupuestos Pendientes"
        value={estadisticas.presupuestosPendientes}
        icon={<FileText className="w-6 h-6" />}
        color={estadisticas.presupuestosPendientes > 5 ? "yellow" : "blue"}
        subtitle="Requieren aprobación"
      />
    </div>
  );
}
