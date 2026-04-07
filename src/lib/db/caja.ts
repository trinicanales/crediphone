/**
 * FASE 18: Database Layer - Caja POS
 * Funciones para gestión de sesiones de caja y movimientos
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CajaSesion, CajaMovimiento, ConteoDenominaciones, AnticipoEnSesion, TipoPago } from "@/types";

// =====================================================
// MAPPERS
// =====================================================

function mapSesionFromDB(row: any): CajaSesion {
  return {
    id: row.id,
    folio: row.folio,
    usuarioId: row.usuario_id,
    usuarioNombre: row.users?.name ?? undefined,
    montoInicial: parseFloat(row.monto_inicial),
    fechaApertura: new Date(row.fecha_apertura),
    notasApertura: row.notas_apertura,
    montoFinal: row.monto_final ? parseFloat(row.monto_final) : undefined,
    montoEsperado: row.monto_esperado ? parseFloat(row.monto_esperado) : undefined,
    diferencia: row.diferencia ? parseFloat(row.diferencia) : undefined,
    fechaCierre: row.fecha_cierre ? new Date(row.fecha_cierre) : undefined,
    notasCierre: row.notas_cierre,
    estado: row.estado,
    totalVentasEfectivo: parseFloat(row.total_ventas_efectivo || 0),
    totalVentasTransferencia: parseFloat(row.total_ventas_transferencia || 0),
    totalVentasTarjeta: parseFloat(row.total_ventas_tarjeta || 0),
    totalRetiros: parseFloat(row.total_retiros || 0),
    totalDepositos: parseFloat(row.total_depositos || 0),
    numeroVentas: row.numero_ventas || 0,
    // FASE 40: conteo ciego por denominaciones
    conteoDenominaciones: row.conteo_denominaciones ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapMovimientoFromDB(row: any): CajaMovimiento {
  return {
    id: row.id,
    sesionId: row.sesion_id,
    tipo: row.tipo,
    monto: parseFloat(row.monto),
    concepto: row.concepto,
    autorizadoPor: row.autorizado_por,
    createdAt: new Date(row.created_at),
  };
}

// =====================================================
// QUERIES - SESIONES DE CAJA
// =====================================================

/**
 * Obtiene la sesión activa de un usuario
 */
export async function getSesionActiva(usuarioId: string): Promise<CajaSesion | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("caja_sesiones")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No se encontró ninguna sesión activa
      return null;
    }
    console.error("Error fetching sesion activa:", error);
    throw new Error(`Error al obtener sesión activa: ${error.message}`);
  }

  return data ? mapSesionFromDB(data) : null;
}

/**
 * Abre una nueva sesión de caja
 */
