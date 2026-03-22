import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

/* ─── Tipos internos ──────────────────────────────────────────────────────────── */

interface RowResult {
  fila:    number;
  tipo:    "telefono" | "producto" | "refaccion";
  accion:  "creado" | "actualizado" | "omitido" | "error";
  sku:     string;
  nombre:  string;
  mensaje: string;
}

/* ─── Generador de SKU ──────────────────────────────────────────────────────── */

async function generarSKU(
  supabase: ReturnType<typeof createAdminClient>,
  distribuidorId: string,
  tipo: "telefono" | "producto" | "refaccion",
  marca: string
): Promise<string> {
  const prefijos = { telefono: "CEL", producto: "ACC", refaccion: "REF" };
  const pref    = prefijos[tipo];
  const marcaCode = (marca ?? "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "X");

  // Contar cuántos SKUs con ese prefijo+marca existen para ese distribuidor
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("distribuidor_id", distribuidorId)
    .like("sku", `${pref}-${marcaCode}-%`);

  const num = String((count ?? 0) + 1).padStart(3, "0");
  return `${pref}-${marcaCode}-${num}`;
}

/* ─── Normalizar valor de celda ─────────────────────────────────────────────── */

function str(v: unknown): string { return String(v ?? "").trim(); }
function num(v: unknown): number { return parseFloat(String(v ?? "0").replace(/[^0-9.]/g, "")) || 0; }
function bool(v: unknown): boolean { return !["no", "false", "0", ""].includes(str(v).toLowerCase()); }

/* ─── Obtener/mapear categoría ──────────────────────────────────────────────── */

async function resolverCategoriaId(
  supabase: ReturnType<typeof createAdminClient>,
  distribuidorId: string,
  nombreCategoria: string
): Promise<string | null> {
  if (!nombreCategoria) return null;
  const { data } = await supabase
    .from("categorias")
    .select("id")
    .eq("distribuidor_id", distribuidorId)
    .ilike("nombre", nombreCategoria)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/* ─── Procesar hoja de Teléfonos ─────────────────────────────────────────────── */

async function procesarHojaTelefonos(
  rows: Record<string, string>[],
  distribuidorId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i];
    const fila  = i + 2; // data starts at row 4 in sheet; offset for user clarity

    const marca  = str(row["* Marca"] ?? row["Marca"]);
    const modelo = str(row["* Modelo"] ?? row["Modelo"]);
    const nombre = str(row["* Nombre / Descripción"] ?? row["Nombre / Descripción"]);
    const precioStr = str(row["* Precio Venta ($)"] ?? row["Precio Venta ($)"]);
    const imei   = str(row["* IMEI"] ?? row["IMEI"]).replace(/\s/g, "");

    // Saltar filas vacías o de ejemplo
    if (!marca || !nombre || !modelo) continue;
    const notasInternas = str(row["NOTAS INTERNAS"] ?? "");
    if (notasInternas.toLowerCase().includes("ejemplo")) continue;

    const precio = num(precioStr);
    if (precio <= 0) {
      results.push({ fila, tipo: "telefono", accion: "error", sku: "", nombre, mensaje: "Precio inválido o cero" });
      continue;
    }

    // Buscar por IMEI (si hay) o por SKU/codigo_barras
    const codigoBarras = str(row["Código Barras / SKU"] ?? "");

    // Verificar si ya existe
    let productoExistente: Record<string, unknown> | null = null;
    if (imei) {
      const { data } = await supabase.from("productos").select("id, sku").eq("distribuidor_id", distribuidorId).eq("imei", imei).maybeSingle();
      productoExistente = data as Record<string, unknown> | null;
    }
    if (!productoExistente && codigoBarras) {
      const { data } = await supabase.from("productos").select("id, sku").eq("distribuidor_id", distribuidorId).or(`codigo_barras.eq.${codigoBarras},sku.eq.${codigoBarras}`).maybeSingle();
      productoExistente = data as Record<string, unknown> | null;
    }

    const categoriaId = await resolverCategoriaId(supabase, distribuidorId, str(row["Categoría"] ?? ""));

    if (productoExistente) {
      // Actualizar solo los campos no vacíos
      const updates: Record<string, unknown> = {};
      if (nombre)        updates.nombre = nombre;
      if (marca)         updates.marca  = marca;
      if (modelo)        updates.modelo = modelo;
      if (precio > 0)    updates.precio = precio;
      const costo = num(row["Costo ($)"]);
      if (costo > 0)     updates.costo  = costo;
      if (str(row["Color"]))         updates.color         = str(row["Color"]);
      if (str(row["RAM (GB)"]))      updates.ram           = str(row["RAM (GB)"]);
      if (str(row["Almacenamiento (GB)"])) updates.almacenamiento = str(row["Almacenamiento (GB)"]);
      if (str(row["Folio Remisión"])) updates.folio_remision = str(row["Folio Remisión"]);
      if (imei)          updates.imei   = imei;
      if (categoriaId)   updates.categoria_id = categoriaId;
      if (str(row["Activo (Sí/No)"]))  updates.activo = bool(row["Activo (Sí/No)"]);

      await supabase.from("productos").update(updates).eq("id", (productoExistente as { id: string }).id);
      results.push({ fila, tipo: "telefono", accion: "actualizado", sku: str(productoExistente.sku), nombre, mensaje: "Producto actualizado" });
    } else {
      // Crear nuevo
      if (imei && !/^\d{15,17}$/.test(imei)) {
        results.push({ fila, tipo: "telefono", accion: "error", sku: "", nombre, mensaje: `IMEI inválido: ${imei}` });
        continue;
      }

      const sku = codigoBarras || await generarSKU(supabase, distribuidorId, "telefono", marca);
      const { error } = await supabase.from("productos").insert({
        distribuidor_id:  distribuidorId,
        nombre,
        marca,
        modelo,
        precio,
        costo:            num(row["Costo ($)"]),
        stock:            1,
        stock_minimo:     1,
        tipo:             "equipo_nuevo",
        es_serializado:   true,
        imei:             imei || null,
        color:            str(row["Color"]) || null,
        ram:              str(row["RAM (GB)"]) || null,
        almacenamiento:   str(row["Almacenamiento (GB)"]) || null,
        folio_remision:   str(row["Folio Remisión"]) || null,
        categoria_id:     categoriaId,
        codigo_barras:    codigoBarras || null,
        sku,
        activo:           bool(row["Activo (Sí/No)"] ?? "Sí"),
      });

      if (error) {
        results.push({ fila, tipo: "telefono", accion: "error", sku, nombre, mensaje: error.message });
      } else {
        results.push({ fila, tipo: "telefono", accion: "creado", sku, nombre, mensaje: `SKU generado: ${sku}` });
      }
    }
  }

  return results;
}

