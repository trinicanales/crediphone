/**
 * FASE 9: Dashboard de Reparaciones
 * Funciones específicas para obtener estadísticas y métricas
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEstadisticasReparaciones,
  getCargaTecnicos,
  getOrdenesReparacionDetalladas,
} from "./reparaciones";
import type { OrdenReparacionDetallada, EstadisticasTecnico } from "@/types";

// ============================================
// TIPOS
// ============================================

export interface IngresoMes {
  mes: string; // "2026-01"
  nombreMes: string; // "Enero 2026"
  ingresos: number;
  ordenesCompletadas: number;
}

export interface DispositivoStats {
  marca: string;
  modelo: string;
  cantidad: number;
  ingresoTotal: number;
}

export interface GarantiaProxima {
  garantiaId: string;
  ordenId: string;
  ordenFolio: string;
  clienteNombre: string;
  diasParaVencer: number;
  fechaVencimiento: Date;
}

export interface DashboardStats {
  kpis: {
    totalOrdenes: number;
    ordenesActivas: number;
    ingresosMes: number;
    trendIngresosMes: number;
    promedioReparacion: number;
    presupuestosPendientes: number;
  };
  graficas: {
    porEstado: Record<string, number>;
    ingresosPorMes: IngresoMes[];
    topDispositivos: DispositivoStats[];
  };
  ordenesRecientes: OrdenReparacionDetallada[];
  alertas: {
    ordenesVencidas: OrdenReparacionDetallada[];
    presupuestosPendientes: OrdenReparacionDetallada[];
    garantiasProximas: GarantiaProxima[];
  };
  cargaTecnicos: EstadisticasTecnico[];
  tasaAprobacion: {
    totalPresupuestos: number;
    aprobados: number;
    rechazados: number;
    pendientes: number;
    tasaAprobacion: number;
  };
}

// ============================================
// FUNCIONES INDIVIDUALES
// ============================================

/**
 * Obtiene estadísticas filtradas por rango de fechas
 */
export async function getEstadisticasReparacionesPorFecha(
  fechaInicio: Date,
  fechaFin: Date
): Promise<{
  total: number;
  porEstado: Record<string, number>;
  promedioReparacionDias: number;
  ingresosPeriodo: number;
}> {
  const supabase = createAdminClient();

  // Total de órdenes en el período
  const { count: total } = await supabase
    .from("ordenes_reparacion")
    .select("*", { count: "exact", head: true })
    .gte("fecha_recepcion", fechaInicio.toISOString())
    .lte("fecha_recepcion", fechaFin.toISOString());

  // Órdenes por estado
  const { data: ordenes } = await supabase
    .from("ordenes_reparacion")
    .select("estado, costo_total, fecha_recepcion, fecha_completado")
    .gte("fecha_recepcion", fechaInicio.toISOString())
    .lte("fecha_recepcion", fechaFin.toISOString());

  const porEstado: Record<string, number> = {};
  let ingresosPeriodo = 0;
  let diasTotales = 0;
  let ordenesConTiempo = 0;

  ordenes?.forEach((orden) => {
    porEstado[orden.estado] = (porEstado[orden.estado] || 0) + 1;

    if (orden.costo_total) {
      ingresosPeriodo += parseFloat(orden.costo_total.toString());
    }

    if (orden.fecha_completado && orden.fecha_recepcion) {
      const inicio = new Date(orden.fecha_recepcion);
      const fin = new Date(orden.fecha_completado);
      const dias = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
      diasTotales += dias;
      ordenesConTiempo++;
    }
  });

  const promedioReparacionDias =
    ordenesConTiempo > 0 ? diasTotales / ordenesConTiempo : 0;

  return {
    total: total || 0,
    porEstado,
    promedioReparacionDias,
    ingresosPeriodo,
  };
}

/**
 * Obtiene órdenes vencidas o próximas a vencer
 */
