import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * FASE 58: Historial de IMEI — trazabilidad completa de un equipo
 *
 * GET /api/productos/historial-imei?imei=123456789012345
 *
 * Cruza 3 fuentes de datos:
 *  1. productos         → entró al inventario
 *  2. ventas_items+ventas → fue vendido
 *  3. ordenes_reparacion → pasó por taller
 *
 * Devuelve línea de tiempo unificada ordenada por fecha.
 */

interface EventoTimeline {
  tipo:        "inventario" | "venta" | "reparacion";
  fecha:       string;
  titulo:      string;
  descripcion: string;
  referencia?: string; // folio, id
  enlace?:     string; // ruta interna para ir al detalle
  monto?:      number;
  estado?:     string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const imei = request.nextUrl.searchParams.get("imei")?.trim();
    if (!imei || imei.length < 6) {
      return NextResponse.json(
        { success: false, error: "IMEI inválido — mínimo 6 caracteres" },
        { status: 400 }
      );
    }

    // Distribuidor efectivo
    let efectivoDistribuidorId: string | null = distribuidorId ?? null;
    if (role === "super_admin") {
      const h = request.headers.get("X-Distribuidor-Id");
      if (h) efectivoDistribuidorId = h;
    }

    const supabase = createAdminClient();
    const timeline: EventoTimeline[] = [];

    // ── 1. INVENTARIO ───────────────────────────────────────────────────
    {
      let q = supabase
        .from("productos")
        .select("id, nombre, marca, modelo, tipo, created_at, costo, precio, distribuidor_id")
        .ilike("imei", imei);
      if (efectivoDistribuidorId) q = q.eq("distribuidor_id", efectivoDistribuidorId);

      const { data } = await q;
      (data ?? []).forEach((p: Record<string, unknown>) => {
        timeline.push({
          tipo:        "inventario",
          fecha:       p.created_at as string,
          titulo:      "Ingreso a inventario",
          descripcion: `${p.marca} ${p.modelo} — ${p.nombre}`,
          estado:      "en_inventario",
          monto:       p.costo as number | undefined,
        });
      });
    }

    // ── 2. VENTAS ───────────────────────────────────────────────────────
    {
      // ventas_items JOIN ventas para obtener folio y fecha
      let q = supabase
        .from("ventas_items")
        .select("id, producto_nombre, producto_marca, producto_modelo, precio_unitario, imei, venta_id, ventas!inner(folio, fecha_venta, estado, distribuidor_id, clientes(nombre))")
        .ilike("imei", imei);

      const { data } = await q;

      (data ?? []).forEach((vi: Record<string, unknown>) => {
        const venta = vi.ventas as Record<string, unknown> | null;
        if (!venta) return;
        if (efectivoDistribuidorId && venta.distribuidor_id !== efectivoDistribuidorId) return;

        const cliente = (venta.clientes as Record<string, unknown> | null)?.nombre ?? "Sin cliente";

        timeline.push({
          tipo:        "venta",
          fecha:       venta.fecha_venta as string,
          titulo:      "Venta en POS",
          descripcion: `Vendido a ${cliente} — ${vi.producto_marca} ${vi.producto_modelo}`,
          referencia:  venta.folio as string,
          enlace:      `/dashboard/pos/historial`,
          monto:       vi.precio_unitario as number,
          estado:      venta.estado as string,
        });
      });
    }

    // ── 3. REPARACIONES ─────────────────────────────────────────────────
    {
      let q = supabase
        .from("ordenes_reparacion")
        .select("id, folio, marca_dispositivo, modelo_dispositivo, estado, problema_reportado, costo_total, created_at, distribuidor_id, clientes(nombre)")
        .ilike("imei", imei);
      if (efectivoDistribuidorId) q = q.eq("distribuidor_id", efectivoDistribuidorId);

      const { data } = await q;
      (data ?? []).forEach((r: Record<string, unknown>) => {
        const cliente = (r.clientes as Record<string, unknown> | null)?.nombre ?? "Sin cliente";
        timeline.push({
          tipo:        "reparacion",
          fecha:       r.created_at as string,
          titulo:      "Orden de reparación",
          descripcion: `${r.marca_dispositivo} ${r.modelo_dispositivo} — ${r.problema_reportado ?? "Sin descripción"} (Cliente: ${cliente})`,
          referencia:  r.folio as string,
          enlace:      `/dashboard/reparaciones/${r.id}`,
          monto:       r.costo_total as number | undefined,
          estado:      r.estado as string,
        });
      });
    }

    // ── Ordenar por fecha ascendente ─────────────────────────────────────
    timeline.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    return NextResponse.json({
      success: true,
      imei,
      total: timeline.length,
      data: timeline,
    });
  } catch (error) {
    console.error("Error al obtener historial IMEI:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener historial del IMEI" },
      { status: 500 }
    );
  }
}
