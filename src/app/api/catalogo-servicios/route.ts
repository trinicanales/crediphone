import { NextResponse } from "next/server";
import {
  getCatalogoServicios,
  createServicio,
} from "@/lib/db/catalogo-servicios";
import { getAuthContext } from "@/lib/auth/server";
import type { CatalogoServicioFormData } from "@/types";

/**
 * GET /api/catalogo-servicios
 * Devuelve servicios activos con precio efectivo para el distribuidor del usuario.
 * Si super_admin → todos los servicios globales y de distribuidores.
 * Query params:
 *   - incluirInactivos=true → muestra también los inactivos (admin/super_admin)
 */
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const incluirInactivos =
      url.searchParams.get("incluirInactivos") === "true" &&
      ["admin", "super_admin"].includes(role ?? "");
    const marcaFiltro = url.searchParams.get("marca") ?? undefined;
    const modeloFiltro = url.searchParams.get("modelo") ?? undefined;

    // super_admin (distribuidorId === null) ve todo con precio_base
    const filterDistribuidorId =
      role === "super_admin" ? null : (distribuidorId ?? null);

    const servicios = await getCatalogoServicios(
      filterDistribuidorId,
      incluirInactivos,
      { marca: marcaFiltro, modelo: modeloFiltro }
    );

    return NextResponse.json({ success: true, data: servicios });
  } catch (error) {
    console.error("Error en GET /api/catalogo-servicios:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener catálogo" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/catalogo-servicios
 * Crea un nuevo servicio en el catálogo.
 * Solo admin y super_admin.
 */
export async function POST(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Sin permisos" },
        { status: 403 }
      );
    }

    const body: CatalogoServicioFormData = await request.json();

    if (!body.nombre || body.precioBase === undefined) {
      return NextResponse.json(
        { success: false, error: "Nombre y precio base son requeridos" },
        { status: 400 }
      );
    }

    // admin solo puede crear servicios de su distribuidor
    const servicioData: CatalogoServicioFormData = {
      ...body,
      distribuidorId:
        role === "super_admin"
          ? (body.distribuidorId ?? undefined)
          : (distribuidorId ?? undefined),
    };

    const servicio = await createServicio(servicioData, userId);

    return NextResponse.json({ success: true, data: servicio }, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/catalogo-servicios:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear servicio" },
      { status: 500 }
    );
  }
}