export async function getOrdenesVencidasOProximas(
  diasAnticipacion: number = 2
): Promise<OrdenReparacionDetallada[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .select(
      `
      *,
      cliente:clientes(nombre, apellido, telefono),
      tecnico:users!ordenes_reparacion_tecnico_id_fkey(name)
    `
    )
    .not("estado", "in", '("completado","listo_entrega","entregado","cancelado","no_reparable")')
    .not("fecha_estimada_entrega", "is", null)
    .lte(
      "fecha_estimada_entrega",
      new Date(Date.now() + diasAnticipacion * 24 * 60 * 60 * 1000).toISOString()
    )
    .order("fecha_estimada_entrega", { ascending: true })
    .limit(10);

  if (error) throw error;

  // Mapear datos con joins al formato correcto
  return (data || []).map((dbOrden: any) => ({
    id: dbOrden.id,
    folio: dbOrden.folio,
    clienteId: dbOrden.cliente_id,
    tecnicoId: dbOrden.tecnico_id,
    productoId: dbOrden.producto_id,
    creditoId: dbOrden.credito_id,
    marcaDispositivo: dbOrden.marca_dispositivo,
    modeloDispositivo: dbOrden.modelo_dispositivo,
    imei: dbOrden.imei,
    numeroSerie: dbOrden.numero_serie,
    problemaReportado: dbOrden.problema_reportado,
    diagnosticoTecnico: dbOrden.diagnostico_tecnico,
    estado: dbOrden.estado,
    costoReparacion: parseFloat(dbOrden.costo_reparacion || 0),
    costoPartes: parseFloat(dbOrden.costo_partes || 0),
    costoTotal: parseFloat(dbOrden.costo_total || 0),
    partesReemplazadas: dbOrden.partes_reemplazadas || [],
    fechaRecepcion: new Date(dbOrden.fecha_recepcion),
    fechaEstimadaEntrega: dbOrden.fecha_estimada_entrega ? new Date(dbOrden.fecha_estimada_entrega) : undefined,
    fechaCompletado: dbOrden.fecha_completado ? new Date(dbOrden.fecha_completado) : undefined,
    fechaEntregado: dbOrden.fecha_entregado ? new Date(dbOrden.fecha_entregado) : undefined,
    notasTecnico: dbOrden.notas_tecnico,
    notasInternas: dbOrden.notas_internas,
    accesoriosEntregados: dbOrden.accesorios_entregados,
    condicionDispositivo: dbOrden.condicion_dispositivo,
    esGarantia: dbOrden.es_garantia || false,
    ordenOriginalId: dbOrden.orden_original_id,
    motivoGarantia: dbOrden.motivo_garantia,
    prioridad: dbOrden.prioridad,
    requiereAprobacion: dbOrden.requiere_aprobacion,
    aprobadoPorCliente: dbOrden.aprobado_por_cliente || false,
    fechaAprobacion: dbOrden.fecha_aprobacion ? new Date(dbOrden.fecha_aprobacion) : undefined,
    afectaScoring: dbOrden.afecta_scoring || false,
    creadoPor: dbOrden.creado_por,
    createdAt: new Date(dbOrden.created_at),
    updatedAt: new Date(dbOrden.updated_at),
    clienteNombre: dbOrden.cliente?.nombre || "",
    clienteApellido: dbOrden.cliente?.apellido,
    clienteTelefono: dbOrden.cliente?.telefono || "",
    tecnicoNombre: dbOrden.tecnico?.name || "",
  }));
}

/**
 * Top 10 dispositivos más reparados
 */
export async function getTop10DispositivosReparados(
  fechaInicio?: Date,
  fechaFin?: Date
): Promise<DispositivoStats[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ordenes_reparacion")
    .select("marca_dispositivo, modelo_dispositivo, costo_total")
    .not("estado", "in", '("cancelado","no_reparable")');

  if (fechaInicio) {
    query = query.gte("fecha_recepcion", fechaInicio.toISOString());
  }
  if (fechaFin) {
    query = query.lte("fecha_recepcion", fechaFin.toISOString());
  }

  const { data, error } = await query;

  if (error) throw error;

  // Agrupar por marca y modelo
  const agrupado: Record<string, DispositivoStats> = {};

  data?.forEach((orden) => {
    const key = `${orden.marca_dispositivo}|${orden.modelo_dispositivo}`;
    if (!agrupado[key]) {
      agrupado[key] = {
        marca: orden.marca_dispositivo,
        modelo: orden.modelo_dispositivo,
        cantidad: 0,
        ingresoTotal: 0,
      };
    }
    agrupado[key].cantidad++;
    if (orden.costo_total) {
      agrupado[key].ingresoTotal += parseFloat(orden.costo_total.toString());
    }
  });

  // Convertir a array y ordenar
  return Object.values(agrupado)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
}

/**
 * Ingresos mensuales de los últimos N meses
 */
