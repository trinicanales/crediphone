import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/pos/bolsa-disputa
 * Retorna movimientos de bolsa virtual con en_disputa=true
 * (piezas defectuosas cuyo monto está congelado hasta resolver la disputa).
 */
export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const supabase = createAdminClient();

    let query = supabase
      .from("movimientos_bolsa_virtual")
      .select(`
        id, monto, concepto, created_at,
        orden_id, pedido_pieza_id,
        ordenes_reparacion!inner(folio, marca_dispositivo, modelo_dispositivo,
          clientes!inner(nombre, apellido)),
        pedidos_pieza_reparacion(nombre_pieza, estado, motivo_defecto, intentos_reemplazo)
      `)
      .eq("en_disputa", true)
      .eq("tipo", "gasto_pieza")
      .order("created_at", { ascending: false });

    if (!isSuperAdmin && distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const mapped = (data || []).map((m: any) => ({
      id: m.id,
      monto: Number(m.monto),
      concepto: m.concepto,
      createdAt: m.created_at,
      ordenId: m.orden_id,
      folio: m.ordenes_reparacion?.folio ?? "",
      dispositivo: [m.ordenes_reparacion?.marca_dispositivo, m.ordenes_reparacion?.modelo_dispositivo].filter(Boolean).join(" "),
      clienteNombre: [m.ordenes_reparacion?.clientes?.nombre, m.ordenes_reparacion?.clientes?.apellido].filter(Boolean).join(" "),
      pieza: {
        nombre: m.pedidos_pieza_reparacion?.nombre_pieza ?? "",
        estado: m.pedidos_pieza_reparacion?.estado ?? "",
        motivoDefecto: m.pedidos_pieza_reparacion?.motivo_defecto ?? null,
        intentosReemplazo: m.pedidos_pieza_reparacion?.intentos_reemplazo ?? 0,
      },
    }));

    const totalDisputa = mapped.reduce((s: number, m: any) => s + m.monto, 0);

    return NextResponse.json({ success: true, data: mapped, totalDisputa });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
