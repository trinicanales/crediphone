/**
 * FASE 56: API para diagnósticos múltiples de una orden de reparación.
 * GET  — lista todos los diagnósticos de la orden
 * POST — crea un nuevo diagnóstico (número 2+, "nuevo problema encontrado")
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDiagnosticosByOrden,
  crearSegundoDiagnostico,
} from "@/lib/db/diagnosticos";
import type { CrearDiagnosticoPayload } from "@/types";

// GET /api/reparaciones/[id]/diagnosticos
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const ALLOWED = ["admin", "tecnico", "super_admin", "vendedor"];
    if (!ALLOWED.includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso" }, { status: 403 });
    }

    if (!isSuperAdmin) {
      const supabase = createAdminClient();
      const { data: ordenCheck } = await supabase
        .from("ordenes_reparacion")
        .select("distribuidor_id")
        .eq("id", id)
        .single();
      if (ordenCheck?.distribuidor_id !== distribuidorId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
    }

    const diagnosticos = await getDiagnosticosByOrden(id);
    return NextResponse.json({ success: true, data: diagnosticos });
  } catch (error) {
    console.error("[diagnosticos GET]", error);
    return NextResponse.json({ success: false, error: "Error al obtener diagnósticos" }, { status: 500 });
  }
}

// POST /api/reparaciones/[id]/diagnosticos
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const ALLOWED = ["admin", "tecnico", "super_admin"];
    if (!ALLOWED.includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "Sin permiso para crear diagnósticos" }, { status: 403 });
    }

    const body = await req.json();
    const { descripcionProblema, diagnosticoTecnico, costoLabor, costoPartes, partesNecesarias, notas } = body;

    if (!descripcionProblema?.trim()) {
      return NextResponse.json({ success: false, error: "La descripción del problema es requerida" }, { status: 400 });
    }

    const payload: CrearDiagnosticoPayload = {
      ordenId: id,
      descripcionProblema: descripcionProblema.trim(),
      diagnosticoTecnico: diagnosticoTecnico?.trim() || undefined,
      costoLabor: parseFloat(costoLabor ?? "0") || 0,
      costoPartes: parseFloat(costoPartes ?? "0") || 0,
      partesNecesarias: partesNecesarias ?? [],
      notas: notas?.trim() || undefined,
    };

    const diagnostico = await crearSegundoDiagnostico(payload, userId, distribuidorId ?? undefined);
    return NextResponse.json({ success: true, data: diagnostico }, { status: 201 });
  } catch (error) {
    console.error("[diagnosticos POST]", error);
    return NextResponse.json({ success: false, error: "Error al crear diagnóstico" }, { status: 500 });
  }
}
