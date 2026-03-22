import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getLotesSeries, crearLoteSerie } from "@/lib/db/lotesSeries";

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    let efectivoDistribuidorId: string | undefined;
    if (isSuperAdmin) {
      const h = request.headers.get("X-Distribuidor-Id");
      efectivoDistribuidorId = h ?? undefined;
    } else {
      efectivoDistribuidorId = distribuidorId ?? undefined;
    }

    const lotes = await getLotesSeries(efectivoDistribuidorId);
    return NextResponse.json({ success: true, data: lotes });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const rolesPermitidos = ["admin", "super_admin"];
    if (!rolesPermitidos.includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    let efectivoDistribuidorId: string | null = distribuidorId ?? null;
    if (isSuperAdmin) {
      const h = request.headers.get("X-Distribuidor-Id");
      if (h) efectivoDistribuidorId = h;
    }
    if (!efectivoDistribuidorId) {
      return NextResponse.json({ success: false, error: "Distribuidor requerido" }, { status: 400 });
    }

    const body = await request.json();
    const { productoId, referencia, proveedorId, totalEsperado, notas, imeis } = body;

    if (!productoId || !imeis || !Array.isArray(imeis) || imeis.length === 0) {
      return NextResponse.json({ success: false, error: "Producto e IMEIs son requeridos" }, { status: 400 });
    }

    const lote = await crearLoteSerie(efectivoDistribuidorId, userId, {
      productoId,
      referencia,
      proveedorId,
      totalEsperado: totalEsperado ?? imeis.length,
      notas,
      imeis,
    });

    return NextResponse.json({ success: true, data: lote }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
