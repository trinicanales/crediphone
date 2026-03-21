/**
 * FASE 55: POST /api/asistencia/checkout
 *
 * Cierra el turno activo del usuario actual (CHECK-OUT).
 * Si el cuerpo tiene `usuarioId` y el role es admin, cierra el turno de ese empleado
 * (para cuando alguien olvidó registrar su salida).
 */

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getSesionActivaUsuario, cerrarSesion, cerrarSesionDeEmpleado } from "@/lib/db/asistencia";

export async function POST(request: Request) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const notas = body?.notas as string | undefined;
    const targetUserId = body?.usuarioId as string | undefined;

    // Si viene targetUserId y quien llama es admin/super_admin → cierra turno de ese empleado
    if (targetUserId && targetUserId !== userId) {
      if (!["admin", "super_admin"].includes(role ?? "")) {
        return NextResponse.json({ success: false, error: "Sin permisos para cerrar turno de otro empleado" }, { status: 403 });
      }
      const sesion = await cerrarSesionDeEmpleado(targetUserId, notas);
      if (!sesion) {
        return NextResponse.json({ success: false, error: "El empleado no tiene turno activo" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: sesion });
    }

    // Cierre propio: buscar sesión activa del usuario actual
    const activa = await getSesionActivaUsuario(userId);
    if (!activa) {
      return NextResponse.json({ success: false, error: "No tienes un turno activo" }, { status: 404 });
    }

    const sesion = await cerrarSesion(activa.id, notas);
    return NextResponse.json({ success: true, data: sesion });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
