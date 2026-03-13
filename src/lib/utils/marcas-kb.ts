/**
 * ============================================================
 * CREDIPHONE — BASE DE CONOCIMIENTO DE MARCAS Y MODELOS
 * ============================================================
 *
 * Propósito:
 *   Normalizar los nombres de marcas y modelos que llegan en tickets
 *   de proveedores (principalmente WINDCEL) a sus nombres oficiales.
 *
 * Cómo agregar una marca nueva:
 *   1. Agregar una entrada a REGLAS_MARCA con los prefijos que usa el proveedor
 *   2. Agregar sus series/familias a SERIES_CONOCIDAS (opcional pero recomendado)
 *   3. Si el proveedor escribe el modelo diferente al nombre oficial, agregar
 *      correcciones en CORRECCIONES_MODELO
 *
 * Última actualización: Marzo 2026
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface ReglaMarca {
  /** Prefijos exactos como aparecen en el ticket (WINDCEL / otros) */
  prefijosTicket: string[];
  /** Nombre comercial oficial de la marca */
  marcaOficial: string;
  /** Prefijo que se agrega antes del modelo en el nombre completo */
  prefijoModelo?: string;
  /** Notas sobre cómo esta marca nombra sus productos */
  notas?: string;
}

export interface ProductoNormalizado {
  marca: string;         // "Samsung"
  modelo: string;        // "Galaxy A16"
  color: string;         // "Verde"
  ram: string | null;    // "4GB" o null si no se especifica
  almacenamiento: string;// "128GB"
  imei: string;          // "356034164929779" o "" si no tiene
  costo: number;
  nombre: string;        // Display: "Samsung Galaxy A16 Verde 4/128GB"
  esSerializado: boolean;
  tipo: "equipo_nuevo" | "equipo_usado" | "accesorio" | "pieza_reparacion" | "servicio";
}

// ─────────────────────────────────────────────────────────────
// REGLAS POR MARCA
// ─────────────────────────────────────────────────────────────

