/**
 * Catálogo de marcas y alias para normalizar lo que escriben los empleados.
 * Hoy "ip", "iphone" y "apple" son la misma marca escrita de tres formas (28 órdenes),
 * igual que "moto"/"motorola" (24) y "redmi"/"xiaomi" (12). El histórico NO se modifica:
 * la normalización se usa para sugerir y para agrupar reportes.
 */

/** Nombre canónico → alias en minúsculas y sin acentos */
const ALIAS: Record<string, string[]> = {
  Samsung: ["samsung", "sams", "sansung", "samsumg", "galaxy"],
  Apple: ["apple", "iphone", "ip", "i phone", "ipod", "ipad", "aple"],
  Motorola: ["motorola", "moto", "motorrola"],
  Xiaomi: ["xiaomi", "xiomi", "redmi", "mi", "poco", "xiaomy"],
  Huawei: ["huawei", "huaweii", "hawei"],
  Honor: ["honor"],
  Oppo: ["oppo", "opo"],
  Realme: ["realme", "real me"],
  Vivo: ["vivo"],
  ZTE: ["zte"],
  LG: ["lg"],
  Nokia: ["nokia"],
  Alcatel: ["alcatel"],
  TCL: ["tcl"],
  Infinix: ["infinix"],
  Tecno: ["tecno"],
  OnePlus: ["oneplus", "one plus"],
  Google: ["google", "pixel"],
  Sony: ["sony", "xperia"],
  Lenovo: ["lenovo"],
  Itel: ["itel"],
  Blu: ["blu"],
};

/** Marcas comunes para sugerir aunque aún no haya historial */
export const MARCAS_COMUNES = Object.keys(ALIAS);

function limpiar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const INDICE = new Map<string, string>();
for (const [canonico, alias] of Object.entries(ALIAS)) {
  INDICE.set(limpiar(canonico), canonico);
  for (const a of alias) INDICE.set(limpiar(a), canonico);
}

/** Devuelve el nombre canónico si el texto es una marca/alias conocido; si no, null. */
export function marcaCanonica(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return INDICE.get(limpiar(texto)) ?? null;
}

/** Clave para agrupar: canónica si se reconoce, si no el texto limpio. */
export function claveMarca(texto: string | null | undefined): string {
  return marcaCanonica(texto) ?? limpiar(texto ?? "");
}

export { limpiar as limpiarTexto };
