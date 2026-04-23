/**
 * CREDIPHONE — Servicio de sincronización offline→online
 *
 * Cuando se recupera internet, procesa la cola de operaciones pendientes
 * en orden FIFO y las envía al servidor.
 */

import {
  leerPendientes,
  eliminarOperacion,
  marcarIntento,
  type PendingOperation,
  type ResultadoSync,
} from "./queue";

// Máximo de intentos antes de dejar la operación "varada"
const MAX_INTENTOS = 5;

// ── Procesadores por tipo ─────────────────────────────────────────────────────

async function enviarVenta(payload: unknown): Promise<void> {
  const res = await fetch("/api/pos/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error ?? "Error al registrar venta");
  }
}

async function enviarReparacionEstado(payload: unknown): Promise<void> {
  const p = payload as { id: string; estado: string; notas?: string };
  const res = await fetch(`/api/reparaciones/${p.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: p.estado, notas: p.notas }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error ?? "Error al actualizar reparación");
  }
}

async function procesarOperacion(op: PendingOperation): Promise<void> {
  switch (op.tipo) {
    case "venta":
      return enviarVenta(op.payload);
    case "reparacion_estado":
      return enviarReparacionEstado(op.payload);
    default:
      throw new Error(`Tipo de operación desconocido: ${op.tipo}`);
  }
}

// ── Flush principal ───────────────────────────────────────────────────────────

/**
 * Procesa todas las operaciones pendientes de la cola.
 * Solo se llama cuando hay conexión.
 */
export async function flushCola(): Promise<ResultadoSync> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { procesadas: 0, fallidas: 0, errores: [] };
  }

  const ops = await leerPendientes();
  const resultado: ResultadoSync = { procesadas: 0, fallidas: 0, errores: [] };

  for (const op of ops) {
    // Ignorar operaciones con demasiados intentos fallidos
    if (op.intentos >= MAX_INTENTOS) {
      resultado.fallidas++;
      resultado.errores.push({
        id: op.id!,
        error: `Máximo de intentos alcanzado: ${op.ultimoError}`,
      });
      continue;
    }

    try {
      await procesarOperacion(op);
      await eliminarOperacion(op.id!);
      resultado.procesadas++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      await marcarIntento(op.id!, msg);
      resultado.fallidas++;
      resultado.errores.push({ id: op.id!, error: msg });
    }
  }

  return resultado;
}
