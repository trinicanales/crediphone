import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ExcelJS from "exceljs";

/* ─── Constantes de color (sin #) ─────────────────────────────────────────── */
const C_AZUL_OSCURO = "FF09244A";
const C_AZUL_MID    = "FF34556E";
const C_GRIS_CLARO  = "FFEEF2F7";
const C_AMARILLO    = "FFFDE7";  // ejemplos
const C_BORDE       = "FFC2D4E0";
const C_BLANCO      = "FFFFFFFF";

/* ─── Helper: estilo de celda base ─────────────────────────────────────────── */
function applyStyle(
  cell: ExcelJS.Cell,
  opts: { bold?: boolean; bgArgb?: string; align?: ExcelJS.Alignment["horizontal"]; fgArgb?: string }
) {
  cell.font = {
    bold: opts.bold ?? false,
    size: 10,
    name: "Calibri",
    color: { argb: opts.fgArgb ?? (opts.bgArgb === C_AZUL_OSCURO || opts.bgArgb === C_AZUL_MID ? C_BLANCO : "FF000000") },
  };
  if (opts.bgArgb) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: opts.bgArgb },
    };
  }
  cell.alignment = {
    horizontal: opts.align ?? "left",
    vertical: "middle",
    wrapText: true,
  };
  cell.border = {
    top:    { style: "thin", color: { argb: C_BORDE } },
    bottom: { style: "thin", color: { argb: C_BORDE } },
    left:   { style: "thin", color: { argb: C_BORDE } },
    right:  { style: "thin", color: { argb: C_BORDE } },
  };
}

/* ─── Headers por pestaña ────────────────────────────────────────────────── */

interface HeaderDef {
  label: string;
  field: string;
  width: number;
  req:   boolean;
}

const HEADERS_TELEFONOS: HeaderDef[] = [
  { label: "* Marca",               field: "marca",          width: 14, req: true  },
  { label: "* Modelo",              field: "modelo",         width: 16, req: true  },
  { label: "* Nombre / Descripción", field: "nombre",        width: 28, req: true  },
  { label: "* Precio Venta ($)",    field: "precio",         width: 14, req: true  },
  { label: "Costo ($)",             field: "costo",          width: 12, req: false },
  { label: "* IMEI",                field: "imei",           width: 18, req: true  },
  { label: "Color",                 field: "color",          width: 10, req: false },
  { label: "RAM (GB)",              field: "ram",            width: 10, req: false },
  { label: "Almacenamiento (GB)",   field: "almacenamiento", width: 18, req: false },
  { label: "Categoría",             field: "categoria",      width: 18, req: false },
  { label: "Código Barras / SKU",   field: "codigo_barras",  width: 18, req: false },
  { label: "Folio Remisión",        field: "folio_remision", width: 16, req: false },
  { label: "Activo (Sí/No)",        field: "activo",         width: 12, req: false },
  { label: "NOTAS INTERNAS",        field: "_notas",         width: 22, req: false },
];

const HEADERS_PRODUCTOS: HeaderDef[] = [
  { label: "* Marca",               field: "marca",          width: 14, req: true  },
  { label: "* Modelo",              field: "modelo",         width: 16, req: true  },
  { label: "* Nombre / Descripción", field: "nombre",        width: 28, req: true  },
  { label: "* Tipo",                field: "tipo",           width: 16, req: true  },
  { label: "* Precio Venta ($)",    field: "precio",         width: 14, req: true  },
  { label: "Costo ($)",             field: "costo",          width: 12, req: false },
  { label: "* Stock Inicial",       field: "stock",          width: 12, req: true  },
  { label: "Stock Mínimo",          field: "stock_minimo",   width: 12, req: false },
  { label: "Categoría",             field: "categoria",      width: 18, req: false },
  { label: "Código Barras / SKU",   field: "codigo_barras",  width: 18, req: false },
  { label: "Color",                 field: "color",          width: 10, req: false },
  { label: "Activo (Sí/No)",        field: "activo",         width: 12, req: false },
  { label: "NOTAS INTERNAS",        field: "_notas",         width: 22, req: false },
];

const HEADERS_REFACCIONES: HeaderDef[] = [
  { label: "* Marca Compatible",    field: "marca",          width: 16, req: true  },
  { label: "* Modelo Compatible",   field: "modelo",         width: 16, req: true  },
  { label: "* Nombre / Descripción", field: "nombre",        width: 28, req: true  },
  { label: "* Precio Venta ($)",    field: "precio",         width: 14, req: true  },
  { label: "Costo ($)",             field: "costo",          width: 12, req: false },
  { label: "* Stock Inicial",       field: "stock",          width: 12, req: true  },
  { label: "Stock Mínimo",          field: "stock_minimo",   width: 12, req: false },
  { label: "Categoría",             field: "categoria",      width: 18, req: false },
  { label: "Código Barras / SKU",   field: "codigo_barras",  width: 18, req: false },
  { label: "Proveedor",             field: "proveedor",      width: 16, req: false },
  { label: "Activo (Sí/No)",        field: "activo",         width: 12, req: false },
  { label: "NOTAS INTERNAS",        field: "_notas",         width: 22, req: false },
];

