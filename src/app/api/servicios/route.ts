import { NextResponse } from "next/server";
import { getServicios, getServiciosActivos, createServicio } from "@/lib/db/servicios";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/servicios
// Query params: ?activos=true  (solo activos, para POS)
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const filterDistribuidorId =
      role === "super_admin" ? undefined : (distribuidorId ?? undefined);

    const url = new URL(request.url);
    const soloActivos = url.searchParams.get("activos") === "true";

    const servicios = soloActivos
      ? await getServiciosActivos(filterDistribuidorId)
      : await getServicios(filterDistribuidorId);

    return NextResponse.json({ success: true, count: servicios.length, data: servicios });
  } catch (error) {
    console.error("Error al obtener servicios:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener servicios" },
      { status: 500 }
    );
  }
}

// POST /api/servicios — solo admin / super_admin
export async function POST(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    let effectiveDistribuidorId = distribuidorId;

    if (role === "super_admin" && !effectiveDistribuidorId) {
      const adminClient = createAdminClient();
      const { data: defaultDist } = await adminClient
        .from("distribuidores")
        .select("id")
        .eq("slug", "default")
        .single();

      if (defaultDist) {
        effectiveDistribuidorId = (defaultDist as { id: string }).id;
      } else {
        return NextResponse.json(
          { success: false, error: "No se encontró distribuidor default para Super Admin" },
          { status: 400 }
        );
      }
    }

    if (!effectiveDistribuidorId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();

    const nuevoServicio = await createServicio({
      distribuidorId: effectiveDistribuidorId,
      nombre: body.nombre,
      descripcion: body.descripcion,
      precioBase: Number(body.precioBase ?? body.precio_base ?? 0),
      precioFijo: body.precioFijo ?? body.precio_fijo ?? true,
      precioMin: body.precioMin ?? body.precio_min ?? undefined,
      precioMax: body.precioMax ?? body.precio_max ?? undefined,
      categoria: body.categoria ?? "otro",
      activo: body.activo ?? true,
    });

    return NextResponse.json({ success: true, data: nuevoServicio }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear servicio:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al crear servicio",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
