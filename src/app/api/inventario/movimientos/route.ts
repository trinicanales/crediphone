import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/inventario/movimientos
 * Historial de movimientos de stock — solo admin/super_admin.
 * Filtros: fecha (YYYY-MM-DD), empleadoId, productoId, tipo
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fecha      = searchParams.get("fecha");      // YYYY-MM-DD
    const empleadoId = searchParams.get("empleadoId");
    const productoId = searchParams.get("productoId");
    const tipo       = searchParams.get("tipo");

    const supabase = createAdminClient();

    let query = supabase
      .from("movimientos_stock")
      .select(`
        id,
        tipo,
        cantidad,
        stock_antes,
        stock_despues,
        referencia_tipo,
        referencia_id,
        referencia_folio,
        notas,
        created_at,
        producto:producto_id ( id, nombre, marca, modelo ),
        registrado_por
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!isSuperAdmin && distribuidorId) {
      query = query.eq("distribuidor_id", distribuidorId);
    }

    if (fecha) {
      query = query.gte("created_at", `${fecha}T00:00:00Z`).lte("created_at", `${fecha}T23:59:59Z`);
    }
    if (empleadoId) query = query.eq("registrado_por", empleadoId);
    if (productoId) query = query.eq("producto_id", productoId);
    if (tipo)       query = query.eq("tipo", tipo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error("Error en GET /api/inventario/movimientos:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/inventario/movimientos
 * Registra una entrada manual de mercancía al inventario.
 * Body: { productoId, cantidad, notas?, referenciaFolio?, tipo? }
 * tipo por defecto: "entrada_manual"
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { productoId, cantidad, notas, referenciaFolio, tipo = "entrada_manual" } = body;

    if (!productoId || !cantidad || Number(cantidad) <= 0) {
      return NextResponse.json({ success: false, error: "productoId y cantidad (> 0) son requeridos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Leer stock actual
    const { data: prod, error: prodErr } = await supabase
      .from("productos")
      .select("stock, nombre")
      .eq("id", productoId)
      .single();

    if (prodErr || !prod) {
      return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });
    }

    const stockAntes  = prod.stock ?? 0;
    const delta       = Number(cantidad);
    const stockDespues = stockAntes + delta;

    // Actualizar stock
    const { error: updErr } = await supabase
      .from("productos")
      .update({ stock: stockDespues })
      .eq("id", productoId);

    if (updErr) throw updErr;

    // Registrar movimiento
    const { error: movErr } = await supabase.from("movimientos_stock").insert({
      producto_id:     productoId,
      distribuidor_id: distribuidorId ?? null,
      tipo,
      cantidad:        delta,
      stock_antes:     stockAntes,
      stock_despues:   stockDespues,
      referencia_tipo: tipo === "entrada_manual" ? "entrada_manual" : undefined,
      referencia_folio: referenciaFolio || null,
      registrado_por:  userId,
      notas:           notas || null,
    });

    if (movErr) throw movErr;

    return NextResponse.json({
      success: true,
      data: { stockAntes, stockDespues, cantidad: delta, producto: prod.nombre },
    });
  } catch (error) {
    console.error("Error en POST /api/inventario/movimientos:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
