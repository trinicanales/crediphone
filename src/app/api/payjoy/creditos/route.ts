/**
 * GET /api/payjoy/creditos
 * Devuelve los créditos vinculados a Payjoy (payjoy_finance_order_id IS NOT NULL)
 * Acceso: todos los roles autenticados
 */
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("creditos")
      .select(`
        id,
        estado,
        monto_total,
        saldo_pendiente,
        payjoy_finance_order_id,
        payjoy_customer_id,
        payjoy_sync_enabled,
        payjoy_last_sync_at,
        created_at,
        cliente:clientes (
          id,
          nombre,
          telefono
        ),
        producto:productos (
          id,
          nombre,
          marca,
          modelo
        )
      `)
      .not("payjoy_finance_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    // Filtrar por distribuidor excepto super_admin
    if (!isSuperAdmin && distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("[Payjoy] Error al obtener créditos:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener créditos Payjoy" },
      { status: 500 }
    );
  }
}
