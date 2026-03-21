/**
 * GET /api/public/productos
 *
 * Endpoint público (sin autenticación) para el catálogo de clientes.
 * Solo devuelve productos activos con stock > 0 y los campos necesarios para
 * mostrar en la tienda pública. NO expone campos internos (costo, proveedor,
 * distribuidorId, ubicaciones, etc.).
 *
 * Query params opcionales:
 *   - distribuidorSlug: string  — filtra por distribuidor (slug)
 *   - marca:            string  — filtra por marca
 *   - q:                string  — búsqueda por nombre/marca/modelo
 *   - limit:            number  — máximo de resultados (default 200)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Campos seguros para exponer públicamente
const PUBLIC_FIELDS = [
  "id",
  "nombre",
  "marca",
  "modelo",
  "precio",
  "stock",
  "imagen",
  "descripcion",
  "activo",
  "tipo",
  "color",
  "ram",
  "almacenamiento",
  "esSerializado",
  "created_at",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const distribuidorSlug = searchParams.get("distribuidorSlug") ?? undefined;
    const marcaFiltro      = searchParams.get("marca") ?? undefined;
    const busqueda         = searchParams.get("q") ?? undefined;
    const limit            = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

    const supabase = createAdminClient();

    // Construir query base — solo productos activos con stock disponible
    let query = supabase
      .from("productos")
      .select(
        [
          "id", "nombre", "marca", "modelo", "precio", "stock",
          "imagen", "descripcion", "activo", "tipo",
          "color", "ram", "almacenamiento", "es_serializado",
          "distribuidor_id",
          // join para obtener el slug del distribuidor si se necesita filtrar
          "distribuidores!inner(id, slug, nombre, activo)",
        ].join(", ")
      )
      .eq("activo", true)
      .gt("stock", 0)
      .order("nombre", { ascending: true })
      .limit(limit);

    // Filtro por distribuidor (slug)
    if (distribuidorSlug) {
      query = query.eq("distribuidores.slug", distribuidorSlug);
    }

    // Solo distribuidores activos
    query = query.eq("distribuidores.activo", true);

    // Filtro por marca
    if (marcaFiltro && marcaFiltro !== "todas") {
      query = query.ilike("marca", marcaFiltro);
    }

    // Búsqueda de texto
    if (busqueda) {
      query = query.or(
        `nombre.ilike.%${busqueda}%,marca.ilike.%${busqueda}%,modelo.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/public/productos]", error);
      return NextResponse.json(
        { success: false, error: "Error al obtener productos" },
        { status: 500 }
      );
    }

    // Limpieza: solo campos públicos, sin datos internos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productosSeguros = (data as any[] ?? []).map((p: Record<string, unknown>) => ({
      id:              p.id,
      nombre:          p.nombre,
      marca:           p.marca,
      modelo:          p.modelo,
      precio:          p.precio,
      stock:           p.stock,
      imagen:          p.imagen ?? null,
      descripcion:     p.descripcion ?? null,
      activo:          p.activo,
      tipo:            p.tipo ?? null,
      color:           p.color ?? null,
      ram:             p.ram ?? null,
      almacenamiento:  p.almacenamiento ?? null,
      esSerializado:   p.es_serializado ?? false,
    }));

    return NextResponse.json(
      {
        success: true,
        count: productosSeguros.length,
        data: productosSeguros,
      },
      {
        headers: {
          // Cache 5 minutos en CDN — el catálogo no cambia segundo a segundo
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/public/productos] unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