/* ─── Procesar hoja de Productos generales ──────────────────────────────────── */

async function procesarHojaProductos(
  rows: Record<string, string>[],
  distribuidorId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const fila = i + 2;

    const marca   = str(row["* Marca"] ?? row["Marca"]);
    const modelo  = str(row["* Modelo"] ?? row["Modelo"]);
    const nombre  = str(row["* Nombre / Descripción"] ?? row["Nombre / Descripción"]);
    const precioStr = str(row["* Precio Venta ($)"] ?? row["Precio Venta ($)"]);
    const stockStr  = str(row["* Stock Inicial"] ?? row["Stock Inicial"]);

    if (!marca || !nombre || !modelo) continue;
    const notasInternas = str(row["NOTAS INTERNAS"] ?? "");
    if (notasInternas.toLowerCase().includes("ejemplo")) continue;

    const precio = num(precioStr);
    const stock  = parseInt(stockStr) || 0;

    if (precio <= 0) {
      results.push({ fila, tipo: "producto", accion: "error", sku: "", nombre, mensaje: "Precio inválido o cero" });
      continue;
    }

    const codigoBarras = str(row["Código Barras / SKU"] ?? "");
    const tipoRaw      = str(row["* Tipo"] ?? "accesorio");
    const tipoValido   = ["accesorio", "equipo_nuevo", "equipo_usado", "pieza_reparacion"].includes(tipoRaw)
      ? tipoRaw : "accesorio";

    // Buscar por SKU o código de barras
    let productoExistente: Record<string, unknown> | null = null;
    if (codigoBarras) {
      const { data } = await supabase.from("productos").select("id, sku").eq("distribuidor_id", distribuidorId).or(`codigo_barras.eq.${codigoBarras},sku.eq.${codigoBarras}`).maybeSingle();
      productoExistente = data as Record<string, unknown> | null;
    }

    const categoriaId = await resolverCategoriaId(supabase, distribuidorId, str(row["Categoría"] ?? ""));

    if (productoExistente) {
      const updates: Record<string, unknown> = {};
      if (nombre)        updates.nombre      = nombre;
      if (marca)         updates.marca       = marca;
      if (modelo)        updates.modelo      = modelo;
      if (precio > 0)    updates.precio      = precio;
      const costo = num(row["Costo ($)"]);
      if (costo > 0)     updates.costo       = costo;
      if (stock > 0)     updates.stock       = stock;
      const stockMin = parseInt(str(row["Stock Mínimo"]));
      if (!isNaN(stockMin)) updates.stock_minimo = stockMin;
      if (str(row["Color"])) updates.color    = str(row["Color"]);
      if (categoriaId)   updates.categoria_id = categoriaId;
      if (tipoValido)    updates.tipo         = tipoValido;
      if (str(row["Activo (Sí/No)"])) updates.activo = bool(row["Activo (Sí/No)"]);

      await supabase.from("productos").update(updates).eq("id", (productoExistente as { id: string }).id);
      results.push({ fila, tipo: "producto", accion: "actualizado", sku: str(productoExistente.sku), nombre, mensaje: "Producto actualizado" });
    } else {
      const sku = codigoBarras || await generarSKU(supabase, distribuidorId, "producto", marca);
      const stockMin = parseInt(str(row["Stock Mínimo"])) || 0;

      const { error } = await supabase.from("productos").insert({
        distribuidor_id: distribuidorId,
        nombre, marca, modelo, precio,
        costo:        num(row["Costo ($)"]),
        stock,
        stock_minimo: stockMin,
        tipo:         tipoValido,
        es_serializado: false,
        color:        str(row["Color"]) || null,
        categoria_id: categoriaId,
        codigo_barras: codigoBarras || null,
        sku,
        activo:       bool(row["Activo (Sí/No)"] ?? "Sí"),
      });

      if (error) {
        results.push({ fila, tipo: "producto", accion: "error", sku, nombre, mensaje: error.message });
      } else {
        results.push({ fila, tipo: "producto", accion: "creado", sku, nombre, mensaje: `SKU generado: ${sku}` });
      }
    }
  }

  return results;
}

