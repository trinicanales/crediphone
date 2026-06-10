"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, Smartphone, CheckCircle } from "lucide-react";
import type { AlertaRecordatorio } from "@/lib/types/notificaciones";
import {
  generarMensajeRecordatorio,
  abrirWhatsApp,
  formatearTelefono,
} from "@/lib/whatsapp-utils";

interface AlertaCardProps {
  alerta: AlertaRecordatorio;
  onEnviado?: (creditoId: string) => void;
}

export function AlertaCard({ alerta, onEnviado }: AlertaCardProps) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const { credito, cliente, tipo, prioridad, diasHastaVencimiento } = alerta;

  // Colores según prioridad
  const colorPrioridad = {
    urgente: "bg-red-50 border-red-300",
    alta: "bg-orange-50 border-orange-300",
    media: "bg-yellow-50 border-yellow-300",
    baja: "bg-blue-50 border-blue-300",
  };

  const badgeVariant = {
    urgente: "danger" as const,
    alta: "warning" as const,
    media: "warning" as const,
    baja: "info" as const,
  };

  const iconoPrioridad: Record<string, string | ReactNode> = {
    urgente: "🚨",
    alta: <AlertTriangle className="w-4 h-4 inline" />,
    media: "⏰",
    baja: "📋",
  };

  const handleEnviarWhatsApp = async () => {
    setEnviando(true);

    try {
      // Generar mensaje personalizado
      const mensaje = generarMensajeRecordatorio({
        nombreCliente: `${cliente.nombre} ${cliente.apellido}`,
        folioCredito: credito.folio,
        fechaVencimiento: credito.fechaFin,
        saldoPendiente: credito.saldoPendiente || credito.monto,
        diasMora: credito.diasMora > 0 ? credito.diasMora : undefined,
      });

      // Abrir WhatsApp
      const telefonoWhatsApp = cliente.whatsapp || cliente.telefono;
      abrirWhatsApp(telefonoWhatsApp, mensaje);

      // Registrar envío en backend
      const response = await fetch(`/api/recordatorios/${credito.id}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.id,
          tipo,
          canal: "whatsapp",
          mensaje,
          telefono: telefonoWhatsApp,
        }),
      });

      if (response.ok) {
        setEnviado(true);
        onEnviado?.(credito.id);
      } else {
        const error = await response.json();
        console.error("Error al registrar envío:", error);
        alert("Error al registrar el envío. El mensaje se abrió pero no se guardó el registro.");
      }
    } catch (error) {
      console.error("Error al enviar WhatsApp:", error);
      alert("Error al procesar el envío");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className={`border-l-4 ${colorPrioridad[prioridad]} hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header con prioridad y folio */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{iconoPrioridad[prioridad]}</span>
            <Badge variant={badgeVariant[prioridad]}>
              {prioridad.toUpperCase()}
            </Badge>
            <span className="text-sm text-gray-600 font-mono">
              #{credito.folio}
            </span>
          </div>

          {/* Información del cliente */}
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {cliente.nombre} {cliente.apellido}
            </h3>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 flex-shrink-0" /> {formatearTelefono(cliente.telefono)}
            </p>
            {cliente.email && (
              <p className="text-sm text-gray-600">
                ✉️ {cliente.email}
              </p>
            )}
          </div>

          {/* Detalles del crédito */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Monto:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                }).format(credito.monto)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Vencimiento:</span>
              <span className="ml-2 font-medium text-gray-900">
                {new Date(credito.fechaFin).toLocaleDateString("es-MX")}
              </span>
            </div>
          </div>

          {/* Estado del crédito */}
          <div className="mt-3">
            {credito.diasMora > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-red-600">
                  {credito.diasMora} día(s) de mora
                </span>
                {credito.diasMora > 30 && (
                  <Badge variant="danger">URGENTE</Badge>
                )}
              </div>
            ) : diasHastaVencimiento !== undefined ? (
              <p className="text-sm font-medium text-orange-600">
                Vence en {diasHastaVencimiento} día(s)
              </p>
            ) : null}
          </div>
        </div>

        {/* Botón WhatsApp */}
        <div className="flex-shrink-0">
          <Button
            variant={enviado ? "secondary" : "primary"}
            size="md"
            onClick={handleEnviarWhatsApp}
            disabled={enviando || enviado}
            className="whitespace-nowrap flex items-center gap-2"
          >
            {enviado ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                Enviado
              </>
            ) : enviando ? (
              <>
                <span className="animate-spin">⏳</span>
                Enviando...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
