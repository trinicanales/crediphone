import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * FASE 67: Sugerencias de reabastecimiento para Órdenes de Compra
 *
 * Retorna productos que necesitan pedirse, priorizando:
 *   1. SIN_STOCK  (stock = 0)
 *   2. STOCK_BAJO (stock <= stock_minimo)
 *   3. CON_VENTAS (tiene ventas en los últimos 60 días aunque stock esté OK)
 *
 * Query params:
 *   proveedorId — filtrar por proveedor (opcional)
 *   dias        — ventana de ventas (default 60)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const url = new URL(req.url);
    const proveedorId = url.searchParams.get("proveedorId") || null;
    const dias = parseInt(url.searchParams.get("dias") || "60");
    const filterDistribuidorId = isSuperAdmin ? null : (distribuidorId ?? null);

    const supabase = createAdminClient();

    // Productos con stock bajo o sin stock
    let queryLow = supabase
      .from("productos")
      .select("id, nombre, marca, modelo, sku, stock, stock_minimo, costo, precio, proveedor_id, imagen, tipo")
      .or("stock.eq.0,and(stock_minimo.not.is.null,stock.lte.stock_minimo)")
      .neq("tipo", "servicio")
      .order("stock", { ascending: true });

    if (filterDistribuidorId) queryLow = queryLow.eq("distribuidor_id", filterDistribuidorId);
    if (proveedorId) queryLow = queryLow.eq("proveedor_id", proveedorId);

    const { data: productosLow } = await queryLow;

    // Ventas por producto en los últimos N días
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const desdeIso = desde.toISOString();

    let queryVentas = supabase
      .from("ventas_items")
      .select("producto_id, cantidad, ventas!inner(created_at, distribuidor_id)")
      .gte("ventas.created_at", desdeIso);

    if (filterDistribuidorId) {
      queryVentas = queryVentas.eq("ventas.distribuidor_id", filterDistribuidorId);
    }

    const { data: ventasItems } = await queryVentas;

    // Agrupar ventas por producto
    const ventasPorProducto: Record<string, { unidades: number; numVentas: number }> = {};
    for (const vi of ventasItems ?? []) {
      if (!vi.producto_id) continue;
      if (!ventasPorProducto[vi.producto_id]) {
        ventasPorProducto[vi.producto_id] = { unidades: 0, numVentas: 0 };
      }
      ventasPorProducto[vi.producto_id].unidades += Number(vi.cantidad);
      ventasPorProducto[vi.producto_id].numVentas += 1;
    }

    // También traer productos con ventas recientes que NO estén ya en la lista de stock bajo
    const idsLow = new Set((productosLow ?? []).map((p) => p.id));
    const idsConVentas = Object.keys(ventasPorProducto).filter((id) => !idsLow.has(id));

    let productosConVentas: typeof productosLow = [];
    if (idsConVentas.length > 0) {
      let queryVentasProd = supabase
        .from("productos")
        .select("id, nombre, marca, modelo, sku, stock, stock_minimo, costo, precio, proveedor_id, imagen, tipo")
        .in("id", idsConVentas.slice(0, 50))
        .neq("tipo", "servicio");

      if (filterDistribuidorId) queryVentasProd = queryVentasProd.eq("distribuidor_id", filterDistribuidorId);
      if (proveedorId) queryVentasProd = queryVentasProd.eq("proveedor_id", proveedorId);

      const { data: pv } = await queryVentasProd;
      productosConVentas = pv ?? [];
    }

    // Combinar y enriquecer con datos de ventas
    const combinar = (prods: typeof productosLow, categoria: "SIN_STOCK" | "STOCK_BAJO" | "CON_VENTAS") =>
      (prods ?? []).map((p) => {
        const ventas = ventasPorProducto[p.id] || { unidades: 0, numVentas: 0 };
        const cat =
          p.stock === 0 ? "SIN_STOCK"
          : p.stock_minimo !== null && p.stock <= p.stock_minimo ? "STOCK_BAJO"
          : "CON_VENTAS";
        return {
          ...p,
          estado: cat || categoria,
          unidadesVendidas60d: ventas.unidades,
          numVentas60d: ventas.numVentas,
          // Cantidad sugerida a pedir: max(stock_minimo*2 - stock, unidadesVendidas60d)
          cantidadSugerida: Math.max(
            (p.stock_minimo ?? 5) * 2 - p.stock,
            ventas.unidades || 1
          ),
        };
      });

    const sinStock   = combinar(
      (productosLow ?? []).filter((p) => p.stock === 0),
      "SIN_STOCK"
    );
    const stockBajo  = combinar(
      (productosLow ?? []).filter((p) => p.stock > 0),
      "STOCK_BAJO"
    );
    const conVentas  = combinar(productosConVentas, "CON_VENTAS")
      .sort((a, b) => b.unidadesVendidas60d - a.unidadesVendidas60d);

    return NextResponse.json({
      success: true,
      data: {
        sinStock,
        stockBajo,
        conVentas,
        totalUrgentes: sinStock.length + stockBajo.length,
        diasVentana: dias,
      },
    });
  } catch (error) {
    console.error("[sugerencias OC]", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
