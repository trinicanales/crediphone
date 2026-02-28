"use client";

import { useState } from "react";
import { MessageSquare, Send, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrdenReparacionDetallada } from "@/types";
import {
  generarMensajePresupuesto,
  abrirWhatsApp,
} from "@/lib/whatsapp-reparaciones";

interface EnvioPresupuestoProps {
  orden: OrdenReparacionDetallada;
  onEnviado?: () => void;
}

export function EnvioPresupuesto({ orden, onEnviado }: EnvioPresupuestoProps) {
  const [mostrandoPreview, setMostrandoPreview] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const mensaje = generarMensajePresupuesto(orden);
  const telefono = orden.clienteTelefono || "";

  const handleEnviar = async () => {
    if (!telefono) {
      alert("❌ No hay número de teléfono registrado para este cliente");
      return;
    }

    setEnviando(true);

    try {
      // Registrar envío en base de datos (opcional)
      try {
        await fetch(`/api/reparaciones/${orden.id}/notificaciones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "presupuesto_enviado",
            canal: "whatsapp",
            mensaje: mensaje,
            telefono: telefono,
          }),
        });
      } catch (dbError) {
        // Si falla el registro, continuamos con el envío
        console.warn("No se pudo registrar la notificación:", dbError);
      }

      // Abrir WhatsApp
      abrirWhatsApp(telefono, mensaje);

      // Callback opcional
      if (onEnviado) {
        onEnviado();
      }

      // Feedback visual
      alert("✅ WhatsApp abierto. Verifica el mensaje y envíalo al cliente.");
    } catch (error) {
      console.error("Error al enviar presupuesto:", error);
      alert(
        "⚠️ Hubo un error al abrir WhatsApp. Por favor, intenta nuevamente."
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Info del destinatario */}
      {telefono && (
        <div
          className="rounded-lg p-3"
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            <MessageSquare className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
            <span className="font-medium">Destinatario:</span>
            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{telefono}</span>
            <span style={{ color: "var(--color-text-secondary)" }}>
              ({orden.clienteNombre} {orden.clienteApellido || ""})
            </span>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMostrandoPreview(!mostrandoPreview)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all"
          style={{
            border: "2px solid var(--color-border-strong)",
            background: "var(--color-bg-elevated)",
            color: "var(--color-accent)",
          }}
        >
          {mostrandoPreview ? (
            <>
              <EyeOff className="w-4 h-4" />
              Ocultar Preview
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Vista Previa
            </>
          )}
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleEnviar}
          disabled={enviando || !telefono}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "var(--color-success)",
            color: "#ffffff",
          }}
        >
          {enviando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar por WhatsApp
            </>
          )}
        </motion.button>
      </div>

      {/* Preview del mensaje */}
      <AnimatePresence>
        {mostrandoPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl p-5"
              style={{
                background: "var(--color-bg-elevated)",
                border: "2px solid var(--color-border)",
              }}
            >
              <div
                className="flex items-center gap-2 mb-4 pb-3"
                style={{ borderBottom: "2px solid var(--color-border)" }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "var(--color-success)" }}
                >
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                    Mensaje de Presupuesto
                  </h4>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    Esto es lo que verá el cliente
                  </p>
                </div>
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  background: "var(--color-bg-surface)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <pre
                  className="text-xs whitespace-pre-wrap font-sans leading-relaxed"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {mensaje}
                </pre>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
                <span className="font-medium">
                  📱 Se enviará vía WhatsApp Web
                </span>
                <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerta si no hay teléfono */}
      {!telefono && (
        <div
          className="rounded-lg p-3 flex items-start gap-2"
          style={{
            background: "var(--color-danger-bg)",
            border: "2px solid var(--color-danger)",
          }}
        >
          <span className="text-lg" style={{ color: "var(--color-danger)" }}>⚠️</span>
          <div className="text-xs" style={{ color: "var(--color-danger-text)" }}>
            <p className="font-semibold mb-1">No hay número de WhatsApp</p>
            <p>
              Este cliente no tiene un número de teléfono o WhatsApp registrado.
              Por favor, actualiza la información del cliente antes de enviar el
              presupuesto.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
