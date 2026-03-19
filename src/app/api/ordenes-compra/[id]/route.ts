import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getOrdenCompra,
  actualizarEstadoOrdenCompra,
  recibirMercancia,
  eliminarOrdenCompra,
} from "@/lib/db/ordenes-compra";
import type { EstadoOrdenCompra } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const orden = await getOrdenCompra(id);
    if (!orden) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });

    return NextResponse.json({ success: true, data: orden });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Operación especial: recibir mercancía
    if (body.action === "recibir") {
      const orden = await recibirMercancia(id, body.recepciones ?? [], body.notasRecepcion);
      return NextResponse.json({ success: true, data: orden });
    }

    // Cambio de estado simple
    if (body.estado) {
      const orden = await actualizarEstadoOrdenCompra(
        id,
        body.estado as EstadoOrdenCompra,
        body.notas
      );
      return NextResponse.json({ success: true, data: orden });
    }

    return NextResponse.json({ success: false, error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { id } = await params;
    await eliminarOrdenCompra(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