/* ─── Crear hoja de instrucciones ───────────────────────────────────────── */

function crearHojaInstrucciones(wb: ExcelJS.Workbook, distribuidorNombre: string) {
  const ws = wb.addWorksheet("📋 INSTRUCCIONES");
  ws.columns = [{ width: 60 }, { width: 15 }, { width: 15 }, { width: 15 }];

  const lines: [string, boolean, string?][] = [
    [`CREDIPHONE — Plantilla de Importación Masiva de Inventario`, true, C_AZUL_OSCURO],
    [`Distribuidor: ${distribuidorNombre}`, false, C_GRIS_CLARO],
    ["", false],
    ["¿CÓMO USAR ESTA PLANTILLA?", true, C_AZUL_MID],
    ["1. Elige la pestaña según el tipo de producto:", false],
    ["   → TELEFONOS  : Equipos con IMEI individual (serializados)", false],
    ["   → PRODUCTOS  : Accesorios, cables, memorias, fundas, etc. con stock por unidad", false],
    ["   → REFACCIONES: Piezas para reparaciones (pantallas, baterías, etc.)", false],
    ["", false],
    ["¿CÓMO LLENA LOS DATOS?", true, C_AZUL_MID],
    ["• Los campos marcados con * son OBLIGATORIOS", false],
    ["• Usa los desplegables para Categoría, Tipo y Activo (Sí/No)", false],
    ["• Para IMEI: un equipo por fila. Si el equipo no tiene IMEI déjalo en blanco.", false],
    ["• Precio y Costo: solo números, sin $ ni comas. Ejemplo: 3500  o  499.50", false],
    ["• Stock: número entero. Para teléfonos con IMEI, el sistema cuenta 1 por fila.", false],
    ["", false],
    ["¿QUÉ PASA AL IMPORTAR?", true, C_AZUL_MID],
    ["• Si 'Código Barras / SKU' está vacío → el sistema genera un código automáticamente", false],
    ["• Si 'Código Barras / SKU' YA existe en el sistema → se ACTUALIZA el producto", false],
    ["  (solo se modifican los campos que llenaste; los vacíos se dejan igual)", false],
    ["• Si el campo 'Activo' está vacío → se asume Sí (activo)", false],
    ["", false],
    ["CÓDIGOS AUTO-GENERADOS", true, C_AZUL_MID],
    ["  Teléfonos:   CEL-[MARCA3]-001, CEL-[MARCA3]-002, ...", false],
    ["  Productos:   ACC-[MARCA3]-001, ...  |  CAB-[MARCA3]-001, ...", false],
    ["  Refacciones: REF-[MARCA3]-001, ...", false],
    ["  Ejemplo: Samsung Galaxy → CEL-SAM-001", false],
    ["", false],
    ["CAMPOS ESPECIALES — TELÉFONOS", true, C_AZUL_MID],
    ["  IMEI:           15-17 dígitos. Cada fila = 1 equipo distinto.", false],
    ["  RAM:            Número en GB. Ejemplo: 8  o  12", false],
    ["  Almacenamiento: Número en GB. Ejemplo: 128  o  256", false],
    ["  Folio Remisión: Número de la remisión o factura del proveedor", false],
    ["", false],
    ["PREGUNTAS FRECUENTES", true, C_AZUL_MID],
    ["Q: ¿Qué pasa si pongo un IMEI que ya existe en el sistema?", false],
    ["A: Se detecta como duplicado y se reporta sin importar (no sobreescribe).", false],
    ["Q: ¿Puedo mezclar tipos en una misma pestaña?", false],
    ["A: No. Usa la pestaña correcta para cada tipo.", false],
  ];

  // Filas 1-2 con merge
  ws.mergeCells("A1:D1");
  ws.mergeCells("A2:D2");

  lines.forEach(([text, bold, bg], idx) => {
    const row = ws.getRow(idx + 1);
    const cell = row.getCell(1);
    cell.value = text;
    applyStyle(cell, { bold, bgArgb: bg });
    // Aplicar mismo fondo a las celdas B-D de las filas fusionadas
    for (let c = 2; c <= 4; c++) {
      const sideCell = row.getCell(c);
      applyStyle(sideCell, { bold: false, bgArgb: bg });
    }
    row.height = text === "" ? 8 : 18;
  });
}

/* ─── Crear hoja de datos ────────────────────────────────────────────────── */

