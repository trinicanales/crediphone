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
 * Obtiene el contexto de autenticación completo: userId, role y distribuidorId.
 * Útil para API routes que necesitan distinguir super_admin vs admin.
 *
 * - super_admin → distribuidorId = null, isSuperAdmin = true (ve todo)
 * - admin/vendedor/etc. → distribuidorId = su tienda, isSuperAdmin = false
 * - no autenticado → userId = null
 */
export async function getAuthContext(): Promise<{
    userId: string | null;
    role: string | null;
    distribuidorId: string | null;
    isSuperAdmin: boolean;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { userId: null, role: null, distribuidorId: null, isSuperAdmin: false };
    }

    const adminClient = createAdminClient();
    const { data: userData } = await adminClient
        .from("users")
        .select("role, distribuidor_id")
        .eq("id", user.id)
        .single();

    const role = userData?.role || null;
    const distribuidorId = userData?.distribuidor_id || null;
    const isSuperAdmin = role === "super_admin";

    return { userId: user.id, role, distribuidorId, isSuperAdmin };
}
