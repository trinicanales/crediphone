"use client";

/**
 * Ticket físico imprimible para el taller (C2)
 *
 * Impresora térmica 58mm. Letra grande y legible.
 * Incluye QR de identificación que apunta a /reparacion/{folio}
 * para identificación rápida al momento de la entrega.
 *
 * Ruta: /dashboard/reparaciones/[id]/ticket
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
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

function formatFechaCorta(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function prioridadLabel(p: string): string {
  return { normal: "Normal", urgente: "URGENTE", express: "EXPRESS" }[p] ?? p;
}

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transf.",
  deposito: "Depósito",
  mixto: "Mixto",
};

interface AnticipoTicket {
  id: string;
  monto: number;
  tipoPago: string;
  fechaAnticipo: string;
}

// ── Ticket component ──────────────────────────────────────────────────────────

function Ticket({ orden, baseUrl, anticipos, nombreEmpresa }: { orden: OrdenReparacionDetallada; baseUrl: string; anticipos: AnticipoTicket[]; nombreEmpresa: string }) {
  const qrUrl = `${baseUrl}/reparacion/${orden.folio}`;

  return (
    <div className="ticket">

      {/* Header con QR */}
      <div className="ticket-header">
        <div className="ticket-brand-col">
          <div className="ticket-brand">{nombreEmpresa.toUpperCase()}</div>
          <div className="ticket-subtitle">Orden de Servicio</div>
        </div>
        <div className="ticket-qr-block">
          <QRCodeSVG value={qrUrl} size={56} level="M" />
          <div className="ticket-qr-label">Escanear al entregar</div>
        </div>
      </div>

      {/* Folio grande */}
      <div className="ticket-folio-block">
        <div className="ticket-folio-label">FOLIO</div>
        <div className="ticket-folio">{orden.folio}</div>
        <div className="ticket-fecha">
          Recibido: {formatFecha(orden.fechaRecepcion)}
        </div>
        {orden.fechaEstimadaEntrega && (
          <div className="ticket-fecha">
            Entrega est.: {formatFecha(orden.fechaEstimadaEntrega)}
          </div>
        )}
      </div>

      <div className="ticket-sep" />

      {/* Cliente */}
      <div className="ticket-section">
        <div className="ticket-label">CLIENTE</div>
        <div className="ticket-val ticket-bold ticket-lg">
          {[orden.clienteNombre, orden.clienteApellido].filter(Boolean).join(" ") || "—"}
        </div>
        {orden.clienteTelefono && (
          <div className="ticket-val ticket-mono">{orden.clienteTelefono}</div>
        )}
      </div>

      <div className="ticket-sep" />

      {/* Dispositivo */}
      <div className="ticket-section">
        <div className="ticket-label">DISPOSITIVO</div>
        <div className="ticket-val ticket-bold ticket-lg">
          {orden.marcaDispositivo} {orden.modeloDispositivo}
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
        <div className="ticket-label">PROBLEMA REPORTADO</div>
        <div className="ticket-problema">{orden.problemaReportado}</div>
      </div>

      {/* Contraseña / patrón */}
      {(orden.patronDesbloqueo || orden.passwordDispositivo) && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-section ticket-acceso">
            <div className="ticket-label">🔐 ACCESO AL DISPOSITIVO</div>
            {orden.patronDesbloqueo && (
              <div className="ticket-row">
                <span className="ticket-key">Patrón:</span>
                <span className="ticket-val ticket-mono ticket-bold">{orden.patronDesbloqueo}</span>
              </div>
            )}
            {orden.passwordDispositivo && (
              <div className="ticket-row">
                <span className="ticket-key">Contraseña:</span>
                <span className="ticket-val ticket-mono ticket-bold">{orden.passwordDispositivo}</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="ticket-sep" />

      {/* Piezas cotizadas */}
      {orden.piezasCotizacion && orden.piezasCotizacion.length > 0 && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-section">
            <div className="ticket-label">PIEZAS / SERVICIO</div>
            {orden.piezasCotizacion.map((p, i) => (
              <div key={i} className="ticket-pieza-row">
                <span className="ticket-pieza-nombre">{p.nombre}</span>
                <span className="ticket-pieza-precio">${Number(p.precioTotal ?? p.precioUnitario ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Presupuesto / anticipo */}
      {(orden.costoTotal > 0 || (orden.totalAnticipos ?? 0) > 0) && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-section">
            {orden.costoTotal > 0 && (
              <div className="ticket-row">
                <span className="ticket-key">Presupuesto:</span>
                <span className="ticket-val ticket-bold">${Number(orden.costoTotal).toFixed(2)}</span>
              </div>
            )}
            {(orden.totalAnticipos ?? 0) > 0 && (
              <div className="ticket-row">
                <span className="ticket-key">Anticipo cobrado:</span>
                <span className="ticket-val ticket-bold">${Number(orden.totalAnticipos).toFixed(2)}</span>
              </div>
            )}
            {/* Desglose individual de anticipos */}
            {anticipos.length > 0 && (
              <div className="ticket-anticipos-det">
                {anticipos.map((a) => (
                  <div key={a.id} className="ticket-anticipo-row">
                    <span className="ticket-anticipo-fecha">{formatFechaCorta(a.fechaAnticipo)}</span>
                    <span className="ticket-anticipo-metodo">{METODO_LABEL[a.tipoPago] || a.tipoPago}</span>
                    <span className="ticket-anticipo-monto">${Number(a.monto).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Saldo pendiente */}
            {orden.costoTotal > 0 && (orden.totalAnticipos ?? 0) > 0 &&
              orden.costoTotal - (orden.totalAnticipos ?? 0) > 0.01 && (
              <div className="ticket-row ticket-saldo">
                <span className="ticket-key">Saldo pendiente:</span>
                <span className="ticket-val ticket-bold">${(orden.costoTotal - (orden.totalAnticipos ?? 0)).toFixed(2)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Notas del técnico */}
      {orden.notasTecnico && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-section">
            <div className="ticket-label">NOTAS TÉCNICO</div>
            <div className="ticket-problema">{orden.notasTecnico}</div>
          </div>
        </>
      )}

      {/* Técnico + prioridad */}
      <div className="ticket-sep" />
      <div className="ticket-footer-row">
        <div>
          <span className="ticket-key">Técnico: </span>
          <span className="ticket-val ticket-bold">{orden.tecnicoNombre || "Sin asignar"}</span>
        </div>
        <div className={`ticket-prioridad ticket-prioridad-${orden.prioridad}`}>
          {prioridadLabel(orden.prioridad)}
        </div>
      </div>

      {orden.esGarantia && (
        <div className="ticket-garantia">★ ORDEN EN GARANTÍA</div>
      )}

      <div className="ticket-sep" />

      {/* Firma al entregar */}
      <div className="ticket-firma-section">
        <div className="ticket-label">FIRMA AL ENTREGAR</div>
        <div className="ticket-firma-linea" />
        <div className="ticket-firma-sub">Nombre y firma del cliente</div>
      </div>

      {/* Notas de corte */}
      <div className="ticket-cut">— — — — — — — — —</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketPage() {
  const params = useParams();
  const id = params.id as string;
  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [anticipos, setAnticipos] = useState<AnticipoTicket[]>([]);
  const [error, setError] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("SERVICIO TÉCNICO");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reparaciones/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrden(d.data);
        else setError(true);
      })
      .catch(() => setError(true));

    // Fetch anticipos independientemente — si falla, el ticket se imprime igual
    fetch(`/api/reparaciones/${id}/anticipos`)
      .then((r) => r.json())
      .then((d) => { if (d.success && Array.isArray(d.data)) setAnticipos(d.data); })
      .catch(() => { /* no bloquear impresión si falla */ });

    // Nombre del negocio desde configuración del distribuidor
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data?.nombreEmpresa) setNombreEmpresa(d.data.nombreEmpresa); })
      .catch(() => { /* usar valor por defecto */ });
  }, [id]);

  // Auto-imprimir cuando la orden esté cargada
  useEffect(() => {
    if (orden && baseUrl) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [orden, baseUrl]);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: "monospace" }}>
        Error: no se pudo cargar la orden.
      </div>
    );
  }

  if (!orden || !baseUrl) {
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
          flex-direction: column;
          align-items: center;
          padding: 24px;
          min-height: 100vh;
        }

        .ticket {
          background: #fff;
          width: 58mm;
          padding: 5mm 3mm;
          border: 1px solid #ddd;
          box-shadow: 0 2px 8px rgba(0,0,0,.12);
          /* Texto más oscuro y grueso — mejor en térmicas */
          -webkit-font-smoothing: antialiased;
          font-weight: 600;
        }

        /* Header: brand a la izquierda, QR a la derecha */
        .ticket-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 3mm;
          margin-bottom: 4px;
        }
        .ticket-brand-col {
          flex: 1;
        }
        .ticket-brand {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #000;
          line-height: 1.1;
        }
        .ticket-subtitle {
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #444;
          margin-top: 2px;
          font-weight: 800;
        }
        .ticket-qr-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .ticket-qr-label {
          font-size: 8px;
          color: #666;
          text-align: center;
          font-weight: 700;
          line-height: 1.2;
          max-width: 56px;
        }

        /* Folio */
        .ticket-folio-block {
          text-align: center;
          margin: 5px 0 4px;
        }
        .ticket-folio-label {
          font-size: 11px;
          letter-spacing: 3px;
          color: #555;
          text-transform: uppercase;
          font-weight: 800;
        }
        .ticket-folio {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #000;
          line-height: 1.1;
        }
        .ticket-fecha {
          font-size: 12px;
          color: #222;
          font-weight: 700;
          margin-top: 2px;
        }

        .ticket-sep {
          border-top: 2px dashed #666;
          margin: 7px 0;
        }

        /* Secciones */
        .ticket-section { margin: 5px 0; }

        .ticket-label {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #000;
          margin-bottom: 4px;
        }

        .ticket-row {
          display: flex;
          gap: 3px;
          margin: 3px 0;
          line-height: 1.5;
        }
        .ticket-key {
          color: #222;
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .ticket-val {
          color: #000;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
          line-height: 1.5;
        }
        .ticket-lg    { font-size: 15px; }
        .ticket-bold  { font-weight: 900; }
        .ticket-mono  { letter-spacing: 0.5px; }

        .ticket-problema {
          font-size: 14px;
          font-weight: 800;
          color: #000;
          line-height: 1.5;
          margin-top: 3px;
          padding: 5px 7px;
          border-left: 4px solid #000;
          background: #e8e8e8;
        }

        .ticket-acceso {
          background: #fff8e1;
          padding: 5px 7px;
          border-left: 4px solid #d97706;
        }

        /* Anticipos detalle */
        .ticket-anticipos-det {
          margin: 4px 0 4px 8px;
          border-left: 2px solid #aaa;
          padding-left: 5px;
        }
        .ticket-anticipo-row {
          display: flex;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          margin: 2px 0;
          color: #333;
        }
        .ticket-anticipo-fecha { color: #555; flex-shrink: 0; }
        .ticket-anticipo-metodo { flex: 1; color: #444; }
        .ticket-anticipo-monto { font-weight: 800; white-space: nowrap; color: #000; }

        /* Saldo pendiente */
        .ticket-saldo {
          margin-top: 5px;
          padding-top: 4px;
          border-top: 1.5px solid #000;
        }

        /* Piezas */
        .ticket-pieza-row {
          display: flex;
          justify-content: space-between;
          gap: 4px;
          margin: 3px 0;
          font-size: 12px;
          font-weight: 700;
        }
        .ticket-pieza-nombre {
          flex: 1;
          color: #000;
        }
        .ticket-pieza-precio {
          font-weight: 800;
          white-space: nowrap;
          color: #000;
        }

        .ticket-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          margin-top: 4px;
        }

        .ticket-prioridad {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          padding: 3px 8px;
          border-radius: 3px;
        }
        .ticket-prioridad-normal  { background: #e5e7eb; color: #374151; }
        .ticket-prioridad-urgente { background: #fef3c7; color: #78350f; }
        .ticket-prioridad-express { background: #fee2e2; color: #7f1d1d; }

        .ticket-garantia {
          text-align: center;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #1d4ed8;
          margin-top: 5px;
        }

        /* Firma */
        .ticket-firma-section {
          margin: 6px 0 2px;
        }
        .ticket-firma-linea {
          border-top: 1.5px solid #000;
          margin: 14px 4px 5px;
        }
        .ticket-firma-sub {
          text-align: center;
          font-size: 11px;
          color: #444;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .ticket-cut {
          text-align: center;
          color: #999;
          font-size: 10px;
          margin-top: 6px;
          letter-spacing: 2px;
        }

        /* Botón imprimir — solo en pantalla */
        .print-btn {
          display: block;
          margin: 16px auto 0;
          padding: 10px 28px;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
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
            border: none;
            box-shadow: none;
            padding: 2mm;
          }
          .print-btn { display: none !important; }
          @page {
            size: 58mm auto;
            margin: 2mm;
          }
        }
      `}</style>

      <Ticket orden={orden} baseUrl={baseUrl} anticipos={anticipos} nombreEmpresa={nombreEmpresa} />

      <button
        className="print-btn"
        onClick={() => window.print()}
      >
        IMPRIMIR TICKET
      </button>
    </>
  );
}
