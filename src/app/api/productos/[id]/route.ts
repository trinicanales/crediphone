import { NextResponse } from "next/server";
import { getProductoById, updateProducto, deleteProducto } from "@/lib/db/productos";
import { requireAuth } from "@/lib/auth/guard";
import { getAuthContext } from "@/lib/auth/server";
import { tienePermiso } from "@/lib/permisos";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "vendedor", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const filterDist = auth.isSuperAdmin ? undefined : (auth.distribuidorId ?? undefined);
    const producto = await getProductoById(id, filterDist);

    if (!producto) {
      return NextResponse.json(
        { success: false, error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: producto,
    });
  } catch (error) {
    console.error("Error al obtener producto:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener producto",
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
    // Vendedores con permiso producto_editar también pueden actualizar
    const { userId, role, permisosExplicitos, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    if (!tienePermiso(role, permisosExplicitos, "producto_editar")) {
      return NextResponse.json({ success: false, error: "No autorizado para editar productos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const filterDist = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    const productoActualizado = await updateProducto(id, body, filterDist);

    return NextResponse.json({
      success: true,
      data: productoActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar producto:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al actualizar producto",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Acciones ligeras que vendedores también pueden ejecutar.
 * action: "generar_codigo" → asigna codigoBarras si el producto no tiene uno aún.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "vendedor", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();

    if (body.action === "generar_codigo") {
      const supabase = createAdminClient();

      // Verificar que el producto existe y no tiene código ya
      const { data: prod } = await supabase
        .from("productos")
        .select("id, codigo_barras, sku, distribuidor_id")
        .eq("id", id)
        .single();

      if (!prod) {
        return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });
      }

      if (!auth.isSuperAdmin && auth.distribuidorId && prod.distribuidor_id !== auth.distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }

      // Si ya tiene código, devolver el existente sin modificar
      if (prod.codigo_barras || prod.sku) {
        return NextResponse.json({ success: true, codigo: prod.codigo_barras || prod.sku, generado: false });
      }

      // Generar código único CP-XXXXXX (sin caracteres confundibles 0/O, 1/I)
      const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let codigo: string;
      let intentos = 0;
      do {
        const rand = Array.from({ length: 7 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
        codigo = `CP-${rand}`;
        intentos++;
        // Verificar que no exista ya este código
        const { data: existe } = await supabase
          .from("productos")
          .select("id")
          .eq("codigo_barras", codigo)
          .maybeSingle();
        if (!existe) break;
      } while (intentos < 10);

      // Guardar en el producto
      const { error } = await supabase
        .from("productos")
        .update({ codigo_barras: codigo })
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({ success: true, codigo, generado: true });
    }

    // C2: Ajuste manual de stock con motivo obligatorio
    if (body.action === "ajustar_stock") {
      const authAdmin = await requireAuth(["admin", "super_admin"]);
      if (!authAdmin.ok) return authAdmin.response;

      const { cantidadNueva, motivo } = body as { cantidadNueva?: number; motivo?: string };
      if (cantidadNueva === undefined || cantidadNueva === null || !Number.isFinite(cantidadNueva)) {
        return NextResponse.json({ success: false, error: "cantidadNueva es obligatorio" }, { status: 400 });
      }
      if (!motivo?.trim()) {
        return NextResponse.json({ success: false, error: "El motivo del ajuste es obligatorio" }, { status: 400 });
      }

      const supabase = createAdminClient();

      const { data: prod } = await supabase
        .from("productos")
        .select("id, stock, distribuidor_id, nombre")
        .eq("id", id)
        .single();

      if (!prod) return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });

      if (!authAdmin.isSuperAdmin && authAdmin.distribuidorId && prod.distribuidor_id !== authAdmin.distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }

      const stockAntes = Number(prod.stock ?? 0);
      const stockDespues = Math.max(0, Math.round(cantidadNueva));
      const delta = stockDespues - stockAntes;

      if (delta === 0) {
        return NextResponse.json({ success: true, message: "Sin cambio de stock", stockAntes, stockDespues });
      }

      const { userId } = await import("@/lib/auth/server").then((m) => m.getAuthContext());

      await supabase.from("productos").update({ stock: stockDespues }).eq("id", id);

      await supabase.from("movimientos_stock").insert({
        producto_id: id,
        distribuidor_id: prod.distribuidor_id ?? null,
        tipo: "ajuste",
        cantidad: delta,
        stock_antes: stockAntes,
        stock_despues: stockDespues,
        referencia_tipo: "ajuste_manual",
        registrado_por: userId ?? null,
        notas: motivo.trim(),
      });

      return NextResponse.json({ success: true, stockAntes, stockDespues, delta, motivo: motivo.trim() });
    }

    return NextResponse.json({ success: false, error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Error en PATCH /api/productos/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar producto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    await deleteProducto(id);

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar producto:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error al eliminar producto",
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
