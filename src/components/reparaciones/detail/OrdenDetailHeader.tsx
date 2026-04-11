"use client";

import { EstadoBadge, PrioridadBadge } from "@/components/reparaciones/EstadoBadge";
import { Button } from "@/components/ui/Button";
import type { OrdenReparacionDetallada } from "@/types";
import { ArrowLeft, Download, Share2, Edit, Printer, Copy, CheckCheck, ExternalLink, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  generarTicketRecepcionReparacion,
  generarTicketEntregaReparacion,
  abrirReporte,
} from "@/lib/utils/reportes";

interface OrdenDetailHeaderProps {
  orden: OrdenReparacionDetallada;
  onEdit?: () => void;
  onCancelar?: () => void;
}

export function OrdenDetailHeader({ orden, onEdit, onCancelar }: OrdenDetailHeaderProps) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printingTicket, setPrintingTicket] = useState(false);
  // Compartir estado
  const [compartirOpen, setCompartirOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  /** Abre el modal Compartir y carga/crea el tracking token si no existe */
  const handleCompartir = async () => {
    setCompartirOpen(true);
    if (trackingUrl) return; // ya lo tenemos
    setLoadingTracking(true);
    try {
      const res = await fetch(`/api/reparaciones/${orden.id}/tracking-link`);
      const data = await res.json();
      if (data.success && data.url) {
        setTrackingUrl(data.url);
      }
    } catch {
      // fallback: link por folio (siempre funciona sin token)
    } finally {
      setLoadingTracking(false);
    }
  };

  /** URL pública de seguimiento por folio (siempre disponible, sin token) */
  const folioUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/reparacion/${orden.folio}`;

  const urlFinal = trackingUrl || folioUrl;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(urlFinal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* ignore */ }
  };

  const handleTicketRecepcion = async () => {
    setPrintingTicket(true);
    try {
      // ── FIX BUG: la API espera JSON body { ordenId }, no query param ──
      let qrDataUrl: string | undefined;
      let qrTrackingUrl: string | undefined;
      try {
        const qrRes = await fetch(`/api/reparaciones/qr/generar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordenId: orden.id }),
        });
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          // FIX: la respuesta está en qrData.sesion.url, no en qrData.url
          const sesionUrl = qrData?.sesion?.url;
          if (sesionUrl) {
            qrTrackingUrl = sesionUrl;
            const QRCode = (await import("qrcode")).default;
            qrDataUrl = await QRCode.toDataURL(sesionUrl, { width: 110, margin: 1 });
          }
        }
      } catch {
        // QR es opcional — si falla, se omite
      }
      const html = generarTicketRecepcionReparacion({
        folio: orden.folio,
        fechaRecepcion: orden.fechaRecepcion,
        fechaEstimadaEntrega: orden.fechaEstimadaEntrega,
        clienteNombre: orden.clienteNombre || "Sin cliente",
        clienteApellido: orden.clienteApellido,
        clienteTelefono: orden.clienteTelefono || "",
        marcaDispositivo: orden.marcaDispositivo,
        modeloDispositivo: orden.modeloDispositivo,
        imei: orden.imei,
        problemaReportado: orden.problemaReportado,
        accesoriosEntregados: orden.accesoriosEntregados,
        condicionDispositivo: orden.condicionDispositivo,
        tecnicoNombre: orden.tecnicoNombre,
        qrDataUrl,
        qrTrackingUrl,
      });
      abrirReporte(html, `Recepción ${orden.folio}`);
    } catch (err) {
      console.error("Error generando ticket recepción:", err);
    } finally {
      setPrintingTicket(false);
    }
  };

  const handleTicketEntrega = () => {
    const html = generarTicketEntregaReparacion({
      folio: orden.folio,
      fechaEntrega: orden.fechaEntregado || new Date(),
      clienteNombre: orden.clienteNombre || "Sin cliente",
      clienteApellido: orden.clienteApellido,
      clienteTelefono: orden.clienteTelefono || "",
      marcaDispositivo: orden.marcaDispositivo,
      modeloDispositivo: orden.modeloDispositivo,
      imei: orden.imei,
      diagnostico: orden.diagnosticoTecnico,
      notasTecnico: orden.notasTecnico,
      costoReparacion: orden.costoReparacion || 0,
      costoPartes: orden.costoPartes || 0,
      costoTotal: orden.costoTotal || 0,
      tecnicoNombre: orden.tecnicoNombre,
      diasGarantia: 30,
    });
    abrirReporte(html, `Entrega ${orden.folio}`);
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`/api/reparaciones/${orden.id}/pdf`, {
        method: "POST",
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.message || `Error ${response.status} al generar PDF`;
        console.error("Error descargando PDF:", msg);
        alert(`No se pudo generar el PDF.\n\n${msg}`);
        return;
      }
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
      alert("Error de conexión al generar el PDF. Verifica tu internet e intenta de nuevo.");
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
          {/* FASE 32: Ticket Recepción 58mm */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTicketRecepcion}
            disabled={printingTicket}
          >
            <Printer className={`w-4 h-4 mr-2 ${printingTicket ? "animate-pulse" : ""}`} />
            {printingTicket ? "..." : "Ticket Recepción"}
          </Button>
          {/* FASE 32: Ticket Entrega — solo si el equipo fue entregado */}
          {(orden.estado === "completado" || orden.estado === "listo_entrega") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTicketEntrega}
            >
              <Printer className="w-4 h-4 mr-2" />
              Ticket Entrega
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleCompartir}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>
          {/* Cancelar orden — solo si no está cancelada/entregada */}
          {onCancelar &&
            orden.estado !== "cancelado" &&
            orden.estado !== "entregado" && (
            <button
              type="button"
              onClick={onCancelar}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger)",
                background: "var(--color-danger-bg)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--color-danger)";
                (e.currentTarget as HTMLButtonElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--color-danger-bg)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
              }}
            >
              <XCircle className="w-4 h-4" />
              Cancelar orden
            </button>
          )}
        </div>
      </div>

      {/* ── Modal Compartir link de seguimiento ─────────────── */}
      {compartirOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setCompartirOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 relative"
            style={{
              background: "var(--color-bg-surface)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            {/* Cerrar */}
            <button
              onClick={() => setCompartirOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--color-accent-light)" }}
              >
                <Share2 className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              </div>
              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--color-text-primary)" }}>
                  Link de Seguimiento
                </h3>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  El cliente puede rastrear su reparación sin iniciar sesión
                </p>
              </div>
            </div>

            {/* Folio badge */}
            <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>
              Orden: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>{orden.folio}</span>
            </p>

            {/* URL */}
            {loadingTracking ? (
              <div
                className="rounded-xl p-3 mb-4 flex items-center gap-2 animate-pulse"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                <div className="h-3 rounded flex-1" style={{ background: "var(--color-border)" }} />
              </div>
            ) : (
              <div
                className="rounded-xl p-3 mb-4 font-mono text-xs break-all"
                style={{
                  background: "var(--color-bg-sunken)",
                  border: "1px solid var(--color-border-subtle)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {urlFinal}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2">
              <button
                onClick={handleCopiar}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: copiado ? "var(--color-success-bg)" : "var(--color-accent)",
                  color: copiado ? "var(--color-success-text)" : "white",
                }}
              >
                {copiado
                  ? <><CheckCheck className="w-4 h-4" /> Copiado</>
                  : <><Copy className="w-4 h-4" /> Copiar link</>
                }
              </button>
              <a
                href={urlFinal}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                  background: "var(--color-bg-elevated)",
                  textDecoration: "none",
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Abrir
              </a>
            </div>

            {/* WhatsApp rápido si hay teléfono */}
            {orden.clienteTelefono && (
              <a
                href={`https://wa.me/52${orden.clienteTelefono.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hola, aquí puedes rastrear tu reparación ${orden.folio}: ${urlFinal}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium w-full"
                style={{
                  background: "#25D366",
                  color: "white",
                  textDecoration: "none",
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar por WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
