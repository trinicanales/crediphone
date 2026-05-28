import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getAllDistribuidores, createDistribuidor } from "@/lib/db/distribuidores";

export async function GET() {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId || role !== "super_admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const distribuidores = await getAllDistribuidores();
    return NextResponse.json({ success: true, data: distribuidores });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId || role !== "super_admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.nombre || !body.slug) {
      return NextResponse.json(
        { success: false, error: "Nombre y slug son requeridos" },
        { status: 400 }
      );
    }

    const nuevo = await createDistribuidor({
      nombre: body.nombre,
      slug: body.slug,
      logoUrl: body.logoUrl || undefined,
      activo: body.activo ?? true,
      configuracion: {},
      tipoTenant: "independiente",
      permiteImpersonacion: true,
    });

    return NextResponse.json({ success: true, data: nuevo }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
