import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { getSesionActiva, abrirCaja, getSesionesCaja, getAnticiposSinSesion } from "@/lib/db/caja";

/**
 * GET /api/pos/caja
 * Lista sesiones de caja o sesión activa
 * Acceso: admin, vendedor
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "vendedor", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Verificar si se solicita sesión activa
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const usuarioId = searchParams.get("usuarioId");

    if (action === "activa") {
      const targetUserId = usuarioId || userId;
      const sesion = await getSesionActiva(targetUserId);
      return NextResponse.json({
        success: true,
        data: sesion,
      });
    }

    // FASE 41: Anticipos sin sesión de caja (anti-fraude) — solo admin y super_admin
    if (action === "anticipos-sin-sesion") {
      if (!["admin", "super_admin"].includes(role)) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
      const distribFilter = role === "super_admin" ? undefined : (distribuidorId ?? undefined);
      const anticipos = await getAnticiposSinSesion(distribFilter);
      return NextResponse.json({ success: true, data: anticipos });
    }

    // Obtener historial de sesiones (scoped por distribuidor)
    const sesiones = await getSesionesCaja(
      50,
      role === "super_admin" ? undefined : distribuidorId ?? undefined
    );
    return NextResponse.json({ success: true, data: sesiones });
  } catch (error) {
    console.error("Error en GET /api/pos/caja:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error al obtener sesiones",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pos/caja
 * Abre una nueva sesión de caja
 * Acceso: admin, vendedor
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "vendedor", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    // Obtener datos del body
    const body = await request.json();
    const { action, montoInicial, notas } = body;

    if (action === "abrir") {
      if (typeof montoInicial !== "number" || montoInicial < 0) {
        return NextResponse.json(
          { success: false, error: "Monto inicial inválido" },
          { status: 400 }
        );
      }

      const sesion = await abrirCaja(
        userId,
        montoInicial,
        notas,
        role === "super_admin" ? undefined : distribuidorId ?? undefined
      );

      return NextResponse.json({
        success: true,
        data: sesion,
        message: "Caja abierta exitosamente",
      });
    }

    return NextResponse.json(
      { success: false, error: "Acción no válida" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error en POST /api/pos/caja:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error al abrir caja",
      },
      { status: 500 }
    );
  }
}