function crearHojaProductos(
  wb: ExcelJS.Workbook,
  sheetName: string,
  headers: HeaderDef[],
  ejemplos: Record<string, string | number>[],
  categorias: string[],
  tiposDropdown?: string[],
  titulo?: string,
) {
  const ws = wb.addWorksheet(sheetName);
  const MAX_ROWS = 300;
  const DATA_START = 4; // fila 1=título, 2=instrucción, 3=headers, 4=datos

  // Columnas
  ws.columns = headers.map((h) => ({ width: h.width }));

  // ── Fila 1: Título ──
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = titulo ?? "Plantilla Crediphone";
  applyStyle(titleCell, { bold: true, bgArgb: C_AZUL_OSCURO, align: "left" });
  ws.getRow(1).height = 22;

  // ── Fila 2: Instrucción ──
  ws.mergeCells(2, 1, 2, headers.length);
  const instrCell = ws.getCell(2, 1);
  instrCell.value = "Los campos con * son obligatorios. Las columnas 'NOTAS INTERNAS' son solo para tu referencia y se ignoran al importar.";
  applyStyle(instrCell, { bold: false, bgArgb: C_GRIS_CLARO, align: "left" });
  ws.getRow(2).height = 18;

  // ── Fila 3: Headers ──
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.label;
    applyStyle(cell, { bold: true, bgArgb: h.req ? C_AZUL_OSCURO : C_AZUL_MID, align: "center" });
  });
  headerRow.height = 18;

  // ── Filas de ejemplo ──
  ejemplos.forEach((row, ri) => {
    const dataRow = ws.getRow(DATA_START + ri);
    headers.forEach((h, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = row[h.field] ?? "";
      applyStyle(cell, { bgArgb: C_AMARILLO });
    });
  });

  // ── Filas vacías ──
  for (let r = DATA_START + ejemplos.length; r < DATA_START + MAX_ROWS; r++) {
    const dataRow = ws.getRow(r);
    headers.forEach((_h, ci) => {
      const cell = dataRow.getCell(ci + 1);
      applyStyle(cell, {});
    });
  }

  // ── Validaciones: Categoría ──
  const catIdx = headers.findIndex((h) => h.field === "categoria") + 1;
  if (catIdx > 0 && categorias.length) {
    const list = `"${categorias.slice(0, 30).join(",")}"`;
    for (let r = DATA_START; r < DATA_START + MAX_ROWS; r++) {
      ws.getCell(r, catIdx).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [list],
        showErrorMessage: true,
        errorTitle: "Error de validación",
        error: "Usa el desplegable de categorías.",
      };
    }
  }

  // ── Validaciones: Tipo ──
  const tipoIdx = headers.findIndex((h) => h.field === "tipo") + 1;
  if (tipoIdx > 0 && tiposDropdown?.length) {
    const list = `"${tiposDropdown.join(",")}"`;
    for (let r = DATA_START; r < DATA_START + MAX_ROWS; r++) {
      ws.getCell(r, tipoIdx).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [list],
        showErrorMessage: true,
        errorTitle: "Error de validación",
        error: "Usa el desplegable de tipos.",
      };
    }
  }

  // ── Validaciones: Activo ──
  const activoIdx = headers.findIndex((h) => h.field === "activo") + 1;
  if (activoIdx > 0) {
    for (let r = DATA_START; r < DATA_START + MAX_ROWS; r++) {
      ws.getCell(r, activoIdx).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Sí,No"'],
        showErrorMessage: true,
        errorTitle: "Error",
        error: "Escribe Sí o No",
      };
    }
  }

  // Filas de altura uniforme
  for (let r = DATA_START; r < DATA_START + MAX_ROWS; r++) {
    ws.getRow(r).height = 16;
  }
}

/* ─── Route handler ─────────────────────────────────────────────────────── */

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
    const wb = new ExcelJS.Workbook();
    wb.creator = "CREDIPHONE ERP";
    wb.created = new Date();

    // Pestaña 1: Instrucciones
    crearHojaInstrucciones(wb, distribuidorNombre);

    // Pestaña 2: Teléfonos
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
    crearHojaProductos(wb, "📱 TELEFONOS", HEADERS_TELEFONOS, ejemplosTel, categoriasDB, undefined,
      `CREDIPHONE [${distribuidorNombre}] — Teléfonos y Equipos Serializados`);

    // Pestaña 3: Productos generales
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
    crearHojaProductos(wb, "📦 PRODUCTOS", HEADERS_PRODUCTOS, ejemplosProd, categoriasDB, tiposProducto,
      `CREDIPHONE [${distribuidorNombre}] — Accesorios y Productos en Stock`);

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
    crearHojaProductos(wb, "🔧 REFACCIONES", HEADERS_REFACCIONES, ejemplosRef, categoriasDB, undefined,
      `CREDIPHONE [${distribuidorNombre}] — Refacciones y Piezas de Reparación`);

    // ── Generar buffer ──
    const rawBuffer = await wb.xlsx.writeBuffer();
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
