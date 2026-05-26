import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Reversiones permitidas: estado actual → estado al que se revierte
// Solo para admin. No se pueden revertir estados terminales.
const REVERSIONES: Record<string, string> = {
  listo_entrega: "completado",
  completado:    "en_reparacion",
  en_reparacion: "aprobado",
  aprobado:      "presupuesto",
  presupuesto:   "diagnostico",
  diagnostico:   "recibido",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getAuthContext();
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Solo admin puede revertir el estado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const motivo: string = body.motivo?.trim() || "";
    if (!motivo) {
      return NextResponse.json({ error: "Se requiere motivo para revertir el estado" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Obtener estado actual
    const { data: orden, error: fetchError } = await supabase
      .from("ordenes_reparacion")
      .select("id, estado, folio, distribuidor_id")
      .eq("id", id)
      .single();

    if (fetchError || !orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const estadoActual = orden.estado as string;
    const estadoDestino = REVERSIONES[estadoActual];

    if (!estadoDestino) {
      return NextResponse.json(
        { error: `El estado "${estadoActual}" no se puede revertir. Solo se revierten estados intermedios.` },
        { status: 422 }
      );
    }

    // Aplicar la reversión
    const { data: actualizada, error: updateError } = await supabase
      .from("ordenes_reparacion")
      .update({ estado: estadoDestino, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Registrar en historial
    await supabase.from("historial_estado_orden").insert({
      orden_id: id,
      estado_anterior: estadoActual,
      estado_nuevo: estadoDestino,
      usuario_id: userId,
      comentario: `[REVERTIDO por admin] ${motivo}`,
    });

    return NextResponse.json({
      success: true,
      data: actualizada,
      message: `Estado revertido: ${estadoActual} → ${estadoDestino}`,
      estadoAnterior: estadoActual,
      estadoNuevo: estadoDestino,
    });
  } catch (err) {
    console.error("Error al revertir estado:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
