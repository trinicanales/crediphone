import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductosEnStock } from "@/lib/db/productos";
import { getServiciosActivos } from "@/lib/db/servicios";

/**
 * GET /api/tracking/[token]/promociones
 * Devuelve las promociones activas del distribuidor asociado a esta orden.
 * NO REQUIERE AUTENTICACIÓN — acceso público vía token de tracking.
 *
 * Prioridad:
 * 1. Promociones manuales activas configuradas por el admin
 * 2. Fallback automático: productos del inventario + servicios activos
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { success: false, error: "Token inválido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Validar token → obtener orden_id
    const { data: trackingData, error: trackingError } = await supabase
      .from("tracking_tokens")
      .select("orden_id, expires_at")
      .eq("token", token)
      .single();

    if (trackingError || !trackingData) {
      return NextResponse.json(
        { success: false, error: "Token inválido o expirado" },
        { status: 404 }
      );
    }

    if (trackingData.expires_at && new Date(trackingData.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Link expirado" },
        { status: 410 }
      );
    }

    // 2. Obtener distribuidor_id de la orden
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("distribuidor_id")
      .eq("id", trackingData.orden_id)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    const distribuidorId: string | null = orden.distribuidor_id ?? null;

    // 3. Buscar promociones manuales activas y vigentes del distribuidor
    const hoy = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    let query = supabase
      .from("promociones")
      .select("id, titulo, descripcion, imagen_url, precio_normal, precio_promocion, categoria")
      .eq("activa", true)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("created_at", { ascending: false })
      .limit(6);

    if (distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    const { data: promociones, error: promosError } = await query;

    if (promosError) {
      console.error("[tracking/promociones] Error al cargar promociones:", promosError);
    }

    // 4. Si hay promociones manuales → usarlas
    if ((promociones ?? []).length > 0) {
      const data = (promociones ?? []).map((p) => ({
        id: p.id,
        titulo: p.titulo,
        descripcion: p.descripcion ?? null,
        imagenUrl: p.imagen_url ?? null,
        precioNormal: p.precio_normal ? Number(p.precio_normal) : null,
        precioPromocion: p.precio_promocion ? Number(p.precio_promocion) : null,
        categoria: p.categoria ?? "general",
      }));
      return NextResponse.json({ success: true, data });
    }

    // 5. Fallback: generar desde inventario real del distribuidor
    const [productos, servicios] = await Promise.all([
      distribuidorId ? getProductosEnStock(distribuidorId).catch(() => []) : [],
      distribuidorId ? getServiciosActivos(distribuidorId).catch(() => []) : [],
    ]);

    // Tomar los 3 primeros productos con stock (ordenados por precio desc = más valiosos primero)
    const productosTop = [...productos]
      .sort((a, b) => Number(b.precio) - Number(a.precio))
      .slice(0, 3);

    // Tomar los 3 primeros servicios activos
    const serviciosTop = servicios.slice(0, 3);

    const fallback = [
      ...productosTop.map((p) => ({
        id: `prod-${p.id}`,
        titulo: p.nombre,
        descripcion: (p.descripcion ?? `${p.marca} ${p.modelo}`.trim()) || null,
        imagenUrl: p.imagen ?? null,
        precioNormal: p.precio ? Number(p.precio) : null,
        precioPromocion: null,
        categoria: (p.tipo ?? "").toLowerCase().includes("accesor")
          ? ("accesorios" as const)
          : ("celulares" as const),
      })),
      ...serviciosTop.map((s) => ({
        id: `serv-${s.id}`,
        titulo: s.nombre,
        descripcion: s.descripcion ?? null,
        imagenUrl: null,
        precioNormal: s.precioBase ? Number(s.precioBase) : null,
        precioPromocion: null,
        categoria: "servicios" as const,
      })),
    ];

    return NextResponse.json({ success: true, data: fallback });
  } catch (error) {
    console.error("[tracking/promociones] Error:", error);
    // En caso de error, retornar array vacío (no romper el tracking)
    return NextResponse.json({ success: true, data: [] });
  }
}
