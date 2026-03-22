"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OrdenDetailHeader } from "@/components/reparaciones/detail/OrdenDetailHeader";
import { PresupuestoSummary } from "@/components/reparaciones/detail/PresupuestoSummary";
import { TimelineOrden } from "@/components/reparaciones/TimelineOrden";
import { GaleriaFotosOrden } from "@/components/reparaciones/GaleriaFotosOrden";
import { HistorialNotificaciones } from "@/components/reparaciones/HistorialNotificaciones";
import { ModalEditarOrden } from "@/components/reparaciones/ModalEditarOrden";
import { ModalEditarPresupuesto } from "@/components/reparaciones/ModalEditarPresupuesto";
import { ModalCancelacion } from "@/components/reparaciones/ModalCancelacion";
import { PiezasInventarioPanel } from "@/components/reparaciones/PiezasInventarioPanel";
import { AnticipoCajaPanel } from "@/components/reparaciones/anticipos/AnticipoCajaPanel";
import { CentroMensajesPanel } from "@/components/reparaciones/mensajeria/CentroMensajesPanel";
import { BitacoraTiempoPanel } from "@/components/reparaciones/BitacoraTiempoPanel";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { OrdenReparacionDetallada } from "@/types";
import {
  Loader2, Package, Wrench, DollarSign, Clock, FileText, Edit,
  ClipboardList, Camera, MessageCircle, Timer, CalendarDays, AlertTriangle,
} from "lucide-react";

