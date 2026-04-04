import { createAdminClient } from "@/lib/supabase/admin";
import type { Credito } from "@/types";

export async function getCreditos(distribuidorId?: string): Promise<Credito[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("creditos")
    .select("*, distribuidor:distribuidores(nombre)")
    .order("created_at", { ascending: false });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Flatten distribuidor.nombre → distribuidorNombre (BUG-003)
  return (data || []).map((row: any) => ({
    ...row,
    distribuidorNombre: row.distribuidor?.nombre || undefined,
    distribuidor: undefined,
  })) as Credito[];
}

export async function getCreditoById(id: string, distribuidorId?: string): Promise<Credito | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from("creditos")
    .select("*")
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Credito;
}

export async function getCreditosByCliente(clienteId: string, distribuidorId?: string): Promise<Credito[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("creditos")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Credito[];
}

export async function getCreditosActivos(distribuidorId?: string): Promise<Credito[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("creditos")
    .select("*")
    .eq("estado", "activo")
    .order("created_at", { ascending: false });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Credito[];
}

export async function createCredito(credito: Omit<Credito, "id" | "createdAt" | "updatedAt">): Promise<Credito> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creditos")
    .insert({
      distribuidor_id: credito.distribuidorId, // FASE 21
      cliente_id: credito.clienteId,
      monto: credito.monto,
      monto_original: credito.montoOriginal,
      enganche: credito.enganche ?? 0,
      enganche_porcentaje: credito.enganchePorcentaje ?? 10,
      plazo: credito.plazo,
      tasa_interes: credito.tasaInteres,
      frecuencia_pago: credito.frecuenciaPago ?? "quincenal",
      monto_pago: credito.montoPago,
      pago_quincenal: credito.pagoQuincenal,
      fecha_inicio: credito.fechaInicio,
      fecha_fin: credito.fechaFin,
      estado: credito.estado,
      dias_mora: credito.diasMora ?? 0,
      monto_mora: credito.montoMora ?? 0,
      tasa_mora_diaria: credito.tasaMoraDiaria ?? 50,
      vendedor_id: credito.vendedorId,
      productos_ids: credito.productosIds ? JSON.stringify(credito.productosIds) : null,
      firma_cliente: credito.firmaCliente,
      tipo_firma: credito.tipoFirma,
      fecha_firma: credito.fechaFirma,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Credito;
}

export async function updateCredito(id: string, credito: Partial<Credito>, distribuidorId?: string): Promise<Credito> {
  const supabase = createAdminClient();

  // Mapear campos de camelCase a snake_case para la DB
  const updateData: Record<string, any> = {};

  if (credito.clienteId !== undefined) updateData.cliente_id = credito.clienteId;
  if (credito.monto !== undefined) updateData.monto = credito.monto;
  if (credito.montoOriginal !== undefined) updateData.monto_original = credito.montoOriginal;
  if (credito.enganche !== undefined) updateData.enganche = credito.enganche;
  if (credito.enganchePorcentaje !== undefined) updateData.enganche_porcentaje = credito.enganchePorcentaje;
  if (credito.plazo !== undefined) updateData.plazo = credito.plazo;
  if (credito.tasaInteres !== undefined) updateData.tasa_interes = credito.tasaInteres;
  if (credito.frecuenciaPago !== undefined) updateData.frecuencia_pago = credito.frecuenciaPago;
  if (credito.montoPago !== undefined) updateData.monto_pago = credito.montoPago;
  if (credito.pagoQuincenal !== undefined) updateData.pago_quincenal = credito.pagoQuincenal;
  if (credito.fechaInicio !== undefined) updateData.fecha_inicio = credito.fechaInicio;
  if (credito.fechaFin !== undefined) updateData.fecha_fin = credito.fechaFin;
  if (credito.estado !== undefined) updateData.estado = credito.estado;
  if (credito.diasMora !== undefined) updateData.dias_mora = credito.diasMora;
  if (credito.montoMora !== undefined) updateData.monto_mora = credito.montoMora;
  if (credito.tasaMoraDiaria !== undefined) updateData.tasa_mora_diaria = credito.tasaMoraDiaria;
  if (credito.vendedorId !== undefined) updateData.vendedor_id = credito.vendedorId;
  if (credito.productosIds !== undefined) updateData.productos_ids = credito.productosIds ? JSON.stringify(credito.productosIds) : null;
  if (credito.firmaCliente !== undefined) updateData.firma_cliente = credito.firmaCliente;
  if (credito.tipoFirma !== undefined) updateData.tipo_firma = credito.tipoFirma;
  if (credito.fechaFirma !== undefined) updateData.fecha_firma = credito.fechaFirma;
  // Payjoy fields
  if (credito.payjoyFinanceOrderId !== undefined) updateData.payjoy_finance_order_id = credito.payjoyFinanceOrderId;
  if (credito.payjoyCustomerId !== undefined) updateData.payjoy_customer_id = credito.payjoyCustomerId;
  if (credito.payjoySyncEnabled !== undefined) updateData.payjoy_sync_enabled = credito.payjoySyncEnabled;
  if (credito.payjoyLastSyncAt !== undefined) updateData.payjoy_last_sync_at = credito.payjoyLastSyncAt;

  let query = supabase
    .from("creditos")
    .update(updateData)
    .eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query
    .select()
    .single();

  if (error) throw error;
  return data as Credito;
}

export async function calcularTotalPagado(creditoId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("total_pagado", {
    credito_uuid: creditoId,
  });

  if (error) throw error;
  return data as number;
}

export async function calcularSaldoPendiente(creditoId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("saldo_pendiente", {
    credito_uuid: creditoId,
  });

  if (error) throw error;
  return data as number;
}

export async function deleteCredito(id: string, distribuidorId?: string): Promise<void> {
  const supabase = createAdminClient();
  let query = supabase.from("creditos").delete().eq("id", id);

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { error } = await query;
  if (error) throw error;
}

// =====================================================
// SISTEMA DE MORA AUTOMÁTICA
// =====================================================

/**
 * Genera el calendario de fechas de pago para un crédito
 */
function generarFechasPago(
  fechaInicio: Date,
  frecuenciaPago: string,
  plazo: number
): Date[] {
  const fechas: Date[] = [];
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);

  let totalPagos: number;
  switch (frecuenciaPago) {
    case "semanal":    totalPagos = plazo * 4; break;
    case "quincenal":  totalPagos = plazo * 2; break;
    case "mensual":
    default:           totalPagos = plazo;      break;
  }

  for (let i = 1; i <= totalPagos; i++) {
    const fecha = new Date(inicio);
    if (frecuenciaPago === "mensual") {
      fecha.setMonth(inicio.getMonth() + i);
    } else if (frecuenciaPago === "quincenal") {
      fecha.setDate(inicio.getDate() + 15 * i);
    } else {
      fecha.setDate(inicio.getDate() + 7 * i);
    }
    fecha.setHours(0, 0, 0, 0);
    fechas.push(fecha);
  }

  return fechas;
}

