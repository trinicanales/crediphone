import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getDistribuidorById, updateDistribuidor } from "@/lib/db/distribuidores";

/**
 * GET /api/distribuidor/perfil
 * Obtiene nombre y logo del distribuidor del usuario autenticado.
 * Solo disponible para admin con distribuidorId asignado.
 */
export async function GET() {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }
    if (!distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin distribuidor asignado" }, { status: 400 });
    }

    const dist = await getDistribuidorById(distribuidorId);
    if (!dist) return NextResponse.json({ success: false, error: "Distribuidor no encontrado" }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: { nombre: dist.nombre, logoUrl: dist.logoUrl },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT /api/distribuidor/perfil
 * Actualiza nombre comercial y/o logo del propio distribuidor.
 * Solo admin (con distribuidorId) puede hacerlo — super_admin sin distribuidor queda excluido.
 */
export async function PUT(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }
    if (!distribuidorId) {
      return NextResponse.json({ success: false, error: "Sin distribuidor asignado" }, { status: 400 });
    }

    const body = await request.json();
    const updates: { nombre?: string; logoUrl?: string } = {};
    if (typeof body.nombre === "string" && body.nombre.trim()) {
      updates.nombre = body.nombre.trim();
    }
    if (typeof body.logoUrl === "string") {
      updates.logoUrl = body.logoUrl.trim() || undefined;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "Sin cambios" }, { status: 400 });
    }

    const dist = await updateDistribuidor(distribuidorId, updates);
    return NextResponse.json({ success: true, data: { nombre: dist.nombre, logoUrl: dist.logoUrl } });
  } catch {
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
