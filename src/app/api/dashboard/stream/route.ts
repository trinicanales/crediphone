import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/dashboard/stream
 * FASE 53: Stream de actividad reciente — últimos 12 eventos del sistema.
 * Combina reparaciones, pagos y ventas ordenados por fecha desc.
 */
export async function GET() {
  try {
    const { userId, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const distId = isSuperAdmin ? undefined : (distribuidorId ?? undefined);

    // Últimas 48h
    const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [repRecientes, pagosRecientes, ventasRecientes] = await Promise.all([
      // Reparaciones creadas/actualizadas recientemente
      (() => {
        let q = supabase
          .from("ordenes_reparacion")
          .select("id, folio, estado, updated_at, clientes(nombre)")
          .gte("updated_at", hace48h)
          .order("updated_at", { ascending: false })
          .limit(8);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // Pagos recientes
      (() => {
        let q = supabase
          .from("pagos")
          .select("id, monto, metodo_pago, fecha_pago, clientes(nombre)")
          .gte("fecha_pago", hace48h)
          .order("fecha_pago", { ascending: false })
          .limit(6);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),

      // Ventas POS recientes
      (() => {
        let q = supabase
          .from("ventas")
          .select("id, folio, total, fecha_venta")
          .gte("fecha_venta", hace48h)
          .order("fecha_venta", { ascending: false })
          .limit(5);
        if (distId) q = q.eq("distribuidor_id", distId);
        return q;
      })(),
    ]);

    // ── Normalizar a formato unificado ──────────────────────────
    type StreamEvent = {
      id: string;
      tipo: "reparacion" | "pago" | "venta";
      descripcion: string;
      detalle: string;
      fecha: string;
      icono: string;
      color: string;
    };

    const ESTADO_LABELS: Record<string, string> = {
      recibido: "Recibida",
      diagnostico: "En diagnóstico",
      esperando_piezas: "Esperando piezas",
      reparando: "En reparación",
      listo_entrega: "Lista para entrega",
      entregado: "Entregada",
      cancelado: "Cancelada",
      presupuesto: "Presupuesto enviado",
      aprobado: "Presupuesto aprobado",
    };

    const eventos: StreamEvent[] = [];

    // Reparaciones
    for (const r of repRecientes.data ?? []) {
      const cliente = (r.clientes as { nombre?: string } | null)?.nombre ?? "Cliente";
      eventos.push({
        id: `rep-${r.id}`,
        tipo: "reparacion",
        descripcion: `Orden ${r.folio}`,
        detalle: `${ESTADO_LABELS[r.estado] ?? r.estado} — ${cliente}`,
        fecha: r.updated_at,
        icono: "wrench",
        color: "accent",
      });
    }

    // Pagos
    const formatMXN = (n: number) =>
      new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
    for (const p of pagosRecientes.data ?? []) {
      const cliente = (p.clientes as { nombre?: string } | null)?.nombre ?? "Cliente";
      eventos.push({
        id: `pago-${p.id}`,
        tipo: "pago",
        descripcion: `Pago ${formatMXN(Number(p.monto))}`,
        detalle: `${cliente} · ${p.metodo_pago ?? "efectivo"}`,
        fecha: p.fecha_pago,
        icono: "wallet",
        color: "success",
      });
    }

    // Ventas POS
    for (const v of ventasRecientes.data ?? []) {
      eventos.push({
        id: `venta-${v.id}`,
        tipo: "venta",
        descripcion: `Venta POS ${v.folio ?? ""}`,
        detalle: `Total ${formatMXN(Number(v.total))}`,
        fecha: v.fecha_venta,
        icono: "store",
        color: "info",
      });
    }

    // Ordenar por fecha descendente, tomar 12
    eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const stream = eventos.slice(0, 12);

    return NextResponse.json({ success: true, data: stream });
  } catch (error) {
    console.error("[dashboard/stream] Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al cargar stream de actividad" },
      { status: 500 }
    );
  }
}