export async function abrirCaja(
  usuarioId: string,
  montoInicial: number,
  notas?: string,
  distribuidorId?: string
): Promise<CajaSesion> {
  const supabase = createAdminClient();

  // Validar que no haya sesión activa
  const sesionActiva = await getSesionActiva(usuarioId);
  if (sesionActiva) {
    throw new Error(
      `Ya existe una sesión de caja abierta (${sesionActiva.folio}). Debe cerrarla antes de abrir una nueva.`
    );
  }

  // Insertar nueva sesión (folio se genera automáticamente por trigger)
  const { data, error } = await supabase
    .from("caja_sesiones")
    .insert({
      folio: "", // El trigger lo genera
      usuario_id: usuarioId,
      distribuidor_id: distribuidorId || null,
      monto_inicial: montoInicial,
      notas_apertura: notas || null,
      estado: "abierta",
      fecha_apertura: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error opening caja:", error);
    throw new Error(`Error al abrir caja: ${error?.message || "Unknown error"}`);
  }

  // Asociar anticipos pendientes del usuario que quedaron sin sesión
  // (registrados cuando la caja estaba cerrada — se suman automáticamente al abrir)
  try {
    const nuevaSesionId = data.id;
    await supabase
      .from("anticipos_reparacion")
      .update({ sesion_caja_id: nuevaSesionId })
      .eq("recibido_por", usuarioId)
      .is("sesion_caja_id", null)
      .eq("tipo_pago", "efectivo")
      .neq("estado", "devuelto");
  } catch {
    // No bloquear la apertura de caja si falla la asociación de anticipos
    console.warn("[Caja] No se pudieron asociar anticipos pendientes al abrir sesión");
  }

  return mapSesionFromDB(data);
}

/**
 * Cierra una sesión de caja
 * FASE 40: acepta conteo ciego por denominaciones y genera alerta si hay descuadre
 */
export async function cerrarCaja(
  sesionId: string,
  montoFinal: number,
  notas?: string,
  conteoDenominaciones?: ConteoDenominaciones
): Promise<CajaSesion & { payjoyStats?: { totalPagosPayjoy: number; montoTotalPayjoy: number; desglosePagos: Array<{ pagoId: string; transactionId: string; clienteNombre: string; monto: number; payjoyPaymentMethod: string; hora: Date }> } }> {
  const supabase = createAdminClient();

  // 1. Obtener sesión actual
  const { data: sesionData, error: sesionError } = await supabase
    .from("caja_sesiones")
    .select("*")
    .eq("id", sesionId)
    .single();

  if (sesionError || !sesionData) {
    console.error("Error fetching sesion:", sesionError);
    throw new Error(`Error al obtener sesión: ${sesionError?.message || "Unknown error"}`);
  }

  if (sesionData.estado === "cerrada") {
    throw new Error("La sesión ya está cerrada");
  }

  // 2. Calcular totales de ventas POS por método de pago
  const { data: ventasData } = await supabase
    .from("ventas")
    .select("metodo_pago, total, desglose_mixto")
    .eq("sesion_caja_id", sesionId)
    .eq("estado", "completada");

  let totalVentasEfectivo = 0;
  let totalVentasTransferencia = 0;
  let totalVentasTarjeta = 0;
  const numeroVentas = ventasData?.length || 0;

  (ventasData || []).forEach((venta: any) => {
    const total = parseFloat(venta.total);
    switch (venta.metodo_pago) {
      case "efectivo":
        totalVentasEfectivo += total;
        break;
      case "transferencia":
        totalVentasTransferencia += total;
        break;
      case "tarjeta":
        totalVentasTarjeta += total;
        break;
      case "mixto":
        if (venta.desglose_mixto) {
          totalVentasEfectivo += parseFloat(venta.desglose_mixto.efectivo || 0);
          totalVentasTransferencia += parseFloat(venta.desglose_mixto.transferencia || 0);
          totalVentasTarjeta += parseFloat(venta.desglose_mixto.tarjeta || 0);
        }
        break;
    }
  });

  // 2b. FASE 28: Sumar pagos presenciales de créditos Payjoy al turno
  // metodo_pago_tienda indica cómo pagó físicamente el cliente en tienda
  // (efectivo → va a la gaveta; tarjeta/transferencia → no en gaveta)
  try {
    const { data: pagosPayjoyTurno } = await supabase
      .from("pagos")
      .select("monto, metodo_pago_tienda")
      .eq("metodo_pago", "payjoy")
      .gte("fecha_pago", sesionData.fecha_apertura.split("T")[0])
      .lte("fecha_pago", new Date().toISOString().split("T")[0]);

    (pagosPayjoyTurno || []).forEach((p: any) => {
      const monto = parseFloat(p.monto || 0);
      const metodo = p.metodo_pago_tienda || "efectivo";
      switch (metodo) {
        case "tarjeta":
          totalVentasTarjeta += monto;
          break;
        case "transferencia":
          totalVentasTransferencia += monto;
          break;
        default: // efectivo
          totalVentasEfectivo += monto;
          break;
      }
    });
  } catch {
    // No interrumpir cierre de caja si falla la suma de pagos Payjoy
    console.warn("[Caja] No se pudieron sumar pagos Payjoy al turno");
  }

  // 3. Calcular totales de movimientos
  const { data: movimientosData } = await supabase
    .from("caja_movimientos")
    .select("tipo, monto")
    .eq("sesion_id", sesionId);

  let totalDepositos = 0;
  let totalRetiros = 0;

  (movimientosData || []).forEach((mov: any) => {
    const monto = parseFloat(mov.monto);
    // NOTA: entrada_anticipo y devolucion_anticipo se excluyen aquí porque los anticipos
    // de reparación se calculan en el paso 3b directamente desde anticipos_reparacion
    // (fuente de verdad). Incluirlos aquí causaría doble conteo en el cuadre.
    if (mov.tipo === "deposito" || mov.tipo === "pay_in") {
      totalDepositos += monto;
    } else if (mov.tipo === "retiro" || mov.tipo === "pay_out") {
      totalRetiros += monto;
    }
  });

  // 3b. Anticipos de reparación en EFECTIVO de esta sesión
  // Fuente de verdad: anticipos_reparacion (no caja_movimientos).
  // Se excluyen los devueltos para obtener el neto real en la caja.
  let totalAnticipsEfectivo = 0;
  try {
    const { data: anticipsData } = await supabase
      .from("anticipos_reparacion")
      .select("monto")
      .eq("sesion_caja_id", sesionId)
      .eq("tipo_pago", "efectivo")
      .neq("estado", "devuelto");

    totalAnticipsEfectivo = (anticipsData || []).reduce(
      (sum: number, a: any) => sum + parseFloat(a.monto || 0), 0
    );
  } catch {
    console.warn("[Caja] No se pudieron sumar anticipos de reparación al cuadre");
  }

  // 4. Calcular monto esperado y diferencia
  // Efectivo esperado = Inicial + Ventas efectivo + Anticipos rep. efectivo + Pay In - Retiros - Pay Out
  const montoInicial = parseFloat(sesionData.monto_inicial);
  const montoEsperado =
    montoInicial + totalVentasEfectivo + totalAnticipsEfectivo + totalDepositos - totalRetiros;
  const diferencia = montoFinal - montoEsperado;

  // 5. Actualizar sesión
  const { data: updatedData, error: updateError } = await supabase
    .from("caja_sesiones")
    .update({
      monto_final: montoFinal,
      monto_esperado: montoEsperado,
      diferencia,
      fecha_cierre: new Date().toISOString(),
      notas_cierre: notas || null,
      estado: "cerrada",
      total_ventas_efectivo: totalVentasEfectivo,
      total_ventas_transferencia: totalVentasTransferencia,
      total_ventas_tarjeta: totalVentasTarjeta,
      total_retiros: totalRetiros,
      total_depositos: totalDepositos,
      numero_ventas: numeroVentas,
      // FASE 40: guardar conteo por denominaciones
      conteo_denominaciones: conteoDenominaciones ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sesionId)
    .select()
    .single();

  if (updateError || !updatedData) {
    console.error("Error closing caja:", updateError);
    throw new Error(`Error al cerrar caja: ${updateError?.message || "Unknown error"}`);
  }

  // 6. FASE 40: Alerta de descuadre si la diferencia excede la tolerancia configurada
  try {
    // Obtener tolerancia del distribuidor
    let tolerancia = 0;
    if (sesionData.distribuidor_id) {
      const { data: configData } = await supabase
        .from("configuracion")
        .select("tolerancia_descuadre")
        .eq("distribuidor_id", sesionData.distribuidor_id)
        .single();
      tolerancia = parseFloat(configData?.tolerancia_descuadre ?? 0);
    }

    if (Math.abs(diferencia) > tolerancia) {
      // Crear notificación para admin/super_admin del distribuidor
      await supabase.from("notificaciones").insert({
        tipo: "descuadre_caja",
        titulo: "⚠️ Descuadre de caja detectado",
        mensaje: `Sesión ${sesionData.folio}: diferencia de $${diferencia.toFixed(2)} (esperado $${montoEsperado.toFixed(2)}, declarado $${montoFinal.toFixed(2)})`,
        severidad: "alta",
        distribuidor_id: sesionData.distribuidor_id || null,
        metadata: {
          sesion_id: sesionId,
          folio: sesionData.folio,
          empleado_id: sesionData.usuario_id,
          monto_esperado: montoEsperado,
          monto_declarado: montoFinal,
          diferencia,
          tolerancia,
        },
        leida: false,
        created_at: new Date().toISOString(),
      });
    }
  } catch (alertError) {
    // No fallar el cierre de caja si falla la creación de alerta
    console.warn("[Caja] No se pudo crear alerta de descuadre:", alertError);
  }

  // 7. FASE 20: Consultar pagos Payjoy del turno (informativo)
  let payjoyStats = undefined;
  try {
    const { data: pagosPayjoy } = await supabase
      .from("pagos")
      .select("id, monto, fecha_pago, payjoy_transaction_id, payjoy_payment_method, payjoy_customer_name")
      .eq("metodo_pago", "payjoy")
      .gte("fecha_pago", sesionData.fecha_apertura)
      .lte("fecha_pago", new Date().toISOString());

    if (pagosPayjoy && pagosPayjoy.length > 0) {
      payjoyStats = {
        totalPagosPayjoy: pagosPayjoy.length,
        montoTotalPayjoy: pagosPayjoy.reduce(
          (sum: number, p: any) => sum + parseFloat(p.monto || 0),
          0
        ),
        desglosePagos: pagosPayjoy.map((p: any) => ({
          pagoId: p.id,
          transactionId: p.payjoy_transaction_id || "N/A",
          clienteNombre: p.payjoy_customer_name || "Desconocido",
          monto: parseFloat(p.monto),
          payjoyPaymentMethod: p.payjoy_payment_method || "N/A",
          hora: new Date(p.fecha_pago),
        })),
      };
    }
  } catch (payjoyError) {
    // No fallar el cierre de caja si falla la consulta de Payjoy
    console.error("Error consultando pagos Payjoy:", payjoyError);
  }

  return { ...mapSesionFromDB(updatedData), payjoyStats };
}

/**
 * Obtiene el historial de sesiones de caja
 */
export async function getSesionesCaja(limit = 50, distribuidorId?: string): Promise<CajaSesion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("caja_sesiones")
    .select("*, users!caja_sesiones_usuario_id_fkey(name)")
    .order("fecha_apertura", { ascending: false })
    .limit(limit);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching sesiones:", error);
    throw new Error(`Error al obtener sesiones: ${error.message}`);
  }

  return (data || []).map(mapSesionFromDB);
}

