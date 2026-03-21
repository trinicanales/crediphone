import { NextRequest, NextResponse } from "next/server";
import { getProveedores } from "@/lib/db/proveedores";
import { getAuthContext } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // Para super_admin: leer el distribuidor del header X-Distribuidor-Id
    let efectivoDistribuidorId: string | null = distribuidorId ?? null;

    if (role === "super_admin") {
      const headerDistribuidor = request.headers.get("X-Distribuidor-Id");
      if (headerDistribuidor) {
        efectivoDistribuidorId = headerDistribuidor;
      }
    }

    if (!efectivoDistribuidorId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const proveedores = await getProveedores(efectivoDistribuidorId);
    return NextResponse.json({ success: true, data: proveedores });
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener proveedores" },
      { status: 500 }
    );
  }
}
