import type { EstadoOrdenReparacion } from "@/types";

/**
 * FUENTE ÚNICA de transiciones de estado de una orden de reparación.
 *
 * La usan: el servidor (cambiarEstadoOrden), ModalCambiarEstado y OrdenCard.
 * Antes cada uno tenía su propia copia y ya habían divergido (la card ofrecía
 * `recibido → no_reparable`, que el servidor rechazaba). Cualquier cambio de
 * flujo se hace SOLO aquí.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoOrdenReparacion, EstadoOrdenReparacion[]> = {
  recibido:          ["diagnostico", "cancelado"],
  diagnostico:       ["esperando_piezas", "presupuesto", "aprobado", "no_reparable", "cancelado"],
  esperando_piezas:  ["en_reparacion", "aprobado", "cancelado"],
  presupuesto:       ["aprobado", "cancelado"],
  aprobado:          ["en_reparacion", "cancelado"],
  en_reparacion:     ["completado", "esperando_piezas", "no_reparable", "cancelado"],
  completado:        ["listo_entrega", "cancelado"],
  listo_entrega:     ["entregado", "cancelado"],
  entregado:         [],
  no_reparable:      [],
  cancelado:         [],
};

/**
 * Estados a los que NO se puede llegar con el cambio de estado genérico.
 * "entregado" solo se alcanza por el flujo de entrega (/entregar o cobro en POS),
 * que aplica anticipos, caja virtual, descuento de stock, puntos, garantía y PDF.
 * Marcarlo desde el cambio genérico dejaba la orden "entregada" sin ninguno de esos efectos.
 */
export const ESTADOS_SOLO_POR_FLUJO_ENTREGA: EstadoOrdenReparacion[] = ["entregado"];

/**
 * ORDEN "ACTIVA" = sigue en el taller (no entregada, cancelada ni no reparable).
 * Antes cada pantalla tenía su propia definición y los números no coincidían.
 */
export const ESTADOS_ACTIVOS: EstadoOrdenReparacion[] = [
  "recibido",
  "diagnostico",
  "esperando_piezas",
  "presupuesto",
  "aprobado",
  "en_reparacion",
  "completado",
  "listo_entrega",
];

export function esOrdenActiva(estado: EstadoOrdenReparacion): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

/** Ingreso de una orden: lo que paga el cliente (precio_total); costo_total solo si no hay precio. */
export function ingresoOrden(o: { precio_total?: unknown; costo_total?: unknown }): number {
  return Number(o.precio_total || o.costo_total || 0);
}

/**
 * PASOS DE PROGRESO — fuente única para el stepper del personal (tarjeta) y el del cliente
 * (seguimiento). Antes eran dos listas distintas (6 y 7 pasos) y el mismo estado caía en
 * pasos diferentes. Decisión de Trini 2026-10-19: unificar en 7 pasos.
 *  - "completado" (reparación terminada) cuenta en el paso "Listo".
 *  - "esperando_piezas" NO es un paso: se muestra como insignia sobre el paso "Aprobado"
 *    (se pide pieza tras aprobar); `esEstadoEspera()` permite pintar la insignia.
 */
export interface PasoProgreso {
  key: string;
  label: string;
  icon: string;
  estados: EstadoOrdenReparacion[];
}

export const PASOS_PROGRESO: PasoProgreso[] = [
  { key: "recibido",    label: "Recibido",    icon: "📥", estados: ["recibido"] },
  { key: "diagnostico", label: "Diagnóstico", icon: "🔍", estados: ["diagnostico"] },
  { key: "presupuesto", label: "Presupuesto", icon: "📄", estados: ["presupuesto"] },
  { key: "aprobado",    label: "Aprobado",    icon: "✅", estados: ["aprobado", "esperando_piezas"] },
  { key: "reparacion",  label: "Reparando",   icon: "🔧", estados: ["en_reparacion"] },
  { key: "listo",       label: "Listo",       icon: "✨", estados: ["completado", "listo_entrega"] },
  { key: "entregado",   label: "Entregado",   icon: "🎉", estados: ["entregado"] },
];

/** Índice del paso al que pertenece el estado (-1 para cancelado / no_reparable). */
export function indicePasoProgreso(estado: EstadoOrdenReparacion): number {
  return PASOS_PROGRESO.findIndex((p) => p.estados.includes(estado));
}

/** Estado de "espera" que se muestra como insignia en vez de mover la barra. */
export function esEstadoEspera(estado: EstadoOrdenReparacion): boolean {
  return estado === "esperando_piezas";
}

/**
 * Estado al que lleva hacer clic en un paso, o null si ese salto no es válido desde el estado actual.
 * "entregado" devuelve "entregado" cuando es alcanzable: el llamador debe abrir el flujo de entrega
 * (no el cambio genérico), igual que "cancelado" debe abrir el flujo de cancelación completo.
 */
export function destinoDePaso(
  actual: EstadoOrdenReparacion,
  paso: PasoProgreso
): EstadoOrdenReparacion | null {
  const validos = TRANSICIONES_VALIDAS[actual] ?? [];
  const destino = paso.estados.find((e) => validos.includes(e));
  return destino ?? null;
}

/** Transiciones que un usuario puede elegir a mano en el cambio de estado genérico. */
export function transicionesManuales(estado: EstadoOrdenReparacion): EstadoOrdenReparacion[] {
  return (TRANSICIONES_VALIDAS[estado] ?? []).filter(
    (e) => !ESTADOS_SOLO_POR_FLUJO_ENTREGA.includes(e)
  );
}