export default function OrdenDetailPage() {
  const params = useParams();
  const ordenId = params.id as string;

  const [orden, setOrden] = useState<OrdenReparacionDetallada | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalPresupuestoOpen, setModalPresupuestoOpen] = useState(false);
  const [modalCancelacionOpen, setModalCancelacionOpen] = useState(false);

  const recargarOrden = async () => {
    try {
      const response = await fetch(`/api/reparaciones/${ordenId}`);
      const result = await response.json();
      if (result.success) setOrden(result.data);
    } catch (err) {
      console.error("Error al recargar orden:", err);
    }
  };

  useEffect(() => {
    const fetchOrden = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/reparaciones/${ordenId}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Error al cargar orden");
        }

        setOrden(result.data);
        setError(null);
      } catch (err) {
        console.error("Error al cargar orden:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    if (ordenId) {
      fetchOrden();
    }
  }, [ordenId]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2
            className="w-12 h-12 animate-spin mx-auto mb-4"
            style={{ color: "var(--color-accent)" }}
          />
          <p style={{ color: "var(--color-text-secondary)" }}>
            Cargando detalles de la orden...
          </p>
        </div>
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div
            className="rounded-lg p-6 max-w-md"
            style={{
              background: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger)",
            }}
          >
            <h2
              className="font-semibold mb-2"
              style={{ color: "var(--color-danger-text)" }}
            >
              Error al cargar orden
            </h2>
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>
              {error || "Orden no encontrada"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatFecha = (fecha: Date | string | null | undefined) => {
    if (!fecha) return "No especificada";
    const date = typeof fecha === "string" ? new Date(fecha) : fecha;
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tabs = [
    {
      id: "resumen",
      label: <span className="flex items-center gap-1.5"><ClipboardList size={14} />Resumen</span>,
      content: (
        <div className="space-y-6">
          {/* Información Básica */}
          <Card title="Información del Dispositivo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Marca y Modelo
                </p>
                <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {orden.marcaDispositivo} {orden.modeloDispositivo}
                </p>
              </div>

              {orden.imei && (
                <div>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    IMEI
                  </p>
                  <p
                    className="text-base font-medium"
                    style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
                  >
                    {orden.imei}
                  </p>
                </div>
              )}

              {orden.numeroSerie && (
                <div>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Número de Serie
                  </p>
                  <p
                    className="text-base font-medium"
                    style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
                  >
                    {orden.numeroSerie}
                  </p>
                </div>
              )}

              {orden.condicionDispositivo && (
                <div>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Condición del Dispositivo
                  </p>
                  <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {orden.condicionDispositivo}
                  </p>
                </div>
              )}

              {orden.accesoriosEntregados && (
                <div className="md:col-span-2">
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Accesorios Entregados
                  </p>
                  <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {orden.accesoriosEntregados}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Alerta de aprobación parcial */}
          {orden.aprobacionParcial && (
            <div
              className="rounded-xl border-2 p-4"
              style={{
                borderColor: "var(--color-warning)",
                background: "var(--color-warning-bg)",
              }}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="shrink-0" style={{ color: "var(--color-warning)" }} />
                <div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: "var(--color-warning-text)" }}
                  >
                    APROBACIÓN PARCIAL — Solo el problema original
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-warning-text)" }}>
                    El cliente <strong>NO autorizó las reparaciones adicionales</strong> del
                    diagnóstico. Procede solo con el problema original por el que trajo el equipo.
                  </p>
                  {orden.notasCliente && (
                    <p
                      className="text-xs mt-2 italic"
                      style={{ color: "var(--color-warning)" }}
                    >
                      Nota del cliente: {orden.notasCliente}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Acceso al Dispositivo */}
          {(orden.patronDesbloqueo || orden.passwordDispositivo) && (
            <div
              className="rounded-xl border-2 p-4"
              style={{
                borderColor: "var(--color-warning)",
                background: "var(--color-warning-bg)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔐</span>
                <p className="font-semibold" style={{ color: "var(--color-warning-text)" }}>
                  Acceso al Dispositivo
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orden.patronDesbloqueo && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--color-warning)" }}>
                      Patrón de desbloqueo
                    </p>
                    <p
                      className="font-mono text-sm font-bold rounded px-3 py-2"
                      style={{
                        color: "var(--color-warning-text)",
                        background: "rgba(0,0,0,0.08)",
                      }}
                    >
                      {orden.patronDesbloqueo}
                    </p>
                  </div>
                )}
                {orden.passwordDispositivo && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--color-warning)" }}>
                      Contraseña / PIN
                    </p>
                    <p
                      className="font-mono text-sm font-bold rounded px-3 py-2"
                      style={{
                        color: "var(--color-warning-text)",
                        background: "rgba(0,0,0,0.08)",
                      }}
                    >
                      {orden.passwordDispositivo}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Problema Reportado */}
          <Card title="Problema Reportado">
            <p className="whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
              {orden.problemaReportado}
            </p>
          </Card>

          {/* Fechas Importantes */}
          <Card title="Fechas Importantes">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
                <div>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Fecha de Recepción
                  </p>
                  <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {formatFecha(orden.fechaRecepcion)}
                  </p>
                </div>
              </div>

              {orden.fechaEstimadaEntrega && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      Entrega Estimada
                    </p>
                    <p className="text-base font-medium" style={{ color: "var(--color-accent)" }}>
                      {formatFecha(orden.fechaEstimadaEntrega)}
                    </p>
                  </div>
                </div>
              )}

              {orden.fechaCompletado && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" style={{ color: "var(--color-success)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      Fecha de Completado
                    </p>
                    <p className="text-base font-medium" style={{ color: "var(--color-success)" }}>
                      {formatFecha(orden.fechaCompletado)}
                    </p>
                  </div>
                </div>
              )}

              {orden.fechaEntregado && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      Fecha de Entrega
                    </p>
                    <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {formatFecha(orden.fechaEntregado)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Notas Internas */}
          {orden.notasInternas && (
            <Card title="Notas Internas">
              <p className="whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
                {orden.notasInternas}
              </p>
            </Card>
          )}
        </div>
      ),
    },
    {
      id: "diagnostico",
      label: <span className="flex items-center gap-1.5"><Wrench size={14} />Diagnóstico</span>,
      content: (
        <div className="space-y-6">
          <Card title="Diagnóstico del Técnico">
            {orden.diagnosticoTecnico ? (
              <div className="space-y-4">
                <p
                  className="whitespace-pre-wrap"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {orden.diagnosticoTecnico}
                </p>

                {orden.notasTecnico && (
                  <div
                    className="mt-4 p-4 rounded-lg"
                    style={{ background: "var(--color-info-bg)" }}
                  >
                    <p
                      className="text-sm font-medium mb-2"
                      style={{ color: "var(--color-info-text)" }}
                    >
                      Notas del Técnico
                    </p>
                    <p
                      className="text-sm whitespace-pre-wrap"
                      style={{ color: "var(--color-info)" }}
                    >
                      {orden.notasTecnico}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Wrench
                  className="w-12 h-12 mx-auto mb-2"
                  style={{ color: "var(--color-border-strong)" }}
                />
                <p style={{ color: "var(--color-text-muted)" }}>
                  El diagnóstico aún no ha sido realizado
                </p>
              </div>
            )}
          </Card>

          <Card title="Técnico Asignado">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--color-info-bg)" }}
              >
                <Wrench className="w-6 h-6" style={{ color: "var(--color-info)" }} />
              </div>
              <div>
                <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {orden.tecnicoNombre || "No asignado"}
                </p>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Técnico de reparación
                </p>
              </div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: "presupuesto",
      label: <span className="flex items-center gap-1.5"><DollarSign size={14} />Presupuesto</span>,
      content: (
        <div className="space-y-6">
          {orden.estado !== "entregado" && orden.estado !== "cancelado" && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModalPresupuestoOpen(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar Presupuesto
              </Button>
            </div>
          )}
          <PresupuestoSummary orden={orden} />
          <AnticipoCajaPanel orden={orden} onOrdenUpdated={recargarOrden} />
        </div>
      ),
    },
    {
      id: "historial",
      label: <span className="flex items-center gap-1.5"><CalendarDays size={14} />Historial</span>,
      content: (
        <div className="space-y-6">
          <TimelineOrden ordenId={orden.id} estadoActual={orden.estado} />
          <div
            className="pt-6"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <HistorialNotificaciones ordenId={orden.id} />
          </div>
        </div>
      ),
    },
    {
      id: "fotos",
      label: <span className="flex items-center gap-1.5"><Camera size={14} />Fotos</span>,
      content: (
        <GaleriaFotosOrden
          orden={orden}
          onUpdate={() => {
            fetch(`/api/reparaciones/${ordenId}`)
              .then((res) => res.json())
              .then((result) => {
                if (result.success) {
                  setOrden(result.data);
                }
              });
          }}
        />
      ),
    },
    {
      id: "piezas",
      label: <span className="flex items-center gap-1.5"><Package size={14} />Piezas</span>,
      content: (
        <PiezasInventarioPanel
          ordenId={orden.id}
          estadoOrden={orden.estado}
          onCostoActualizado={() => {
            fetch(`/api/reparaciones/${ordenId}`)
              .then((res) => res.json())
              .then((result) => {
                if (result.success) setOrden(result.data);
              });
          }}
        />
      ),
    },
    {
      id: "mensajeria",
      label: <span className="flex items-center gap-1.5"><MessageCircle size={14} />Mensajería</span>,
      content: <CentroMensajesPanel orden={orden} onUpdate={recargarOrden} />,
    },
    {
      id: "tiempo",
      label: <span className="flex items-center gap-1.5"><Timer size={14} />Tiempo</span>,
      content: <BitacoraTiempoPanel ordenId={orden.id} />,
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <OrdenDetailHeader
        orden={orden}
        onEdit={() => setModalEditarOpen(true)}
        onCancelar={() => setModalCancelacionOpen(true)}
      />

      <Tabs tabs={tabs} defaultTab="resumen" />

      <ModalEditarOrden
        isOpen={modalEditarOpen}
        onClose={() => setModalEditarOpen(false)}
        orden={orden}
        onSuccess={() => {
          setModalEditarOpen(false);
          fetch(`/api/reparaciones/${ordenId}`)
            .then((res) => res.json())
            .then((result) => {
              if (result.success) {
                setOrden(result.data);
              }
            });
        }}
      />

      <ModalEditarPresupuesto
        isOpen={modalPresupuestoOpen}
        onClose={() => setModalPresupuestoOpen(false)}
        orden={orden}
        onSuccess={() => {
          setModalPresupuestoOpen(false);
          fetch(`/api/reparaciones/${ordenId}`)
            .then((res) => res.json())
            .then((result) => {
              if (result.success) {
                setOrden(result.data);
              }
            });
        }}
      />

      <ModalCancelacion
        isOpen={modalCancelacionOpen}
        onClose={() => setModalCancelacionOpen(false)}
        onConfirm={() => {
          setModalCancelacionOpen(false);
          recargarOrden();
        }}
        folio={orden.folio}
        ordenId={orden.id}
      />
    </div>
  );
}
