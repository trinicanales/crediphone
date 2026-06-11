import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createApartado, getApartadosActivos } from "@/lib/db/creditos";

export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!distribuidorId && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Sin franquicia asignada" }, { status: 403 });
    }
    if (!distribuidorId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const apartados = await getApartadosActivos(distribuidorId);
    return NextResponse.json({ success: true, data: apartados });
  } catch (err) {
    console.error("GET /api/apartados error:", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!distribuidorId && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Sin franquicia asignada" }, { status: 403 });
    }

    const body = await request.json();
    const {
      clienteId,
      productosIds,
      montoTotal,
      depositoPorcentaje,
      metodoPagoDeposito,
      montoRecibido,
      referenciaPago,
      diasParaRecoger,
    } = body;

    if (!clienteId || !productosIds?.length || !montoTotal || !depositoPorcentaje) {
      return NextResponse.json({ success: false, error: "Faltan campos requeridos" }, { status: 400 });
    }

    const result = await createApartado({
      distribuidorId: distribuidorId!,
      clienteId,
      vendedorId: userId,
      productosIds,
      montoTotal,
      depositoPorcentaje,
      metodoPagoDeposito: metodoPagoDeposito ?? "efectivo",
      montoRecibido,
      referenciaPago,
      diasParaRecoger: diasParaRecoger ?? 15,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("POST /api/apartados error:", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
