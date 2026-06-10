import { createAdminClient } from "@/lib/supabase/admin";
import type { Kit, KitItem, NuevoKitFormData } from "@/types";

// ─── Mappers ────────────────────────────────────────────────────────────────────

function mapKitItemFromDB(row: Record<string, unknown>): KitItem {
  return {
    id:         row.id as string,
    kitId:      row.kit_id as string,
    productoId: row.producto_id as string,
    cantidad:   row.cantidad as number,
    producto:   row.productos
      ? {
          id:           (row.productos as Record<string, unknown>).id as string,
          nombre:       (row.productos as Record<string, unknown>).nombre as string,
          marca:        (row.productos as Record<string, unknown>).marca as string,
          modelo:       (row.productos as Record<string, unknown>).modelo as string,
          precio:       (row.productos as Record<string, unknown>).precio as number,
          costo:        (row.productos as Record<string, unknown>).costo as number,
          stock:        (row.productos as Record<string, unknown>).stock as number,
          tipo:         (row.productos as Record<string, unknown>).tipo as "accesorio" | "pieza_reparacion" | "equipo_nuevo" | "equipo_usado" | "servicio" | undefined,
          imagen:       (row.productos as Record<string, unknown>).imagen as string | undefined,
          codigoBarras: (row.productos as Record<string, unknown>).codigo_barras as string | undefined,
          distribuidorId: (row.productos as Record<string, unknown>).distribuidor_id as string,
          activo:       (row.productos as Record<string, unknown>).activo as boolean,
          stockMinimo:  (row.productos as Record<string, unknown>).stock_minimo as number | undefined,
          esSerializado: (row.productos as Record<string, unknown>).es_serializado as boolean | undefined,
          imei:         (row.productos as Record<string, unknown>).imei as string | undefined,
          categoriaId:  (row.productos as Record<string, unknown>).categoria_id as string | undefined,
          createdAt:    new Date((row.productos as Record<string, unknown>).created_at as string),
          updatedAt:    new Date((row.productos as Record<string, unknown>).updated_at as string),
        }
      : undefined,
  };
}

function mapKitFromDB(row: Record<string, unknown>): Kit {
  return {
    id:             row.id as string,
    distribuidorId: row.distribuidor_id as string,
    nombre:         row.nombre as string,
    descripcion:    row.descripcion as string | undefined,
    precio:         Number(row.precio),
    activo:         row.activo as boolean,
    imagen:         row.imagen as string | undefined,
    createdAt:      new Date(row.created_at as string),
    updatedAt:      new Date(row.updated_at as string),
    items:          Array.isArray(row.kits_items)
      ? (row.kits_items as Record<string, unknown>[]).map(mapKitItemFromDB)
      : undefined,
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getKits(distribuidorId: string, soloActivos = false): Promise<Kit[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("kits")
    .select(`
      *,
      kits_items (
        *,
        productos ( id, nombre, marca, modelo, precio, costo, stock, tipo,
                    imagen, codigo_barras, distribuidor_id, activo,
                    stock_minimo, es_serializado, imei, categoria_id,
                    created_at, updated_at )
      )
    `)
    .eq("distribuidor_id", distribuidorId)
    .order("nombre");

  if (soloActivos) q = q.eq("activo", true);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapKitFromDB(r as Record<string, unknown>));
}

export async function getKitById(id: string, distribuidorId?: string): Promise<Kit | null> {
  const supabase = createAdminClient();
  let q = supabase
    .from("kits")
    .select(`
      *,
      kits_items (
        *,
        productos ( id, nombre, marca, modelo, precio, costo, stock, tipo,
                    imagen, codigo_barras, distribuidor_id, activo,
                    stock_minimo, es_serializado, imei, categoria_id,
                    created_at, updated_at )
      )
    `)
    .eq("id", id);
  if (distribuidorId) q = q.eq("distribuidor_id", distribuidorId);
  const { data, error } = await q.single();
  if (error) return null;
  return mapKitFromDB(data as Record<string, unknown>);
}

export async function createKit(
  distribuidorId: string,
  data: NuevoKitFormData
): Promise<Kit> {
  const supabase = createAdminClient();

  // 1. Insertar kit
  const { data: kit, error: kitErr } = await supabase
    .from("kits")
    .insert({
      distribuidor_id: distribuidorId,
      nombre:          data.nombre,
      descripcion:     data.descripcion ?? null,
      precio:          data.precio,
      imagen:          data.imagen ?? null,
      activo:          true,
    })
    .select()
    .single();

  if (kitErr) throw kitErr;

  // 2. Insertar items
  if (data.items.length > 0) {
    const { error: itemsErr } = await supabase.from("kits_items").insert(
      data.items.map((item) => ({
        kit_id:      kit.id,
        producto_id: item.productoId,
        cantidad:    item.cantidad,
      }))
    );
    if (itemsErr) throw itemsErr;
  }

  return (await getKitById(kit.id))!;
}

export async function updateKit(
  id: string,
  data: Partial<NuevoKitFormData> & { activo?: boolean },
  distribuidorId?: string
): Promise<Kit> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.nombre      !== undefined) updates.nombre      = data.nombre;
  if (data.descripcion !== undefined) updates.descripcion = data.descripcion;
  if (data.precio      !== undefined) updates.precio      = data.precio;
  if (data.imagen      !== undefined) updates.imagen      = data.imagen;
  if (data.activo      !== undefined) updates.activo      = data.activo;

  let updateQ = supabase.from("kits").update(updates).eq("id", id);
  if (distribuidorId) updateQ = updateQ.eq("distribuidor_id", distribuidorId);
  const { error: kitErr } = await updateQ;
  if (kitErr) throw kitErr;

  // Reemplazar items si se envían
  if (data.items !== undefined) {
    await supabase.from("kits_items").delete().eq("kit_id", id);
    if (data.items.length > 0) {
      await supabase.from("kits_items").insert(
        data.items.map((item) => ({
          kit_id:      id,
          producto_id: item.productoId,
          cantidad:    item.cantidad,
        }))
      );
    }
  }

  return (await getKitById(id))!;
}

export async function deleteKit(id: string, distribuidorId?: string): Promise<void> {
  const supabase = createAdminClient();
  let q = supabase.from("kits").delete().eq("id", id);
  if (distribuidorId) q = q.eq("distribuidor_id", distribuidorId);
  const { error } = await q;
  if (error) throw error;
}
