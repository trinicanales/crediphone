/**
 * POST /api/cron/recordatorios-reparaciones
 *
 * Cron diario (10:00 AM) — envía recordatorios automáticos por WhatsApp a clientes
 * con equipos sin recoger en días clave: 15, 25, 30, 60, 90.
 *
 * Protegido con header Authorization: Bearer <CRON_SECRET>
 * Configura CRON_SECRET en las variables de entorno.
 *
 * En wrangler.toml:
 *   [triggers]
 *   crons = ["0 16 * * *"]   # 10am CDT (UTC-6)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarLinkWhatsApp } from "@/lib/whatsapp-reparaciones";

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

/** Días objetivo para envío automático */
const DIAS_OBJETIVO = [15, 25, 30, 60, 90];

function tipoParaDias(dias: number): string | null {
  if (dias === 15) return "recordatorio_15";
  if (dias === 25) return "recordatorio_25";
  if (dias === 30) return "aviso_cobro_30";
  if (dias === 60) return "urgente_60";
  if (dias === 90) return "disposicion_90";
  return null;
}

function buildMensaje(
  clienteNombre: string,
  folio: string,
  dias: number,
  cobro: number,
  tarifaDiaria: number
): string {
  if (dias >= 90) {
    return `Estimado/a ${clienteNombre},\n\nTe notificamos que tu equipo con folio *${folio}* lleva *${dias} días* en CREDIPHONE sin ser recogido.\n\nConforme a la LFPC Art. 63, hemos iniciado el proceso de disposición del equipo para recuperar costos ($${cobro.toFixed(2)}).\n\nContáctanos a la brevedad.\n\n*CREDIPHONE*`;
  }
  if (dias >= 60) {
    return `Estimado/a ${clienteNombre},\n\nTu equipo *${folio}* lleva *${dias} días* en nuestro establecimiento. ⚠️\n\nCobro acumulado: *$${cobro.toFixed(2)}* ($${tarifaDiaria}/día).\n\nEn 30 días más iniciaremos proceso de disposición (LFPC Art. 63).\n\n*CREDIPHONE*`;
  }
  if (dias >= 30) {
    return `Hola ${clienteNombre} 👋\n\nTu equipo *${folio}* lleva *${dias} días* listo para recoger en CREDIPHONE.\n\nSe están aplicando cargos de almacenaje de $${tarifaDiaria}/día. Total acumulado: *$${cobro.toFixed(2)}*.\n\nPasa a recogerlo pronto. 🙏`;
  }
  if (dias >= 25) {
    return `Hola ${clienteNombre} 👋\n\nSegundo aviso: tu equipo *${folio}* está listo para recoger desde hace *${dias} días*.\n\n⚠️ En ${30 - dias} días más comenzarán cargos de almacenaje ($${tarifaDiaria}/día).\n\n*CREDIPHONE*`;
  }
  return `Hola ${clienteNombre} 👋\n\nTe recordamos que tu equipo *${folio}* está listo para recoger en CREDIPHONE desde hace *${dias} días*.\n\nTienes hasta el día 30 para recogerlo sin cargo adicional.\n\n*CREDIPHONE*`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validar secret del cron
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (!auth || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const resultados: { folio: string; tipo: string; exito: boolean; motivo?: string }[] = [];

  try {
    // 1. Obtener órdenes en listo_entrega
    const { data: ordenes, error } = await supabase
      .from("ordenes_reparacion")
      .select(`
        id, folio, distribuidor_id,
        cliente:clientes(nombre, apellido, telefono),
        updated_at
      `)
      .eq("estado", "listo_entrega");

    if (error) throw error;
    if (!ordenes || ordenes.length === 0) {
      return NextResponse.json({ success: true, procesados: 0, resultados: [] });
    }

    // 2. Fecha en que cada orden entró en listo_entrega
    const ordenIds = ordenes.map((o: any) => o.id);
    const { data: historialData } = await supabase
      .from("historial_estado_orden")
      .select("orden_id, created_at")
      .in("orden_id", ordenIds)
      .eq("estado_nuevo", "listo_entrega")
      .order("created_at", { ascending: false });

    const fechaListoMap: Record<string, string> = {};
    for (const h of historialData ?? []) {
      if (!fechaListoMap[h.orden_id]) fechaListoMap[h.orden_id] = h.created_at;
    }

    // 3. Recordatorios ya enviados
    const { data: yaEnviados } = await supabase
      .from("recordatorios_enviados")
      .select("orden_id, tipo")
      .in("orden_id", ordenIds);

    const enviados = new Set((yaEnviados ?? []).map((r: any) => `${r.orden_id}::${r.tipo}`));

    // 4. Tarifas por distribuidor
    const distribuidorIds = [...new Set(ordenes.map((o: any) => o.distribuidor_id).filter(Boolean))];
    const tarifasMap: Record<string, number> = {};
    if (distribuidorIds.length > 0) {
      const { data: configs } = await supabase
        .from("configuracion")
        .select("distribuidor_id, tarifa_almacenaje_diaria")
        .in("distribuidor_id", distribuidorIds);
      for (const c of configs ?? []) {
        tarifasMap[c.distribuidor_id] = parseFloat(c.tarifa_almacenaje_diaria) || 30;
      }
    }

    // 5. Procesar cada orden
    for (const orden of ordenes) {
      const fechaListo = fechaListoMap[orden.id] ?? orden.updated_at;
      const dias = diasDesde(fechaListo);
      const tipo = tipoParaDias(dias);

      if (!tipo) continue; // no es un día objetivo
      if (enviados.has(`${orden.id}::${tipo}`)) continue; // ya enviado

      const cli = orden.cliente as unknown as { nombre?: string; apellido?: string; telefono?: string } | null;
      const clienteNombre = [cli?.nombre, cli?.apellido].filter(Boolean).join(" ") || "Cliente";
      const telefono = cli?.telefono;
      const tarifaDiaria = tarifasMap[orden.distribuidor_id] ?? 30;
      const cobro = dias > 30 ? (dias - 30) * tarifaDiaria : 0;

      // Registrar recordatorio (sin esperar WA real — el link se comparte por batch)
      try {
        await supabase.from("recordatorios_enviados").insert({
          orden_id: orden.id,
          distribuidor_id: orden.distribuidor_id,
          tipo,
          dias_transcurridos: dias,
          canal: "whatsapp",
          resultado: "pendiente",
          notas: `[CRON] Generado automáticamente. Tel: ${telefono}`,
        });

        // Construir link de WA (el envío real lo hace el técnico/admin desde el panel,
        // o si se integra WA Business API, aquí se llamaría a la función correspondiente)
        const mensaje = buildMensaje(clienteNombre, orden.folio, dias, cobro, tarifaDiaria);
        const waLink = telefono ? generarLinkWhatsApp(telefono, mensaje) : null;

        resultados.push({ folio: orden.folio, tipo, exito: true, motivo: waLink ?? "sin telefono" });
      } catch (insertErr) {
        console.error(`[CRON] Error procesando ${orden.folio}:`, insertErr);
        resultados.push({ folio: orden.folio, tipo, exito: false, motivo: "Error al insertar recordatorio" });
      }
    }

    return NextResponse.json({
      success: true,
      procesados: resultados.filter((r) => r.exito).length,
      omitidos: resultados.filter((r) => !r.exito).length,
      resultados,
    });
  } catch (err) {
    console.error("[CRON recordatorios-reparaciones]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