export interface ResultadoMoraCredito {
  creditoId: string;
  diasMoraAnterior: number;
  diasMoraNuevo: number;
  montoMoraAnterior: number;
  montoMoraNuevo: number;
  estadoAnterior: string;
  estadoNuevo: string;
}

export interface ResultadoRecalculo {
  total: number;
  actualizados: number;
  enMora: number;
  sinMora: number;
  cambios: ResultadoMoraCredito[];
  fechaCalculo: Date;
}

export interface CreditoCarteraVencida {
  id: string;
  folio?: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  monto: number;
  totalPagado: number;
  saldoPendiente: number;
  pagoQuincenal: number;
  frecuenciaPago: string;
  plazo: number;
  diasMora: number;
  montoMora: number;
  tasaMoraDiaria: number;
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  nivelRiesgo: "bajo" | "medio" | "alto" | "critico";
}

/**
 * Recalcula dias_mora y monto_mora para TODOS los créditos activos/vencidos.
 * Lógica:
 *   1. Genera el calendario de pagos según frecuencia y plazo
 *   2. Compara con pagos reales acumulados
 *   3. Determina la primera fecha de pago incumplida
 *   4. dias_mora = días desde esa fecha
 *   5. monto_mora = dias_mora × tasa_mora_diaria
 *   6. Si el crédito está past fechaFin y sin saldar → cambia a 'vencido'
 */
