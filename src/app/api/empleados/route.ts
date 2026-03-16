import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import {
  getEmpleados,
  getEmpleadosActivos,
  createEmpleado,
  searchEmpleados,
  getEstadisticasEmpleados,
} from "@/lib/db/empleados";

/**
 * GET /api/empleados
 * Obtiene todos los empleados con filtros opcionales
 */
export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const activos = searchParams.get("activos");
    const stats = searchParams.get("stats");

    // Filtro multi-tenant: super_admin ve todos, admin solo su tienda
    const filterDistribuidorId =
      role === "super_admin" ? undefined : (distribuidorId ?? undefined);

    // Si se solicitan estadísticas
    if (stats === "true") {
      const estadisticas = await getEstadisticasEmpleados(filterDistribuidorId);
      return NextResponse.json({ success: true, data: estadisticas });
    }

    let empleados;
    if (query) {
      empleados = await searchEmpleados(query, filterDistribuidorId);
    } else if (activos === "true") {
      empleados = await getEmpleadosActivos(filterDistribuidorId);
    } else {
      empleados = await getEmpleados(filterDistribuidorId);
    }

    return NextResponse.json({
      success: true,
      count: empleados.length,
      data: empleados,
    });
  } catch (error) {
    console.error("Error en GET /api/empleados:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener empleados",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/empleados
 * Crea un nuevo empleado
 */
export async function POST(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado. Solo administradores pueden crear empleados." },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validaciones básicas
    if (!body.email || !body.name || !body.role) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos requeridos faltantes",
          message: "Email, nombre y rol son obligatorios",
        },
        { status: 400 }
      );
    }

    // Validar rol válido
    const rolesValidos = ["admin", "vendedor", "cobrador", "tecnico"];
    if (!rolesValidos.includes(body.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Rol inválido",
          message: `El rol debe ser uno de: ${rolesValidos.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // super_admin puede pasar distribuidorId en el body para asignar el empleado a una tienda
    const effectiveDistribuidorId =
      role === "super_admin" ? (body.distribuidorId || undefined) : (distribuidorId ?? undefined);

    const { tempPassword, ...nuevoEmpleado } = await createEmpleado(
      body,
      effectiveDistribuidorId,
      body.password || undefined
    );

    return NextResponse.json(
      {
        success: true,
        data: nuevoEmpleado,
        tempPassword,
        message: "Empleado creado exitosamente",
      },
      { status: 201 }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as any)?.code || (error as any)?.status || "unknown";
    console.error("Error en POST /api/empleados:", errMsg, "code:", errCode, error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al crear empleado",
        message: errMsg,
        code: errCode,
      },
      { status: 500 }
    );
  }
}
