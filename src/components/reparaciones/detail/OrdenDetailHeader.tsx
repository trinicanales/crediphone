"use client";

import { EstadoBadge, PrioridadBadge } from "@/components/reparaciones/EstadoBadge";
import { Button } from "@/components/ui/Button";
import type { OrdenReparacionDetallada } from "@/types";
import { ArrowLeft, Download, Share2, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface OrdenDetailHeaderProps {
  orden: OrdenReparacionDetallada;
  onEdit?: () => void;
}

export function OrdenDetailHeader({ orden, onEdit }: OrdenDetailHeaderProps) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`/api/reparaciones/${orden.id}/pdf`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Error al generar PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Orden-${orden.folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando PDF:", error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatFecha = (fecha: Date | string | null | undefined) => {
    if (!fecha) return "No especificada";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div style={{ background: "var(--color-bg-surface)", borderRadius: "0.5rem", boxShadow: "var(--shadow-sm)", padding: "1.5rem", marginBottom: "1.5rem" }}>
      {/* Botón Volver */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Info Principal */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{orden.folio}</h1>
            <EstadoBadge estado={orden.estado} />
            <PrioridadBadge prioridad={orden.prioridad} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Cliente */}
            <div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Cliente</p>
              <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.clienteNombre
                  ? `${orden.clienteNombre} ${orden.clienteApellido || ""}`.trim()
                  : "Sin cliente"}
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{orden.clienteTelefono}</p>
            </div>

            {/* Dispositivo */}
            <div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Dispositivo</p>
              <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.marcaDispositivo} {orden.modeloDispositivo}
              </p>
              {orden.imei && (
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>IMEI: {orden.imei}</p>
              )}
            </div>

            {/* Técnico */}
            <div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Técnico Asignado</p>
              <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                {orden.tecnicoNombre || "No asignado"}
              </p>
            </div>

            {/* Fechas */}
            <div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Fecha de Recepción</p>
              <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                {formatFecha(orden.fechaRecepcion)}
              </p>
              {orden.fechaEstimadaEntrega && (
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Entrega estimada: {formatFecha(orden.fechaEstimadaEntrega)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 lg:ml-4">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf}>
            <Download className={`w-4 h-4 mr-2 ${downloadingPdf ? "animate-pulse" : ""}`} />
            {downloadingPdf ? "Generando..." : "Descargar PDF"}
          </Button>
          <Button variant="secondary" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>
        </div>
      </div>
    </div>
  );
}