export async function getIngresosPorMes(meses: number = 6): Promise<IngresoMes[]> {
  const supabase = createAdminClient();

  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - meses);

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .select("fecha_completado, costo_total")
    .not("fecha_completado", "is", null)
    .gte("fecha_completado", fechaInicio.toISOString())
    .order("fecha_completado", { ascending: true });

  if (error) throw error;

  // Agrupar por mes
  const porMes: Record<string, { ingresos: number; ordenes: number }> = {};

  data?.forEach((orden) => {
    if (!orden.fecha_completado) return;

    const fecha = new Date(orden.fecha_completado);
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;

    if (!porMes[mes]) {
      porMes[mes] = { ingresos: 0, ordenes: 0 };
    }

    porMes[mes].ordenes++;
    if (orden.costo_total) {
      porMes[mes].ingresos += parseFloat(orden.costo_total.toString());
    }
  });

  // Convertir a array y formatear nombres
  return Object.entries(porMes)
    .map(([mes, stats]) => {
      const [año, mesNum] = mes.split("-");
      const fecha = new Date(parseInt(año), parseInt(mesNum) - 1, 1);
      const nombreMes = fecha.toLocaleDateString("es-MX", {
        month: "long",
        year: "numeric",
      });

      return {
        mes,
        nombreMes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        ingresos: stats.ingresos,
        ordenesCompletadas: stats.ordenes,
      };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * Tasa de aprobación de presupuestos
 */
export async function getTasaAprobacionPresupuestos(): Promise<{
  totalPresupuestos: number;
  aprobados: number;
  rechazados: number;
  pendientes: number;
  tasaAprobacion: number;
}> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .select("aprobado_por_cliente, estado")
    .eq("requiere_aprobacion", true);

  if (error) throw error;

  let aprobados = 0;
  let rechazados = 0;
  let pendientes = 0;

  data?.forEach((orden) => {
    if (orden.aprobado_por_cliente === true) {
      aprobados++;
    } else if (orden.estado === "cancelado") {
      rechazados++;
    } else if (orden.estado === "presupuesto") {
      pendientes++;
    }
  });

  const totalPresupuestos = data?.length || 0;
  const tasaAprobacion =
    totalPresupuestos > 0 ? (aprobados / totalPresupuestos) * 100 : 0;

  return {
    totalPresupuestos,
    aprobados,
    rechazados,
    pendientes,
    tasaAprobacion,
  };
}

/**
 * Presupuestos pendientes antiguos
 */
export async function getPresupuestosPendientesAntiguos(
  diasMinimo: number = 3
): Promise<OrdenReparacionDetallada[]> {
  const supabase = createAdminClient();

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasMinimo);

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .select(
      `
      *,
      cliente:clientes(nombre, apellido, telefono),
      tecnico:users!ordenes_reparacion_tecnico_id_fkey(name)
    `
    )
    .eq("estado", "presupuesto")
    .lte("updated_at", fechaLimite.toISOString())
    .order("updated_at", { ascending: true })
    .limit(10);

  if (error) throw error;

  // Mapear datos con joins al formato correcto
  return (data || []).map((dbOrden: any) => ({
    id: dbOrden.id,
    folio: dbOrden.folio,
    clienteId: dbOrden.cliente_id,
    tecnicoId: dbOrden.tecnico_id,
    productoId: dbOrden.producto_id,
    creditoId: dbOrden.credito_id,
    marcaDispositivo: dbOrden.marca_dispositivo,
    modeloDispositivo: dbOrden.modelo_dispositivo,
    imei: dbOrden.imei,
    numeroSerie: dbOrden.numero_serie,
    problemaReportado: dbOrden.problema_reportado,
    diagnosticoTecnico: dbOrden.diagnostico_tecnico,
    estado: dbOrden.estado,
    costoReparacion: parseFloat(dbOrden.costo_reparacion || 0),
    costoPartes: parseFloat(dbOrden.costo_partes || 0),
    costoTotal: parseFloat(dbOrden.costo_total || 0),
    partesReemplazadas: dbOrden.partes_reemplazadas || [],
    fechaRecepcion: new Date(dbOrden.fecha_recepcion),
    fechaEstimadaEntrega: dbOrden.fecha_estimada_entrega ? new Date(dbOrden.fecha_estimada_entrega) : undefined,
    fechaCompletado: dbOrden.fecha_completado ? new Date(dbOrden.fecha_completado) : undefined,
    fechaEntregado: dbOrden.fecha_entregado ? new Date(dbOrden.fecha_entregado) : undefined,
    notasTecnico: dbOrden.notas_tecnico,
    notasInternas: dbOrden.notas_internas,
    accesoriosEntregados: dbOrden.accesorios_entregados,
    condicionDispositivo: dbOrden.condicion_dispositivo,
    esGarantia: dbOrden.es_garantia || false,
    ordenOriginalId: dbOrden.orden_original_id,
    motivoGarantia: dbOrden.motivo_garantia,
    prioridad: dbOrden.prioridad,
    requiereAprobacion: dbOrden.requiere_aprobacion,
    aprobadoPorCliente: dbOrden.aprobado_por_cliente || false,
    fechaAprobacion: dbOrden.fecha_aprobacion ? new Date(dbOrden.fecha_aprobacion) : undefined,
    afectaScoring: dbOrden.afecta_scoring || false,
    creadoPor: dbOrden.creado_por,
    createdAt: new Date(dbOrden.created_at),
    updatedAt: new Date(dbOrden.updated_at),
    clienteNombre: dbOrden.cliente?.nombre || "",
    clienteApellido: dbOrden.cliente?.apellido,
    clienteTelefono: dbOrden.cliente?.telefono || "",
    tecnicoNombre: dbOrden.tecnico?.name || "",
  }));
}

