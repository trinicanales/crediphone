/**
 * FASE 55: Control de Asistencia
 *
 * GET  /api/asistencia  → historial (admin/super_admin)
 * POST /api/asistencia  → CHECK-IN (cualquier empleado autenticado)
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSesiones,
  getEstadisticasAsistencia,
  abrirSesion,
} from "@/lib/db/asistencia";

// ─── GET — historial con filtros (admin / super_admin) ────────────────────────
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterDistribuidorId =
      role === "super_admin" ? (searchParams.get("distribuidorId") ?? undefined) : (distribuidorId ?? undefined);

    const params = {
      distribuidorId: filterDistribuidorId,
      usuarioId: searchParams.get("usuarioId") ?? undefined,
      desde: searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined,
      hasta: searchParams.get("hasta") ? new Date(searchParams.get("hasta")!) : undefined,
      estado: (searchParams.get("estado") as "activo" | "cerrado" | undefined) ?? undefined,
      limit: parseInt(searchParams.get("limit") ?? "50"),
      offset: parseInt(searchParams.get("offset") ?? "0"),
    };

    const [{ sesiones, total }, stats] = await Promise.all([
      getSesiones(params),
      getEstadisticasAsistencia(filterDistribuidorId),
    ]);

    return NextResponse.json({ success: true, data: sesiones, total, stats });
  } catch (error) {
    console.error("[GET /api/asistencia]", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener asistencia" },
      { status: 500 }
    );
  }
}

// ─── POST — CHECK-IN (cualquier empleado autenticado) ─────────────────────────
export async function POST(request: Request) {
  try {
    const { userId, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // Obtener el nombre del usuario desde public.users
    const supabase = createAdminClient();
    const { data: userRow } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    const usuarioNombre = userRow?.name ?? "Empleado";

    const body = await request.json().catch(() => ({}));
    const notas = body?.notas as string | undefined;

    const sesion = await abrirSesion(
      userId,
      usuarioNombre,
      distribuidorId ?? undefined,
      notas
    );

    return NextResponse.json({ success: true, data: sesion });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    // "Ya tienes un turno activo" es un 409 Conflict, no 500
    const status = msg.includes("turno activo") ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
