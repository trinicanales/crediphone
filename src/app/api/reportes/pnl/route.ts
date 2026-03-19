import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/server";

/**
 * GET /api/reportes/pnl?mes=3&anio=2026
 *
 * Estado de Resultados (P&L) básico mensual.
 * Solo accesible para admin y super_admin.
 *
 * Ingresos:
 *   - Pagos de créditos del mes
 *   - Ventas POS del mes (no canceladas)
 *   - Reparaciones cobradas del mes (estado = entregado)
 *
 * Costos / Egresos:
 *   - Costo de mercancía vendida (CMV): ventas_items * producto.costo
 *   - Costos de piezas de reparación del mes
 *   - Órdenes de compra recibidas del mes (inventario repuesto)
 *
 * Utilidad Bruta = Ingresos totales - CMV
 * Utilidad Operativa = Ingresos totales - (CMV + costos reparación + compras)
 */

export async function GET(req: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const mes = parseInt(searchParams.get("mes") ?? String(now.getMonth() + 1), 10); // 1-12
    const anio = parseInt(searchParams.get("anio") ?? String(now.getFullYear()), 10);

    // Rango del mes: primer día 00:00:00 → primer día siguiente mes 00:00:00
    const inicio = new Date(anio, mes - 1, 1).toISOString();
    const fin = new Date(anio, mes, 1).toISOString();

    const supabase = createAdminClient();
    const filterDist = isSuperAdmin ? null : (distribuidorId ?? null);

    // ─── Paralelo: todas las consultas del mes ────────────────────────────────
    const [
      pagosRes,
      ventasRes,
      ventasItemsRes,
      reparacionesRes,
      piezasReparacionRes,
      comprasRes,
    ] = await Promise.all([
      // 1. Pagos de créditos del mes
      (() => {
        let q = supabase
          .from("pagos")
          .select("id, monto")
          .gte("fecha_pago", inicio)
          .lt("fecha_pago", fin);
        if (filterDist) q = q.eq("distribuidor_id", filterDist);
        return q;
      })(),

      // 2. Ventas POS del mes (no canceladas)
      (() => {
        let q = supabase
          .from("ventas")
          .select("id, total, subtotal, descuento")
          .gte("fecha_venta", inicio)
          .lt("fecha_venta", fin)
          .neq("estado", "cancelada");
        if (filterDist) q = q.eq("distribuidor_id", filterDist);
        return q;
      })(),

      // 3. Items de ventas del mes para calcular CMV
      //    Join con productos para obtener precio de costo
      (() => {
        let q = supabase
          .from("ventas_items")
          .select(`
            id,
            cantidad,
            precio_unitario,
            subtotal,
            venta_id,
            producto_id,
            productos!ventas_items_producto_id_fkey(id, costo)
          `)
          .gte("created_at", inicio)
          .lt("created_at", fin);
        return q;
      })(),

      // 4. Reparaciones entregadas en el mes
      (() => {
        let q = supabase
          .from("reparaciones")
          .select("id, costo_reparacion, costo_partes, costo_total, anticipo")
          .gte("fecha_entregado", inicio)
          .lt("fecha_entregado", fin)
          .eq("estado", "entregado");
        if (filterDist) q = q.eq("distribuidor_id", filterDist);
        return q;
      })(),

      // 5. Piezas usadas en reparaciones del mes (costo directo)
      (() => {
        let q = supabase
          .from("reparacion_piezas")
          .select("id, costo_total")
          .gte("created_at", inicio)
          .lt("created_at", fin);
        return q;
      })(),

      // 6. Órdenes de compra recibidas en el mes
      (() => {
        let q = supabase
          .from("ordenes_compra")
          .select("id, total")
          .gte("fecha_recibida", inicio.slice(0, 10))
          .lt("fecha_recibida", fin.slice(0, 10))
          .eq("estado", "recibida");
        if (filterDist) q = q.eq("distribuidor_id", filterDist);
        return q;
      })(),
    ]);

    // ─── Ingresos ─────────────────────────────────────────────────────────────
    const ingresosPagosCredito = (pagosRes.data ?? []).reduce(
      (s, p) => s + Number(p.monto ?? 0), 0
    );
    const ingresosVentasPOS = (ventasRes.data ?? []).reduce(
      (s, v) => s + Number(v.total ?? 0), 0
    );
    const ingresosReparaciones = (reparacionesRes.data ?? []).reduce(
      (s, r) => s + Number(r.costo_total ?? 0), 0
    );
    const totalIngresos = ingresosPagosCredito + ingresosVentasPOS + ingresosReparaciones;

    // ─── Costo de Mercancía Vendida (CMV) ────────────────────────────────────
    // Si el producto tiene campo `costo`, usamos costo * cantidad
    // Si no, usamos 0 (producto sin costo registrado)
    let cmv = 0;
    for (const item of (ventasItemsRes.data ?? [])) {
      const prod = (item as { productos?: { costo?: number } | null }).productos;
      const costoProd = prod?.costo ?? 0;
      if (costoProd > 0) {
        cmv += Number(costoProd) * Number(item.cantidad ?? 1);
      }
    }

    // ─── Costos de reparación (piezas) ───────────────────────────────────────
    const costoPiezasReparacion = (piezasReparacionRes.data ?? []).reduce(
      (s, p) => s + Number(p.costo_total ?? 0), 0
    );

    // ─── Compras de inventario ────────────────────────────────────────────────
    const costoCompras = (comprasRes.data ?? []).reduce(
      (s, c) => s + Number(c.total ?? 0), 0
    );

    const totalCostos = cmv + costoPiezasReparacion + costoCompras;

    // ─── Utilidades ──────────────────────────────────────────────────────────
    const utilidadBruta = totalIngresos - cmv;
    const utilidadOperativa = totalIngresos - totalCostos;
    const margenBruto = totalIngresos > 0
      ? Math.round((utilidadBruta / totalIngresos) * 1000) / 10
      : 0;
    const margenOperativo = totalIngresos > 0
      ? Math.round((utilidadOperativa / totalIngresos) * 1000) / 10
      : 0;

    // ─── Conteos para contexto ───────────────────────────────────────────────
    const cantidadPagos = (pagosRes.data ?? []).length;
    const cantidadVentas = (ventasRes.data ?? []).length;
    const cantidadReparaciones = (reparacionesRes.data ?? []).length;

    return NextResponse.json({
      success: true,
      data: {
        periodo: { mes, anio },
        ingresos: {
          pagosCredito: ingresosPagosCredito,
          ventasPOS: ingresosVentasPOS,
          reparaciones: ingresosReparaciones,
          total: totalIngresos,
        },
        costos: {
          cmv,
          piezasReparacion: costoPiezasReparacion,
          comprasInventario: costoCompras,
          total: totalCostos,
        },
        utilidades: {
          bruta: utilidadBruta,
          operativa: utilidadOperativa,
          margenBruto,
          margenOperativo,
        },
        contexto: {
          cantidadPagos,
          cantidadVentas,
          cantidadReparaciones,
        },
      },
    });
  } catch (error) {
    console.error("Error en GET /api/reportes/pnl:", error);
    return NextResponse.json(
      { success: false, error: "Error al calcular P&L" },
      { status: 500 }
    );
  }
}
