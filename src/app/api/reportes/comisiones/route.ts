/**
 * FASE 20: Reporte de Comisiones por Vendedor
 * GET /api/reportes/comisiones?fecha=YYYY-MM-DD
 *
 * Calcula comisiones individuales por empleado basándose en:
 * - El porcentaje de comisión configurado POR EMPLEADO (comision_porcentaje en users)
 * - Ventas POS completadas en la fecha
 * - Créditos nuevos creados en la fecha
 *
 * Si un empleado tiene comision_porcentaje = 0 → no recibe comisión
 * El porcentaje se configura en la página de Empleados, individualmente.
 */

import { NextRequest, NextResponse } from "next/server";
import { ymdMX } from "@/lib/fechas";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";

export async function GET(request: NextRequest) {
    const auth = await requireAuth(["admin", "super_admin"]);
    if (!auth.ok) return auth.response;

    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const fecha = searchParams.get("fecha") || ymdMX();

    // Filtrar por distribuidor — super_admin ve todos, admin ve solo su tienda
    const distribuidorId = auth.isSuperAdmin ? null : auth.distribuidorId;

    try {
        const fechaInicio = `${fecha}T00:00:00-06:00`;
        const fechaFin = `${fecha}T23:59:59.999-06:00`;

        // 1. Obtener todos los empleados activos con rol vendedor o admin (filtrado por distribuidor)
        const empleadosQuery = supabase
            .from("users")
            .select("id, name, email, role, comision_porcentaje, activo")
            .in("role", ["vendedor", "admin"])
            .eq("activo", true)
            .order("name", { ascending: true });
        const { data: empleados } = distribuidorId
            ? await empleadosQuery.eq("distribuidor_id", distribuidorId)
            : await empleadosQuery;

        // 2. Obtener ventas POS del día (solo completadas, filtradas por distribuidor)
        const ventasQuery = supabase
            .from("ventas")
            .select("id, vendedor_id, total, fecha_venta")
            .eq("estado", "completada")
            .gte("fecha_venta", fechaInicio)
            .lte("fecha_venta", fechaFin);
        const { data: ventas } = distribuidorId
            ? await ventasQuery.eq("distribuidor_id", distribuidorId)
            : await ventasQuery;

        // 3. Obtener créditos nuevos del día (filtrados por distribuidor)
        const creditosQuery = supabase
            .from("creditos")
            .select("id, vendedor_id, monto, monto_original, created_at")
            .gte("created_at", fechaInicio)
            .lte("created_at", fechaFin);
        const { data: creditos } = distribuidorId
            ? await creditosQuery.eq("distribuidor_id", distribuidorId)
            : await creditosQuery;

        // Crear mapa de empleados
        const empleadosMap = new Map<string, {
            nombre: string;
            role: string;
            comisionPorcentaje: number;
        }>();
        (empleados || []).forEach((e: any) => {
            empleadosMap.set(e.id, {
                nombre: e.name || e.email || e.id,
                role: e.role,
                comisionPorcentaje: parseFloat(e.comision_porcentaje || 0),
            });
        });

        // Incluir vendedores con actividad que no estén en el mapa (ej: inactivos con ventas del día)
        const vendedorIdsConActividad = new Set<string>();
        (ventas || []).forEach((v: any) => v.vendedor_id && vendedorIdsConActividad.add(v.vendedor_id));
        (creditos || []).forEach((c: any) => c.vendedor_id && vendedorIdsConActividad.add(c.vendedor_id));

        const idsExtra = Array.from(vendedorIdsConActividad).filter((id) => !empleadosMap.has(id));
        if (idsExtra.length > 0) {
            const { data: extra } = await supabase
                .from("users")
                .select("id, name, email, role, comision_porcentaje")
                .in("id", idsExtra);
            (extra || []).forEach((e: any) => {
                empleadosMap.set(e.id, {
                    nombre: e.name || e.email || e.id,
                    role: e.role,
                    comisionPorcentaje: parseFloat(e.comision_porcentaje || 0),
                });
            });
        }

        // 4. Calcular por empleado
        const resultados = Array.from(empleadosMap.entries()).map(([vendedorId, empleado]) => {
            const ventasVendedor = (ventas || []).filter((v: any) => v.vendedor_id === vendedorId);
            const creditosVendedor = (creditos || []).filter((c: any) => c.vendedor_id === vendedorId);

            const totalVentasPOS = ventasVendedor.reduce(
                (sum: number, v: any) => sum + parseFloat(v.total || 0), 0
            );
            const totalCreditos = creditosVendedor.reduce(
                (sum: number, c: any) => sum + parseFloat(c.monto_original || c.monto || 0), 0
            );
            const totalMonto = totalVentasPOS + totalCreditos;
            const totalEquipos = ventasVendedor.length + creditosVendedor.length;

            // Comisión = % individual del empleado × monto total vendido
            const comision = totalMonto * (empleado.comisionPorcentaje / 100);

            return {
                vendedorId,
                vendedorNombre: empleado.nombre,
                vendedorRol: empleado.role,
                comisionPorcentaje: empleado.comisionPorcentaje,
                comisionHabilitada: empleado.comisionPorcentaje > 0,
                ventasPOS: ventasVendedor.length,
                creditosNuevos: creditosVendedor.length,
                totalEquipos,
                totalVentasPOS,
                totalCreditos,
                totalMonto,
                comision,
            };
        });

        // Ordenar: primero los que tienen actividad, luego por comisión desc
        resultados.sort((a, b) => {
            if (b.totalEquipos !== a.totalEquipos) return b.totalEquipos - a.totalEquipos;
            return b.comision - a.comision;
        });

        return NextResponse.json({
            success: true,
            fecha,
            totalComisiones: resultados.reduce((sum, r) => sum + r.comision, 0),
            data: resultados,
        });
    } catch (error) {
        console.error("[Comisiones] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 }
        );
    }
}
