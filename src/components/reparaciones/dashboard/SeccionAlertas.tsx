"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { OrdenReparacionDetallada } from "@/types";
import type { GarantiaProxima } from "@/lib/db/reparaciones-dashboard";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, ShieldAlert } from "lucide-react";

interface SeccionAlertasProps {
  alertas: {
    ordenesVencidas: OrdenReparacionDetallada[];
    presupuestosPendientes: OrdenReparacionDetallada[];
    garantiasProximas: GarantiaProxima[];
  };
}

export function SeccionAlertas({ alertas }: SeccionAlertasProps) {
  const router = useRouter();

  const formatFecha = (fecha: Date | string | null | undefined) => {
    if (!fecha) return "Sin fecha";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    });
  };

  const totalAlertas =
    alertas.ordenesVencidas.length +
    alertas.presupuestosPendientes.length +
    alertas.garantiasProximas.length;

  if (totalAlertas === 0) {
    return (
      <Card title="🔔 Alertas">
        <div className="text-center py-8" style={{ color: "var(--color-text-muted)" }}>
          ✅ No hay alertas pendientes
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
        🔔 Alertas ({totalAlertas})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Órdenes Vencidas */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ background: "var(--color-danger-bg)" }}>
              <AlertCircle className="w-5 h-5" style={{ color: "var(--color-danger)" }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Órdenes Vencidas</h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {alertas.ordenesVencidas.length} órdenes
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {alertas.ordenesVencidas.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Sin órdenes vencidas</p>
            ) : (
              alertas.ordenesVencidas.slice(0, 5).map((orden) => (
                <div
                  key={orden.id}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)" }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {orden.folio}
                    </span>
                    <Badge variant="danger" className="text-xs">
                      Vencida
                    </Badge>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
                    {orden.clienteNombre
                      ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
                      : "Sin cliente"}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Entrega: {formatFecha(orden.fechaEstimadaEntrega)}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/reparaciones/${orden.id}`)
                      }
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Presupuestos Pendientes */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ background: "var(--color-warning-bg)" }}>
              <Clock className="w-5 h-5" style={{ color: "var(--color-warning)" }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Presupuestos Antiguos
              </h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {alertas.presupuestosPendientes.length} pendientes
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {alertas.presupuestosPendientes.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Sin presupuestos pendientes
              </p>
            ) : (
              alertas.presupuestosPendientes.slice(0, 5).map((orden) => (
                <div
                  key={orden.id}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)" }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {orden.folio}
                    </span>
                    <Badge variant="warning" className="text-xs">
                      Antiguo
                    </Badge>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
                    {orden.clienteNombre
                      ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
                      : "Sin cliente"}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Actualizado: {formatFecha(orden.updatedAt)}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/reparaciones/${orden.id}`)
                      }
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Garantías Próximas a Vencer */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ background: "var(--color-accent-light)" }}>
              <ShieldAlert className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Garantías Próximas
              </h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {alertas.garantiasProximas.length} por vencer
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {alertas.garantiasProximas.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Sin garantías próximas</p>
            ) : (
              alertas.garantiasProximas.slice(0, 5).map((garantia) => (
                <div
                  key={garantia.garantiaId}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--color-accent-light)", border: "1px solid var(--color-accent)" }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {garantia.ordenFolio}
                    </span>
                    <Badge variant="info" className="text-xs">
                      {garantia.diasParaVencer}d
                    </Badge>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
                    {garantia.clienteNombre}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Vence: {formatFecha(garantia.fechaVencimiento)}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/reparaciones/${garantia.ordenId}`)
                      }
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
