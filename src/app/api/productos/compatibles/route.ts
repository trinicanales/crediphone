import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/productos/compatibles?modelo=Samsung+A05&tipo=pieza_reparacion
 *
 * Busca productos compatibles con un modelo de dispositivo dado.
 * Usa el campo `modelos_compatibles` (array GIN-indexed) para la búsqueda.
 * Devuelve resultados agrupados por proveedor con: costo, precio, envío, stock, calidad.
 *
 * FASE 80 — Autosugerencia de piezas al crear orden de servicio.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const modelo = url.searchParams.get("modelo")?.trim();
    const tipo = url.searchParams.get("tipo") ?? "pieza_reparacion";
    const calidad = url.searchParams.get("calidad") ?? undefined;

    if (!modelo) {
      return NextResponse.json(
        { success: false, error: "Parámetro 'modelo' requerido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Búsqueda en modelos_compatibles (array contains) usando el índice GIN
    let query = supabase
      .from("productos")
      .select(`
        id,
        nombre,
        marca,
        modelo,
        tipo,
        calidad,
        costo,
        precio,
        stock,
        stock_minimo,
        modelos_compatibles,
        proveedor_id,
        distribuidor_id,
        activo,
        proveedores:proveedor_id (
          id,
          nombre,
          telefono,
          contacto
        )
      `)
      .eq("activo", true)
      .eq("tipo", tipo)
      .contains("modelos_compatibles", [modelo]);

    if (filterDistribuidorId) {
      query = query.eq("distribuidor_id", filterDistribuidorId);
    }

    if (calidad) {
      query = query.eq("calidad", calidad);
    }

    query = query.order("stock", { ascending: false }).order("costo", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Mapear a formato camelCase limpio
    const resultados = (data ?? []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      marca: p.marca,
      modelo: p.modelo,
      tipo: p.tipo,
      calidad: p.calidad ?? null,
      costo: p.costo ?? 0,
      precio: p.precio,
      stock: p.stock,
      stockMinimo: p.stock_minimo ?? 0,
      modelosCompatibles: p.modelos_compatibles ?? [],
      proveedor: p.proveedores
        ? {
            id: p.proveedores.id,
            nombre: p.proveedores.nombre,
            telefono: p.proveedores.telefono ?? null,
            contacto: p.proveedores.contacto ?? null,
          }
        : null,
      hayStock: p.stock > 0,
    }));

    return NextResponse.json({
      success: true,
      modelo,
      count: resultados.length,
      data: resultados,
    });
  } catch (error) {
    console.error("Error al buscar productos compatibles:", error);
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
