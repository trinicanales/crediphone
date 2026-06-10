/**
 * GET /api/clientes/[id]/resumen-pos
 * Devuelve un resumen rápido del cliente para mostrar en el POS:
 *   - créditos activos (count + deuda total)
 *   - última compra (fecha + monto)
 *   - scoring
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { id: clienteId } = await params;
    const supabase = createAdminClient();

    // Verificar que el cliente pertenece al distribuidor del usuario
    const { data: cliente, error: errCliente } = await supabase
      .from("clientes")
      .select("id, nombre, apellido, distribuidor_id")
      .eq("id", clienteId)
      .maybeSingle();

    if (errCliente || !cliente) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    if (!isSuperAdmin && distribuidorId && cliente.distribuidor_id !== distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });
    }

    // Créditos activos (filtrados por franquicia para evitar mezcla cross-tenant)
    let creditosQuery = supabase
      .from("creditos")
      .select("id, monto_credito, saldo_pendiente, estado, created_at")
      .eq("cliente_id", clienteId)
      .in("estado", ["activo", "vencido"]);
    if (!isSuperAdmin && distribuidorId) {
      creditosQuery = creditosQuery.eq("distribuidor_id", distribuidorId);
    }
    const { data: creditos } = await creditosQuery;

    const creditosActivos = (creditos ?? []).length;
    const deudaTotal = (creditos ?? []).reduce(
      (sum: number, c: Record<string, unknown>) => sum + ((c.saldo_pendiente as number) || 0),
      0
    );

    // Última venta en POS (filtrada por franquicia)
    let ventasQuery = supabase
      .from("ventas")
      .select("id, total, created_at, folio")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!isSuperAdmin && distribuidorId) {
      ventasQuery = ventasQuery.eq("distribuidor_id", distribuidorId);
    }
    const { data: ultimasVentas } = await ventasQuery;

    const ultimaVenta = ultimasVentas?.[0] ?? null;

    // Scoring
    const { data: scoring } = await supabase
      .from("scoring_clientes")
      .select("score, categoria")
      .eq("cliente_id", clienteId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        creditosActivos,
        deudaTotal,
        ultimaVentaFecha: ultimaVenta?.created_at ?? null,
        ultimaVentaMonto: ultimaVenta?.total ?? null,
        ultimaVentaFolio: ultimaVenta?.folio ?? null,
        score: scoring?.score ?? null,
        scoreCategoria: scoring?.categoria ?? null,
      },
    });
  } catch (error) {
    console.error("Error en resumen-pos:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