export const REGLAS_MARCA: ReglaMarca[] = [
  // ── SAMSUNG ───────────────────────────────────────────────
  {
    prefijosTicket: ["SAMSUNG"],
    marcaOficial: "Samsung",
    prefijoModelo: "Galaxy",
    notas: `
      - Serie A: A05, A06, A07, A15, A16, A17, A25, A26, A35, A36, A55, A56
        Algunos modelos llevan "5G" como parte del nombre (A26 5G, A36 5G, A56 5G).
        En WINDCEL aparece como "A26" en la línea principal y "5G" en la línea de color.
      - Serie S: S24, S25 (premium) — poco común en estos tickets
      - Serie M: M14, M15 (canales digitales, raro en WINDCEL)
      - RAM en formato "4/" o "6/" antes del almacenamiento (ej: "4/128GB")
      - El modelo completo oficial SIEMPRE incluye "Galaxy" (Samsung Galaxy A16)
    `,
  },

  // ── MOTOROLA ──────────────────────────────────────────────
  {
    prefijosTicket: ["MOTO"],
    marcaOficial: "Motorola",
    prefijoModelo: "Moto",
    notas: `
      - Serie G (las más comunes en WINDCEL):
          G04, G04s, G04 Power
          G13, G14, G15, G15 Power
          G23, G24, G24 Power
          G34, G35, G45, G54, G54s, G64, G84, G85
          G Power (variante específica)
      - Serie E (entrada): E13, E14, E22, E32
      - Serie Edge (premium): Edge 20, Edge 30, Edge 40, Edge 50
      - En WINDCEL: "MOTO G15 VERDE 256GB" → Motorola Moto G15 Verde 256GB
      - El prefijoModelo "Moto" ya está incluido en WINDCEL (MOTO = marca abreviada)
        por lo que no se duplica, se usa para normalizar capitalización.
    `,
  },

  // ── XIAOMI / REDMI ────────────────────────────────────────
  {
    prefijosTicket: ["REDMI", "XIAOMI"],
    marcaOficial: "Xiaomi",
    prefijoModelo: "Redmi",
    notas: `
      - Redmi es SUB-MARCA de Xiaomi. En WINDCEL siempre aparece como "REDMI".
      - Serie A (entrada): A1, A2, A3, A4, A5
      - Serie número (gama media): 12, 12C, 13, 13C, 14, 14C, 15, 15C
      - Serie Note (gama media alta): Note 12, Note 13, Note 14
        ⚠ En WINDCEL aparece como "REDMI NOTE 13" con NOTE en la misma línea.
      - En WINDCEL: "REDMI 15C NEGRO 256GB" → Xiaomi Redmi 15C Negro 256GB
      - "REDMI A5 NEGRO 128GB" → Xiaomi Redmi A5 Negro 128GB
    `,
  },

  // ── INFINIX ───────────────────────────────────────────────
  {
    prefijosTicket: ["INFINIX"],
    marcaOficial: "Infinix",
    prefijoModelo: undefined,
    notas: `
      - Serie Hot (la más común): Hot 20, Hot 30, Hot 40, Hot 50, Hot 50 Pro, Hot 60, Hot 60i
        ⚠ En WINDCEL "INFINIX HOT" está en la línea principal y el número en la siguiente.
          Ejemplo: línea1="INFINIX HOT" + línea2="50 PRO GRIS" + línea3="256GB"
          → Infinix Hot 50 Pro Gris 256GB
      - Serie Note (media-alta): Note 30, Note 40
      - Serie Zero (premium de la marca): Zero 30, Zero 40
      - Serie Smart (entrada): Smart 7, Smart 8
      - RAM en formato "8/256GB" → ram=8GB, almacenamiento=256GB
    `,
  },

  // ── HONOR ─────────────────────────────────────────────────
  {
    prefijosTicket: ["HONOR"],
    marcaOficial: "Honor",
    prefijoModelo: undefined,
    notas: `
      - Serie X (gama media, las más comunes):
          X6A, X6B, X7A, X7B, X8A, X8B, X8 Plus, X9A, X9B
      - Serie 90: Honor 90, Honor 90 Lite, Honor 90 Smart
      - Serie 200: Honor 200 Lite (nuevo 2024-2025)
      - Serie Magic (premium): Magic 6 Pro, Magic 7
      - En WINDCEL: "HONOR X6A AZUL 128GB" → Honor X6A Azul 128GB
        (sin prefijo de serie, el modelo completo es solo "X6A")
    `,
  },

  // ── TECNO ─────────────────────────────────────────────────
  {
    prefijosTicket: ["TECNO"],
    marcaOficial: "Tecno",
    prefijoModelo: undefined,
    notas: `
      - Serie Spark (la más frecuente en WINDCEL):
          Spark 10, Spark 20, Spark 20 Pro, Spark 30, Spark 40, Spark 40 Pro
      - Serie Camon (cámara): Camon 20, Camon 30
      - Serie Pop (ultra entrada): Pop 7, Pop 8
      - Serie Pova (batería/gaming): Pova 5, Pova 6
      - En WINDCEL: "TECNO SPARK" en línea principal + "40 PRO AZUL" en siguiente
        → Tecno Spark 40 Pro Azul 256GB
    `,
  },

  // ── APPLE ─────────────────────────────────────────────────
  {
    prefijosTicket: ["IPHONE", "APPLE"],
    marcaOficial: "Apple",
    prefijoModelo: "iPhone",
    notas: `
      - En WINDCEL puede aparecer como "IPHONE 15 PRO" o "APPLE IPHONE 15"
      - Series actuales: iPhone 13, 14, 14 Pro, 14 Plus,
                         15, 15 Pro, 15 Plus, 15 Pro Max,
                         16, 16 Pro, 16 Plus, 16 Pro Max
      - Almacenamiento: 128GB, 256GB, 512GB, 1TB
      - No tiene RAM explícita en las especificaciones de venta
      - SIEMPRE tiene IMEI. El IMEI de iPhone tiene la particularidad de
        poder ser verificado en checkcoverage.apple.com
      - Color puede ser: Negro (Black Titanium), Blanco, Natural Titanium,
        Rosa, Amarillo, etc. WINDCEL puede usar inglés o español.
    `,
  },

  // ── HUAWEI ────────────────────────────────────────────────
  {
    prefijosTicket: ["HUAWEI"],
    marcaOficial: "Huawei",
    prefijoModelo: undefined,
    notas: `
      - Serie Y (gama media/entrada en México): Y6p, Y7a, Y8p, Y9a
      - Serie nova: nova 12, nova 12i, nova 12 SE
      - Serie P (premium, ahora escasa por sanciones): P30, P40
      - ⚠ Los equipos Huawei recientes NO tienen Google Play Services.
        Esto es importante para el inventario (puede afectar la venta).
      - En WINDCEL: "HUAWEI NOVA 12I NEGRO 128GB" → Huawei nova 12i Negro 128GB
    `,
  },

  // ── ITEL ──────────────────────────────────────────────────
  {
    prefijosTicket: ["ITEL"],
    marcaOficial: "Itel",
    prefijoModelo: undefined,
    notas: `
      - Marca ultra económica, frecuente en zonas rurales.
      - Serie A: A70, A70s
      - Serie P: P40, P55
      - Serie Vision: Vision 3, Vision 3 Plus
      - En WINDCEL: "ITEL A70 NEGRO 64GB" → Itel A70 Negro 64GB
    `,
  },

  // ── OPPO ──────────────────────────────────────────────────
  {
    prefijosTicket: ["OPPO"],
    marcaOficial: "Oppo",
    prefijoModelo: undefined,
    notas: `
      - Serie A: A3, A3x, A78, A98
      - Serie Reno: Reno 10, Reno 11, Reno 12
      - En WINDCEL: "OPPO A3X NEGRO 128GB" → Oppo A3x Negro 128GB
      - ⚠ Capitalización: el modelo oficial es minúsculas después de la primera letra
        (A3x no A3X, Reno no RENO)
    `,
  },

  // ── VIVO ──────────────────────────────────────────────────
  {
    prefijosTicket: ["VIVO"],
    marcaOficial: "Vivo",
    prefijoModelo: undefined,
    notas: `
      - Serie Y: Y17s, Y27, Y27s, Y36, Y100
      - Serie V: V29, V30, V40 (premium)
      - En WINDCEL: "VIVO Y27S AZUL 128GB" → Vivo Y27s Azul 128GB
    `,
  },
];

