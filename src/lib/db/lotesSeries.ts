import { createAdminClient } from "@/lib/supabase/admin";
import type { LoteSerie, LoteSerieItem, NuevoLoteSerieFormData } from "@/types";

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapItemFromDB(row: Record<string, unknown>): LoteSerieItem {
  return {
    id:         row.id as string,
    loteId:     row.lote_id as string,
    imei:       row.imei as string,
    estado:     row.estado as LoteSerieItem["estado"],
    productoId: row.producto_id as string | undefined,
    notas:      row.notas as string | undefined,
    createdAt:  new Date(row.created_at as string),
  };
}

function mapLoteFromDB(row: Record<string, unknown>): LoteSerie {
  return {
    id:             row.id as string,
    distribuidorId: row.distribuidor_id as string,
    productoId:     row.producto_id as string,
    folio:          row.folio as string,
    referencia:     row.referencia as string | undefined,
    proveedorId:    row.proveedor_id as string | undefined,
    totalEsperado:  row.total_esperado as number,
    totalRecibido:  row.total_recibido as number,
    totalDuplicado: row.total_duplicado as number,
    totalInvalido:  row.total_invalido as number,
    estado:         row.estado as LoteSerie["estado"],
    notas:          row.notas as string | undefined,
    creadoPor:      row.creado_por as string | undefined,
    createdAt:      new Date(row.created_at as string),
    updatedAt:      new Date(row.updated_at as string),
    producto:       row.productos
      ? {
          id:     (row.productos as Record<string, unknown>).id as string,
          nombre: (row.productos as Record<string, unknown>).nombre as string,
          marca:  (row.productos as Record<string, unknown>).marca as string,
          modelo: (row.productos as Record<string, unknown>).modelo as string,
        }
      : undefined,
    proveedor: row.proveedores
      ? {
          id:     (row.proveedores as Record<string, unknown>).id as string,
          nombre: (row.proveedores as Record<string, unknown>).nombre as string,
        }
      : null,
    items: Array.isArray(row.lotes_series_items)
      ? (row.lotes_series_items as Record<string, unknown>[]).map(mapItemFromDB)
      : undefined,
  };
}

// ─── Generar folio ────────────────────────────────────────────────────────────

export async function generarFolioLote(distribuidorId: string): Promise<string> {
  const supabase = createAdminClient();
  const anio = new Date().getFullYear();
  const { count } = await supabase
    .from("lotes_series")
    .select("id", { count: "exact", head: true })
    .eq("distribuidor_id", distribuidorId)
    .gte("created_at", `${anio}-01-01`);
  const num = String((count ?? 0) + 1).padStart(3, "0");
  return `LS-${anio}-${num}`;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getLotesSeries(
  distribuidorId?: string,
  opts?: { limit?: number; offset?: number }
): Promise<LoteSerie[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("lotes_series")
    .select(`
      *,
      productos (id, nombre, marca, modelo),
      proveedores (id, nombre)
    `)
    .order("created_at", { ascending: false });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);
  if (opts?.limit)    query = query.limit(opts.limit);
  if (opts?.offset)   query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapLoteFromDB);
}

