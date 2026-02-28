"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EstadoBadge } from "@/components/reparaciones/EstadoBadge";
import type { OrdenReparacionDetallada } from "@/types";
import { useRouter } from "next/navigation";

interface TablaOrdenesRecientesProps {
  ordenes: OrdenReparacionDetallada[];
}

export function TablaOrdenesRecientes({ ordenes }: TablaOrdenesRecientesProps) {
  const router = useRouter();

  if (!ordenes || ordenes.length === 0) {
    return (
      <Card title="📋 Órdenes Recientes">
        <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--color-text-muted)" }}>
          No hay órdenes recientes
        </div>
      </Card>
    );
  }

  const formatFecha = (fecha: Date | string | null | undefined) => {
    if (!fecha) return "Sin fecha";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card title="📋 Últimas 10 Órdenes">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Folio
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Cliente
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Dispositivo
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Estado
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Fecha Recepción
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((orden) => (
              <tr
                key={orden.id}
                style={{ borderBottom: "1px solid var(--color-border-subtle)" }} onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-elevated)")} onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <td className="py-3 px-4 text-sm font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                  {orden.folio}
                </td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {orden.clienteNombre
                    ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
                    : "Sin cliente"}
                </td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {orden.marcaDispositivo} {orden.modeloDispositivo}
                </td>
                <td className="py-3 px-4">
                  <EstadoBadge estado={orden.estado} />
                </td>
                <td className="py-3 px-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  {formatFecha(orden.fechaRecepcion)}
                </td>
                <td className="py-3 px-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      router.push(`/dashboard/reparaciones/${orden.id}`)
                    }
                  >
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
