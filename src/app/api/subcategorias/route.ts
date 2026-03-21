import { NextRequest, NextResponse } from "next/server";
import {
  getSubcategorias,
  createSubcategoria,
} from "@/lib/db/subcategorias";
import { getAuthContext } from "@/lib/auth/server";

/**
 * FASE 57: API de Subcategorías
 *
 * GET  /api/subcategorias?categoria_id=UUID  → lista subcategorias de esa categoría
 * POST /api/subcategorias                    → crear nueva subcategoría (admin/super_admin)
 */

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // Determinar distribuidor efectivo (soporte super_admin con header)
    let efectivoDistribuidorId: string | null = distribuidorId ?? null;
    if (role === "super_admin") {
      const headerDist = request.headers.get("X-Distribuidor-Id");
      if (headerDist) efectivoDistribuidorId = headerDist;
    }

    if (!efectivoDistribuidorId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const categoriaId = request.nextUrl.searchParams.get("categoria_id") ?? undefined;
    const subcategorias = await getSubcategorias(efectivoDistribuidorId, categoriaId);

    return NextResponse.json({ success: true, data: subcategorias });
  } catch (error) {
    console.error("Error al obtener subcategorías:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener subcategorías" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    let efectivoDistribuidorId: string | null = distribuidorId ?? null;
    if (role === "super_admin") {
      const headerDist = request.headers.get("X-Distribuidor-Id");
      if (headerDist) efectivoDistribuidorId = headerDist;
    }

    if (!efectivoDistribuidorId) {
      return NextResponse.json(
        { success: false, error: "Se requiere distribuidor activo" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombre, categoriaId, descripcion } = body;

    if (!nombre?.trim() || !categoriaId) {
      return NextResponse.json(
        { success: false, error: "nombre y categoriaId son requeridos" },
        { status: 400 }
      );
    }

    const nueva = await createSubcategoria({
      distribuidorId: efectivoDistribuidorId,
      categoriaId,
      nombre: nombre.trim(),
      descripcion: descripcion ?? null,
    });

    return NextResponse.json({ success: true, data: nueva }, { status: 201 });
  } catch (error) {
    console.error("Error al crear subcategoría:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear subcategoría" },
      { status: 500 }
    );
  }
}
