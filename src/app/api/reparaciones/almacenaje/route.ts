/**
 * GET  /api/reparaciones/almacenaje
 * Lista órdenes en estado listo_entrega con días transcurridos e historial de recordatorios.
 *
 * POST /api/reparaciones/almacenaje
 * Registra un recordatorio enviado manualmente.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

function rangoAlmacenaje(dias: number): "ok" | "aviso_15" | "cobro_30" | "urgente_60" | "disposicion_90" {
  if (dias >= 90) return "disposicion_90";
  if (dias >= 60) return "urgente_60";
  if (dias >= 30) return "cobro_30";
  if (dias >= 15) return "aviso_15";
  return "ok";
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const supabase = createAdminClient();

    // Órdenes en listo_entrega
    let q = supabase
      .from("ordenes_reparacion")
      .select(`
        id, folio, estado, tecnico_id,
        cliente:clientes(nombre, apellido, telefono),
        fecha_recepcion,
        updated_at
      `)
      .eq("estado", "listo_entrega")
      .order("updated_at", { ascending: true });

    if (!isSuperAdmin && distribuidorId) {
      q = q.eq("distribuidor_id", distribuidorId);
    }

    const { data: ordenes, error } = await q;
    if (error) throw error;

    // Nombres de técnicos (la orden solo guarda tecnico_id)
    const tecnicoIds = [...new Set((ordenes ?? []).map((o: any) => o.tecnico_id).filter(Boolean))];
    const tecnicoNombres = new Map<string, string>();
    if (tecnicoIds.length > 0) {
      const { data: tecs } = await supabase.from("users").select("id, name").in("id", tecnicoIds);
      for (const t of tecs ?? []) tecnicoNombres.set(t.id, t.name);
    }

    // Encontrar cuándo entraron en listo_entrega para cada orden
    const ordenIds = (ordenes ?? []).map((o: any) => o.id);

    // Historial de cambios de estado
    const { data: historialData } = await supabase
      .from("historial_estado_orden")
      .select("orden_id, created_at")
      .in("orden_id", ordenIds)
      .eq("estado_nuevo", "listo_entrega")
      .order("created_at", { ascending: false });

    // Última vez que entraron en listo_entrega por orden_id
    const fechaListoMap: Record<string, string> = {};
    for (const h of historialData ?? []) {
      if (!fechaListoMap[h.orden_id]) {
        fechaListoMap[h.orden_id] = h.created_at;
      }
    }

    // Recordatorios enviados para estas órdenes
    const { data: recordatoriosData } = await supabase
      .from("recordatorios_enviados")
      .select("id, orden_id, tipo, dias_transcurridos, enviado_en, canal, resultado")
      .in("orden_id", ordenIds)
      .order("enviado_en", { ascending: false });

    // Agrupar recordatorios por orden
    const recordatoriosPorOrden: Record<string, any[]> = {};
    for (const r of recordatoriosData ?? []) {
      if (!recordatoriosPorOrden[r.orden_id]) recordatoriosPorOrden[r.orden_id] = [];
      recordatoriosPorOrden[r.orden_id].push(r);
    }

    // Tarifa de almacenaje del distribuidor
    let tarifaDiaria = 30; // fallback
    if (distribuidorId) {
      const { data: config } = await supabase
        .from("configuracion")
        .select("tarifa_almacenaje_diaria")
        .eq("distribuidor_id", distribuidorId)
        .maybeSingle();
      if (config?.tarifa_almacenaje_diaria) {
        tarifaDiaria = parseFloat(config.tarifa_almacenaje_diaria);
      }
    }

    const result = (ordenes ?? []).map((o: any) => {
      const fechaListo = fechaListoMap[o.id] ?? o.updated_at;
      const dias = diasDesde(fechaListo);
      const rango = rangoAlmacenaje(dias);
      const cobro = dias > 30 ? (dias - 30) * tarifaDiaria : 0;

      return {
        id: o.id,
        folio: o.folio,
        clienteNombre: [o.cliente?.nombre, o.cliente?.apellido].filter(Boolean).join(" ") || "—",
        clienteTelefono: o.cliente?.telefono,
        tecnicoNombre: o.tecnico_id ? tecnicoNombres.get(o.tecnico_id) ?? null : null,
        fechaListo,
        diasTranscurridos: dias,
        rango,
        cobroPendiente: cobro,
        tarifaDiaria,
        recordatorios: recordatoriosPorOrden[o.id] ?? [],
      };
    });

    // Ordenar: más días primero
    result.sort((a: any, b: any) => b.diasTranscurridos - a.diasTranscurridos);

    return NextResponse.json({ success: true, data: result, tarifaDiaria });
  } catch (err) {
    console.error("[almacenaje GET]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

// ── POST — registrar recordatorio enviado ─────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId, distribuidorId, isSuperAdmin, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    // Solo admin y super_admin pueden registrar recordatorios
    if (!["admin", "super_admin"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    const body = await req.json();
    const { ordenId, tipo, diasTranscurridos, canal = "whatsapp", notas } = body;

    if (!ordenId || !tipo) {
      return NextResponse.json({ success: false, error: "ordenId y tipo son requeridos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verificar que la orden pertenece al distribuidor
    if (!isSuperAdmin && distribuidorId) {
      const { data: orden } = await supabase
        .from("ordenes_reparacion")
        .select("id")
        .eq("id", ordenId)
        .eq("distribuidor_id", distribuidorId)
        .maybeSingle();
      if (!orden) return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("recordatorios_enviados")
      .insert({
        orden_id: ordenId,
        distribuidor_id: distribuidorId,
        tipo,
        dias_transcurridos: diasTranscurridos,
        canal,
        resultado: "enviado",
        notas: notas || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[almacenaje POST]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
