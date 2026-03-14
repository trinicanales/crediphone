/**
 * GET /api/payjoy/creditos
 * Devuelve los créditos vinculados a Payjoy (payjoy_finance_order_id IS NOT NULL)
 * con saldo_pendiente calculado desde pagos.
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

    /* ── 1. Obtener créditos Payjoy ──────────────────── */
    let query = supabase
      .from("creditos")
      .select(`
        id,
        estado,
        monto,
        payjoy_finance_order_id,
        payjoy_customer_id,
        payjoy_sync_enabled,
        payjoy_last_sync_at,
        created_at,
        clientes (
          id,
          nombre,
          apellido,
          telefono
        ),
        productos (
          id,
          nombre,
          marca,
          modelo
        )
      `)
      .not("payjoy_finance_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!isSuperAdmin && distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data: creditos, error } = await query;
    if (error) throw error;

    if (!creditos || creditos.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    /* ── 2. Calcular saldo pendiente desde pagos ─────── */
    const ids = creditos.map((c: any) => c.id);
    const { data: pagosData } = await supabase
      .from("pagos")
      .select("credito_id, monto")
      .in("credito_id", ids);

    const pagosMap: Record<string, number> = {};
    for (const p of pagosData || []) {
      pagosMap[p.credito_id] = (pagosMap[p.credito_id] || 0) + Number(p.monto);
    }

    /* ── 3. Mapear resultado ─────────────────────────── */
    const resultado = creditos.map((c: any) => {
      const monto = Number(c.monto) || 0;
      const totalPagado = pagosMap[c.id] || 0;
      const saldoPendiente = Math.max(0, monto - totalPagado);
      const cliente = Array.isArray(c.clientes) ? c.clientes[0] : c.clientes;
      const producto = Array.isArray(c.productos) ? c.productos[0] : c.productos;

      return {
        id: c.id,
        estado: c.estado,
        monto_total: monto,
        saldo_pendiente: saldoPendiente,
        payjoy_finance_order_id: c.payjoy_finance_order_id,
        payjoy_customer_id: c.payjoy_customer_id,
        payjoy_sync_enabled: c.payjoy_sync_enabled,
        payjoy_last_sync_at: c.payjoy_last_sync_at,
        created_at: c.created_at,
        cliente: cliente
          ? {
              id: cliente.id,
              nombre: `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim(),
              telefono: cliente.telefono,
            }
          : null,
        producto: producto
          ? {
              id: producto.id,
              nombre: producto.nombre,
              marca: producto.marca,
              modelo: producto.modelo,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    console.error("[Payjoy] Error al obtener créditos:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener créditos Payjoy" },
      { status: 500 }
    );
  }
}
