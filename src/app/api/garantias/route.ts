import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";

/**
 * GET /api/garantias
 * Devuelve todas las garantías con info de orden y cliente.
 * Filtradas por distribuidor para admins de franquicia.
 */
export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const supabase = createAdminClient();

    let query = supabase
      .from("garantias_reparacion")
      .select(`
        *,
        ordenes_reparacion (
          folio,
          imei,
          marca_dispositivo,
          modelo_dispositivo,
          distribuidor_id,
          fecha_completado
        ),
        clientes (
          nombre,
          apellido
        )
      `)
      .order("fecha_vencimiento", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("[garantias] Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Filtrar por distribuidor en código (join no permite eq en nested)
    let result = data || [];
    if (!isSuperAdmin && distribuidorId) {
      result = result.filter(
        (g: any) => g.ordenes_reparacion?.distribuidor_id === distribuidorId
      );
    }

    const mapped = result.map((g: any) => ({
      id: g.id,
      ordenId: g.orden_id,
      clienteId: g.cliente_id,
      tipoGarantia: g.tipo_garantia,
      diasGarantia: g.dias_garantia,
      fechaInicio: g.fecha_inicio,
      fechaVencimiento: g.fecha_vencimiento,
      estado: g.estado,
      ordenGarantiaId: g.orden_garantia_id ?? null,
      fechaReclamo: g.fecha_reclamo ?? null,
      motivoReclamo: g.motivo_reclamo ?? null,
      aplicaCosto: g.aplica_costo,
      notas: g.notas ?? null,
      createdAt: g.created_at,
      // Datos de la orden
      folio: g.ordenes_reparacion?.folio ?? "",
      imei: g.ordenes_reparacion?.imei ?? null,
      marcaDispositivo: g.ordenes_reparacion?.marca_dispositivo ?? "",
      modeloDispositivo: g.ordenes_reparacion?.modelo_dispositivo ?? "",
      fechaEntrega: g.ordenes_reparacion?.fecha_completado ?? null,
      // Datos del cliente
      clienteNombre: g.clientes
        ? `${g.clientes.nombre} ${g.clientes.apellido ?? ""}`.trim()
        : "Cliente desconocido",
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    console.error("[garantias] Error:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
