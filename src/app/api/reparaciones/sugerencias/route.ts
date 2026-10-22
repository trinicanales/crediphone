import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARCAS_COMUNES, claveMarca, limpiarTexto } from "@/lib/reparaciones/marcas";

/**
 * GET /api/reparaciones/sugerencias?campo=marca|modelo|problema|pieza&q=...&marca=...&distribuidorId=...
 * Autocompletado a partir del historial de órdenes de la tienda, para que el empleado escriba
 * menos y se equivoque menos. Devuelve hasta 8 sugerencias, las más usadas primero.
 */
type Campo = "marca" | "modelo" | "problema" | "pieza";

interface Acumulador {
  total: number;
  variantes: Map<string, number>; // texto tal como se escribió → veces
}

function agregar(mapa: Map<string, Acumulador>, clave: string, texto: string) {
  if (!clave) return;
  const a = mapa.get(clave) ?? { total: 0, variantes: new Map() };
  a.total += 1;
  a.variantes.set(texto, (a.variantes.get(texto) ?? 0) + 1);
  mapa.set(clave, a);
}

/** La variante más escrita (si empatan, la que tiene mayúsculas/minúsculas "bonitas") */
function mejorVariante(a: Acumulador): string {
  return [...a.variantes.entries()].sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)[0][0];
}

function normalizarEspacios(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  try {
    const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    if (!["admin", "super_admin", "vendedor", "tecnico"].includes(role ?? "")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const campo = searchParams.get("campo") as Campo | null;
    const q = limpiarTexto(searchParams.get("q") ?? "");
    const marcaParam = searchParams.get("marca") ?? "";
    if (!campo || !["marca", "modelo", "problema", "pieza"].includes(campo)) {
      return NextResponse.json({ success: false, error: "campo inválido" }, { status: 400 });
    }

    const tienda = isSuperAdmin ? searchParams.get("distribuidorId") : distribuidorId;
    const supabase = createAdminClient();
    const acum = new Map<string, Acumulador>();

    if (campo === "marca" || campo === "modelo" || campo === "problema") {
      let query = supabase
        .from("ordenes_reparacion")
        .select("marca_dispositivo, modelo_dispositivo, problema_reportado")
        .order("fecha_recepcion", { ascending: false })
        .limit(3000);
      if (tienda) query = query.eq("distribuidor_id", tienda);
      const { data } = await query;

      for (const o of data ?? []) {
        if (campo === "marca" && o.marca_dispositivo) {
          const canon = claveMarca(o.marca_dispositivo);
          // Se sugiere el nombre canónico si se reconoce; si no, lo escrito
          const texto = MARCAS_COMUNES.find((m) => limpiarTexto(m) === canon) ?? normalizarEspacios(o.marca_dispositivo);
          agregar(acum, limpiarTexto(texto), texto);
        } else if (campo === "modelo" && o.modelo_dispositivo) {
          if (marcaParam && claveMarca(o.marca_dispositivo) !== claveMarca(marcaParam)) continue;
          const texto = normalizarEspacios(o.modelo_dispositivo);
          agregar(acum, limpiarTexto(texto), texto);
        } else if (campo === "problema" && o.problema_reportado) {
          const primera = normalizarEspacios(String(o.problema_reportado).split("\n")[0]);
          if (primera.length >= 3 && primera.length <= 90) agregar(acum, limpiarTexto(primera), primera);
        }
      }

      // Marcas comunes aunque aún no haya historial
      if (campo === "marca") {
        for (const m of MARCAS_COMUNES) {
          const k = limpiarTexto(m);
          if (!acum.has(k)) acum.set(k, { total: 0, variantes: new Map([[m, 0]]) });
        }
      }
    } else {
      // pieza / servicio: nombres usados en cotizaciones y pedidos de pieza
      let qOrd = supabase
        .from("ordenes_reparacion")
        .select("piezas_cotizacion")
        .not("piezas_cotizacion", "is", null)
        .order("fecha_recepcion", { ascending: false })
        .limit(1500);
      if (tienda) qOrd = qOrd.eq("distribuidor_id", tienda);
      const { data: ords } = await qOrd;
      for (const o of ords ?? []) {
        const lista = Array.isArray(o.piezas_cotizacion) ? o.piezas_cotizacion : [];
        for (const p of lista as { nombre?: string }[]) {
          const texto = normalizarEspacios(String(p?.nombre ?? ""));
          if (texto.length >= 2) agregar(acum, limpiarTexto(texto), texto);
        }
      }
      let qPed = supabase.from("pedidos_pieza_reparacion").select("nombre_pieza").limit(1000);
      if (tienda) qPed = qPed.eq("distribuidor_id", tienda);
      const { data: peds } = await qPed;
      for (const p of peds ?? []) {
        const texto = normalizarEspacios(String(p.nombre_pieza ?? ""));
        if (texto.length >= 2) agregar(acum, limpiarTexto(texto), texto);
      }
    }

    // Filtrar por lo escrito: primero los que EMPIEZAN con eso, luego los que lo contienen
    const lista = [...acum.entries()]
      .filter(([clave]) => (q ? clave.includes(q) : true))
      .map(([clave, a]) => ({
        texto: mejorVariante(a),
        veces: a.total,
        empieza: q ? clave.startsWith(q) : true,
      }))
      .filter((s) => limpiarTexto(s.texto) !== q || s.veces > 0)
      .sort((a, b) => Number(b.empieza) - Number(a.empieza) || b.veces - a.veces || a.texto.localeCompare(b.texto))
      .slice(0, 8)
      .map((s) => ({ texto: s.texto, veces: s.veces }));

    return NextResponse.json({ success: true, data: lista });
  } catch (error) {
    console.error("[reparaciones/sugerencias] Error:", error);
    return NextResponse.json({ success: false, error: "Error al cargar sugerencias" }, { status: 500 });
  }
}
