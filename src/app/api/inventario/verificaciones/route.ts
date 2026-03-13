import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  createVerificacion,
  getVerificacionesByUsuario,
  getVerificacionActiva,
  getAllVerificaciones,
  getEstadisticasVerificacion,
  scanProducto,
} from "@/lib/db/verificaciones";
import type { NuevaVerificacionFormData, ScanProductoFormData } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    if (action === "activa") {
      const verificacion = await getVerificacionActiva(userId);
      return NextResponse.json({ success: true, data: verificacion });
    }

    if (action === "estadisticas") {
      const stats = await getEstadisticasVerificacion();
      return NextResponse.json({ success: true, data: stats });
    }

    // Admin and super_admin see all verifications
    if (role === "admin" || role === "super_admin") {
      const verificaciones = await getAllVerificaciones();
      return NextResponse.json({ success: true, data: verificaciones });
    } else {
      const verificaciones = await getVerificacionesByUsuario(userId);
      return NextResponse.json({ success: true, data: verificaciones });
    }
  } catch (error: any) {
    console.error("Error in GET /api/inventario/verificaciones:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener verificaciones",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!role || !["admin", "vendedor", "super_admin"].includes(role)) {
      return NextResponse.json(
        { error: "No tiene permisos para crear verificaciones" },
        { status: 403 }
      );
    }

    // Resolve target distribuidor
    let targetDistribuidorId: string | null = distribuidorId ?? null;
    if (isSuperAdmin) {
      const headerDistId = request.headers.get("X-Distribuidor-Id");
      if (headerDistId) targetDistribuidorId = headerDistId;
    }
    if (!targetDistribuidorId) {
      return NextResponse.json(
        { error: "No se pudo determinar el distribuidor activo" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body.action;

    if (action === "scan") {
      // Scan a product
      const scanData: ScanProductoFormData = {
        verificacionId: body.verificacionId,
        codigoEscaneado: body.codigoEscaneado,
        cantidad: body.cantidad ? Number(body.cantidad) : undefined,
        ubicacionEncontradaId: body.ubicacionEncontradaId,
        notasScan: body.notasScan,
      };

      if (!scanData.verificacionId || !scanData.codigoEscaneado) {
        return NextResponse.json(
          {
            success: false,
            error: "verificacionId y codigoEscaneado son requeridos",
          },
          { status: 400 }
        );
      }

      const item = await scanProducto(scanData);

      return NextResponse.json({ success: true, data: item });
    }

    // Create new verification session
    const formData: NuevaVerificacionFormData = {
      ubicacionId: body.ubicacionId,
      notas: body.notas,
    };

    // Check if user already has an active verification
    const existing = await getVerificacionActiva(userId);
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Ya tiene una verificación activa. Complete o cancele la actual primero.",
        },
        { status: 400 }
      );
    }

    const verificacion = await createVerificacion(formData, userId, targetDistribuidorId);

    return NextResponse.json({ success: true, data: verificacion });
  } catch (error: any) {
    console.error("Error in POST /api/inventario/verificaciones:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al crear verificación",
      },
      { status: 500 }
    );
  }
}