/* ─── Procesar hoja de Refacciones ─────────────────────────────────────────── */

async function procesarHojaRefacciones(
  rows: Record<string, string>[],
  distribuidorId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const fila = i + 2;

    const marca   = str(row["* Marca Compatible"] ?? row["Marca Compatible"] ?? row["Marca"]);
    const modelo  = str(row["* Modelo Compatible"] ?? row["Modelo Compatible"] ?? row["Modelo"]);
    const nombre  = str(row["* Nombre / Descripción"] ?? row["Nombre / Descripción"]);
    const precioStr = str(row["* Precio Venta ($)"] ?? row["Precio Venta ($)"]);
    const stockStr  = str(row["* Stock Inicial"] ?? row["Stock Inicial"]);

    if (!marca || !nombre || !modelo) continue;
    const notasInternas = str(row["NOTAS INTERNAS"] ?? "");
    if (notasInternas.toLowerCase().includes("ejemplo")) continue;

    const precio = num(precioStr);
    const stock  = parseInt(stockStr) || 0;

    if (precio <= 0) {
      results.push({ fila, tipo: "refaccion", accion: "error", sku: "", nombre, mensaje: "Precio inválido o cero" });
      continue;
    }

    const codigoBarras = str(row["Código Barras / SKU"] ?? "");

    let productoExistente: Record<string, unknown> | null = null;
    if (codigoBarras) {
      const { data } = await supabase.from("productos").select("id, sku").eq("distribuidor_id", distribuidorId).or(`codigo_barras.eq.${codigoBarras},sku.eq.${codigoBarras}`).maybeSingle();
      productoExistente = data as Record<string, unknown> | null;
    }

    const categoriaId = await resolverCategoriaId(supabase, distribuidorId, str(row["Categoría"] ?? "Refacciones / Piezas"));

    if (productoExistente) {
      const updates: Record<string, unknown> = {};
      if (nombre)     updates.nombre      = nombre;
      if (marca)      updates.marca       = marca;
      if (modelo)     updates.modelo      = modelo;
      if (precio > 0) updates.precio      = precio;
      const costo = num(row["Costo ($)"]);
      if (costo > 0)  updates.costo       = costo;
      if (stock > 0)  updates.stock       = stock;
      const stockMin = parseInt(str(row["Stock Mínimo"]));
      if (!isNaN(stockMin)) updates.stock_minimo = stockMin;
      if (categoriaId) updates.categoria_id = categoriaId;
      if (str(row["Activo (Sí/No)"])) updates.activo = bool(row["Activo (Sí/No)"]);

      await supabase.from("productos").update(updates).eq("id", (productoExistente as { id: string }).id);
      results.push({ fila, tipo: "refaccion", accion: "actualizado", sku: str(productoExistente.sku), nombre, mensaje: "Refacción actualizada" });
    } else {
      const sku = codigoBarras || await generarSKU(supabase, distribuidorId, "refaccion", marca);
      const stockMin = parseInt(str(row["Stock Mínimo"])) || 0;

      const { error } = await supabase.from("productos").insert({
        distribuidor_id: distribuidorId,
        nombre, marca, modelo, precio,
        costo:        num(row["Costo ($)"]),
        stock,
        stock_minimo: stockMin,
        tipo:         "pieza_reparacion",
        es_serializado: false,
        categoria_id: categoriaId,
        codigo_barras: codigoBarras || null,
        sku,
        activo:       bool(row["Activo (Sí/No)"] ?? "Sí"),
      });

      if (error) {
        results.push({ fila, tipo: "refaccion", accion: "error", sku, nombre, mensaje: error.message });
      } else {
        results.push({ fila, tipo: "refaccion", accion: "creado", sku, nombre, mensaje: `SKU generado: ${sku}` });
      }
    }
  }

  return results;
}