export async function getLoteSerieById(id: string): Promise<LoteSerie | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lotes_series")
    .select(`
      *,
      productos (id, nombre, marca, modelo),
      proveedores (id, nombre),
      lotes_series_items (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapLoteFromDB(data as Record<string, unknown>);
}

// ─── Crear lote con procesamiento de IMEIs ────────────────────────────────────

export async function crearLoteSerie(
  distribuidorId: string,
  userId: string,
  data: NuevoLoteSerieFormData
): Promise<LoteSerie> {
  const supabase = createAdminClient();
  const folio = await generarFolioLote(distribuidorId);

  // 1. Detectar IMEIs duplicados dentro del lote actual
  const uniqueMap = new Map<string, number>();
  for (const imei of data.imeis) uniqueMap.set(imei, (uniqueMap.get(imei) ?? 0) + 1);

  // 2. Buscar IMEIs ya existentes en productos de este distribuidor
  const imeisUnicos = [...uniqueMap.keys()];
  const { data: existentes } = await supabase
    .from("productos")
    .select("imei")
    .eq("distribuidor_id", distribuidorId)
    .in("imei", imeisUnicos);

  const imeisEnDB = new Set((existentes ?? []).map((p: Record<string, string>) => p.imei));

  // 3. Clasificar cada IMEI
  const items: { imei: string; estado: "valido" | "duplicado" | "invalido"; notas?: string }[] = [];
  const vistos = new Set<string>();
  let recibidos = 0, duplicados = 0, invalidos = 0;

  for (const imei of data.imeis) {
    const esFormatoValido = /^\d{15,17}$/.test(imei.replace(/\s/g, ""));
    if (!esFormatoValido) {
      items.push({ imei, estado: "invalido", notas: "Formato inválido (debe ser 15-17 dígitos)" });
      invalidos++;
    } else if (vistos.has(imei)) {
      items.push({ imei, estado: "duplicado", notas: "Duplicado en este lote" });
      duplicados++;
    } else if (imeisEnDB.has(imei)) {
      items.push({ imei, estado: "duplicado", notas: "Ya existe en inventario" });
      duplicados++;
    } else {
      items.push({ imei, estado: "valido" });
      recibidos++;
    }
    vistos.add(imei);
  }

  // 4. Crear el lote
  const { data: lote, error: errLote } = await supabase
    .from("lotes_series")
    .insert({
      distribuidor_id:  distribuidorId,
      producto_id:      data.productoId,
      folio,
      referencia:       data.referencia ?? null,
      proveedor_id:     data.proveedorId ?? null,
      total_esperado:   data.totalEsperado,
      total_recibido:   recibidos,
      total_duplicado:  duplicados,
      total_invalido:   invalidos,
      estado:           "borrador",
      notas:            data.notas ?? null,
      creado_por:       userId,
    })
    .select()
    .single();

  if (errLote) throw errLote;
  const loteId = (lote as Record<string, string>).id;

  // 5. Insertar items
  if (items.length > 0) {
    const { error: errItems } = await supabase
      .from("lotes_series_items")
      .insert(items.map((it) => ({
        lote_id:    loteId,
        imei:       it.imei,
        estado:     it.estado,
        producto_id: data.productoId,
        notas:      it.notas ?? null,
      })));
    if (errItems) throw errItems;
  }

  // 6. Actualizar stock del producto con los IMEIs válidos (crear productos serializados)
  const imeisValidos = items.filter((i) => i.estado === "valido").map((i) => i.imei);
  if (imeisValidos.length > 0) {
    // Obtener datos del producto base
    const { data: prodBase } = await supabase
      .from("productos")
      .select("*")
      .eq("id", data.productoId)
      .single();

    if (prodBase) {
      const p = prodBase as Record<string, unknown>;
      // Incrementar stock del producto base
      await supabase
        .from("productos")
        .update({ stock: (p.stock as number) + imeisValidos.length })
        .eq("id", data.productoId);

      // Para productos serializados: crear una entrada por IMEI
      if (p.es_serializado) {
        const nuevosProductos = imeisValidos.map((imei) => ({
          distribuidor_id: distribuidorId,
          nombre:         p.nombre,
          marca:          p.marca,
          modelo:         p.modelo,
          precio:         p.precio,
          costo:          p.costo,
          stock:          1,
          tipo:           p.tipo,
          es_serializado: true,
          imei,
          categoria_id:   p.categoria_id,
          activo:         true,
        }));
        await supabase.from("productos").insert(nuevosProductos);
        // Mantener el producto base con stock=0 (es el "template")
        await supabase
          .from("productos")
          .update({ stock: (p.stock as number) })
          .eq("id", data.productoId);
      }
    }
  }

  const resultado = await getLoteSerieById(loteId);
  return resultado!;
}

export async function procesarLote(id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("lotes_series")
    .update({ estado: "procesado", updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function cancelarLote(id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("lotes_series")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id);
}
