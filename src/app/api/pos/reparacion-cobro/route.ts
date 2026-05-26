import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionActiva } from "@/lib/db/caja";
import { createTraspasoAnticipo } from "@/lib/db/traspasos";
import type { TipoPago, DesglosePagoMixto, UserRole } from "@/types";

/**
 * Ejecuta el flujo completo de entrega después de que el saldo llega a 0 desde POS.
 * Fire-and-forget: no bloquea la respuesta al cliente.
 */
async function ejecutarEntregaCompleta(
  ordenId: string,
  folio: string,
  distribuidorId: string | null,
  clienteId: string | null,
  precioTotal: number,
  sesionCajaId: string | null,
  estadoAnterior: string,
  userId: string
): Promise<void> {
  const supabase = createAdminClient();
  try {
    // 1. Marcar todos los anticipos pendientes como aplicados
    await supabase
      .from("anticipos_reparacion")
      .update({ estado: "aplicado", fecha_aplicado: new Date().toISOString() })
      .eq("orden_id", ordenId)
      .eq("estado", "pendiente");

    // 2. Calcular costos de piezas para ingreso neto
    const { data: pedidosPieza } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("costo_estimado, costo_envio, monto_de_caja, estado")
      .eq("orden_id", ordenId)
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

    // 3. Registrar movimientos en bolsa virtual
    const movimientosBolsa: any[] = [];
    if (montoCajaAdvanced > 0) {
      movimientosBolsa.push({
        orden_id: ordenId,
        distribuidor_id: distribuidorId,
        tipo: "reembolso_caja",
        monto: montoCajaAdvanced,
        concepto: `Reembolso a caja: adelanto por piezas $${montoCajaAdvanced.toFixed(2)}`,
        sesion_caja_id: sesionCajaId,
        registrado_por: userId,
      });
    }
    movimientosBolsa.push({
      orden_id: ordenId,
      distribuidor_id: distribuidorId,
      tipo: "ingreso_caja",
      monto: ingresoNeto,
      concepto: `Ingreso neto POS: precio $${precioTotal.toFixed(2)} - costos piezas $${costosPiezas.toFixed(2)}`,
      sesion_caja_id: sesionCajaId,
      registrado_por: userId,
    });
    if (movimientosBolsa.length > 0) {
      await supabase.from("movimientos_bolsa_virtual").insert(movimientosBolsa);
    }

    // 4a. Consumir stock de piezas reservadas en reparacion_piezas
    //     (estas fueron apartadas al agregarPiezaReparacion — ahora salen físicamente)
    const { data: piezasApartadas } = await supabase
      .from("reparacion_piezas")
      .select("producto_id, nombre_pieza, cantidad")
      .eq("orden_id", ordenId)
      .not("producto_id", "is", null);

    for (const pieza of piezasApartadas || []) {
      const { data: prodAp } = await supabase
        .from("productos")
        .select("stock, stock_apartado")
        .eq("id", pieza.producto_id)
        .single();
      if (!prodAp) continue;
      const nuevoStock = Math.max(0, (prodAp.stock ?? 0) - pieza.cantidad);
      const nuevoApartado = Math.max(0, (prodAp.stock_apartado ?? 0) - pieza.cantidad);
      await supabase.from("productos").update({ stock: nuevoStock, stock_apartado: nuevoApartado }).eq("id", pieza.producto_id);
      await supabase.from("movimientos_stock").insert({
        producto_id: pieza.producto_id,
        distribuidor_id: distribuidorId,
        tipo: "uso_reparacion",
        cantidad: -pieza.cantidad,
        stock_antes: prodAp.stock ?? 0,
        stock_despues: nuevoStock,
        referencia_id: ordenId,
        referencia_tipo: "orden_reparacion",
        referencia_folio: folio,
        registrado_por: userId,
        notas: `Pieza "${pieza.nombre_pieza}" consumida al entregar ${folio}`,
      });
    }

    // 4b. Descontar stock de piezas del catálogo instaladas en esta reparación (pedidos_pieza_reparacion)
    const { data: piezasCatalogo } = await supabase
      .from("pedidos_pieza_reparacion")
      .select("id, producto_id, nombre_pieza")
      .eq("orden_id", ordenId)
      .not("producto_id", "is", null)
      .in("estado", ["instalada", "verificada_ok"]);

    for (const pieza of piezasCatalogo || []) {
      const { data: prod } = await supabase
        .from("productos")
        .select("stock")
        .eq("id", pieza.producto_id)
        .single();
      if (!prod) continue;
      const stockAntes = Number(prod.stock ?? 0);
      const stockDespues = Math.max(0, stockAntes - 1);
      await supabase.from("productos").update({ stock: stockDespues }).eq("id", pieza.producto_id);
      await supabase.from("movimientos_stock").insert({
        producto_id: pieza.producto_id,
        distribuidor_id: distribuidorId,
        tipo: "uso_reparacion",
        cantidad: -1,
        stock_antes: stockAntes,
        stock_despues: stockDespues,
        referencia_id: ordenId,
        referencia_tipo: "orden_reparacion",
        referencia_folio: folio,
        registrado_por: userId,
        notas: `Pieza "${pieza.nombre_pieza}" instalada en ${folio} (cobro POS)`,
      });
    }

    // 5. Acumular puntos de loyalty
    if (clienteId && precioTotal > 0) {
      import("@/lib/db/puntos").then(({ acumularPuntos }) =>
        acumularPuntos({
          clienteId,
          distribuidorId: distribuidorId ?? undefined,
          monto: precioTotal,
          referenciaId: ordenId,
          referenciaTipo: "reparacion",
          descripcion: `Reparación ${folio} — $${precioTotal.toFixed(2)}`,
        })
      ).catch(() => {});
    }

    // 6. Registrar historial
    await supabase.from("historial_estado_orden").insert({
      orden_id: ordenId,
      estado_anterior: estadoAnterior,
      estado_nuevo: "entregado",
      comentario: `Equipo entregado. Pagado completamente desde POS. Ingreso neto: $${ingresoNeto.toFixed(2)}`,
      usuario_id: userId,
    });
  } catch (e) {
    console.error("[reparacion-cobro] Error en ejecutarEntregaCompleta:", e);
  }
}

