import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getUbicaciones,
  getAllUbicaciones,
  getUbicacionesWithCounts,
  createUbicacion,
} from "@/lib/db/ubicaciones";
import type { NuevaUbicacionFormData } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const withCounts = searchParams.get("withCounts") === "true";

    if (withCounts) {
      const ubicaciones = await getUbicacionesWithCounts();
      return NextResponse.json({ success: true, data: ubicaciones });
    }

    if (includeInactive) {
      const ubicaciones = await getAllUbicaciones();
      return NextResponse.json({ success: true, data: ubicaciones });
    }

    const ubicaciones = await getUbicaciones();
    return NextResponse.json({ success: true, data: ubicaciones });
  } catch (error: any) {
    console.error("Error in GET /api/inventario/ubicaciones:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener ubicaciones" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "vendedor", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "No tiene permisos para crear ubicaciones" },
        { status: 403 }
      );
    }

    // Resolve target distribuidor
    let targetDistribuidorId: string | null = distribuidorId ?? null;
    if (isSuperAdmin) {
      const headerDistId = request.headers.get("X-Distribuidor-Id");
      if (headerDistId) targetDistribuidorId = headerDistId;
    }
    if (!targetDistribuidorId) {
      return NextResponse.json(
        { error: "No se pudo determinar el distribuidor activo" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const formData: NuevaUbicacionFormData = {
      nombre: body.nombre,
      codigo: body.codigo,
      tipo: body.tipo,
      descripcion: body.descripcion,
      capacidadMaxima: body.capacidadMaxima,
    };

    // Validate required fields
    if (!formData.nombre || !formData.tipo) {
      return NextResponse.json(
        { success: false, error: "Nombre y tipo son requeridos" },
        { status: 400 }
      );
    }

    const ubicacion = await createUbicacion(formData, targetDistribuidorId);

    return NextResponse.json({ success: true, data: ubicacion });
  } catch (error: any) {
    console.error("Error in POST /api/inventario/ubicaciones:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al crear ubicación" },
      { status: 500 }
    );
  }
}
