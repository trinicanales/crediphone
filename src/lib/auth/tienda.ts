import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verifica que un registro pertenezca a la tienda del usuario.
 * super_admin (distribuidorId = null) puede acceder a cualquiera.
 * Si el registro no existe, devuelve true para que la ruta responda su propio 404.
 */
export async function registroEsDeMiTienda(
  tabla: "ubicaciones_inventario" | "ordenes_compra" | "productos",
  id: string,
  distribuidorId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!distribuidorId) return false;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from(tabla)
    .select("distribuidor_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) return true;
  return data.distribuidor_id === distribuidorId;
}
