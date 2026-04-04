import { NextResponse } from "next/server";
import {
  getEmpleadoById,
  updateEmpleado,
  deleteEmpleado,
} from "@/lib/db/empleados";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/empleados/[id]
 * Obtiene un empleado por ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // Validar UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID inválido",
          message: "El ID proporcionado no es un UUID válido",
        },
        { status: 400 }
      );
    }

    // super_admin ve cualquier empleado; admin solo los de su distribuidor
    const distribuidorFilter = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const empleado = await getEmpleadoById(id, distribuidorFilter);

    if (!empleado) {
      return NextResponse.json(
        {
          success: false,
          error: "Empleado no encontrado",
          message: `No se encontró un empleado con el ID ${id}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: empleado,
    });
  } catch (error) {
    console.error("Error en GET /api/empleados/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener empleado",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/empleados/[id]
 * Actualiza un empleado existente
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();

    // Validar UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID inválido",
          message: "El ID proporcionado no es un UUID válido",
        },
        { status: 400 }
      );
    }

    // Validar rol si se proporciona
    if (body.role) {
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
    }

    // Verificar que el empleado pertenece al distribuidor del admin antes de modificar
    const distribuidorFilter = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const empleadoExistente = await getEmpleadoById(id, distribuidorFilter);
    if (!empleadoExistente) {
      return NextResponse.json(
        { success: false, error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    const empleadoActualizado = await updateEmpleado(id, body);

    return NextResponse.json({
      success: true,
      data: empleadoActualizado,
      message: "Empleado actualizado exitosamente",
    });
  } catch (error) {
    console.error("Error en PUT /api/empleados/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar empleado",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/empleados/[id]
 * Desactiva un empleado (soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // Validar UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "ID inválido",
          message: "El ID proporcionado no es un UUID válido",
        },
        { status: 400 }
      );
    }

    // Verificar que el empleado pertenece al distribuidor del admin antes de desactivar
    const distribuidorFilter = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const empleadoExistente = await getEmpleadoById(id, distribuidorFilter);
    if (!empleadoExistente) {
      return NextResponse.json(
        { success: false, error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    await deleteEmpleado(id);

    return NextResponse.json({
      success: true,
      message: "Empleado desactivado correctamente",
    });
  } catch (error) {
    console.error("Error en DELETE /api/empleados/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al desactivar empleado",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
