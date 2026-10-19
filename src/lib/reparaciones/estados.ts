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

/** Transiciones que un usuario puede elegir a mano en el cambio de estado genérico. */
export function transicionesManuales(estado: EstadoOrdenReparacion): EstadoOrdenReparacion[] {
  return (TRANSICIONES_VALIDAS[estado] ?? []).filter(
    (e) => !ESTADOS_SOLO_POR_FLUJO_ENTREGA.includes(e)
  );
}
