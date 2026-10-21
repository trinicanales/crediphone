/**
 * Formato de dinero único (es-MX). Antes había ~34 copias locales en distintas pantallas.
 *  - formatMXN: sin centavos (KPIs, gráficas, reportes).
 *  - formatMXNDec: con centavos (tickets, cobros, comisiones).
 */
const sinCentavos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const conCentavos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export const formatMXN = (n: number): string => sinCentavos.format(Number(n) || 0);
export const formatMXNDec = (n: number): string => conCentavos.format(Number(n) || 0);
