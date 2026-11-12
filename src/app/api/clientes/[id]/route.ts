import { NextResponse } from "next/server";
import { getClienteById, updateCliente, deleteCliente } from "@/lib/db/clientes";
import { getAuthContext } from "@/lib/auth/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const cliente = await getClienteById(id, isSuperAdmin ? undefined : (distribuidorId ?? undefined));

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cliente,
    });
  } catch (error) {
    console.error("Error al obtener cliente:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener cliente",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const clienteActualizado = await updateCliente(
      id,
      body,
      isSuperAdmin ? undefined : (distribuidorId ?? undefined)
    );

    return NextResponse.json({
      success: true,
      data: clienteActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar cliente:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar cliente",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    // Decisión de Trini (2026-11-11): solo admin o super_admin pueden borrar clientes
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Solo administradores pueden eliminar clientes" },
        { status: 403 }
      );
    }

    await deleteCliente(id, isSuperAdmin ? undefined : (distribuidorId ?? undefined));

    return NextResponse.json({
      success: true,
      message: "Cliente eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al eliminar cliente",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