export async function recalcularTodasLasMoras(
  distribuidorId?: string
): Promise<ResultadoRecalculo> {
  const supabase = createAdminClient();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Obtener todos los créditos activos y vencidos
  let creditosQuery = supabase
    .from("creditos")
    .select(`
      id, folio, monto, pago_quincenal, frecuencia_pago, plazo,
      fecha_inicio, fecha_fin, estado, dias_mora, monto_mora, tasa_mora_diaria,
      cliente_id
    `)
    .in("estado", ["activo", "vencido"]);

  if (distribuidorId) {
    creditosQuery = creditosQuery.eq("distribuidor_id", distribuidorId);
  }

  const { data: creditos, error: creditosError } = await creditosQuery;
  if (creditosError) throw new Error(creditosError.message);
  if (!creditos || creditos.length === 0) {
    return { total: 0, actualizados: 0, enMora: 0, sinMora: 0, cambios: [], fechaCalculo: hoy };
  }

  // Obtener totales pagados para todos los créditos de un jalón
  const creditoIds = creditos.map((c: any) => c.id);
  const { data: pagosData, error: pagosError } = await supabase
    .from("pagos")
    .select("credito_id, monto")
    .in("credito_id", creditoIds)
    .not("estado", "eq", "cancelado");

  if (pagosError) throw new Error(pagosError.message);

  // Agrupar pagos por crédito
  const pagosMap: Record<string, number> = {};
  for (const pago of pagosData || []) {
    pagosMap[pago.credito_id] = (pagosMap[pago.credito_id] || 0) + Number(pago.monto);
  }

  const cambios: ResultadoMoraCredito[] = [];
  let enMora = 0;
  let sinMora = 0;

  for (const credito of creditos) {
    const totalPagado = pagosMap[credito.id] || 0;
    const pagoQuincenal = Number(credito.pago_quincenal) || 1;
    const tasaMoraDiaria = Number(credito.tasa_mora_diaria) || 50;
    const fechaInicio = new Date(credito.fecha_inicio);
    const fechaFin = new Date(credito.fecha_fin);
    fechaInicio.setHours(0, 0, 0, 0);
    fechaFin.setHours(0, 0, 0, 0);

    // Generar calendario de pagos
    const calendario = generarFechasPago(
      fechaInicio,
      credito.frecuencia_pago || "quincenal",
      credito.plazo
    );

    // Fechas vencidas hasta hoy
    const fechasVencidas = calendario.filter((f) => f <= hoy);

    let nuevoDiasMora = 0;

    if (fechasVencidas.length > 0) {
      const expectedAmount = fechasVencidas.length * pagoQuincenal;

      if (totalPagado < expectedAmount) {
        // Calcular cuántos pagos fueron cubiertos
        const pagosCubiertos = Math.min(
          Math.floor(totalPagado / pagoQuincenal),
          fechasVencidas.length - 1
        );

        // Primera fecha incumplida
        const primeraFechaMissed = fechasVencidas[pagosCubiertos];
        nuevoDiasMora = Math.max(
          0,
          Math.floor((hoy.getTime() - primeraFechaMissed.getTime()) / (1000 * 60 * 60 * 24))
        );
      }
    }

    const nuevoMontoMora = nuevoDiasMora * tasaMoraDiaria;

    // Determinar nuevo estado
    let nuevoEstado = credito.estado;
    if (nuevoDiasMora > 0 && hoy > fechaFin) {
      nuevoEstado = "vencido";
    } else if (nuevoDiasMora === 0 && credito.estado === "vencido") {
      // Si se puso al corriente, vuelve a activo
      nuevoEstado = "activo";
    }

    // Solo actualizar si hay cambio
    const diasMoraAnterior = Number(credito.dias_mora) || 0;
    const montoMoraAnterior = Number(credito.monto_mora) || 0;

    if (
      nuevoDiasMora !== diasMoraAnterior ||
      Math.abs(nuevoMontoMora - montoMoraAnterior) > 0.01 ||
      nuevoEstado !== credito.estado
    ) {
      await supabase
        .from("creditos")
        .update({
          dias_mora: nuevoDiasMora,
          monto_mora: nuevoMontoMora,
          estado: nuevoEstado,
        })
        .eq("id", credito.id);

      cambios.push({
        creditoId: credito.id,
        diasMoraAnterior,
        diasMoraNuevo: nuevoDiasMora,
        montoMoraAnterior,
        montoMoraNuevo: nuevoMontoMora,
        estadoAnterior: credito.estado,
        estadoNuevo: nuevoEstado,
      });
    }

    if (nuevoDiasMora > 0) enMora++;
    else sinMora++;
  }

  return {
    total: creditos.length,
    actualizados: cambios.length,
    enMora,
    sinMora,
    cambios,
    fechaCalculo: hoy,
  };
}

