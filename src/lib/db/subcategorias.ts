import { createAdminClient } from "@/lib/supabase/admin";

export interface Subcategoria {
  id: string;
  distribuidorId: string;
  categoriaId: string;
  nombre: string;
  descripcion?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function mapSubcategoriaFromDB(db: Record<string, unknown>): Subcategoria {
  return {
    id:             db.id as string,
    distribuidorId: db.distribuidor_id as string,
    categoriaId:    db.categoria_id as string,
    nombre:         db.nombre as string,
    descripcion:    db.descripcion as string | null,
    createdAt:      db.created_at as string,
    updatedAt:      db.updated_at as string,
  };
}

export async function getSubcategorias(
  distribuidorId: string,
  categoriaId?: string
): Promise<Subcategoria[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("subcategorias")
    .select("*")
    .eq("distribuidor_id", distribuidorId)
    .order("nombre", { ascending: true });

  if (categoriaId) {
    query = query.eq("categoria_id", categoriaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapSubcategoriaFromDB);
}

export async function createSubcategoria(
  sub: Omit<Subcategoria, "id" | "createdAt" | "updatedAt">
): Promise<Subcategoria> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subcategorias")
    .insert({
      distribuidor_id: sub.distribuidorId,
      categoria_id:    sub.categoriaId,
      nombre:          sub.nombre,
      descripcion:     sub.descripcion,
    })
    .select()
    .single();

  if (error) throw error;
  return mapSubcategoriaFromDB(data as Record<string, unknown>);
}

export async function updateSubcategoria(
  id: string,
  sub: Partial<Pick<Subcategoria, "nombre" | "descripcion">>,
  distribuidorId?: string
): Promise<Subcategoria> {
  const supabase = createAdminClient();
  let query = supabase
    .from("subcategorias")
    .update({ nombre: sub.nombre, descripcion: sub.descripcion })
    .eq("id", id);

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return mapSubcategoriaFromDB(data as Record<string, unknown>);
}

export async function deleteSubcategoria(
  id: string,
  distribuidorId?: string
): Promise<void> {
  const supabase = createAdminClient();
  let query = supabase.from("subcategorias").delete().eq("id", id);
  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);
  const { error } = await query;
  if (error) throw error;
}