/* ─── Route handler ─────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const rolesPermitidos = ["admin", "super_admin"];
    if (!rolesPermitidos.includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    let efectivoDistribuidorId: string | null = distribuidorId ?? null;
    if (isSuperAdmin) {
      const h = request.headers.get("X-Distribuidor-Id");
      if (h) efectivoDistribuidorId = h;
    }
    if (!efectivoDistribuidorId) {
      return NextResponse.json({ success: false, error: "Distribuidor requerido" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("archivo") as File | null;
    if (!file) return NextResponse.json({ success: false, error: "No se recibió archivo" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      return NextResponse.json({ success: false, error: "Solo se aceptan archivos .xlsx o .xls" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    const supabase = createAdminClient();
    const allResults: RowResult[] = [];

    // Detectar pestañas por nombre (busca parecidos)
    for (const sheetName of wb.SheetNames) {
      const sn = sheetName.toLowerCase();
      const ws = wb.Sheets[sheetName];

      // Convertir a JSON desde fila 3 (headers en fila 3, datos desde fila 4)
      const rows = XLSX.utils.sheet_to_json(ws, {
        defval: "",
        raw: false,
        range: 2, // fila 3 es index 2
      }) as Record<string, string>[];

      if (sn.includes("telef") || sn.includes("📱")) {
        const r = await procesarHojaTelefonos(rows, efectivoDistribuidorId!, supabase);
        allResults.push(...r);
      } else if (sn.includes("refacc") || sn.includes("🔧")) {
        const r = await procesarHojaRefacciones(rows, efectivoDistribuidorId!, supabase);
        allResults.push(...r);
      } else if (sn.includes("producto") || sn.includes("📦")) {
        const r = await procesarHojaProductos(rows, efectivoDistribuidorId!, supabase);
        allResults.push(...r);
      }
      // "instrucciones" se ignora
    }

    const creados      = allResults.filter((r) => r.accion === "creado").length;
    const actualizados = allResults.filter((r) => r.accion === "actualizado").length;
    const errores      = allResults.filter((r) => r.accion === "error").length;

    return NextResponse.json({
      success: true,
      data: {
        resumen: { creados, actualizados, errores, total: allResults.length },
        resultados: allResults,
      },
    });
  } catch (e) {
    console.error("Error importando inventario:", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
