"use client";

import { Card } from "@/components/ui/Card";
import type { OrdenReparacionDetallada, ParteReemplazada } from "@/types";

interface PresupuestoSummaryProps {
  orden: OrdenReparacionDetallada;
}

export function PresupuestoSummary({ orden }: PresupuestoSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const costoPartes =
    orden.partesReemplazadas?.reduce(
      (sum, parte) => sum + parte.costo * parte.cantidad,
      0
    ) || 0;

  const total = orden.costoReparacion + costoPartes;

  return (
    <div className="space-y-6">
      {/* Partes Reemplazadas */}
      {orden.partesReemplazadas && orden.partesReemplazadas.length > 0 && (
        <Card title="Partes a Reemplazar">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--color-text-muted)" }}>Parte</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--color-text-muted)" }}>Cantidad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--color-text-muted)" }}>Costo Unitario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--color-text-muted)" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody style={{ background: "var(--color-bg-surface)" }}>
                {orden.partesReemplazadas.map((parte, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-text-primary)" }}>
                      {parte.parte}
                      {parte.proveedor && (
                        <span className="text-xs block" style={{ color: "var(--color-text-muted)" }}>
                          Proveedor: {parte.proveedor}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-text-primary)" }}>{parte.cantidad}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>{formatCurrency(parte.costo)}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>{formatCurrency(parte.costo * parte.cantidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Resumen de Costos */}
      <Card title="Resumen de Costos">
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Mano de Obra</span>
            <span className="text-base font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
              {formatCurrency(orden.costoReparacion)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Partes y Refacciones</span>
            <span className="text-base font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
              {formatCurrency(costoPartes)}
            </span>
          </div>

          <div className="flex justify-between items-center py-3 px-4 rounded-lg" style={{ background: "var(--color-accent-light)" }}>
            <span className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Total</span>
            <span className="text-xl font-bold" style={{ color: "var(--color-accent)", fontFamily: "var(--font-data)" }}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </Card>

      {/* Estado de Aprobación */}
      {orden.requiereAprobacion && (
        <Card>
          <div className="flex items-center gap-3">
            <div
              style={{ width: "0.75rem", height: "0.75rem", borderRadius: "9999px", background: orden.aprobadoPorCliente ? "var(--color-success)" : "var(--color-warning)" }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.aprobadoPorCliente
                  ? "Presupuesto Aprobado"
                  : "Esperando Aprobación del Cliente"}
              </p>
              {orden.fechaAprobacion && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Aprobado el:{" "}
                  {new Date(orden.fechaAprobacion).toLocaleDateString("es-MX")}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
