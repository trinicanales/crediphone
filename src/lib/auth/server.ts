import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Obtiene el distribuidor_id del usuario autenticado actual.
 * Retorna null si no hay usuario o no tiene distribuidor asignado.
 */
export async function getDistribuidorId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Use admin client to reliably get metadata regardless of RLS
    const adminClient = createAdminClient();
    const { data: userData } = await adminClient
        .from("users")
        .select("distribuidor_id")
        .eq("id", user.id)
        .single();

    return userData?.distribuidor_id || null;
}

/**
 * Obtiene el contexto de autenticación completo: userId, role, distribuidorId
 * y los permisos explícitos del empleado (FASE 56).
 *
 * - super_admin → distribuidorId = null, isSuperAdmin = true (ve todo)
 * - admin/vendedor/etc. → distribuidorId = su tienda, isSuperAdmin = false
 * - no autenticado → userId = null
 *
 * permisosExplicitos: overrides por empleado { [permiso]: activo }
 * La evaluación final se hace con tienePermiso() de @/lib/permisos
 */
export async function getAuthContext(): Promise<{
    userId: string | null;
    role: string | null;
    distribuidorId: string | null;
    isSuperAdmin: boolean;
    permisosExplicitos: Record<string, boolean>;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { userId: null, role: null, distribuidorId: null, isSuperAdmin: false, permisosExplicitos: {} };
    }

    const adminClient = createAdminClient();

    // Fetch role + distribuidor en paralelo con los permisos explícitos
    const [{ data: userData }, { data: permisosRows }] = await Promise.all([
        adminClient
            .from("users")
            .select("role, distribuidor_id, activo")
            .eq("id", user.id)
            .single(),
        adminClient
            .from("permisos_empleado")
            .select("permiso, activo")
            .eq("usuario_id", user.id),
    ]);

    // Empleado desactivado: se trata como sin sesión (antes `activo=false` no bloqueaba nada)
    if (userData?.activo === false) {
        return { userId: null, role: null, distribuidorId: null, isSuperAdmin: false, permisosExplicitos: {} };
    }

    const role = userData?.role || null;
    const distribuidorId = userData?.distribuidor_id || null;
    const isSuperAdmin = role === "super_admin";

    const permisosExplicitos: Record<string, boolean> = {};
    for (const row of permisosRows ?? []) {
        permisosExplicitos[row.permiso as string] = row.activo as boolean;
    }

    return { userId: user.id, role, distribuidorId, isSuperAdmin, permisosExplicitos };
}
