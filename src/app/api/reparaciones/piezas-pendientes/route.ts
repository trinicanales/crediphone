import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/reparaciones/piezas-pendientes
 * Lista todos los pedidos de piezas en estado "pendiente" para todas las órdenes activas.
 * Permite al vendedor ver de un vistazo qué piezas hay que pedir al proveedor.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const url = new URL(request.url);
    const soloSinCosto = url.searchParams.get("sinCosto") === "true";
    const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    const supabase = createAdminClient();

    let query = supabase
      .from("pedidos_pieza_reparacion")
      .select(`
        id, nombre_pieza, costo_estimado, costo_envio, estado,
        created_at, notas, financiado_por, monto_de_caja,
        creadoPor:creado_por (name),
        orden:ordenes_reparacion!inner (
          id, folio, estado, marca_dispositivo, modelo_dispositivo,
          distribuidor_id,
          clientes:cliente_id (nombre, apellido, telefono)
        )
      `)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true });

    if (filterDistribuidorId) {
      query = query.eq("distribuidor_id", filterDistribuidorId);
    }

    // Excluir órdenes canceladas/entregadas
    query = query.not("orden.estado", "in", '("entregado","cancelado","no_reparable")');

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const mapped = (data ?? [])
      .filter((p: any) => {
        // Si soloSinCosto=true: solo los que tienen costo_estimado = 0 (auto-generados, sin confirmar)
        if (soloSinCosto) return Number(p.costo_estimado || 0) === 0;
        return true;
      })
      .map((p: any) => {
        const ord = p.orden as any;
        const cli = ord?.clientes as any;
        return {
          id: p.id,
          nombrePieza: p.nombre_pieza,
          costoEstimado: Number(p.costo_estimado || 0),
          costoEnvio: Number(p.costo_envio || 0),
          estado: p.estado,
          createdAt: p.created_at,
          notas: p.notas,
          financiadoPor: p.financiado_por ?? "bolsa",
          montoDeCaja: Number(p.monto_de_caja || 0),
          creadoPorNombre: p.creadoPor?.name ?? null,
          orden: {
            id: ord?.id ?? null,
            folio: ord?.folio ?? null,
            estado: ord?.estado ?? null,
            marcaDispositivo: ord?.marca_dispositivo ?? "",
            modeloDispositivo: ord?.modelo_dispositivo ?? "",
            clienteNombre: cli ? `${cli.nombre ?? ""} ${cli.apellido ?? ""}`.trim() : "—",
            clienteTelefono: cli?.telefono ?? null,
          },
        };
      });

    return NextResponse.json({ success: true, data: mapped, total: mapped.length });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
