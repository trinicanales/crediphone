/**
 * POST /api/reparaciones/[id]/entregar
 *
 * Cobro final + entrega del equipo.
 * - Calcula saldo pendiente (total - anticipos aplicados)
 * - Calcula ingreso_neto = precio_total - sum(costo_pieza + costo_envio)
 * - Si caja financió piezas (monto_de_caja > 0) → registra reembolso a caja primero
 * - Registra ingreso_neto en movimientos_bolsa_virtual
 * - Registra el saldo en caja
 * - Marca todos los anticipos pendientes como "aplicado"
 * - Cambia el estado de la orden a "entregado"
 * - Registra en historial
 */
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicarAnticiposOrden } from "@/lib/db/reparaciones";
import { getSesionActiva } from "@/lib/db/caja";
import { guardarVersionPDF } from "@/lib/pdf/versiones-pdf";
import type { TipoPago } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const permitidos = ["admin", "super_admin", "vendedor", "cobrador"];
    if (!permitidos.includes(role || "")) {
      return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    // SEGURIDAD: validar que la orden pertenece al distribuidor del usuario
    if (!isSuperAdmin) {
      const supabaseCheck = createAdminClient();
      const { data: chk } = await supabaseCheck.from("ordenes_reparacion").select("distribuidor_id").eq("id", id).single();
      if (!chk || chk.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
    }

    const body = await request.json();
    const metodoPago: TipoPago = body.metodoPago || "efectivo";

    const supabase = createAdminClient();

    // 1. Obtener la orden
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select("id, folio, estado, precio_total, presupuesto_total, distribuidor_id, cliente_id")
      .eq("id", id)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    const estadosValidos = ["listo_entrega", "completado", "aprobado", "en_reparacion"];
    if (!estadosValidos.includes(orden.estado)) {
      return NextResponse.json({
        success: false,
        error: `No se puede entregar una orden en estado "${orden.estado}"`,
      }, { status: 400 });
    }

    // 2. Calcular totales de anticipos pendientes
    const { data: anticiposPendientes } = await supabase
      .from("anticipos_reparacion")
      .select("id, monto")
      .eq("orden_id", id)
      .eq("estado", "pendiente");

    const totalAnticipos = (anticiposPendientes || []).reduce(
      (sum: number, a: any) => sum + parseFloat(a.monto),
      0
    );
    const precioTotal = parseFloat(orden.precio_total || orden.presupuesto_total || 0);
    const saldoFinal = Math.max(0, precioTotal - totalAnticipos);

    // 3. Calcular costos de piezas (para ingreso neto)
    const { data: pedidosPieza } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("costo_estimado, costo_envio, monto_de_caja, estado")
      .eq("orden_id", id)
      .neq("estado", "cancelada");

    const costosPiezas = (pedidosPieza || []).reduce(
      (sum: number, p: any) => sum + Number(p.costo_estimado || 0) + Number(p.costo_envio || 0),
      0
    );

    const montoCajaAdvanced = (pedidosPieza || []).reduce(
      (sum: number, p: any) => sum + Number(p.monto_de_caja || 0),
      0
    );

    const ingresoNeto = Math.max(0, precioTotal - costosPiezas);

    // 4. Sesión de caja activa
    let sesionCajaId: string | undefined;
    try {
      const sesion = await getSesionActiva(userId);
      sesionCajaId = sesion?.id;
    } catch { /* sin caja activa */ }

    // 5. Aplicar anticipos + registrar saldo en caja
    await aplicarAnticiposOrden(
      id,
      orden.folio,
      sesionCajaId,
      saldoFinal,
      metodoPago,
      userId
    );

    // 6. Registrar movimientos en bolsa virtual
    const movimientosBolsa = [];

    // Si la caja financió parte de la pieza → registrar reembolso
    if (montoCajaAdvanced > 0) {
      movimientosBolsa.push({
        orden_id: id,
        distribuidor_id: orden.distribuidor_id,
        tipo: "reembolso_caja",
        monto: montoCajaAdvanced,
        concepto: `Reembolso a caja: adelanto por piezas $${montoCajaAdvanced.toFixed(2)}`,
        sesion_caja_id: sesionCajaId || null,
        registrado_por: userId,
      });
    }

    // Ingreso neto del servicio → entra a caja
    movimientosBolsa.push({
      orden_id: id,
      distribuidor_id: orden.distribuidor_id,
      tipo: "ingreso_caja",
      monto: ingresoNeto,
      concepto: `Ingreso neto: precio $${precioTotal.toFixed(2)} - costos piezas $${costosPiezas.toFixed(2)}`,
      sesion_caja_id: sesionCajaId || null,
      registrado_por: userId,
    });

    if (movimientosBolsa.length > 0) {
      await supabase.from("movimientos_bolsa_virtual").insert(movimientosBolsa);
    }

    // 7. Cambiar estado a "entregado"
    await supabase
      .from("ordenes_reparacion")
      .update({ estado: "entregado", fecha_entrega: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);

    // PDF final — acuse de entrega (fire-and-forget)
    guardarVersionPDF(
      id,
      orden.folio,
      "entrega",
      `Acuse de entrega. Ingreso neto: $${ingresoNeto.toFixed(2)}`,
      userId
    ).catch(() => {});

    // 8. C1: Descontar stock de piezas del catálogo usadas en esta reparación
    // Solo piezas con producto_id (del catálogo) y estado instalada/verificada_ok
    ;(async () => {
      try {
        const { data: piezasCatalogo } = await supabase
          .from("pedidos_pieza_reparacion")
          .select("id, producto_id, nombre_pieza")
          .eq("orden_id", id)
          .not("producto_id", "is", null)
          .in("estado", ["instalada", "verificada_ok"]);

        if (!piezasCatalogo || piezasCatalogo.length === 0) return;

        for (const pieza of piezasCatalogo) {
          // Leer stock actual
          const { data: prod } = await supabase
            .from("productos")
            .select("stock")
            .eq("id", pieza.producto_id)
            .single();

          if (!prod) continue;
          const stockAntes = Number(prod.stock ?? 0);
          const stockDespues = Math.max(0, stockAntes - 1);

          // Actualizar stock
          await supabase
            .from("productos")
            .update({ stock: stockDespues })
            .eq("id", pieza.producto_id);

          // Registrar movimiento
          await supabase.from("movimientos_stock").insert({
            producto_id: pieza.producto_id,
            distribuidor_id: orden.distribuidor_id,
            tipo: "uso_reparacion",
            cantidad: -1,
            stock_antes: stockAntes,
            stock_despues: stockDespues,
            referencia_id: id,
            referencia_tipo: "orden_reparacion",
            referencia_folio: orden.folio,
            registrado_por: userId,
            notas: `Pieza "${pieza.nombre_pieza}" instalada en ${orden.folio}`,
          });
        }
      } catch (e) {
        console.error("[entregar] Error al descontar stock de piezas (no bloquea):", e);
      }
    })();

    // 8b. Acumular puntos de loyalty (fire-and-forget)
    if (orden.cliente_id && precioTotal > 0) {
      import("@/lib/db/puntos").then(({ acumularPuntos }) =>
        acumularPuntos({
          clienteId:      orden.cliente_id,
          distribuidorId: orden.distribuidor_id ?? undefined,
          monto:          precioTotal,
          referenciaId:   id,
          referenciaTipo: "reparacion",
          descripcion:    `Reparación ${orden.folio} — $${precioTotal.toFixed(2)}`,
        })
      ).catch(() => {});
    }

    // 9. Registrar historial
    await supabase.from("historial_estado_orden").insert({
      orden_id: id,
      estado_anterior: orden.estado,
      estado_nuevo: "entregado",
      comentario: saldoFinal > 0
        ? `Equipo entregado. Saldo cobrado: $${saldoFinal.toFixed(2)} (${metodoPago}). Ingreso neto: $${ingresoNeto.toFixed(2)}`
        : `Equipo entregado. Pagado completamente con anticipo(s). Ingreso neto: $${ingresoNeto.toFixed(2)}`,
      usuario_id: userId,
    });

    return NextResponse.json({
      success: true,
      message: "Equipo entregado correctamente",
      data: {
        folio: orden.folio,
        precioTotal,
        totalAnticipos,
        saldoCobrado: saldoFinal,
        costosPiezas,
        ingresoNeto,
        montoCajaAdvanced,
        registradoEnCaja: !!sesionCajaId,
        metodoPago,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/reparaciones/[id]/entregar:", error);
    return NextResponse.json({
      success: false,
      error: "Error al procesar entrega",
      message: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 500 });
  }
}
