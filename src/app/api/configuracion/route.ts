import { NextResponse } from "next/server";
import { getConfiguracion, updateConfiguracion } from "@/lib/db/configuracion";
import { getAuthContext } from "@/lib/auth/server";
import { getDistribuidorBySlug } from "@/lib/db/distribuidores";

/** Extrae el subdominio del header Host. Retorna null si es el dominio raíz. */
function getSubdominioFromHost(host: string): string | null {
  const mainDomain = "crediphone.com.mx";
  if (!host.endsWith(`.${mainDomain}`)) return null;
  const sub = host.slice(0, -(mainDomain.length + 1));
  if (!sub || sub === "www" || sub.includes(".")) return null;
  return sub;
}

/**
 * GET /api/configuracion
 * Obtiene la configuracion del sistema.
 * Resolución de distribuidor (en orden de prioridad):
 *   1. distribuidorId de la sesión autenticada
 *   2. Subdominio del Host header (páginas públicas por franquicia)
 *   3. null → primera config disponible (dominio raíz o sin contexto)
 */
export async function GET(request: Request) {
  try {
    let distribuidorId: string | null = null;

    // 1. Intentar obtener distribuidorId de sesión autenticada
    try {
      const auth = await getAuthContext();
      distribuidorId = auth.distribuidorId ?? null;
    } catch {
      // Sin sesión o error de auth — continuar con resolución por Host
    }

    // 2. Si no hay sesión, resolver por subdominio (ej: lalo.crediphone.com.mx)
    if (!distribuidorId) {
      const host = request.headers.get("host") ?? "";
      const slug = getSubdominioFromHost(host);
      if (slug) {
        const dist = await getDistribuidorBySlug(slug);
        distribuidorId = dist?.id ?? null;
      }
    }

    const config = await getConfiguracion(distribuidorId);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error("Error en GET /api/configuracion:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener configuracion" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/configuracion
 * Actualiza la configuracion del sistema.
 * Acceso: Solo administradores.
 */
export async function PUT(request: Request) {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    if (!role || !["admin", "super_admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No autorizado. Solo administradores." },
        { status: 403 }
      );
    }

    // Obtener datos del body
    const body = await request.json();

    // Enforce: modulos CORE siempre activos
    if (body.modulosHabilitados) {
      body.modulosHabilitados.dashboard = true;
      body.modulosHabilitados.reparaciones = true;
    }

    // Actualizar configuracion — pasar distribuidorId para filtrar la fila correcta
    const updated = await updateConfiguracion(body, userId, distribuidorId ?? null);

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Configuracion actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error en PUT /api/configuracion:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar configuracion" },
      { status: 500 }
    );
  }
}
