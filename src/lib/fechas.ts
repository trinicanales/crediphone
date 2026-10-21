/**
 * Fechas en hora de México (UTC-6, sin horario de verano desde 2022).
 *
 * Cloudflare Workers corre en UTC: `new Date().setHours(0,0,0,0)` da medianoche UTC, que en
 * México es las 18:00 del día anterior, y `toISOString().split("T")[0]` cambia de día a las 18:00.
 * Todo "hoy", corte diario o rango mensual debe salir de estas funciones.
 */
const OFFSET = "-06:00";
const TZ = "America/Mexico_City";

/** Fecha local de México como YYYY-MM-DD. */
export function ymdMX(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Medianoche (hora de México) del día de `d`, como instante. */
export function inicioDiaMX(d: Date = new Date()): Date {
  return new Date(`${ymdMX(d)}T00:00:00${OFFSET}`);
}

/** Inicio de un mes (1-12) en hora de México, como instante. */
export function inicioMesMX(anio: number, mes: number): Date {
  const m = String(mes).padStart(2, "0");
  return new Date(`${anio}-${m}-01T00:00:00${OFFSET}`);
}

/** Inicio y fin (exclusivo) de un día YYYY-MM-DD en hora de México. */
export function rangoDiaMX(ymd: string): { inicio: string; fin: string } {
  const inicio = new Date(`${ymd}T00:00:00${OFFSET}`);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio: inicio.toISOString(), fin: fin.toISOString() };
}