/**
 * POST /api/pos/reparacion-cobro
 *
 * Registra un cobro de reparación (anticipo o saldo final) desde el POS.
 *
 * Body:
 *  - ordenId: UUID de la orden
 *  - tipo: "anticipo" | "saldo_final"
 *  - monto: número
 *  - metodoPago: TipoPago (efectivo, tarjeta, transferencia, deposito)
 *  - desgloseMixto?: DesglosePagoMixto (opcional, para pagos mixtos)
 *
 * Retorna:
 *  - { success: true, nuevoSaldo: number, entregado: boolean }
 */
export async function POST(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ordenId, tipo, monto, metodoPago, desgloseMixto } = body;

    if (!ordenId || !tipo || !monto || !metodoPago) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    if (tipo !== "anticipo" && tipo !== "saldo_final") {
      return NextResponse.json(
        { success: false, error: "Tipo de cobro inválido" },
        { status: 400 }
      );
    }

    if (parseFloat(monto) <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Obtener datos de la orden con nombre del cliente para el traspaso
    const { data: orden, error: ordenError } = await supabase
      .from("ordenes_reparacion")
      .select(`
        id, folio, estado, cliente_id, costo_total, precio_total, distribuidor_id,
        cliente:clientes(nombre, apellido)
      `)
      .eq("id", ordenId)
      .single();

    if (ordenError || !orden) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Validar que el usuario pertenece al mismo distribuidor
    if (!isSuperAdmin && orden.distribuidor_id !== distribuidorId) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos en este distribuidor" },
        { status: 403 }
      );
    }

    // Obtener sesión de caja activa
    let sesionCajaId: string | null = null;
    try {
      const sesion = await getSesionActiva(userId);
      sesionCajaId = sesion?.id || null;
    } catch {
      // Sin sesión activa — no hay problema, el anticipo se registra sin caja
    }

    // Obtener total de anticipos existentes (todos los activos, no solo "aplicado")
    const { data: anticiposExistentes } = await supabase
      .from("anticipos_reparacion")
      .select("monto")
      .eq("orden_id", ordenId)
      .neq("estado", "devuelto"); // incluye pendiente + aplicado, excluye devuelto

    const totalAnticiposActual = anticiposExistentes
      ? anticiposExistentes.reduce((sum: number, a: any) => sum + parseFloat(a.monto || 0), 0)
      : 0;

    // C3 fix: cobrar sobre precio_total (lo que el cliente paga), no costo_total (costo interno)
    const precioTotal = parseFloat(orden.precio_total || orden.costo_total || 0);
    const nuevoTotalAnticipos = totalAnticiposActual + parseFloat(monto);
    const nuevoSaldo = Math.max(0, precioTotal - nuevoTotalAnticipos);

    // Crear anticipo
    const { data: nuevoAnticipo, error: insertError } = await supabase
      .from("anticipos_reparacion")
      .insert({
        orden_id: ordenId,
        monto: parseFloat(monto),
        tipo_pago: metodoPago as TipoPago,
        desglose_mixto: desgloseMixto as DesglosePagoMixto | null,
        recibido_por: userId,
        // C3 fix: estado='pendiente' para que /entregar los encuentre y aplique correctamente
        estado: "pendiente",
        // C2 fix: nombre canónico sesion_caja_id (no caja_sesion_id)
        sesion_caja_id: sesionCajaId,
        creado_por: userId,
        created_at: new Date().toISOString(),
      })
      .select("id");

    if (insertError) {
      console.error("Error al insertar anticipo:", insertError);
      return NextResponse.json(
        { success: false, error: "Error al registrar anticipo" },
        { status: 500 }
      );
    }

    const anticipoId = nuevoAnticipo?.[0]?.id;
    const clienteRow = orden.cliente as { nombre?: string; apellido?: string } | null;
    const clienteNombre = clienteRow
      ? `${clienteRow.nombre || ""} ${clienteRow.apellido || ""}`.trim()
      : "Cliente";

    // Determinar si el pago incluye efectivo físico (requiere traspaso sin caja)
    const incluyeEfectivo =
      metodoPago === "efectivo" ||
      (metodoPago === "mixto" &&
        desgloseMixto &&
        (parseFloat(desgloseMixto.efectivo || 0) > 0));

    if (sesionCajaId) {
      // HAY sesión activa → registrar entrada en caja_movimientos para auditoría
      try {
        await supabase.from("caja_movimientos").insert({
          sesion_id: sesionCajaId,
          tipo: tipo === "saldo_final" ? "cobro_reparacion" : "entrada_anticipo",
          monto: parseFloat(monto),
          concepto: `${tipo === "saldo_final" ? "Saldo final" : "Anticipo"} reparación ${orden.folio} (${metodoPago})`,
          referencia_id: anticipoId,
          distribuidor_id: orden.distribuidor_id || null,
        });
      } catch (cajaErr) {
        // No bloqueamos el flujo si falla el movimiento de caja
        console.error("No se pudo registrar movimiento en caja:", cajaErr);
      }
    } else if (incluyeEfectivo && anticipoId) {
      // SIN sesión y con efectivo → crear traspaso para auditoría y notificación
      try {
        await createTraspasoAnticipo({
          distribuidorId: orden.distribuidor_id || undefined,
          reparacionId: ordenId,
          anticipoId,
          tecnicoId: userId, // quién tiene el dinero
          creadoPorRol: (role ?? "vendedor") as UserRole,
          folioOrden: orden.folio,
          clienteNombre,
          montoRegistrado: parseFloat(monto),
        });
      } catch (traspasoErr) {
        // No bloqueamos el flujo; el anticipo ya quedó registrado
        console.error("No se pudo crear traspaso:", traspasoErr);
      }
    }

    // Si es saldo final y el nuevo saldo es 0 o negativo, marcar como entregado + flujo completo
    let entregado = false;
    if (tipo === "saldo_final" && nuevoSaldo <= 0) {
      const estadoAnterior = orden.estado || "listo_entrega";
      const { error: updateError } = await supabase
        .from("ordenes_reparacion")
        .update({
          estado: "entregado",
          fecha_entrega: new Date().toISOString(), // C5 fix: campo canónico fecha_entrega
          updated_at: new Date().toISOString(),
        })
        .eq("id", ordenId);

      if (updateError) {
        console.error("Error al marcar como entregada:", updateError);
      } else {
        entregado = true;
        // P2: Ejecutar flujo completo de entrega (bolsa virtual, stock, puntos, historial)
        ejecutarEntregaCompleta(
          ordenId,
          orden.folio,
          orden.distribuidor_id || null,
          orden.cliente_id || null,
          precioTotal,
          sesionCajaId,
          estadoAnterior,
          userId
        ).catch((e) => console.error("[reparacion-cobro] ejecutarEntregaCompleta falló:", e));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        anticipoId,
        nuevoSaldo: Math.max(0, nuevoSaldo),
        entregado,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/pos/reparacion-cobro:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
