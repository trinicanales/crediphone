import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  listarOrdenesCompra,
  crearOrdenCompra,
} from "@/lib/db/ordenes-compra";
import type { EstadoOrdenCompra } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterDistribuidorId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    const data = await listarOrdenesCompra({
      distribuidorId: filterDistribuidorId,
      estado: (searchParams.get("estado") as EstadoOrdenCompra) || undefined,
      proveedorId: searchParams.get("proveedor_id") || undefined,
      limit: parseInt(searchParams.get("limit") ?? "50"),
      offset: parseInt(searchParams.get("offset") ?? "0"),
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const body = await req.json();
    const filterDistribuidorId = isSuperAdmin
      ? (body.distribuidorId ?? null)
      : (distribuidorId ?? null);

    const orden = await crearOrdenCompra({
      ...body,
      distribuidorId: filterDistribuidorId,
      creadoPor: userId,
    });

    return NextResponse.json({ success: true, data: orden }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
