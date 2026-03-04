import { createAdminClient } from "@/lib/supabase/admin";
import type { Proveedor } from "@/types";

export async function getProveedores(distribuidorId: string): Promise<Proveedor[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .eq("distribuidor_id", distribuidorId)
        .order("nombre", { ascending: true });

    if (error) throw error;
    return data as Proveedor[];
}

export async function getProveedorById(id: string, distribuidorId?: string): Promise<Proveedor | null> {
    const supabase = createAdminClient();
    let query = supabase
        .from("proveedores")
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
    return data as Proveedor;
}

export async function createProveedor(proveedor: Omit<Proveedor, "id" | "createdAt" | "updatedAt">): Promise<Proveedor> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("proveedores")
        .insert({
            distribuidor_id: proveedor.distribuidorId,
            nombre: proveedor.nombre,
            contacto: proveedor.contacto,
            telefono: proveedor.telefono,
            email: proveedor.email,
            rfc: proveedor.rfc,
            direccion: proveedor.direccion,
            notas: proveedor.notas,
        })
        .select()
        .single();

    if (error) throw error;
    return data as Proveedor;
}

export async function updateProveedor(id: string, proveedor: Partial<Proveedor>, distribuidorId?: string): Promise<Proveedor> {
    const supabase = createAdminClient();

    // Build update object only with defined fields
    const updates: any = {};
    if (proveedor.nombre !== undefined) updates.nombre = proveedor.nombre;
    if (proveedor.contacto !== undefined) updates.contacto = proveedor.contacto;
    if (proveedor.telefono !== undefined) updates.telefono = proveedor.telefono;
    if (proveedor.email !== undefined) updates.email = proveedor.email;
    if (proveedor.rfc !== undefined) updates.rfc = proveedor.rfc;
    if (proveedor.direccion !== undefined) updates.direccion = proveedor.direccion;
    if (proveedor.notas !== undefined) updates.notas = proveedor.notas;

    let query = supabase
        .from("proveedores")
        .update(updates)
        .eq("id", id);

    if (distribuidorId) {
        query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await query
        .select()
        .single();

    if (error) throw error;
    return data as Proveedor;
}

export async function deleteProveedor(id: string, distribuidorId?: string): Promise<void> {
    const supabase = createAdminClient();
    let query = supabase
        .from("proveedores")
        .delete()
        .eq("id", id);

    if (distribuidorId) {
        query = query.eq("distribuidor_id", distribuidorId);
    }

    const { error } = await query;

    if (error) throw error;
}
