import { createAdminClient } from "@/lib/supabase/admin";
import type { Categoria } from "@/types";

export async function getCategorias(distribuidorId: string): Promise<Categoria[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .eq("distribuidor_id", distribuidorId)
        .order("nombre", { ascending: true });

    if (error) throw error;
    return data as Categoria[];
}

export async function getCategoriaById(id: string, distribuidorId?: string): Promise<Categoria | null> {
    const supabase = createAdminClient();
    let query = supabase
        .from("categorias")
        .select("*")
        .eq("id", id);

    if (distribuidorId) {
        query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await query.single();

    if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
    }
    return data as Categoria;
}

export async function createCategoria(categoria: Omit<Categoria, "id" | "createdAt" | "updatedAt">): Promise<Categoria> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("categorias")
        .insert({
            distribuidor_id: categoria.distribuidorId,
            nombre: categoria.nombre,
            descripcion: categoria.descripcion,
        })
        .select()
        .single();

    if (error) throw error;
    return data as Categoria;
}

export async function updateCategoria(id: string, categoria: Partial<Categoria>, distribuidorId?: string): Promise<Categoria> {
    const supabase = createAdminClient();
    let query = supabase
        .from("categorias")
        .update({
            nombre: categoria.nombre,
            descripcion: categoria.descripcion,
            // distribuidor_id should generally not be updated
        })
        .eq("id", id);

    if (distribuidorId) {
        query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await query
        .select()
        .single();

    if (error) throw error;
    return data as Categoria;
}

export async function deleteCategoria(id: string, distribuidorId?: string): Promise<void> {
    const supabase = createAdminClient();
    let query = supabase
        .from("categorias")
        .delete()
        .eq("id", id);

    if (distribuidorId) {
        query = query.eq("distribuidor_id", distribuidorId);
    }

    const { error } = await query;

    if (error) throw error;
}