// ─────────────────────────────────────────────────────────────
// CORRECCIONES DE MODELO CONOCIDAS
// ─────────────────────────────────────────────────────────────
// Cuando el ticket escribe el modelo diferente al nombre oficial.
// Clave: texto EXACTO del ticket (uppercase, sin color/almacenamiento)
// Valor: modelo normalizado oficial

export const CORRECCIONES_MODELO: Record<string, string> = {
  // Samsung — no necesita "Galaxy" aquí, se agrega via prefijoModelo
  "A26 5G": "A26 5G",
  "A36 5G": "A36 5G",
  "A56 5G": "A56 5G",

  // Cuando "5G" llega en la línea de color (ej: "5G NEGRO" en vez de en el modelo)
  // El parser debe unir "A26" + "5G" → "A26 5G"

  // Motorola — normalizar capitalización
  "G04": "G04",
  "G04S": "G04s",
  "G15": "G15",
  "G24": "G24",

  // Xiaomi Redmi — el ticket puede omitir el guion
  "14C": "14C",
  "15C": "15C",
  "NOTE 12": "Note 12",
  "NOTE 13": "Note 13",
  "NOTE 14": "Note 14",

  // Infinix — el número de modelo viene en la segunda línea
  // El parser debe concatenar "HOT" + "60I" → "Hot 60i"
  // (la función normalizarModelo maneja esto)

  // Honor
  "X6A": "X6A",
  "X7A": "X7A",
  "X8A": "X8A",
  "X9A": "X9A",
  "X6B": "X6B",
  "X7B": "X7B",

  // Tecno — el nombre completo viene en 2 líneas
  // "TECNO SPARK" + "40 PRO AZUL" → Spark 40 Pro
};

