import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? ""))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo") ?? "mes"; // semana | mes | trimestre | anio
    const distribuidorHeader = req.headers.get("X-Distribuidor-Id");
    const filterDistribuidorId = isSuperAdmin
      ? (distribuidorHeader ?? undefined)
      : (distribuidorId ?? undefined);

    const supabase = createAdminClient();

    // ── Rango de fechas según período ────────────────────────────────────────
    const ahora = new Date();
    let fechaInicio: Date;
    switch (periodo) {
      case "semana":
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(ahora.getDate() - 7);
        break;
      case "trimestre":
        fechaInicio = new Date(ahora);
        fechaInicio.setMonth(ahora.getMonth() - 3);
        break;
      case "anio":
        fechaInicio = new Date(ahora.getFullYear(), 0, 1);
        break;
      default: // mes
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    }
    const fechaInicioISO = fechaInicio.toISOString();

    // ── 1. Ventas con sus ítems + producto + categoría ───────────────────────
    let ventasQuery = supabase
      .from("ventas")
      .select(`
        id,
        created_at,
        ventas_items (
          id,
          producto_id,
          cantidad,
          precio_unitario,
          subtotal,
          productos (
            id,
            nombre,
            marca,
            modelo,
            costo,
            tipo,
            categoria_id,
            categorias ( id, nombre )
          )
        )
      `)
      .gte("created_at", fechaInicioISO)
      .eq("estado", "completada");

    if (filterDistribuidorId) {
      ventasQuery = ventasQuery.eq("distribuidor_id", filterDistribuidorId);
    }

    const { data: ventas, error: ventasError } = await ventasQuery;
    if (ventasError) throw ventasError;

    // ── 2. Agrupación por categoría ──────────────────────────────────────────
    type CategoriaStat = {
      id: string;
      nombre: string;
      ingresos: number;
      costo: number;
      unidades: number;
      productos: Map<
        string,
        { nombre: string; ingresos: number; costo: number; unidades: number }
      >;
    };

    const mapa = new Map<string, CategoriaStat>();

    const SIN_CAT_ID = "sin-categoria";
    const SIN_CAT_NOMBRE = "Sin categoría";

    for (const venta of ventas ?? []) {
      for (const item of (venta.ventas_items as any[]) ?? []) {
        const prod = item.productos;
        if (!prod) continue; // ítems de servicio sin producto

        const catId: string = prod.categoria_id ?? SIN_CAT_ID;
        const catNombre: string =
          prod.categorias?.nombre ?? SIN_CAT_NOMBRE;

        if (!mapa.has(catId)) {
          mapa.set(catId, {
            id: catId,
            nombre: catNombre,
            ingresos: 0,
            costo: 0,
            unidades: 0,
            productos: new Map(),
          });
        }

        const cat = mapa.get(catId)!;
        const ingreso = Number(item.subtotal ?? 0);
        const costoUnitario = Number(prod.costo ?? 0);
        const costoTotal = costoUnitario * Number(item.cantidad ?? 1);

        cat.ingresos += ingreso;
        cat.costo += costoTotal;
        cat.unidades += Number(item.cantidad ?? 1);

        // Acumular por producto
        const prodId = prod.id as string;
        if (!cat.productos.has(prodId)) {
          cat.productos.set(prodId, {
            nombre: `${prod.marca ?? ""} ${prod.nombre ?? ""}`.trim(),
            ingresos: 0,
            costo: 0,
            unidades: 0,
          });
        }
        const ps = cat.productos.get(prodId)!;
        ps.ingresos += ingreso;
        ps.costo += costoTotal;
        ps.unidades += Number(item.cantidad ?? 1);
      }
    }

    // ── 3. Serializar resultados ─────────────────────────────────────────────
    const categorias = Array.from(mapa.values())
      .map((cat) => {
        const margenBruto = cat.ingresos - cat.costo;
        const pctMargen =
          cat.ingresos > 0
            ? Math.round((margenBruto / cat.ingresos) * 10000) / 100
            : 0;

        const topProductos = Array.from(cat.productos.values())
          .map((p) => ({
            nombre: p.nombre,
            ingresos: Math.round(p.ingresos * 100) / 100,
            costo: Math.round(p.costo * 100) / 100,
            margen: Math.round((p.ingresos - p.costo) * 100) / 100,
            pctMargen:
              p.ingresos > 0
                ? Math.round(((p.ingresos - p.costo) / p.ingresos) * 10000) / 100
                : 0,
            unidades: p.unidades,
          }))
          .sort((a, b) => b.margen - a.margen)
          .slice(0, 5);

        return {
          id: cat.id,
          nombre: cat.nombre,
          ingresos: Math.round(cat.ingresos * 100) / 100,
          costo: Math.round(cat.costo * 100) / 100,
          margenBruto: Math.round(margenBruto * 100) / 100,
          pctMargen,
          unidades: cat.unidades,
          topProductos,
        };
      })
      .sort((a, b) => b.margenBruto - a.margenBruto);

    // ── 4. Totales globales ──────────────────────────────────────────────────
    const totales = categorias.reduce(
      (acc, c) => ({
        ingresos: acc.ingresos + c.ingresos,
        costo: acc.costo + c.costo,
        margenBruto: acc.margenBruto + c.margenBruto,
        unidades: acc.unidades + c.unidades,
      }),
      { ingresos: 0, costo: 0, margenBruto: 0, unidades: 0 }
    );
    const pctMargenTotal =
      totales.ingresos > 0
        ? Math.round((totales.margenBruto / totales.ingresos) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        periodo,
        fechaInicio: fechaInicioISO,
        fechaFin: ahora.toISOString(),
        totales: { ...totales, pctMargen: pctMargenTotal },
        categorias,
      },
    });
  } catch (err) {
    console.error("[/api/reportes/rentabilidad]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
