import { createAdminClient } from "@/lib/supabase/admin";
import { type Distribuidor, type FranquiciaConfig, type PagosHabilitados } from "@/types";

const PAGOS_DEFAULT: PagosHabilitados = {
  efectivo: true,
  tarjeta: true,
  transferencia: true,
  deposito: true,
  payjoy: false,
};

/**
 * Obtiene todos los distribuidores (solo admin)
 */
export async function getAllDistribuidores(): Promise<Distribuidor[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("distribuidores")
        .select("*")
        .order("nombre");

    if (error) {
        console.error("Error fetching distribuidores:", error);
        throw new Error(error.message);
    }

    return data.map(mapDistribuidorFromDB);
}

/**
 * Obtiene un distribuidor por ID
 */
export async function getDistribuidorById(id: string): Promise<Distribuidor | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("distribuidores")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        if (error.code === "PGRST116") return null; // Not found
        console.error("Error fetching distribuidor:", error);
        throw new Error(error.message);
    }

    return mapDistribuidorFromDB(data);
}

/**
 * Obtiene un distribuidor por Slug
 */
export async function getDistribuidorBySlug(slug: string): Promise<Distribuidor | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("distribuidores")
        .select("*")
        .eq("slug", slug)
        .single();

    if (error) {
        if (error.code === "PGRST116") return null;
        console.error("Error fetching distribuidor by slug:", error);
        throw new Error(error.message);
    }

    return mapDistribuidorFromDB(data);
}

/**
 * Crea un nuevo distribuidor
 */
export async function createDistribuidor(
    data: Omit<Distribuidor, "id" | "createdAt" | "updatedAt">
): Promise<Distribuidor> {
    const supabase = createAdminClient();

    const insertData = {
        nombre: data.nombre,
        slug: data.slug,
        logo_url: data.logoUrl,
        activo: data.activo,
        configuracion: data.configuracion || {},
    };

    const { data: newDist, error } = await supabase
        .from("distribuidores")
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error("Error creating distribuidor:", error);
        throw new Error(error.message);
    }

    // FASE 21: Crear configuración por defecto para este distribuidor
    await createDefaultConfig(newDist.id, newDist.nombre);

    return mapDistribuidorFromDB(newDist);
}

/**
 * Actualiza un distribuidor existente
 */
export async function updateDistribuidor(
    id: string,
    data: Partial<Distribuidor>
): Promise<Distribuidor> {
    const supabase = createAdminClient();

    const updateData: any = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl;
    if (data.activo !== undefined) updateData.activo = data.activo;
    if (data.configuracion !== undefined) updateData.configuracion = data.configuracion;

    const { data: updatedDist, error } = await supabase
        .from("distribuidores")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating distribuidor:", error);
        throw new Error(error.message);
    }

    return mapDistribuidorFromDB(updatedDist);
}

/**
 * Helper: Crea configuración por defecto para un nuevo distribuidor
 */
async function createDefaultConfig(distribuidorId: string, nombreEmpresa: string) {
    const supabase = createAdminClient();

    const defaultConfig = {
        distribuidor_id: distribuidorId,
        nombre_empresa: nombreEmpresa,
        modulos_habilitados: {
            dashboard: true,
            reparaciones: true,
            pos: true,
            inventario: true,
            creditos: true,
            reportes: true,
            configuracion: true,
        },
        // Valores por defecto
        comision_vendedor_default: 5,
        tasa_mora_diaria: 50,
        dias_gracia: 3,
        dias_garantia_default: 90,
        notificaciones_activas: true,
    };

    const { error } = await supabase.from("configuracion").insert(defaultConfig);

    if (error) {
        console.error("Error creating default config for distribuidor:", error);
        // No lanzamos error para no romper el flujo principal, pero logueamos
    }
}

function mapDistribuidorFromDB(db: any): Distribuidor {
    return {
        id: db.id,
        nombre: db.nombre,
        slug: db.slug,
        logoUrl: db.logo_url,
        activo: db.activo,
        configuracion: db.configuracion,
        franquicia: {
            modoOperacion: db.modo_operacion ?? "red",
            grupoInventario: db.grupo_inventario ?? undefined,
            accesoHabilitado: db.acceso_habilitado ?? true,
            tipoAcceso: db.tipo_acceso ?? "incluido",
            pagosHabilitados: db.pagos_habilitados ?? PAGOS_DEFAULT,
            notasFranquicia: db.notas_franquicia ?? undefined,
        },
        createdAt: new Date(db.created_at),
        updatedAt: new Date(db.updated_at),
    };
}

/**
 * Actualiza la configuración de franquicia de un distribuidor.
 * Separado del updateDistribuidor para mantenerlo como módulo independiente.
 */
export async function updateFranquiciaConfig(
    id: string,
    config: Partial<FranquiciaConfig>
): Promise<Distribuidor> {
    const supabase = createAdminClient();

    const updateData: any = {};
    if (config.modoOperacion !== undefined) updateData.modo_operacion = config.modoOperacion;
    if (config.grupoInventario !== undefined) updateData.grupo_inventario = config.grupoInventario || null;
    if (config.accesoHabilitado !== undefined) updateData.acceso_habilitado = config.accesoHabilitado;
    if (config.tipoAcceso !== undefined) updateData.tipo_acceso = config.tipoAcceso;
    if (config.pagosHabilitados !== undefined) updateData.pagos_habilitados = config.pagosHabilitados;
    if (config.notasFranquicia !== undefined) updateData.notas_franquicia = config.notasFranquicia || null;

    const { data: updated, error } = await supabase
        .from("distribuidores")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating franquicia config:", error);
        throw new Error(error.message);
    }

    return mapDistribuidorFromDB(updated);
}