// ─────────────────────────────────────────────────────────────
// COLORES CONOCIDOS — lista exhaustiva para detección
// ─────────────────────────────────────────────────────────────

export const COLORES_CONOCIDOS: string[] = [
  // Español
  "NEGRO", "NEGRA", "BLANCO", "BLANCA",
  "AZUL", "AZUL CLARO", "AZUL OSCURO",
  "VERDE", "VERDE CLARO", "VERDE OSCURO", "VERDE OLIVA", "VERDE MENTA",
  "GRIS", "GRIS CLARO", "GRIS OSCURO",
  "PLATA", "PLATEADO",
  "DORADO", "ORO",
  "ROSA", "ROSADO",
  "MORADO", "VIOLETA", "LILA", "LAVANDA",
  "NARANJA",
  "ROJO", "ROJA",
  "AMARILLO", "AMARILLA",
  "CELESTE",
  "CAFÉ", "CAFE",
  "COBRE",
  "CHAMPAGNE",
  "AQUA", "AGUAMARINA",
  "ARENA",
  "TITANIO", "TITANIUM",
  "PURPURA",
  // Inglés (algunos proveedores los usan)
  "BLACK", "WHITE", "BLUE", "GREEN", "GRAY", "GREY",
  "SILVER", "GOLD", "PINK", "PURPLE", "ORANGE", "RED",
  "MIDNIGHT", "STARLIGHT", "ALPINE",
  // Nombres especiales de marcas
  "GRAPHITE", "PHANTOM", "SPACE BLACK", "DEEP BLACK",
  "ICE BLUE", "SKY BLUE", "FOREST GREEN", "SAGE GREEN",
  "CORAL ORANGE", "SUNRISE GOLD",
];

// ─────────────────────────────────────────────────────────────
// FUNCIONES DE NORMALIZACIÓN
// ─────────────────────────────────────────────────────────────

/**
 * Dado un prefijo del ticket, retorna la regla de marca correspondiente.
 * Ejemplo: "SAMSUNG" → ReglaMarca { marcaOficial: "Samsung", prefijoModelo: "Galaxy", ... }
 */
export function buscarReglaMarca(textoPrefijo: string): ReglaMarca | null {
  const textoUpper = textoPrefijo.toUpperCase().trim();
  for (const regla of REGLAS_MARCA) {
    for (const prefijo of regla.prefijosTicket) {
      if (textoUpper.startsWith(prefijo)) {
        return regla;
      }
    }
  }
  return null;
}

/**
 * Normaliza capitalización de un modelo según convenciones de su marca.
 * Ejemplo: "A26 5G" con Samsung → "Galaxy A26 5G"
 * Ejemplo: "G15" con Motorola → "Moto G15"
 * Ejemplo: "HOT 60I" con Infinix → "Hot 60i"
 */
export function normalizarModelo(modeloRaw: string, regla: ReglaMarca): string {
  let modelo = modeloRaw.trim();

  // Aplicar correcciones conocidas primero
  const correccion = CORRECCIONES_MODELO[modelo.toUpperCase()];
  if (correccion) {
    modelo = correccion;
  } else {
    // Normalizar capitalización: primera letra de cada palabra en mayúscula
    // excepto para números y siglas (5G, RAM, etc.)
    modelo = modelo
      .toLowerCase()
      .replace(/\b(\w)/g, (_, c) => c.toUpperCase())
      // Mantener mayúsculas en siglas conocidas
      .replace(/\b5g\b/gi, "5G")
      .replace(/\b4g\b/gi, "4G")
      .replace(/\bnfc\b/gi, "NFC")
      .replace(/\bpro\b/gi, "Pro")
      .replace(/\bplus\b/gi, "Plus")
      .replace(/\bmax\b/gi, "Max")
      .replace(/\blite\b/gi, "Lite")
      .replace(/\bultra\b/gi, "Ultra")
      .replace(/\bpower\b/gi, "Power");
  }

  // Para Infinix: convertir "HOT 60I" a "Hot 60i"
  if (regla.marcaOficial === "Infinix") {
    modelo = modelo
      .replace(/Hot (\d+)I\b/gi, (_, n) => `Hot ${n}i`)
      .replace(/Hot (\d+) Pro/gi, (_, n) => `Hot ${n} Pro`);
  }

  // Agregar prefijo de modelo si corresponde
  if (regla.prefijoModelo && !modelo.startsWith(regla.prefijoModelo)) {
    modelo = `${regla.prefijoModelo} ${modelo}`;
  }

  return modelo;
}