/**
 * Obtiene el reporte de cartera vencida (créditos con mora > 0)
 * con datos del cliente e indicador de nivel de riesgo
 */
export async function getCarteraVencida(
  distribuidorId?: string
): Promise<CreditoCarteraVencida[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("creditos")
    .select(`
      id, folio, cliente_id, monto, pago_quincenal, frecuencia_pago, plazo,
      fecha_inicio, fecha_fin, estado, dias_mora, monto_mora, tasa_mora_diaria,
      clientes(nombre, apellido, telefono)
    `)
    .gt("dias_mora", 0)
    .in("estado", ["activo", "vencido"])
    .order("dias_mora", { ascending: false });

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Obtener pagos totales por crédito
  const ids = (data || []).map((c: any) => c.id);
  let pagosMap: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: pagosData } = await supabase
      .from("pagos")
      .select("credito_id, monto")
      .in("credito_id", ids)
      .not("estado", "eq", "cancelado");

    for (const p of pagosData || []) {
      pagosMap[p.credito_id] = (pagosMap[p.credito_id] || 0) + Number(p.monto);
    }
  }

  return (data || []).map((c: any) => {
    const diasMora = Number(c.dias_mora) || 0;
    const totalPagado = pagosMap[c.id] || 0;
    const monto = Number(c.monto) || 0;
    const saldoPendiente = Math.max(0, monto - totalPagado);

    let nivelRiesgo: CreditoCarteraVencida["nivelRiesgo"] = "bajo";
    if (diasMora > 60) nivelRiesgo = "critico";
    else if (diasMora > 30) nivelRiesgo = "alto";
    else if (diasMora > 7) nivelRiesgo = "medio";

    const cliente = c.clientes || {};
    return {
      id: c.id,
      folio: c.folio,
      clienteId: c.cliente_id,
      clienteNombre: `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim() || "Sin nombre",
      clienteTelefono: cliente.telefono || "",
      monto,
      totalPagado,
      saldoPendiente,
      pagoQuincenal: Number(c.pago_quincenal) || 0,
      frecuenciaPago: c.frecuencia_pago || "quincenal",
      plazo: c.plazo,
      diasMora,
      montoMora: Number(c.monto_mora) || 0,
      tasaMoraDiaria: Number(c.tasa_mora_diaria) || 50,
      fechaInicio: new Date(c.fecha_inicio),
      fechaFin: new Date(c.fecha_fin),
      estado: c.estado,
      nivelRiesgo,
    };
  });
}
