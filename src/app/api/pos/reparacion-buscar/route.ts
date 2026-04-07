import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrdenReparacionDetallada } from "@/types";

/**
 * GET /api/pos/reparacion-buscar
 *
 * Busca órdenes de reparación por folio, nombre de cliente o teléfono.
 * Solo retorna órdenes en estados activos (no entregado, no cancelado).
 * Filtra por distribuidor del usuario.
 *
 * Query params:
 *  - q: texto de búsqueda (folio, nombre cliente, teléfono)
 */
export async function GET(request: Request) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || !query.trim()) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const supabase = createAdminClient();

    // Estados activos para cobro en POS
    const estadosActivos = [
      "recibido",
      "diagnostico",
      "presupuesto",
      "aprobado",
      "en_reparacion",
      "completado",
      "listo_entrega",
    ];

    // Búsqueda por folio, nombre o teléfono
    const queryLower = query.toLowerCase();

    let q = supabase
      .from("ordenes_reparacion")
      .select(
        `
        id,
        folio,
        estado,
        marca_dispositivo,
        modelo_dispositivo,
        costo_total,
        cargo_cancelacion,
        cliente:clientes(
          id,
          nombre,
          apellido,
          telefono
        )
      `
      )
      .in("estado", estadosActivos);

    // Filtrar por distribuidor
    if (!isSuperAdmin && distribuidorId) {
      q = q.eq("distribuidor_id", distribuidorId);
    }

    const { data, error } = await q;

    if (error) {
      console.error("Error en búsqueda de reparaciones:", error);
      return NextResponse.json(
        { success: false, error: "Error al buscar órdenes" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Filtrar por texto (folio, nombre cliente, teléfono)
    const resultados = data
      .filter((orden: any) => {
        const folio = orden.folio?.toLowerCase() || "";
        const cliente = orden.cliente as { nombre?: string; apellido?: string; telefono?: string } | null;
        const nombreCliente = cliente
          ? `${cliente.nombre || ""} ${cliente.apellido || ""}`.toLowerCase()
          : "";
        const telefonoCliente = cliente?.telefono?.toLowerCase() || "";

        return (
          folio.includes(queryLower) ||
          nombreCliente.includes(queryLower) ||
          telefonoCliente.includes(queryLower)
        );
      })
      .map((orden: any) => {
        const cliente = orden.cliente as { nombre?: string; apellido?: string; telefono?: string } | null;
        return {
          id: orden.id,
          folio: orden.folio,
          estado: orden.estado,
          marcaDispositivo: orden.marca_dispositivo,
          modeloDispositivo: orden.modelo_dispositivo,
          costoTotal: parseFloat(orden.costo_total || 0),
          cargoCancelacion: parseFloat(orden.cargo_cancelacion ?? 100),
          clienteNombre: cliente
            ? `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim()
            : "",
          clienteTelefono: cliente?.telefono || "",
          totalAnticipos: 0, // Se calculará abajo
        };
      });

    // Obtener anticipos para cada orden
    if (resultados.length > 0) {
      const ordenIds = resultados.map((r: any) => r.id);
      const { data: anticipos } = await supabase
        .from("anticipos_reparacion")
        .select("orden_id, monto")
        .in("orden_id", ordenIds)
        .neq("estado", "devuelto"); // incluir pendiente + aplicado, excluir solo devuelto

      if (anticipos && anticipos.length > 0) {
        const anticiposPorOrden: Record<string, number> = {};
        anticipos.forEach((a: any) => {
          anticiposPorOrden[a.orden_id] =
            (anticiposPorOrden[a.orden_id] || 0) + (parseFloat(a.monto || 0));
        });

        resultados.forEach((r: any) => {
          r.totalAnticipos = anticiposPorOrden[r.id] || 0;
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: resultados,
    });
  } catch (error) {
    console.error("Error en GET /api/pos/reparacion-buscar:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
