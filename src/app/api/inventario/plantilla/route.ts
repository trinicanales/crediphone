import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function cellStyle(bold = false, fill?: string, align: "left" | "center" | "right" = "left") {
  return {
    font:      { bold, sz: 10, name: "Calibri" },
    fill:      fill ? { fgColor: { rgb: fill }, patternType: "solid" } : undefined,
    alignment: { horizontal: align, vertical: "center", wrapText: true },
    border: {
      top:    { style: "thin", color: { rgb: "C2D4E0" } },
      bottom: { style: "thin", color: { rgb: "C2D4E0" } },
      left:   { style: "thin", color: { rgb: "C2D4E0" } },
      right:  { style: "thin", color: { rgb: "C2D4E0" } },
    },
  };
}

function setColWidths(ws: Record<string, unknown>, widths: number[]) {
  (ws as { "!cols": { wch: number }[] })["!cols"] = widths.map((w) => ({ wch: w }));
}

function addDropdown(
  ws: Record<string, unknown>,
  col: string,
  fromRow: number,
  toRow: number,
  values: string[]
) {
  if (!values.length) return;
  const list = `"${values.join(",")}"`;
  for (let r = fromRow; r <= toRow; r++) {
    const cellRef = `${col}${r}`;
    if (!(ws as Record<string, unknown>)[cellRef]) {
      (ws as Record<string, unknown>)[cellRef] = { t: "s", v: "" };
    }
    const cell = (ws as Record<string, { s?: unknown; t: string; v: unknown }>)[cellRef];
    cell.s = cellStyle();
  }
  if (!(ws as { "!dataValidations"?: unknown[] })["!dataValidations"]) {
    (ws as { "!dataValidations": unknown[] })["!dataValidations"] = [];
  }
  (ws as { "!dataValidations": unknown[] })["!dataValidations"].push({
    sqref: `${col}${fromRow}:${col}${toRow}`,
    type: "list",
    formula1: list,
    showDropDown: false,
    showErrorMessage: true,
    error: "Valor no válido. Usa la lista desplegable.",
    errorTitle: "Error de validación",
  });
}

/* ─── Headers por pestaña ───────────────────────────────────────────────────── */

// Headers visibles + campo BD + tipo
const HEADERS_TELEFONOS = [
  { label: "* Marca",              field: "marca",          width: 14, req: true  },
  { label: "* Modelo",             field: "modelo",         width: 16, req: true  },
  { label: "* Nombre / Descripción",field: "nombre",        width: 28, req: true  },
  { label: "* Precio Venta ($)",   field: "precio",         width: 14, req: true  },
  { label: "Costo ($)",            field: "costo",          width: 12, req: false },
  { label: "* IMEI",               field: "imei",           width: 18, req: true  },
  { label: "Color",                field: "color",          width: 10, req: false },
  { label: "RAM (GB)",             field: "ram",            width: 10, req: false },
  { label: "Almacenamiento (GB)",  field: "almacenamiento", width: 18, req: false },
  { label: "Categoría",            field: "categoria",      width: 18, req: false },
  { label: "Código Barras / SKU",  field: "codigo_barras",  width: 18, req: false },
  { label: "Folio Remisión",       field: "folio_remision", width: 16, req: false },
  { label: "Activo (Sí/No)",       field: "activo",         width: 12, req: false },
  { label: "NOTAS INTERNAS",       field: "_notas",         width: 22, req: false },
];

const HEADERS_PRODUCTOS = [
  { label: "* Marca",              field: "marca",          width: 14, req: true  },
  { label: "* Modelo",             field: "modelo",         width: 16, req: true  },
  { label: "* Nombre / Descripción",field: "nombre",        width: 28, req: true  },
  { label: "* Tipo",               field: "tipo",           width: 16, req: true  },
  { label: "* Precio Venta ($)",   field: "precio",         width: 14, req: true  },
  { label: "Costo ($)",            field: "costo",          width: 12, req: false },
  { label: "* Stock Inicial",      field: "stock",          width: 12, req: true  },
  { label: "Stock Mínimo",         field: "stock_minimo",   width: 12, req: false },
  { label: "Categoría",            field: "categoria",      width: 18, req: false },
  { label: "Código Barras / SKU",  field: "codigo_barras",  width: 18, req: false },
  { label: "Color",                field: "color",          width: 10, req: false },
  { label: "Activo (Sí/No)",       field: "activo",         width: 12, req: false },
  { label: "NOTAS INTERNAS",       field: "_notas",         width: 22, req: false },
];