// =====================================================
// QUERIES - MOVIMIENTOS DE CAJA
// =====================================================

/**
 * Agrega un movimiento de caja (depósito o retiro)
 */
export async function agregarMovimientoCaja(
  sesionId: string,
  tipo: "deposito" | "retiro" | "pay_in" | "pay_out",
  monto: number,
  concepto: string,
  autorizadoPor?: string
): Promise<CajaMovimiento> {
  const supabase = createAdminClient();

  // Validar que la sesión esté abierta
  const { data: sesionData, error: sesionError } = await supabase
    .from("caja_sesiones")
    .select("estado")
    .eq("id", sesionId)
    .single();

  if (sesionError || !sesionData) {
    throw new Error("Sesión de caja no encontrada");
  }

  if (sesionData.estado !== "abierta") {
    throw new Error("No se pueden agregar movimientos a una sesión cerrada");
  }

  // Insertar movimiento
  const { data, error } = await supabase
    .from("caja_movimientos")
    .insert({
      sesion_id: sesionId,
      tipo,
      monto,
      concepto,
      autorizado_por: autorizadoPor || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating movimiento:", error);
    throw new Error(`Error al crear movimiento: ${error?.message || "Unknown error"}`);
  }

  return mapMovimientoFromDB(data);
}

/**
 * Obtiene los movimientos de una sesión
 */
export async function getMovimientosSesion(sesionId: string): Promise<CajaMovimiento[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("caja_movimientos")
    .select("*")
    .eq("sesion_id", sesionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching movimientos:", error);
    throw new Error(`Error al obtener movimientos: ${error.message}`);
  }

  return (data || []).map(mapMovimientoFromDB);
}

// =====================================================
// FASE 41: Bolsa virtual de reparaciones en caja
// =====================================================

/**
 * Obtiene los anticipos de reparación registrados en una sesión de caja.
 * Enriquece cada anticipo con datos de la orden y el cliente.
 */
export async function getAnticiposBySesion(sesionId: string): Promise<AnticipoEnSesion[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("anticipos_reparacion")
    .select(`
      id,
      monto,
      tipo_pago,
      fecha_anticipo,
      estado,
      orden:ordenes_reparacion (
        id,
        folio,
        problema_reportado,
        estado,
        cliente:clientes ( nombre, apellido )
      ),
      empleado:users!recibido_por ( name )
    `)
    .eq("sesion_caja_id", sesionId)
    .neq("estado", "devuelto")
    .order("fecha_anticipo", { ascending: true });

  if (error) {
    console.error("Error fetching anticipos by sesion:", error);
    throw new Error(`Error al obtener anticipos de sesión: ${error.message}`);
  }

  return (data || []).map((row: any) => {
    const orden = row.orden;
    const cliente = orden?.cliente;
    const empleado = row.empleado;
    return {
      id: row.id,
      monto: parseFloat(row.monto),
      tipoPago: row.tipo_pago as TipoPago,
      fechaAnticipo: new Date(row.fecha_anticipo),
      estado: row.estado,
      folioOrden: orden?.folio || "Sin folio",
      descripcionProblema: orden?.problema_reportado || undefined,
      ordenId: orden?.id || "",
      ordenEstado: orden?.estado || undefined,
      ordenEntregada: orden?.estado === "entregado",
      clienteNombre: cliente
        ? [cliente.nombre, cliente.apellido].filter(Boolean).join(" ")
        : "Cliente",
      empleadoNombre: empleado?.name || undefined,
      registradoEnCaja: true,
    } satisfies AnticipoEnSesion;
  });
}

/**
 * Obtiene anticipos de reparación en efectivo que NO tienen sesión de caja asignada.
 * Estos son potenciales registros de fraude — dinero recibido sin pasar por caja.
 * Filtra por distribuidor_id del distribuidor de la orden.
 */
export async function getAnticiposSinSesion(distribuidorId?: string): Promise<AnticipoEnSesion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("anticipos_reparacion")
    .select(`
      id,
      monto,
      tipo_pago,
      fecha_anticipo,
      estado,
      orden:ordenes_reparacion (
        id,
        folio,
        problema_reportado,
        distribuidor_id,
        cliente:clientes ( nombre, apellido )
      ),
      empleado:users!recibido_por ( name )
    `)
    .is("sesion_caja_id", null)
    .eq("tipo_pago", "efectivo")
    .neq("estado", "devuelto")
    .order("fecha_anticipo", { ascending: false })
    .limit(100);

  // Filtrar por distribuidor si se proporciona
  // (el distribuidor_id está en la orden, no en el anticipo)
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching anticipos sin sesion:", error);
    throw new Error(`Error al obtener anticipos sin sesión: ${error.message}`);
  }

  return (data || [])
    .filter((row: any) => {
      if (!distribuidorId) return true;
      return row.orden?.distribuidor_id === distribuidorId;
    })
    .map((row: any) => {
      const orden = row.orden;
      const cliente = orden?.cliente;
      const empleado = row.empleado;
      return {
        id: row.id,
        monto: parseFloat(row.monto),
        tipoPago: row.tipo_pago as TipoPago,
        fechaAnticipo: new Date(row.fecha_anticipo),
        estado: row.estado,
        folioOrden: orden?.folio || "Sin folio",
        descripcionProblema: orden?.problema_reportado || undefined,
        ordenId: orden?.id || "",
        clienteNombre: cliente
          ? [cliente.nombre, cliente.apellido].filter(Boolean).join(" ")
          : "Cliente",
        empleadoNombre: empleado?.name || undefined,
        registradoEnCaja: false,
      } satisfies AnticipoEnSesion;
    });
}