/**
 * Garantías próximas a vencer
 */
export async function getGarantiasProximasVencer(
  diasAnticipacion: number = 7
): Promise<GarantiaProxima[]> {
  try {
    const supabase = createAdminClient();

    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + diasAnticipacion);

    const { data, error } = await supabase
      .from("garantias_reparacion")
      .select(
        `
        id,
        orden_id,
        fecha_vencimiento,
        orden:ordenes_reparacion!garantias_reparacion_orden_id_fkey(
          folio,
          cliente:clientes(nombre, apellido)
        )
      `
      )
      .gte("fecha_vencimiento", fechaInicio.toISOString())
      .lte("fecha_vencimiento", fechaFin.toISOString())
      .eq("activa", true)
      .order("fecha_vencimiento", { ascending: true });

    if (error) {
      console.warn("No se pudieron cargar garantías próximas a vencer:", error.message);
      return [];
    }

    return (
      data?.map((garantia: any) => {
        const vencimiento = new Date(garantia.fecha_vencimiento);
        const diasParaVencer = Math.ceil(
          (vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        return {
          garantiaId: garantia.id,
          ordenId: garantia.orden_id,
          ordenFolio: garantia.orden?.folio || "Sin folio",
          clienteNombre: garantia.orden?.cliente
            ? `${garantia.orden.cliente.nombre} ${garantia.orden.cliente.apellido}`
            : "Sin cliente",
          diasParaVencer,
          fechaVencimiento: vencimiento,
        };
      }) || []
    );
  } catch (error) {
    console.warn("Error al cargar garantías próximas a vencer:", error);
    return [];
  }
}

// ============================================
// FUNCIÓN CONSOLIDADA
// ============================================

/**
 * Obtiene TODOS los datos del dashboard de una sola vez
 * Optimizado para reducir queries múltiples
 */
export async function getDashboardCompleto(): Promise<DashboardStats> {
  // Ejecutar todas las queries en paralelo
  const [
    estadisticas,
    cargaTecnicos,
    ordenesRecientes,
    ingresosPorMes,
    topDispositivos,
    ordenesVencidas,
    presupuestosPendientes,
    garantiasProximas,
    tasaAprobacion,
  ] = await Promise.all([
    getEstadisticasReparaciones(),
    getCargaTecnicos(),
    getOrdenesReparacionDetalladas().then((ordenes) =>
      ordenes.slice(0, 10)
    ),
    getIngresosPorMes(6),
    getTop10DispositivosReparados(),
    getOrdenesVencidasOProximas(2),
    getPresupuestosPendientesAntiguos(3),
    getGarantiasProximasVencer(7),
    getTasaAprobacionPresupuestos(),
  ]);

  // Calcular KPIs
  const ordenesActivas = Object.entries(estadisticas.porEstado)
    .filter(([estado]) =>
      ["recibido", "diagnostico", "presupuesto", "aprobado", "en_reparacion"].includes(
        estado
      )
    )
    .reduce((sum, [, count]) => sum + count, 0);

  const presupuestosPendientesCount = estadisticas.porEstado.presupuesto || 0;

  // Calcular trend de ingresos (comparar mes actual vs anterior)
  const mesActual = ingresosPorMes[ingresosPorMes.length - 1];
  const mesAnterior = ingresosPorMes[ingresosPorMes.length - 2];
  const trendIngresosMes =
    mesAnterior && mesAnterior.ingresos > 0
      ? ((mesActual.ingresos - mesAnterior.ingresos) / mesAnterior.ingresos) * 100
      : 0;

  return {
    kpis: {
      totalOrdenes: estadisticas.total,
      ordenesActivas,
      ingresosMes: mesActual?.ingresos || 0,
      trendIngresosMes,
      promedioReparacion: estadisticas.promedioReparacionDias,
      presupuestosPendientes: presupuestosPendientesCount,
    },
    graficas: {
      porEstado: estadisticas.porEstado,
      ingresosPorMes,
      topDispositivos,
    },
    ordenesRecientes,
    alertas: {
      ordenesVencidas,
      presupuestosPendientes,
      garantiasProximas,
    },
    cargaTecnicos,
    tasaAprobacion,
  };
}