const HEADERS_REFACCIONES = [
  { label: "* Marca Compatible",   field: "marca",          width: 16, req: true  },
  { label: "* Modelo Compatible",  field: "modelo",         width: 16, req: true  },
  { label: "* Nombre / Descripción",field: "nombre",        width: 28, req: true  },
  { label: "* Precio Venta ($)",   field: "precio",         width: 14, req: true  },
  { label: "Costo ($)",            field: "costo",          width: 12, req: false },
  { label: "* Stock Inicial",      field: "stock",          width: 12, req: true  },
  { label: "Stock Mínimo",         field: "stock_minimo",   width: 12, req: false },
  { label: "Categoría",            field: "categoria",      width: 18, req: false },
  { label: "Código Barras / SKU",  field: "codigo_barras",  width: 18, req: false },
  { label: "Proveedor",            field: "proveedor",      width: 16, req: false },
  { label: "Activo (Sí/No)",       field: "activo",         width: 12, req: false },
  { label: "NOTAS INTERNAS",       field: "_notas",         width: 22, req: false },
];

/* ─── Crear pestaña de datos ────────────────────────────────────────────────── */

function crearHojaProductos(
  headers: typeof HEADERS_TELEFONOS,
  ejemplos: Record<string, string | number>[],
  categorias: string[],
  tiposDropdown?: string[],
  titulo?: string,
) {
  const ws: Record<string, unknown> = {};
  const HEADER_ROW = 3;
  const DATA_START = HEADER_ROW + 1;
  const MAX_ROWS   = 300;

  // ── Título de la hoja ──
  ws["A1"] = { t: "s", v: titulo ?? "Plantilla Crediphone", s: cellStyle(true, "09244A", "left") };
  (ws as { "!merges"?: unknown[] })["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ];
  ws["A2"] = { t: "s", v: "Los campos con * son obligatorios. Las columnas 'NOTAS INTERNAS' son solo para tu referencia y se ignoran al importar.", s: cellStyle(false, "EEF2F7") };

  // ── Headers ──
  headers.forEach((h, i) => {
    const col = XLSX.utils.encode_col(i);
    const cellRef = `${col}${HEADER_ROW}`;
    ws[cellRef] = {
      t: "s",
      v: h.label,
      s: cellStyle(true, h.req ? "09244A" : "34556E", "center"),
    };
    // Ajustar color del texto a blanco
  });

  // ── Ejemplos ──
  ejemplos.forEach((row, ri) => {
    headers.forEach((h, ci) => {
      const col = XLSX.utils.encode_col(ci);
      const cellRef = `${col}${DATA_START + ri}`;
      const val = row[h.field] ?? "";
      ws[cellRef] = {
        t: typeof val === "number" ? "n" : "s",
        v: val,
        s: cellStyle(false, "FFFDE7"),
      };
    });
  });

  // ── Filas vacías para datos ──
  const emptyStart = DATA_START + ejemplos.length;
  for (let r = emptyStart; r < emptyStart + (MAX_ROWS - ejemplos.length); r++) {
    headers.forEach((_h, ci) => {
      const col = XLSX.utils.encode_col(ci);
      ws[`${col}${r}`] = { t: "s", v: "", s: cellStyle() };
    });
  }

  // ── Dropdowns ──
  const catIdx = headers.findIndex((h) => h.field === "categoria");
  if (catIdx >= 0 && categorias.length) {
    addDropdown(ws, XLSX.utils.encode_col(catIdx), DATA_START, DATA_START + MAX_ROWS - 1, categorias);
  }

  const tipoIdx = headers.findIndex((h) => h.field === "tipo");
  if (tipoIdx >= 0 && tiposDropdown?.length) {
    addDropdown(ws, XLSX.utils.encode_col(tipoIdx), DATA_START, DATA_START + MAX_ROWS - 1, tiposDropdown);
  }

  const activoIdx = headers.findIndex((h) => h.field === "activo");
  if (activoIdx >= 0) {
    addDropdown(ws, XLSX.utils.encode_col(activoIdx), DATA_START, DATA_START + MAX_ROWS - 1, ["Sí", "No"]);
  }

  // ── Range ──
  const lastCol = XLSX.utils.encode_col(headers.length - 1);
  (ws as { "!ref"?: string })["!ref"] = `A1:${lastCol}${DATA_START + MAX_ROWS}`;

  setColWidths(ws, headers.map((h) => h.width));
  return ws;
}

/* ─── Hoja de instrucciones ─────────────────────────────────────────────────── */

function crearHojaInstrucciones(distribuidorNombre: string) {
  const ws: Record<string, unknown> = {};
  const lines: [string, string, boolean, string?][] = [
    ["CREDIPHONE — Plantilla de Importación Masiva de Inventario", "", true, "09244A"],
    [`Distribuidor: ${distribuidorNombre}`, "", false, "EEF2F7"],
    ["", "", false],
    ["¿CÓMO USAR ESTA PLANTILLA?", "", true, "34556E"],
    ["1. Elige la pestaña según el tipo de producto:", "", false],
    ["   → TELEFONOS  : Equipos con IMEI individual (serializados)", "", false],
    ["   → PRODUCTOS  : Accesorios, cables, memorias, fundas, etc. con stock por unidad", "", false],
    ["   → REFACCIONES: Piezas para reparaciones (pantallas, baterías, etc.)", "", false],
    ["", "", false],
    ["¿CÓMO LLENA LOS DATOS?", "", true, "34556E"],
    ["• Los campos marcados con * son OBLIGATORIOS", "", false],
    ["• Usa los desplegables para Categoría, Tipo y Activo (Sí/No)", "", false],
    ["• Para IMEI: un equipo por fila. Si el equipo no tiene IMEI déjalo en blanco.", "", false],
    ["• Precio y Costo: solo números, sin $ ni comas. Ejemplo: 3500  o  499.50", "", false],
    ["• Stock: número entero. Para teléfonos con IMEI, el sistema cuenta 1 por fila.", "", false],
    ["", "", false],
    ["¿QUÉ PASA AL IMPORTAR?", "", true, "34556E"],
    ["• Si 'Código Barras / SKU' está vacío → el sistema genera un código automáticamente", "", false],
    ["• Si 'Código Barras / SKU' YA existe en el sistema → se ACTUALIZA el producto", "", false],
    ["  (solo se modifican los campos que llenaste; los vacíos se dejan igual)", "", false],
    ["• Si el campo 'Activo' está vacío → se asume Sí (activo)", "", false],
    ["", "", false],
    ["CÓDIGOS AUTO-GENERADOS", "", true, "34556E"],
    ["  Teléfonos:   CEL-[MARCA3]-001, CEL-[MARCA3]-002, ...", "", false],
    ["  Productos:   ACC-[MARCA3]-001, ...  |  CAB-[MARCA3]-001, ...", "", false],
    ["  Refacciones: REF-[MARCA3]-001, ...", "", false],
    ["  Ejemplo: Samsung Galaxy → CEL-SAM-001", "", false],
    ["", "", false],
    ["CAMPOS ESPECIALES — TELÉFONOS", "", true, "34556E"],
    ["  IMEI:          15-17 dígitos. Cada fila = 1 equipo distinto.", "", false],
    ["  RAM:           Número en GB. Ejemplo: 8  o  12", "", false],
    ["  Almacenamiento:Número en GB. Ejemplo: 128  o  256", "", false],
    ["  Folio Remisión:Número de la remisión o factura del proveedor", "", false],
    ["", "", false],
    ["PREGUNTAS FRECUENTES", "", true, "34556E"],
    ["Q: ¿Qué pasa si pongo un IMEI que ya existe en el sistema?", "", false],
    ["A: Se detecta como duplicado y se reporta sin importar (no sobreescribe).", "", false],
    ["", "", false],
    ["Q: ¿Puedo mezclar tipos en una misma pestaña?", "", false],
    ["A: No. Usa la pestaña correcta para cada tipo.", "", false],
    ["", "", false],
    ["Q: ¿Puedo agregar fotos desde aquí?", "", false],
    ["A: No, las fotos se agregan después desde el catálogo de productos.", "", false],
  ];

  let row = 1;
  (ws as { "!merges": unknown[] })["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];

  for (const [text, , bold, bg] of lines) {
    const style = cellStyle(bold, bg);
    ws[`A${row}`] = { t: "s", v: text, s: style };
    ws[`B${row}`] = { t: "s", v: "", s: style };
    ws[`C${row}`] = { t: "s", v: "", s: style };
    ws[`D${row}`] = { t: "s", v: "", s: style };
    row++;
  }

  (ws as { "!ref"?: string })["!ref"] = `A1:D${row}`;
  setColWidths(ws, [60, 15, 15, 15]);
  return ws;
}

/* ─── Route handler ─────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return new NextResponse("No autenticado", { status: 401 });

    let efectivoDistribuidorId: string | null = distribuidorId ?? null;
    if (isSuperAdmin) {
      const h = request.headers.get("X-Distribuidor-Id");
      if (h) efectivoDistribuidorId = h;
    }

    const rolesPermitidos = ["admin", "super_admin"];
    if (!rolesPermitidos.includes(role ?? "")) {
      return new NextResponse("Sin permiso", { status: 403 });
    }

    const supabase = createAdminClient();

    // Cargar categorías del distribuidor
    let categoriasDB: string[] = [];
    if (efectivoDistribuidorId) {
      const { data } = await supabase
        .from("categorias")
        .select("nombre")
        .eq("distribuidor_id", efectivoDistribuidorId)
        .order("nombre");
      categoriasDB = (data ?? []).map((c: { nombre: string }) => c.nombre);
    }
    if (!categoriasDB.length) {
      categoriasDB = ["Celulares", "Accesorios", "Cargadores", "Fundas", "Micas / Protectores",
                       "Audio / Bocinas", "Memorias", "Refacciones / Piezas", "Para tu Auto"];
    }

    // Nombre del distribuidor
    let distribuidorNombre = "Tu Tienda";
    if (efectivoDistribuidorId) {
      const { data } = await supabase
        .from("distribuidores")
        .select("nombre")
        .eq("id", efectivoDistribuidorId)
        .single();
      if (data) distribuidorNombre = (data as { nombre: string }).nombre;
    }

    const tiposProducto = ["accesorio", "equipo_nuevo", "equipo_usado", "pieza_reparacion"];

    // ── Crear libro ──
    const wb = XLSX.utils.book_new();

    // Pestaña 1: Instrucciones
    XLSX.utils.book_append_sheet(wb, crearHojaInstrucciones(distribuidorNombre), "📋 INSTRUCCIONES");

    // Pestaña 2: Teléfonos (serializados con IMEI)
    const ejemplosTel = [
      { marca: "Samsung", modelo: "Galaxy A55", nombre: "Samsung Galaxy A55 5G Negro 8/128",
        precio: 7499, costo: 5200, imei: "358240051234567", color: "Negro",
        ram: 8, almacenamiento: 128, categoria: "Celulares", codigo_barras: "",
        folio_remision: "FAC-2024-001", activo: "Sí", _notas: "EJEMPLO — borra esta fila" },
      { marca: "Xiaomi", modelo: "Redmi Note 13", nombre: "Xiaomi Redmi Note 13 Pro Azul",
        precio: 5299, costo: 3800, imei: "358240059876543", color: "Azul",
        ram: 8, almacenamiento: 256, categoria: "Celulares", codigo_barras: "",
        folio_remision: "FAC-2024-001", activo: "Sí", _notas: "EJEMPLO — borra esta fila" },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      crearHojaProductos(HEADERS_TELEFONOS, ejemplosTel, categoriasDB, undefined, `CREDIPHONE [${distribuidorNombre}] — Teléfonos y Equipos Serializados`),
      "📱 TELEFONOS"
    );

    // Pestaña 3: Productos generales (accesorios, cables, etc.)
    const ejemplosProd = [
      { marca: "Belkin", modelo: "Universal", nombre: "Cargador USB-C 20W Rápido",
        tipo: "accesorio", precio: 349, costo: 180, stock: 15, stock_minimo: 3,
        categoria: "Cargadores", codigo_barras: "7501234567890",
        color: "Blanco", activo: "Sí", _notas: "EJEMPLO — borra esta fila" },
      { marca: "Genérico", modelo: "iPhone 15", nombre: "Funda transparente iPhone 15",
        tipo: "accesorio", precio: 129, costo: 45, stock: 30, stock_minimo: 5,
        categoria: "Fundas", codigo_barras: "",
        color: "Transparente", activo: "Sí", _notas: "EJEMPLO — borra esta fila" },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      crearHojaProductos(HEADERS_PRODUCTOS, ejemplosProd, categoriasDB, tiposProducto, `CREDIPHONE [${distribuidorNombre}] — Accesorios y Productos en Stock`),
      "📦 PRODUCTOS"
    );

    // Pestaña 4: Refacciones
    const ejemplosRef = [
      { marca: "Samsung", modelo: "Galaxy A54", nombre: "Pantalla OLED Samsung A54 Original",
        precio: 1250, costo: 780, stock: 5, stock_minimo: 1,
        categoria: "Refacciones / Piezas", codigo_barras: "",
        proveedor: "", activo: "Sí", _notas: "EJEMPLO — borra esta fila" },
      { marca: "iPhone", modelo: "15 Pro", nombre: "Batería iPhone 15 Pro 3274mAh",
        precio: 890, costo: 520, stock: 8, stock_minimo: 2,
        categoria: "Refacciones / Piezas", codigo_barras: "",
        proveedor: "", activo: "Sí", _notas: "EJEMPLO — borra esta fila" },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      crearHojaProductos(HEADERS_REFACCIONES, ejemplosRef, categoriasDB, undefined, `CREDIPHONE [${distribuidorNombre}] — Refacciones y Piezas de Reparación`),
      "🔧 REFACCIONES"
    );

    // ── Generar buffer ──
    const rawBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const body = Buffer.from(rawBuffer) as unknown as BodyInit;

    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="crediphone-plantilla-inventario-${fecha}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Error generando plantilla:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
