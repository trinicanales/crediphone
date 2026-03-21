import { NextRequest, NextResponse } from "next/server";
import { getCategorias } from "@/lib/db/categorias";
import { getAuthContext } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // Para super_admin: leer el distribuidor del header X-Distribuidor-Id
    // (enviado por ProductoForm cuando hay un distribuidor activo seleccionado)
    let efectivoDistribuidorId: string | null = distribuidorId ?? null;

    if (role === "super_admin") {
      const headerDistribuidor = request.headers.get("X-Distribuidor-Id");
      if (headerDistribuidor) {
        efectivoDistribuidorId = headerDistribuidor;
      }
    }

    if (!efectivoDistribuidorId) {
      // super_admin en Vista Global sin distribuidor seleccionado → lista vacía
      return NextResponse.json({ success: true, data: [] });
    }

    const categorias = await getCategorias(efectivoDistribuidorId);
    return NextResponse.json({ success: true, data: categorias });
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener categorías" },
      { status: 500 }
    );
  }
}
