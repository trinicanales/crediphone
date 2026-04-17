"use client";

/**
 * Ticket físico imprimible para el taller (C2)
 *
 * Muestra una etiqueta/ticket de la orden de reparación optimizado para imprimir.
 * Abre en pestaña nueva y auto-dispara window.print().
 *
 * Ruta: /dashboard/reparaciones/[id]/ticket
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { OrdenReparacionDetallada } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function prioridadLabel(p: string): string {
  return { normal: "Normal", urgente: "URGENTE", express: "EXPRESS" }[p] ?? p;
}

// ── Ticket component ──────────────────────────────────────────────────────────

function Ticket({ orden }: { orden: OrdenReparacionDetallada }) {
  return (
    <div className="ticket">

      {/* Header */}
      <div className="ticket-header">
        <div className="ticket-brand">CREDIPHONE</div>
        <div className="ticket-subtitle">Orden de Servicio</div>
      </div>

      {/* Folio grande */}
      <div className="ticket-folio-block">
        <div className="ticket-folio-label">FOLIO</div>
        <div className="ticket-folio">{orden.folio}</div>
        <div className="ticket-fecha">
          Recibido: {formatFecha(orden.fechaRecepcion)}
          {orden.fechaEstimadaEntrega && ` · Entrega est.: ${formatFecha(orden.fechaEstimadaEntrega)}`}
        </div>
      </div>

      {/* Separador */}
      <div className="ticket-sep" />

      {/* Cliente */}
      <div className="ticket-section">
        <div className="ticket-row">
          <span className="ticket-key">Cliente:</span>
          <span className="ticket-val">
            {[orden.clienteNombre, orden.clienteApellido].filter(Boolean).join(" ") || "—"}
          </span>
        </div>
        {orden.clienteTelefono && (
          <div className="ticket-row">
            <span className="ticket-key">Tel:</span>
            <span className="ticket-val ticket-mono">{orden.clienteTelefono}</span>
          </div>
        )}
      </div>

      <div className="ticket-sep" />

      {/* Dispositivo */}
      <div className="ticket-section">
        <div className="ticket-row">
          <span className="ticket-key">Dispositivo:</span>
          <span className="ticket-val ticket-bold">
            {orden.marcaDispositivo} {orden.modeloDispositivo}
          </span>
        </div>
        {orden.imei && (
          <div className="ticket-row">
            <span className="ticket-key">IMEI:</span>
            <span className="ticket-val ticket-mono">{orden.imei}</span>
          </div>
        )}
        {orden.numeroSerie && (
          <div className="ticket-row">
            <span className="ticket-key">Serie:</span>
            <span className="ticket-val ticket-mono">{orden.numeroSerie}</span>
          </div>
        )}
        {orden.condicionDispositivo && (
          <div className="ticket-row">
            <span className="ticket-key">Condición:</span>
            <span className="ticket-val">{orden.condicionDispositivo}</span>
          </div>
        )}
        {orden.accesoriosEntregados && (
          <div className="ticket-row">
            <span className="ticket-key">Accesorios:</span>
            <span className="ticket-val">{orden.accesoriosEntregados}</span>
          </div>
        )}
      </div>

      <div className="ticket-sep" />

      {/* Problema */}
      <div className="ticket-section">
        <div className="ticket-key">Problema reportado:</div>
        <div className="ticket-problema">{orden.problemaReportado}</div>
      </div>

      {/* Contraseña / patrón — solo si existe */}
      {(orden.patronDesbloqueo || orden.passwordDispositivo) && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-section ticket-acceso">
            <div className="ticket-key">🔐 Acceso al dispositivo:</div>
            {orden.patronDesbloqueo && (
              <div className="ticket-row">
                <span className="ticket-key">Patrón:</span>
                <span className="ticket-val ticket-mono">{orden.patronDesbloqueo}</span>
              </div>
            )}
            {orden.passwordDispositivo && (
              <div className="ticket-row">
                <span className="ticket-key">Contraseña:</span>
                <span className="ticket-val ticket-mono">{orden.passwordDispositivo}</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="ticket-sep" />

      {/* Técnico + prioridad */}
      <div className="ticket-footer-row">
        <div>
          <span className="ticket-key">Técnico: </span>
          <span className="ticket-val">{orden.tecnicoNombre || "Sin asignar"}</span>
        </div>
        <div className={`ticket-prioridad ticket-prioridad-${orden.prioridad}`}>
          {prioridadLabel(orden.prioridad)}
        </div>
      </div>

      {/* Garantía */}
      {orden.esGarantia && (
        <div className="ticket-garantia">★ ORDEN EN GARANTÍA</div>
      )}

      {/* Notas de corte */}
      <div className="ticket-cut">— — — — — — — — — — — — — —</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketPage() {
  const params = useParams();
  const id = params.id as string;
  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reparaciones/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrden(d.data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [id]);

  // Auto-imprimir cuando la orden esté cargada
  useEffect(() => {
    if (orden) {
      // Pequeño delay para que el browser renderice antes de imprimir
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [orden]);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: "monospace" }}>
        Error: no se pudo cargar la orden.
      </div>
    );
  }

  if (!orden) {
    return (
      <div style={{ padding: 32, fontFamily: "monospace", color: "#666" }}>
        Cargando ticket…
      </div>
    );
  }

  return (
    <>
      {/* Estilos inline — solo para esta página (print + screen) */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Courier New', Courier, monospace;
          background: #f5f5f5;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px;
          min-height: 100vh;
        }

        .ticket {
          background: #fff;
          width: 80mm;
          padding: 8mm 6mm;
          border: 1px solid #ddd;
          box-shadow: 0 2px 8px rgba(0,0,0,.12);
        }

        .ticket-header {
          text-align: center;
          margin-bottom: 6px;
        }
        .ticket-brand {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 4px;
          color: #000;
        }
        .ticket-subtitle {
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #555;
        }

        .ticket-folio-block {
          text-align: center;
          margin: 6px 0;
        }
        .ticket-folio-label {
          font-size: 8px;
          letter-spacing: 3px;
          color: #777;
          text-transform: uppercase;
        }
        .ticket-folio {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #000;
          line-height: 1.1;
        }
        .ticket-fecha {
          font-size: 8.5px;
          color: #555;
          margin-top: 2px;
        }

        .ticket-sep {
          border-top: 1px dashed #bbb;
          margin: 6px 0;
        }

        .ticket-section {
          margin: 4px 0;
        }
        .ticket-row {
          display: flex;
          gap: 4px;
          margin: 1px 0;
          font-size: 9px;
          line-height: 1.4;
        }
        .ticket-key {
          color: #555;
          font-size: 8.5px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .ticket-val {
          color: #000;
          font-size: 9px;
          word-break: break-word;
        }
        .ticket-bold { font-weight: 700; }
        .ticket-mono { letter-spacing: 0.5px; }

        .ticket-problema {
          font-size: 9.5px;
          font-weight: 600;
          color: #000;
          line-height: 1.4;
          margin-top: 2px;
          padding: 4px 6px;
          border-left: 3px solid #000;
          background: #f8f8f8;
        }

        .ticket-acceso {
          background: #fff8e1;
          padding: 4px 6px;
          border-left: 3px solid #f59e0b;
        }

        .ticket-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9px;
          margin-top: 4px;
        }

        .ticket-prioridad {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1px;
          padding: 2px 6px;
          border-radius: 3px;
        }
        .ticket-prioridad-normal  { background: #e5e7eb; color: #374151; }
        .ticket-prioridad-urgente { background: #fef3c7; color: #92400e; }
        .ticket-prioridad-express { background: #fee2e2; color: #991b1b; }

        .ticket-garantia {
          text-align: center;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #1d4ed8;
          margin-top: 4px;
        }

        .ticket-cut {
          text-align: center;
          color: #ccc;
          font-size: 9px;
          margin-top: 8px;
          letter-spacing: 2px;
        }

        /* Botón imprimir — solo en pantalla */
        .print-btn {
          display: block;
          margin: 16px auto 0;
          padding: 8px 24px;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 1px;
        }

        /* ESTILOS DE IMPRESIÓN */
        @media print {
          body {
            background: #fff !important;
            padding: 0 !important;
          }
          .ticket {
            width: 100%;
            max-width: 80mm;
            border: none;
            box-shadow: none;
            padding: 4mm;
          }
          .print-btn { display: none !important; }
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
        }
      `}</style>

      <Ticket orden={orden} />

      <button
        className="print-btn"
        onClick={() => window.print()}
      >
        IMPRIMIR TICKET
      </button>
    </>
  );
}
