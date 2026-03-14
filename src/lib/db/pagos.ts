import { createAdminClient } from "@/lib/supabase/admin";
import type { Pago } from "@/types";

/**
 * Helper: returns credito IDs belonging to a distribuidor.
 * Used to scope pagos (which are linked to creditos via credito_id).
 */
async function getCreditoIdsByDistribuidor(distribuidorId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("creditos")
    .select("id")
    .eq("distribuidor_id", distribuidorId);
  return (data || []).map((c: any) => c.id);
}

export async function getPagos(distribuidorId?: string): Promise<Pago[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("pagos")
    .select("*")
    .order("fecha_pago", { ascending: false });

  if (distribuidorId) {
    const creditoIds = await getCreditoIdsByDistribuidor(distribuidorId);
    if (creditoIds.length === 0) return [];
    query = query.in("credito_id", creditoIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Pago[];
}

export async function getPagosByCredito(creditoId: string): Promise<Pago[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("credito_id", creditoId)
    .order("fecha_pago", { ascending: false });

  if (error) throw error;
  return data as Pago[];
}

export async function getPagosDelDia(distribuidorId?: string): Promise<Pago[]> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("pagos")
    .select("*")
    .eq("fecha_pago", today)
    .order("created_at", { ascending: false });

  if (distribuidorId) {
    const creditoIds = await getCreditoIdsByDistribuidor(distribuidorId);
    if (creditoIds.length === 0) return [];
    query = query.in("credito_id", creditoIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Pago[];
}

export async function getTotalPagosDelDia(distribuidorId?: string): Promise<number> {
  const pagos = await getPagosDelDia(distribuidorId);
  return pagos.reduce((sum, pago) => sum + parseFloat(pago.monto.toString()), 0);
}

export async function getPagoById(id: string): Promise<Pago | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Pago;
}

export async function createPago(pago: Omit<Pago, "id" | "createdAt">): Promise<Pago> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pagos")
    .insert({
      credito_id: pago.creditoId,
      monto: pago.monto,
      fecha_pago: pago.fechaPago,
      metodo_pago: pago.metodoPago,
      referencia: pago.referencia,
      detalle_pago: pago.detallePago,
      cobrador_id: pago.cobradorId,
      // FASE 28: método real en tienda para cuadre de caja (pagos Payjoy)
      metodo_pago_tienda: pago.metodoPagoTienda ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Pago;
}

export async function updatePago(id: string, pago: Partial<Omit<Pago, "id" | "createdAt">>): Promise<Pago> {
  const supabase = createAdminClient();
  const updateData: Record<string, any> = {};

  if (pago.creditoId !== undefined) updateData.credito_id = pago.creditoId;
  if (pago.monto !== undefined) updateData.monto = pago.monto;
  if (pago.fechaPago !== undefined) updateData.fecha_pago = pago.fechaPago;
  if (pago.metodoPago !== undefined) updateData.metodo_pago = pago.metodoPago;
  if (pago.referencia !== undefined) updateData.referencia = pago.referencia;
  if (pago.detallePago !== undefined) updateData.detalle_pago = pago.detallePago;
  if (pago.cobradorId !== undefined) updateData.cobrador_id = pago.cobradorId;
  if (pago.metodoPagoTienda !== undefined) updateData.metodo_pago_tienda = pago.metodoPagoTienda;

  const { data, error } = await supabase
    .from("pagos")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Pago;
}

export async function deletePago(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("pagos").delete().eq("id", id);

  if (error) throw error;
}
