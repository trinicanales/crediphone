"use client";

/**
 * CREDIPHONE — Banner de estado offline en el POS
 *
 * Muestra una barra visible cuando no hay internet.
 * Indica cuántas ventas están en cola pendientes de sincronización.
 * Cuando vuelve el internet, dispara el flush y confirma el resultado.
 */

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { contarPendientes } from "@/lib/offline/queue";
import { flushCola } from "@/lib/offline/sync";

interface OfflineBannerProps {
  /** Se llama cada vez que el flush termina con éxito para refrescar el POS */
  onSyncComplete?: (procesadas: number) => void;
}

export function OfflineBanner({ onSyncComplete }: OfflineBannerProps) {
  const online = useOnlineStatus();
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState<string | null>(null);

  // Actualiza el contador de pendientes cada vez que el componente se monta o el estado online cambia
  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const n = await contarPendientes();
      if (!cancelado) setPendientes(n);
    }

    cargar();

    // Cuando recupera conexión, flush automático
    if (online && pendientes > 0) {
      handleFlush();
    }

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  async function handleFlush() {
    if (sincronizando) return;
    setSincronizando(true);
    setMensajeSync(null);

    try {
      const resultado = await flushCola();
      const n = await contarPendientes();
      setPendientes(n);

      if (resultado.procesadas > 0) {
        setMensajeSync(
          `✓ ${resultado.procesadas} venta${resultado.procesadas > 1 ? "s" : ""} sincronizada${resultado.procesadas > 1 ? "s" : ""}`
        );
        onSyncComplete?.(resultado.procesadas);
        setTimeout(() => setMensajeSync(null), 4000);
      }

      if (resultado.fallidas > 0) {
        setMensajeSync(
          `⚠ ${resultado.fallidas} operación${resultado.fallidas > 1 ? "es" : ""} con error — se reintentará`
        );
        setTimeout(() => setMensajeSync(null), 6000);
      }
    } catch {
      setMensajeSync("Error al sincronizar — se reintentará al próximo intento");
      setTimeout(() => setMensajeSync(null), 5000);
    } finally {
      setSincronizando(false);
    }
  }

  // No mostrar nada si hay conexión y nada pendiente
  if (online && pendientes === 0 && !mensajeSync) return null;

  // Banner de confirmación de sync exitoso (brevemente visible)
  if (online && mensajeSync && pendientes === 0) {
    return (
      <div
        role="status"
        style={{
          background: "var(--color-success-bg)",
          borderBottom: "1px solid var(--color-success)",
          color: "var(--color-success-text)",
          fontSize: "0.8rem",
          fontWeight: 600,
          padding: "0.4rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span>{mensajeSync}</span>
      </div>
    );
  }

  // Banner de offline o pendientes
  return (
    <div
      role="alert"
      style={{
        background: online ? "var(--color-warning-bg)" : "var(--color-danger-bg)",
        borderBottom: `1px solid ${online ? "var(--color-warning)" : "var(--color-danger)"}`,
        color: online ? "var(--color-warning-text)" : "var(--color-danger-text)",
        fontSize: "0.8rem",
        fontWeight: 600,
        padding: "0.4rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
      }}
    >
      <span>
        {online ? (
          <>
            📡 Conexión recuperada —{" "}
            {sincronizando
              ? "sincronizando..."
              : mensajeSync ?? `${pendientes} operación${pendientes !== 1 ? "es" : ""} pendiente${pendientes !== 1 ? "s" : ""} de sincronizar`}
          </>
        ) : (
          <>
            ⚠ Sin conexión a internet
            {pendientes > 0
              ? ` — ${pendientes} operación${pendientes !== 1 ? "es" : ""} guardada${pendientes !== 1 ? "s" : ""} localmente`
              : " — las operaciones se guardarán localmente"}
          </>
        )}
      </span>

      {online && pendientes > 0 && !sincronizando && (
        <button
          onClick={handleFlush}
          style={{
            background: "var(--color-warning)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "0.2rem 0.7rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Sincronizar ahora
        </button>
      )}
    </div>
  );
}
