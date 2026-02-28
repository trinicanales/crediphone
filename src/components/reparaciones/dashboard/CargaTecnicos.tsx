"use client";

import { Card } from "@/components/ui/Card";
import type { EstadisticasTecnico } from "@/types";
interface CargaTecnicosProps {
  tecnicos: EstadisticasTecnico[];
}

export function CargaTecnicos({ tecnicos }: CargaTecnicosProps) {
  if (!tecnicos || tecnicos.length === 0) {
    return (
      <Card title="👷 Carga de Técnicos">
        <div className="text-center py-8" style={{ color: "var(--color-text-muted)" }}>
          No hay técnicos registrados
        </div>
      </Card>
    );
  }

  const getCargaBarColor = (total: number): string => {
    if (total < 10) return "var(--color-success)";
    if (total < 15) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getCargaTextColor = (total: number): string => {
    if (total < 10) return "var(--color-success)";
    if (total < 15) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getCargaPercentage = (total: number) => {
    const max = 20; // Máximo considerado para la barra
    return Math.min((total / max) * 100, 100);
  };

  const getCargaLabel = (total: number) => {
    if (total < 10) return "Baja";
    if (total < 15) return "Media";
    return "Alta";
  };

  return (
    <Card title="👷 Carga de Trabajo - Técnicos">
      <div className="space-y-6">
        {tecnicos.map((tecnico) => (
          <div key={tecnico.tecnicoId} className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {tecnico.nombreTecnico}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {tecnico.ordenesRecibidas + tecnico.ordenesDiagnostico + tecnico.ordenesEnReparacion} órdenes totales
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: getCargaTextColor(tecnico.ordenesActivas) }}>
                  {tecnico.ordenesActivas}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {getCargaLabel(tecnico.ordenesActivas)}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="w-full rounded-full h-3" style={{ background: "var(--color-bg-elevated)" }}>
              <div
                className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${getCargaPercentage(tecnico.ordenesActivas)}%`,
                  background: getCargaBarColor(tecnico.ordenesActivas),
                }}
              />
            </div>

            {/* Desglose de estados */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded" style={{ background: "var(--color-accent-light)" }}>
                <p style={{ color: "var(--color-text-secondary)" }}>Diagnóstico</p>
                <p className="font-semibold" style={{ color: "var(--color-accent)" }}>{tecnico.ordenesDiagnostico || 0}</p>
              </div>
              <div className="p-2 rounded" style={{ background: "var(--color-info-bg)" }}>
                <p style={{ color: "var(--color-text-secondary)" }}>En Reparación</p>
                <p className="font-semibold" style={{ color: "var(--color-info)" }}>{tecnico.ordenesEnReparacion || 0}</p>
              </div>
              <div className="p-2 rounded" style={{ background: "var(--color-success-bg)" }}>
                <p style={{ color: "var(--color-text-secondary)" }}>Completadas Hoy</p>
                <p className="font-semibold" style={{ color: "var(--color-success)" }}>{tecnico.ordenesCompletadasHoy || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
