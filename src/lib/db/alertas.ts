import { createAdminClient } from "@/lib/supabase/admin";

export type SeveridadAlerta = "info" | "media" | "alta";

export interface AlertaInterna {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  severidad: SeveridadAlerta;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Crea una alerta interna para los administradores de la tienda.
 * Nunca lanza error: una alerta que falla no debe romper el cobro o el cierre que la origina.
 */
export async function crearAlertaInterna(params: {
  distribuidorId: string | null | undefined;
  tipo: string;
  titulo: string;
  mensaje: string;
  severidad?: SeveridadAlerta;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("alertas_internas").insert({
      distribuidor_id: params.distribuidorId ?? null,
      tipo: params.tipo,
      titulo: params.titulo,
      mensaje: params.mensaje,
      severidad: params.severidad ?? "info",
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.warn("[alertas] No se pudo crear la alerta:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[alertas] No se pudo crear la alerta:", e);
    return false;
  }
}

/** Alertas sin leer. distribuidorId undefined = todas (super_admin). */
export async function listarAlertasPendientes(distribuidorId?: string): Promise<AlertaInterna[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("alertas_internas")
    .select("id, tipo, titulo, mensaje, severidad, metadata, created_at")
    .eq("leida", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (distribuidorId) q = q.eq("distribuidor_id", distribuidorId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    tipo: a.tipo,
    titulo: a.titulo,
    mensaje: a.mensaje,
    severidad: a.severidad,
    metadata: a.metadata ?? {},
    createdAt: a.created_at,
  }));
}