/**
 * Extrae el color de un texto, retornando { color, textoSinColor }
 */
export function extraerColor(texto: string): { color: string; textoSinColor: string } {
  const textoUpper = texto.toUpperCase();

  // Buscar colores compuestos primero (2 palabras)
  for (const color of COLORES_CONOCIDOS.filter((c) => c.includes(" "))) {
    if (textoUpper.includes(color)) {
      const colorNorm = color.charAt(0) + color.slice(1).toLowerCase();
      const textoSinColor = texto
        .replace(new RegExp(color, "gi"), "")
        .replace(/\s+/g, " ")
        .trim();
      return { color: colorNorm, textoSinColor };
    }
  }

  // Buscar colores simples
  for (const color of COLORES_CONOCIDOS.filter((c) => !c.includes(" "))) {
    const regex = new RegExp(`\\b${color}\\b`, "i");
    if (regex.test(texto)) {
      const colorNorm = color.charAt(0) + color.slice(1).toLowerCase();
      const textoSinColor = texto
        .replace(regex, "")
        .replace(/\s+/g, " ")
        .trim();
      return { color: colorNorm, textoSinColor };
    }
  }

  return { color: "", textoSinColor: texto };
}

/**
 * Extrae RAM y almacenamiento de un texto como "4/128GB" o "8/256GB" o solo "256GB"
 * Retorna { ram, almacenamiento, textoSinStorage }
 */
export function extraerStorage(texto: string): {
  ram: string | null;
  almacenamiento: string;
  textoSinStorage: string;
} {
  // Formato "RAM/STORAGE" como "4/128GB", "8/256GB", "6/128G"
  const matchRamStorage = texto.match(/\b(\d+)\/(\d+)\s*G[B]?\b/i);
  if (matchRamStorage) {
    const ram = `${matchRamStorage[1]}GB`;
    const almacenamiento = `${matchRamStorage[2]}GB`;
    const textoSinStorage = texto
      .replace(matchRamStorage[0], "")
      .replace(/\s+/g, " ")
      .trim();
    return { ram, almacenamiento, textoSinStorage };
  }

  // Formato solo almacenamiento: "256GB", "128GB", "64GB", "512GB"
  const matchStorage = texto.match(/\b(\d+)\s*G[B]?\b/i);
  if (matchStorage) {
    const almacenamiento = `${matchStorage[1]}GB`;
    const textoSinStorage = texto
      .replace(matchStorage[0], "")
      .replace(/\s+/g, " ")
      .trim();
    return { ram: null, almacenamiento, textoSinStorage };
  }

  return { ram: null, almacenamiento: "", textoSinStorage: texto };
}

/**
 * Construye el nombre de display completo de un producto.
 * Ejemplo: Samsung + Galaxy A16 + Verde + 4GB/128GB → "Samsung Galaxy A16 Verde 4/128GB"
 */
export function construirNombre(
  marca: string,
  modelo: string,
  color: string,
  ram: string | null,
  almacenamiento: string
): string {
  const partes: string[] = [marca, modelo, color].filter(Boolean);
  if (ram && almacenamiento) {
    partes.push(`${ram.replace("GB", "")}/${almacenamiento}`);
  } else if (almacenamiento) {
    partes.push(almacenamiento);
  }
  return partes.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Tabla de marcas para el selector del formulario de productos.
 * Ordenadas por frecuencia en México.
 */
export const MARCAS_SELECTOR = [
  "Samsung",
  "Motorola",
  "Xiaomi",
  "Infinix",
  "Honor",
  "Tecno",
  "Apple",
  "Huawei",
  "Oppo",
  "Vivo",
  "Itel",
  "Otra",
] as const;

export type MarcaSelector = (typeof MARCAS_SELECTOR)[number];
