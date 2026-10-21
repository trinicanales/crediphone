/**
 * Regla única de stock bajo/crítico.
 *
 * Decisión de Trini (2026-10-20): si un producto no tiene mínimo definido, el mínimo es 1.
 * El stock negativo (se vendió sin existencia) NO se oculta: cuenta como crítico y se reporta aparte.
 * PostgREST no puede comparar columna contra columna (`stock <= stock_minimo`), por eso se evalúa aquí.
 */
export const STOCK_MINIMO_DEFECTO = 1;

export function minimoEfectivo(stockMinimo: number | null | undefined): number {
  const m = Number(stockMinimo ?? 0);
  return m > 0 ? m : STOCK_MINIMO_DEFECTO;
}

export function esStockCritico(stock: number | null | undefined, stockMinimo: number | null | undefined): boolean {
  return Number(stock ?? 0) <= minimoEfectivo(stockMinimo);
}

export function esStockNegativo(stock: number | null | undefined): boolean {
  return Number(stock ?? 0) < 0;
}
