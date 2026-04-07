/**
 * Funciones de base de datos para el módulo de Reparaciones
 * FASE 8: Sistema completo de gestión de órdenes de reparación
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionActiva } from "@/lib/db/caja";
import type {
  OrdenReparacion,
  OrdenReparacionDetallada,
  OrdenReparacionFormData,
  GarantiaReparacion,
  EstadisticasTecnico,
  EstadoOrdenReparacion,
  DiagnosticoFormData,
  ParteReemplazada,
  PiezaReparacion,
  SolicitudPieza,
  EstadoSolicitudPieza,
  GarantiaPieza,
  EstadoGarantiaPieza,
  TipoResolucionGarantiaPieza,
  TipoGarantia,
  AnticipoReparacion,
  TipoPago,
  DesglosePagoMixto,
  PrioridadOrden,
} from "@/types";

// =====================================================
// FUNCIONES HELPER: Mapeo DB → TypeScript
// =====================================================

function mapOrdenFromDB(dbOrden: any): OrdenReparacion {
  return {
    id: dbOrden.id,
    folio: dbOrden.folio,
    clienteId: dbOrden.cliente_id,
    tecnicoId: dbOrden.tecnico_id,
    productoId: dbOrden.producto_id || undefined,
    creditoId: dbOrden.credito_id || undefined,

    marcaDispositivo: dbOrden.marca_dispositivo,
    modeloDispositivo: dbOrden.modelo_dispositivo,
    imei: dbOrden.imei || undefined,
    numeroSerie: dbOrden.numero_serie || undefined,

    problemaReportado: dbOrden.problema_reportado,
    diagnosticoTecnico: dbOrden.diagnostico_tecnico || undefined,

    estado: dbOrden.estado,

    costoReparacion: parseFloat(dbOrden.costo_reparacion || 0),
    costoPartes: parseFloat(dbOrden.costo_partes || 0),
    costoTotal: parseFloat(dbOrden.costo_total || 0),
    partesReemplazadas: dbOrden.partes_reemplazadas || [],

    fechaRecepcion: new Date(dbOrden.fecha_recepcion),
    fechaEstimadaEntrega: dbOrden.fecha_estimada_entrega
      ? new Date(dbOrden.fecha_estimada_entrega)
      : undefined,
    fechaCompletado: dbOrden.fecha_completado
      ? new Date(dbOrden.fecha_completado)
      : undefined,
    fechaEntregado: dbOrden.fecha_entregado
      ? new Date(dbOrden.fecha_entregado)
      : undefined,

    notasTecnico: dbOrden.notas_tecnico || undefined,
    notasInternas: dbOrden.notas_internas || undefined,
    accesoriosEntregados: dbOrden.accesorios_incluidos || undefined,
    condicionDispositivo: dbOrden.condicion_dispositivo || undefined,

    esGarantia: dbOrden.es_garantia || false,
    ordenOriginalId: dbOrden.orden_original_id || undefined,
    motivoGarantia: dbOrden.motivo_garantia || undefined,

    prioridad: dbOrden.prioridad,
    requiereAprobacion: dbOrden.requiere_aprobacion,
    aprobadoPorCliente: dbOrden.aprobado_por_cliente || false,
    fechaAprobacion: dbOrden.fecha_aprobacion
      ? new Date(dbOrden.fecha_aprobacion)
      : undefined,
    aprobacionParcial: dbOrden.aprobacion_parcial || false,
    notasCliente: dbOrden.notas_cliente || undefined,

    afectaScoring: dbOrden.afecta_scoring || false,

    // Fase 8B - Campos avanzados
    patronDesbloqueo: dbOrden.patron_desbloqueo || undefined,
    passwordDispositivo: dbOrden.password_dispositivo || undefined,
    cuentasDispositivo: dbOrden.cuentas_dispositivo || undefined,
    condicionesFuncionamiento: dbOrden.condiciones_funcionamiento || undefined,
    estadoFisicoDispositivo: dbOrden.estado_fisico_dispositivo || undefined,
    deslindesLegales: dbOrden.deslindes_legales || undefined,
    firmaCliente: dbOrden.firma_cliente || undefined,
    tipoFirma: dbOrden.tipo_firma || undefined,
    fechaFirma: dbOrden.fecha_firma ? new Date(dbOrden.fecha_firma) : undefined,

    creadoPor: dbOrden.creado_por || undefined,
    createdAt: new Date(dbOrden.created_at),
    updatedAt: new Date(dbOrden.updated_at),
    // Mensajería y almacenaje (FASE 27)
    fechaAvisoRecoleccion: dbOrden.fecha_aviso_recoleccion ? new Date(dbOrden.fecha_aviso_recoleccion) : undefined,
    cobroAlmacenajeInicio: dbOrden.cobro_almacenaje_inicio ? new Date(dbOrden.cobro_almacenaje_inicio) : undefined,
    descuentoRapidoOfrecido: dbOrden.descuento_rapido_ofrecido ?? false,
    descuentoRapidoPorcentaje: dbOrden.descuento_rapido_porcentaje ?? undefined,
  };
}

function mapOrdenesFromDB(dbOrdenes: any[]): OrdenReparacion[] {
  return dbOrdenes.map(mapOrdenFromDB);
}

function mapOrdenDetalladaFromDB(dbOrden: any): OrdenReparacionDetallada {
  const ordenBase = mapOrdenFromDB(dbOrden);
  return {
    ...ordenBase,
    clienteNombre: dbOrden.cliente_nombre || "",
    clienteApellido: dbOrden.cliente_apellido || undefined,
    clienteTelefono: dbOrden.cliente_telefono || "",
    tecnicoNombre: dbOrden.tecnico_nombre || "",
  };
}

function mapOrdenesDetalladasFromDB(
  dbOrdenes: any[]
): OrdenReparacionDetallada[] {
  return dbOrdenes.map(mapOrdenDetalladaFromDB);
}

function mapGarantiaFromDB(dbGarantia: any): GarantiaReparacion {
  return {
    id: dbGarantia.id,
    ordenId: dbGarantia.orden_id,
    clienteId: dbGarantia.cliente_id,
    tipoGarantia: dbGarantia.tipo_garantia,
    diasGarantia: dbGarantia.dias_garantia,
    fechaInicio: new Date(dbGarantia.fecha_inicio),
    fechaVencimiento: new Date(dbGarantia.fecha_vencimiento),
    estado: dbGarantia.estado,
    ordenGarantiaId: dbGarantia.orden_garantia_id || undefined,
    fechaReclamo: dbGarantia.fecha_reclamo
      ? new Date(dbGarantia.fecha_reclamo)
      : undefined,
    motivoReclamo: dbGarantia.motivo_reclamo || undefined,
    aplicaCosto: dbGarantia.aplica_costo,
    notas: dbGarantia.notas || undefined,
    createdAt: new Date(dbGarantia.created_at),
    updatedAt: new Date(dbGarantia.updated_at),
  };
}

function mapGarantiasFromDB(dbGarantias: any[]): GarantiaReparacion[] {
  return dbGarantias.map(mapGarantiaFromDB);
}

// =====================================================
// FUNCIONES CRUD BÁSICAS
// =====================================================

/**
 * Obtiene todas las órdenes de reparación
 */
export async function getOrdenesReparacion(distribuidorId?: string): Promise<OrdenReparacion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ordenes_reparacion")
    .select("*")
    .order("fecha_recepcion", { ascending: false });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener órdenes:", error);
    throw new Error(`Error al obtener órdenes: ${error.message}`);
  }

  return mapOrdenesFromDB(data || []);
}

/**
 * Obtiene todas las órdenes con información detallada (cliente y técnico)
 */
export async function getOrdenesReparacionDetalladas(distribuidorId?: string): Promise<
  OrdenReparacionDetallada[]
> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ordenes_reparacion")
    .select(
      `
      *,
      cliente:clientes(nombre, apellido, telefono),
      tecnico:users!ordenes_reparacion_tecnico_id_fkey(name)
    `
    )
    .order("fecha_recepcion", { ascending: false });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener órdenes detalladas:", error);
    throw new Error(`Error al obtener órdenes detalladas: ${error.message}`);
  }

  // Mapear datos con joins
  const ordenesDetalladas = (data || []).map((dbOrden: any) => ({
    ...dbOrden,
    cliente_nombre: dbOrden.cliente?.nombre || "",
    cliente_apellido: dbOrden.cliente?.apellido || "",
    cliente_telefono: dbOrden.cliente?.telefono || "",
    tecnico_nombre: dbOrden.tecnico?.name || "",
  }));

  return mapOrdenesDetalladasFromDB(ordenesDetalladas);
}

/**
 * Obtiene una orden por ID
 */
export async function getOrdenReparacionById(
  id: string
): Promise<OrdenReparacion | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No se encontró el registro
      return null;
    }
    console.error("Error al obtener orden por ID:", error);
    throw new Error(`Error al obtener orden: ${error.message}`);
  }

  return data ? mapOrdenFromDB(data) : null;
}

/**
 * Obtiene una orden por ID con información detallada (cliente y técnico)
 */
export async function getOrdenReparacionDetalladaById(
  id: string
): Promise<OrdenReparacionDetallada | null> {
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
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No se encontró el registro
      return null;
    }
    console.error("Error al obtener orden detallada por ID:", error);
    throw new Error(`Error al obtener orden detallada: ${error.message}`);
  }

  if (!data) return null;

  // Mapear datos con joins
  const ordenDetallada = {
    ...data,
    cliente_nombre: data.cliente?.nombre || "",
    cliente_apellido: data.cliente?.apellido || "",
    cliente_telefono: data.cliente?.telefono || "",
    tecnico_nombre: data.tecnico?.name || "",
  };

  const mapped = mapOrdenesDetalladasFromDB([ordenDetallada]);
  return mapped[0] || null;
}

/**
 * Obtiene todas las órdenes de un cliente específico
 */
export async function getOrdenesByCliente(
  clienteId: string
): Promise<OrdenReparacion[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("fecha_recepcion", { ascending: false });

  if (error) {
    console.error("Error al obtener órdenes del cliente:", error);
    throw new Error(`Error al obtener órdenes del cliente: ${error.message}`);
  }

  return mapOrdenesFromDB(data || []);
}

/**
 * Obtiene todas las órdenes de un técnico específico
 */
export async function getOrdenesByTecnico(
  tecnicoId: string,
  distribuidorId?: string
): Promise<OrdenReparacion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ordenes_reparacion")
    .select("*")
    .eq("tecnico_id", tecnicoId);

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query.order("fecha_recepcion", {
    ascending: false,
  });

  if (error) {
    console.error("Error al obtener órdenes del técnico:", error);
    throw new Error(`Error al obtener órdenes del técnico: ${error.message}`);
  }

  return mapOrdenesFromDB(data || []);
}

/**
 * Obtiene órdenes por estado
 */
export async function getOrdenesByEstado(
  estado: EstadoOrdenReparacion,
  distribuidorId?: string
): Promise<OrdenReparacion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ordenes_reparacion")
    .select("*")
    .eq("estado", estado)
    .order("fecha_recepcion", { ascending: false });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener órdenes por estado:", error);
    throw new Error(`Error al obtener órdenes por estado: ${error.message}`);
  }

  return mapOrdenesFromDB(data || []);
}

/**
 * Obtiene órdenes que son garantías activas
 */
export async function getOrdenesGarantiaActivas(distribuidorId?: string): Promise<OrdenReparacion[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("ordenes_reparacion")
    .select("*")
    .eq("es_garantia", true)
    .not("estado", "in", '("entregado","cancelado")')
    .order("prioridad", { ascending: false })
    .order("fecha_recepcion", { ascending: true });

  if (distribuidorId) query = query.eq("distribuidor_id", distribuidorId);

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener órdenes de garantía activas:", error);
    throw new Error(
      `Error al obtener órdenes de garantía activas: ${error.message}`
    );
  }

  return mapOrdenesFromDB(data || []);
}

// =====================================================
// CREAR ORDEN CON AUTO-ASIGNACIÓN
// =====================================================

/**
 * Crea una nueva orden de reparación con auto-asignación de técnico
 */
export async function createOrdenReparacion(
  ordenData: Partial<OrdenReparacionFormData>,
  creadoPor: string,
  distribuidorId?: string | null,
  folioPreReservado?: string | null
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  try {
    // 1. Usar folio pre-reservado o generar uno nuevo
    let folio: string;
    if (folioPreReservado) {
      folio = folioPreReservado;
    } else {
      const { data: folioData, error: folioError } = await supabase.rpc(
        "generar_folio_orden"
      );
      if (folioError) {
        throw new Error(`Error al generar folio: ${folioError.message}`);
      }
      folio = folioData as string;
    }

    // 2. Auto-asignar técnico disponible (no crítico — null es aceptable)
    const { data: tecnicoData } = await supabase.rpc(
      "obtener_tecnico_disponible"
    );
    const tecnicoId = (tecnicoData as string) || null;

    // 3. Insertar orden en la base de datos
    const insertData: any = {
      folio,
      distribuidor_id: distribuidorId || null,
      tecnico_id: tecnicoId,
      cliente_id: ordenData.clienteId,
      producto_id: ordenData.productoId || null,
      credito_id: ordenData.creditoId || null,
      marca_dispositivo: ordenData.marcaDispositivo,
      modelo_dispositivo: ordenData.modeloDispositivo,
      imei: ordenData.imei || null,
      numero_serie: ordenData.numeroSerie || null,
      accesorios_incluidos: ordenData.accesoriosEntregados || null,
      problema_reportado: ordenData.problemaReportado,
      estado: "recibido",
      // costo_reparacion: labor cost (mano de obra). Usa el desglose del presupuesto
      // como fallback para que no quede en 0 cuando viene del modal de nueva orden.
      costo_reparacion: ordenData.costoReparacion || ordenData.presupuestoManoDeObra || 0,
      // costo_partes: partes reales (se recalcula en recalcularCostoPiezas al agregar piezas)
      costo_partes: ordenData.costoPartes || 0,
      // costo_total inicial = mano de obra (las piezas reales se suman en recalcularCostoPiezas)
      costo_total: (ordenData.costoReparacion || ordenData.presupuestoManoDeObra || 0) + (ordenData.costoPartes || 0),
      partes_reemplazadas: ordenData.partesReemplazadas || [],
      fecha_estimada_entrega: ordenData.fechaEstimadaEntrega || null,
      notas_internas: ordenData.notasInternas || null,
      condicion_dispositivo: ordenData.condicionDispositivo || null,
      prioridad: ordenData.prioridad || "normal",
      requiere_aprobacion: ordenData.requiereAprobacion ?? true,
      afecta_scoring: ordenData.afectaScoring ?? false,
      creado_por: creadoPor,
    };

    // Fase 8B - Campos avanzados
    if (ordenData.patronDesbloqueo) insertData.patron_desbloqueo = ordenData.patronDesbloqueo;
    if (ordenData.passwordDispositivo) insertData.password_dispositivo = ordenData.passwordDispositivo;
    if (ordenData.cuentasDispositivo) insertData.cuentas_dispositivo = ordenData.cuentasDispositivo;
    if (ordenData.condicionesFuncionamiento) insertData.condiciones_funcionamiento = ordenData.condicionesFuncionamiento;
    if (ordenData.estadoFisicoDispositivo) insertData.estado_fisico_dispositivo = ordenData.estadoFisicoDispositivo;
    if (ordenData.deslindesLegales) insertData.deslindes_legales = ordenData.deslindesLegales;
    if (ordenData.firmaCliente) insertData.firma_cliente = ordenData.firmaCliente;
    if (ordenData.tipoFirma) insertData.tipo_firma = ordenData.tipoFirma;
    if (ordenData.fechaFirma) insertData.fecha_firma = ordenData.fechaFirma;

    // Fase 8C - Presupuesto total con desglose mano de obra / piezas
    if (ordenData.presupuestoTotal !== undefined) {
      insertData.precio_total = ordenData.presupuestoTotal;
      insertData.precio_mano_obra = ordenData.presupuestoManoDeObra ?? ordenData.presupuestoTotal;
      insertData.precio_piezas = ordenData.presupuestoPiezas ?? 0;
    }

    // FASE 54-B: Referencia al catálogo de servicios (opcional)
    if ((ordenData as any).catalogoServicioId) {
      insertData.catalogo_servicio_id = (ordenData as any).catalogoServicioId;
    }

    const { data, error } = await supabase
      .from("ordenes_reparacion")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error al crear orden:", error);
      throw new Error(`Error al crear orden: ${error.message}`);
    }

    // Marcar el folio como usado en la tabla de seguimiento
    if (folioPreReservado) {
      await supabase
        .from("folios_reparacion")
        .update({ estado: "usado", orden_id: data.id })
        .eq("folio", folioPreReservado);
    }

    // 4. Crear anticipos si existen (FASE 54-C: vincular a caja activa)
    if (ordenData.anticiposData && Array.isArray(ordenData.anticiposData) && ordenData.anticiposData.length > 0) {
      // Obtener caja activa del usuario que crea la orden para vincular anticipos
      let sesionCajaActiva: string | undefined;
      try {
        const sesion = await getSesionActiva(creadoPor);
        sesionCajaActiva = sesion?.id;
      } catch {
        // Si falla obtener la caja, continuar sin vincular — no crítico
      }

      for (const anticipo of ordenData.anticiposData as any[]) {
        if (!anticipo.monto || anticipo.monto <= 0) continue;
        try {
          await addAnticipoReparacion(
            data.id,
            {
              monto: anticipo.monto,
              tipoPago: anticipo.tipoPago || "efectivo",
              desgloseMixto: anticipo.desgloseMixto,
              referenciaPago: anticipo.referenciaPago,
              notas: anticipo.notas,
            },
            creadoPor,
            sesionCajaActiva,
            data.folio
          );
        } catch (anticipoErr) {
          console.error("Error al crear anticipo:", anticipoErr);
          // No fallar la orden si falla un anticipo
        }
      }
    }

    // 5. Asociar imágenes si existen
    if (ordenData.imagenesIds && Array.isArray(ordenData.imagenesIds) && ordenData.imagenesIds.length > 0) {
      const { error: imagenesError } = await supabase
        .from("imagenes_reparacion")
        .update({ orden_id: data.id })
        .in("id", ordenData.imagenesIds);

      if (imagenesError) {
        console.error("Error al asociar imágenes:", imagenesError);
        // No lanzar error, solo registrar - la orden ya se creó
      }
    }

    return mapOrdenFromDB(data);
  } catch (error) {
    console.error("Error en createOrdenReparacion:", error);
    throw error;
  }
}

// =====================================================
// ACTUALIZAR DIAGNÓSTICO
// =====================================================

/**
 * Actualiza el diagnóstico de una orden (solo técnico asignado)
 */
export async function updateDiagnostico(
  ordenId: string,
  diagnosticoData: DiagnosticoFormData
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  // Obtener el estado actual para no resetear ordenes ya aprobadas/en progreso
  const { data: ordenActual } = await supabase
    .from("ordenes_reparacion")
    .select("estado")
    .eq("id", ordenId)
    .single();

  const estadoActual = ordenActual?.estado as string | undefined;
  // Solo cambiar estado si la orden está en etapas iniciales (diagnóstico / presupuesto).
  // Si ya está aprobada, en reparación, completada, etc., preservar el estado actual.
  const estadosFase = ["recibido", "diagnostico", "presupuesto"];
  const nuevoEstado = estadosFase.includes(estadoActual || "")
    ? (diagnosticoData.requiereAprobacion ? "presupuesto" : "aprobado")
    : estadoActual;

  // Calcular costo_total como suma de mano de obra + partes
  const costoTotal = (diagnosticoData.costoReparacion || 0) + (diagnosticoData.costoPartes || 0);

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .update({
      diagnostico_tecnico: diagnosticoData.diagnosticoTecnico,
      costo_reparacion: diagnosticoData.costoReparacion,
      costo_partes: diagnosticoData.costoPartes,
      costo_total: costoTotal,
      partes_reemplazadas: diagnosticoData.partesReemplazadas,
      fecha_estimada_entrega: diagnosticoData.fechaEstimadaEntrega || null,
      notas_tecnico: diagnosticoData.notasTecnico || null,
      requiere_aprobacion: diagnosticoData.requiereAprobacion,
      estado: nuevoEstado,
    })
    .eq("id", ordenId)
    .select()
    .single();

  if (error) {
    console.error("Error al actualizar diagnóstico:", error);
    throw new Error(`Error al actualizar diagnóstico: ${error.message}`);
  }

  return mapOrdenFromDB(data);
}

// =====================================================
// CAMBIAR ESTADO DE ORDEN
// =====================================================

/**
 * Mapa de transiciones de estado válidas del servidor.
 * Espejo del frontend — validación en servidor para prevenir manipulación de API.
 * Regla: si el estado destino no está en el array del estado origen → rechazar.
 */
const TRANSICIONES_VALIDAS: Record<EstadoOrdenReparacion, EstadoOrdenReparacion[]> = {
  recibido:          ["diagnostico", "cancelado"],
  diagnostico:       ["esperando_piezas", "presupuesto", "aprobado", "no_reparable", "cancelado"],
  esperando_piezas:  ["en_reparacion", "aprobado", "cancelado"],
  presupuesto:       ["aprobado", "cancelado"],
  aprobado:          ["en_reparacion", "cancelado"],
  en_reparacion:     ["completado", "esperando_piezas", "no_reparable", "cancelado"],
  completado:        ["listo_entrega", "cancelado"],
  listo_entrega:     ["entregado", "cancelado"],
  entregado:         [],
  no_reparable:      [],
  cancelado:         [],
};

/**
 * Cambia el estado de una orden con validación de transición en el servidor.
 */
export async function cambiarEstadoOrden(
  ordenId: string,
  nuevoEstado: EstadoOrdenReparacion,
  notas?: string
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  // Leer el estado actual antes de actualizar
  const { data: ordenActual, error: errorLectura } = await supabase
    .from("ordenes_reparacion")
    .select("estado")
    .eq("id", ordenId)
    .single();

  if (errorLectura || !ordenActual) {
    throw new Error("Orden no encontrada");
  }

  const estadoActual = ordenActual.estado as EstadoOrdenReparacion;
  const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual] ?? [];

  if (!transicionesPermitidas.includes(nuevoEstado)) {
    throw new Error(
      `Transición no permitida: "${estadoActual}" → "${nuevoEstado}". ` +
      `Estados permitidos desde "${estadoActual}": ${transicionesPermitidas.join(", ") || "ninguno"}`
    );
  }

  const updateData: any = {
    estado: nuevoEstado,
  };

  // Actualizar fechas según el estado
  if (nuevoEstado === "completado") {
    updateData.fecha_completado = new Date().toISOString();
  } else if (nuevoEstado === "entregado") {
    updateData.fecha_entregado = new Date().toISOString();
  }

  if (notas) {
    updateData.notas_tecnico = notas;
  }

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .update(updateData)
    .eq("id", ordenId)
    .select()
    .single();

  if (error) {
    console.error("Error al cambiar estado de orden:", error);
    throw new Error(`Error al cambiar estado: ${error.message}`);
  }

  return mapOrdenFromDB(data);
}

/**
 * Actualiza la información básica de una orden de reparación
 * No modifica: folio, técnico, estado, costos, firma
 */
export async function updateOrdenBasicInfo(
  ordenId: string,
  updateData: {
    clienteId?: string;
    marcaDispositivo?: string;
    modeloDispositivo?: string;
    imei?: string;
    numeroSerie?: string;
    problemaReportado?: string;
    prioridad?: PrioridadOrden;
    fechaEstimadaEntrega?: Date;
    notasInternas?: string;
    condicionDispositivo?: string;
  }
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  // Mapear nombres de campos al formato de la DB
  const dbUpdateData: any = {};

  if (updateData.clienteId !== undefined)
    dbUpdateData.cliente_id = updateData.clienteId;
  if (updateData.marcaDispositivo !== undefined)
    dbUpdateData.marca_dispositivo = updateData.marcaDispositivo;
  if (updateData.modeloDispositivo !== undefined)
    dbUpdateData.modelo_dispositivo = updateData.modeloDispositivo;
  if (updateData.imei !== undefined) dbUpdateData.imei = updateData.imei;
  if (updateData.numeroSerie !== undefined)
    dbUpdateData.numero_serie = updateData.numeroSerie;
  if (updateData.problemaReportado !== undefined)
    dbUpdateData.problema_reportado = updateData.problemaReportado;
  if (updateData.prioridad !== undefined)
    dbUpdateData.prioridad = updateData.prioridad;
  if (updateData.fechaEstimadaEntrega !== undefined)
    dbUpdateData.fecha_estimada_entrega =
      updateData.fechaEstimadaEntrega?.toISOString();
  if (updateData.notasInternas !== undefined)
    dbUpdateData.notas_internas = updateData.notasInternas;
  if (updateData.condicionDispositivo !== undefined)
    dbUpdateData.condicion_dispositivo = updateData.condicionDispositivo;

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .update(dbUpdateData)
    .eq("id", ordenId)
    .select()
    .single();

  if (error) {
    console.error("Error al actualizar información básica de orden:", error);
    throw new Error(`Error al actualizar orden: ${error.message}`);
  }

  return mapOrdenFromDB(data);
}

// =====================================================
// HISTORIAL DE ESTADOS
// =====================================================

/**
 * Obtiene el historial completo de cambios de estado de una orden
 * FASE 3: Timeline visual para tracking público
 */
export async function getHistorialEstadosOrden(ordenId: string): Promise<any[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("historial_estado_orden")
    .select(`
      *,
      usuario:users(name)
    `)
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener historial de estados:", error);
    throw new Error(`Error al obtener historial de estados: ${error.message}`);
  }

  return data || [];
}

// =====================================================
// REASIGNAR TÉCNICO
// =====================================================

/**
 * Reasigna una orden a un técnico diferente
 */
export async function reasignarTecnico(
  ordenId: string,
  nuevoTecnicoId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("reasignar_tecnico", {
    orden_uuid: ordenId,
    nuevo_tecnico_uuid: nuevoTecnicoId,
  });

  if (error) {
    console.error("Error al reasignar técnico:", error);
    throw new Error(`Error al reasignar técnico: ${error.message}`);
  }

  return true;
}

// =====================================================
// APROBAR PRESUPUESTO
// =====================================================

/**
 * Aprueba el presupuesto de una orden (cambia estado a "aprobado")
 */
export async function aprobarPresupuesto(
  ordenId: string
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .update({
      estado: "aprobado",
      aprobado_por_cliente: true,
      fecha_aprobacion: new Date().toISOString(),
    })
    .eq("id", ordenId)
    .select()
    .single();

  if (error) {
    console.error("Error al aprobar presupuesto:", error);
    throw new Error(`Error al aprobar presupuesto: ${error.message}`);
  }

  return mapOrdenFromDB(data);
}

/**
 * Aprueba parcialmente el presupuesto: cliente acepta solo el problema original,
 * rechaza los detalles adicionales encontrados en el diagnóstico.
 */
export async function aprobarPresupuestoParcial(
  ordenId: string,
  notasCliente?: string
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .update({
      estado: "aprobado",
      aprobado_por_cliente: true,
      fecha_aprobacion: new Date().toISOString(),
      aprobacion_parcial: true,
      notas_cliente: notasCliente || "Cliente aprobó solo el problema original, rechazó las adiciones del diagnóstico",
    })
    .eq("id", ordenId)
    .select()
    .single();

  if (error) {
    console.error("Error al aprobar presupuesto parcial:", error);
    throw new Error(`Error al aprobar presupuesto parcial: ${error.message}`);
  }

  return mapOrdenFromDB(data);
}

// =====================================================
// FUNCIONES DE GARANTÍAS
// =====================================================

/**
 * Crea una garantía para una orden completada
 */
export async function createGarantia(
  ordenId: string,
  garantiaData: Partial<GarantiaReparacion>
): Promise<GarantiaReparacion> {
  const supabase = createAdminClient();

  // Obtener la orden para obtener el cliente_id
  const orden = await getOrdenReparacionById(ordenId);
  if (!orden) {
    throw new Error("Orden no encontrada");
  }

  const diasGarantia = garantiaData.diasGarantia || 90;
  const fechaInicio = new Date();
  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + diasGarantia);

  const { data, error } = await supabase
    .from("garantias_reparacion")
    .insert({
      orden_id: ordenId,
      cliente_id: orden.clienteId,
      tipo_garantia: garantiaData.tipoGarantia || "garantia_pieza",
      dias_garantia: diasGarantia,
      fecha_inicio: fechaInicio.toISOString(),
      fecha_vencimiento: fechaVencimiento.toISOString(),
      estado: "activa",
      aplica_costo:
        garantiaData.tipoGarantia === "daño_cliente" ? true : false,
      notas: garantiaData.notas || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error al crear garantía:", error);
    throw new Error(`Error al crear garantía: ${error.message}`);
  }

  return mapGarantiaFromDB(data);
}

/**
 * Obtiene la garantía de una orden
 */
export async function getGarantiaByOrden(
  ordenId: string
): Promise<GarantiaReparacion | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("garantias_reparacion")
    .select("*")
    .eq("orden_id", ordenId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error al obtener garantía:", error);
    throw new Error(`Error al obtener garantía: ${error.message}`);
  }

  return data ? mapGarantiaFromDB(data) : null;
}

/**
 * Verifica si una orden tiene garantía activa
 */
export async function verificarGarantiaActiva(ordenId: string): Promise<{
  activa: boolean;
  garantia: GarantiaReparacion | null;
}> {
  const garantia = await getGarantiaByOrden(ordenId);

  if (!garantia) {
    return { activa: false, garantia: null };
  }

  const ahora = new Date();
  const activa =
    garantia.estado === "activa" && garantia.fechaVencimiento > ahora;

  return { activa, garantia };
}

/**
 * Crea una nueva orden en garantía (reclamo)
 */
export async function createOrdenGarantia(
  ordenOriginalId: string,
  motivoReclamo: string,
  creadoPor: string
): Promise<OrdenReparacion> {
  const supabase = createAdminClient();

  // Obtener orden original
  const ordenOriginal = await getOrdenReparacionById(ordenOriginalId);
  if (!ordenOriginal) {
    throw new Error("Orden original no encontrada");
  }

  // Verificar garantía activa
  const { activa, garantia } = await verificarGarantiaActiva(ordenOriginalId);
  if (!activa || !garantia) {
    throw new Error("La orden no tiene garantía activa");
  }

  // Determinar si aplica costo (solo si es daño del cliente)
  const aplicaCosto = garantia.tipoGarantia === "daño_cliente";
  const motivoGarantia = garantia.tipoGarantia;

  // Crear nueva orden marcada como garantía
  const nuevaOrden = await createOrdenReparacion(
    {
      clienteId: ordenOriginal.clienteId,
      marcaDispositivo: ordenOriginal.marcaDispositivo,
      modeloDispositivo: ordenOriginal.modeloDispositivo,
      imei: ordenOriginal.imei,
      numeroSerie: ordenOriginal.numeroSerie,
      problemaReportado: `GARANTÍA - ${motivoReclamo}`,
      prioridad: "alta",
      requiereAprobacion: aplicaCosto,
      costoReparacion: aplicaCosto ? ordenOriginal.costoReparacion : 0,
      costoPartes: aplicaCosto ? ordenOriginal.costoPartes : 0,
      partesReemplazadas: [],
    },
    creadoPor
  );

  // Actualizar orden para marcarla como garantía
  const { data, error } = await supabase
    .from("ordenes_reparacion")
    .update({
      es_garantia: true,
      orden_original_id: ordenOriginalId,
      motivo_garantia: motivoGarantia,
    })
    .eq("id", nuevaOrden.id)
    .select()
    .single();

  if (error) {
    console.error("Error al actualizar orden de garantía:", error);
    throw new Error(`Error al crear orden de garantía: ${error.message}`);
  }

  // Actualizar garantía original como "usada"
  await supabase
    .from("garantias_reparacion")
    .update({
      estado: "usada",
      orden_garantia_id: nuevaOrden.id,
      fecha_reclamo: new Date().toISOString(),
      motivo_reclamo: motivoReclamo,
    })
    .eq("id", garantia.id);

  return mapOrdenFromDB(data);
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

/**
 * Obtiene la carga de trabajo de todos los técnicos
 */
export async function getCargaTecnicos(): Promise<EstadisticasTecnico[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("obtener_carga_tecnicos");

  if (error) {
    console.error("Error al obtener carga de técnicos:", error);
    throw new Error(`Error al obtener carga de técnicos: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    tecnicoId: item.tecnico_id,
    nombreTecnico: item.nombre_tecnico,
    ordenesActivas: parseInt(item.ordenes_activas || 0),
    ordenesRecibidas: parseInt(item.ordenes_recibidas || 0),
    ordenesDiagnostico: parseInt(item.ordenes_diagnostico || 0),
    ordenesEnReparacion: parseInt(item.ordenes_en_reparacion || 0),
    ordenesCompletadasHoy: parseInt(item.ordenes_completadas_hoy || 0),
  }));
}

/**
 * Obtiene estadísticas generales de reparaciones
 */
export async function getEstadisticasReparaciones(distribuidorId?: string): Promise<{
  total: number;
  porEstado: Record<EstadoOrdenReparacion, number>;
  promedioReparacionDias: number;
  ingresosEsteMes: number;
}> {
  const supabase = createAdminClient();

  // Obtener todas las órdenes (filtradas por distribuidor si aplica)
  let statsQuery = supabase
    .from("ordenes_reparacion")
    .select("estado, costo_total, fecha_recepcion, fecha_completado");

  if (distribuidorId) statsQuery = statsQuery.eq("distribuidor_id", distribuidorId);

  const { data: ordenes, error } = await statsQuery;

  if (error) {
    console.error("Error al obtener estadísticas:", error);
    throw new Error(`Error al obtener estadísticas: ${error.message}`);
  }

  const total = ordenes?.length || 0;

  // Contar por estado
  const porEstado: Record<EstadoOrdenReparacion, number> = {
    recibido: 0,
    diagnostico: 0,
    esperando_piezas: 0,
    presupuesto: 0,
    aprobado: 0,
    en_reparacion: 0,
    completado: 0,
    listo_entrega: 0,
    entregado: 0,
    no_reparable: 0,
    cancelado: 0,
  };

  ordenes?.forEach((orden: any) => {
    porEstado[orden.estado as EstadoOrdenReparacion]++;
  });

  // Calcular promedio de días de reparación
  const ordenesCompletadas = ordenes?.filter(
    (o: any) => o.fecha_completado && o.fecha_recepcion
  );

  let promedioReparacionDias = 0;
  if (ordenesCompletadas && ordenesCompletadas.length > 0) {
    const totalDias = ordenesCompletadas.reduce((sum: number, orden: any) => {
      const inicio = new Date(orden.fecha_recepcion);
      const fin = new Date(orden.fecha_completado);
      const dias = Math.ceil(
        (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + dias;
    }, 0);
    promedioReparacionDias = Math.round(totalDias / ordenesCompletadas.length);
  }

  // Calcular ingresos del mes actual
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const ingresosEsteMes =
    ordenes
      ?.filter((o: any) => {
        if (!o.fecha_completado) return false;
        const fecha = new Date(o.fecha_completado);
        return fecha >= inicioMes;
      })
      .reduce((sum: number, orden: any) => sum + parseFloat(orden.costo_total || 0), 0) || 0;

  return {
    total,
    porEstado,
    promedioReparacionDias,
    ingresosEsteMes,
  };
}

/**
 * Obtiene historial completo de servicios de un cliente
 */
export async function getHistorialServiciosCliente(
  clienteId: string
): Promise<{
  ordenes: OrdenReparacion[];
  totalGastado: number;
  serviciosActivos: number;
  garantiasActivas: number;
}> {
  const ordenes = await getOrdenesByCliente(clienteId);

  const totalGastado = ordenes
    .filter((o) => o.estado === "entregado")
    .reduce((sum, orden) => sum + orden.costoTotal, 0);

  const serviciosActivos = ordenes.filter(
    (o) => !["entregado", "cancelado", "no_reparable"].includes(o.estado)
  ).length;

  const garantiasActivas = ordenes.filter((o) => o.esGarantia && o.estado !== "entregado").length;

  return {
    ordenes,
    totalGastado,
    serviciosActivos,
    garantiasActivas,
  };
}

/**
 * Búsqueda de órdenes por folio, IMEI, o modelo
 */
export async function searchOrdenes(query: string, distribuidorId?: string): Promise<OrdenReparacion[]> {
  const supabase = createAdminClient();

  let q = supabase
    .from("ordenes_reparacion")
    .select("*")
    .or(
      `folio.ilike.%${query}%,imei.ilike.%${query}%,modelo_dispositivo.ilike.%${query}%,marca_dispositivo.ilike.%${query}%`
    )
    .order("fecha_recepcion", { ascending: false })
    .limit(50);

  if (distribuidorId) q = q.eq("distribuidor_id", distribuidorId);

  const { data, error } = await q;

  if (error) {
    console.error("Error en búsqueda de órdenes:", error);
    throw new Error(`Error en búsqueda: ${error.message}`);
  }

  return mapOrdenesFromDB(data || []);
}

// =====================================================
// GESTIÓN DE ANTICIPOS
// =====================================================

/**
 * Obtiene todos los anticipos de una orden de reparación
 */
export async function getAnticiposByOrden(
  ordenId: string
): Promise<AnticipoReparacion[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("anticipos_reparacion")
    .select("*")
    .eq("orden_id", ordenId)
    .order("fecha_anticipo", { ascending: false });

  if (error) {
    console.error("Error al obtener anticipos:", error);
    throw new Error(`Error al obtener anticipos: ${error.message}`);
  }

  return (data || []).map(mapAnticipoFromDB);
}

function mapAnticipoFromDB(anticipo: any): AnticipoReparacion {
  return {
    id: anticipo.id,
    ordenId: anticipo.orden_id,
    monto: parseFloat(anticipo.monto),
    tipoPago: anticipo.tipo_pago,
    desgloseMixto: anticipo.desglose_mixto || undefined,
    referenciaPago: anticipo.referencia_pago || undefined,
    notas: anticipo.notas || undefined,
    recibidoPor: anticipo.recibido_por || anticipo.created_by || undefined,
    estado: (anticipo.estado as "pendiente" | "aplicado" | "devuelto") || "pendiente",
    fechaAplicado: anticipo.fecha_aplicado ? new Date(anticipo.fecha_aplicado) : undefined,
    fechaDevuelto: anticipo.fecha_devuelto ? new Date(anticipo.fecha_devuelto) : undefined,
    motivoDevolucion: anticipo.motivo_devolucion || undefined,
    fechaAnticipo: new Date(anticipo.fecha_anticipo),
    createdAt: new Date(anticipo.created_at),
  };
}

/**
 * Agrega un anticipo a una orden de reparación y lo registra en caja si hay sesión activa.
 */
export async function addAnticipoReparacion(
  ordenId: string,
  anticipo: {
    monto: number;
    tipoPago: TipoPago;
    desgloseMixto?: DesglosePagoMixto;
    referenciaPago?: string;
    notas?: string;
  },
  recibidoPor: string,
  sesionCajaId?: string,
  folioOrden?: string
): Promise<AnticipoReparacion> {
  const supabase = createAdminClient();

  const anticipoData: Record<string, unknown> = {
    orden_id: ordenId,
    monto: anticipo.monto,
    tipo_pago: anticipo.tipoPago,
    notas: anticipo.notas || null,
    recibido_por: recibidoPor,
    fecha_anticipo: new Date().toISOString(),
    estado: "pendiente",
    // FASE 41: Vincular con la sesión de caja para bolsa virtual
    sesion_caja_id: sesionCajaId || null,
  };
  if (anticipo.desgloseMixto) anticipoData.desglose_mixto = anticipo.desgloseMixto;
  if (anticipo.referenciaPago) anticipoData.referencia_pago = anticipo.referenciaPago;

  const { data, error } = await supabase
    .from("anticipos_reparacion")
    .insert([anticipoData])
    .select()
    .single();

  if (error) {
    console.error("Error al agregar anticipo:", error);
    throw new Error(`Error al agregar anticipo: ${error.message}`);
  }

  // Registrar entrada en caja si hay sesión activa
  if (sesionCajaId) {
    try {
      await supabase.from("caja_movimientos").insert({
        sesion_id: sesionCajaId,
        tipo: "entrada_anticipo",
        monto: anticipo.monto,
        concepto: `Anticipo reparación ${folioOrden || ordenId}`,
        autorizado_por: recibidoPor,
      });
    } catch (cajaErr) {
      console.error("No se pudo registrar anticipo en caja:", cajaErr);
      // No fallar el anticipo si la caja falla
    }
  }

  return mapAnticipoFromDB(data);
}

/**
 * Aplica un anticipo al momento de entregar el equipo (cobra el saldo final).
 * Marca todos los anticipos pendientes de la orden como 'aplicado'.
 * Registra el saldo final en caja.
 */
export async function aplicarAnticiposOrden(
  ordenId: string,
  folio: string,
  sesionCajaId: string | undefined,
  saldoFinal: number,
  metodoPagoSaldo: TipoPago,
  cobradoPor: string
): Promise<void> {
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();

  // 1. Marcar anticipos pendientes como aplicados
  await supabase
    .from("anticipos_reparacion")
    .update({ estado: "aplicado", fecha_aplicado: ahora })
    .eq("orden_id", ordenId)
    .eq("estado", "pendiente");

  // 2. Si hay saldo final y sesión de caja, registrar en caja
  if (sesionCajaId && saldoFinal > 0) {
    try {
      await supabase.from("caja_movimientos").insert({
        sesion_id: sesionCajaId,
        tipo: "deposito",
        monto: saldoFinal,
        concepto: `Saldo final reparación ${folio} (${metodoPagoSaldo})`,
        autorizado_por: cobradoPor,
      });
    } catch (cajaErr) {
      console.error("Error registrando saldo final en caja:", cajaErr);
    }
  }
}

/**
 * Devuelve todos los anticipos pendientes de una orden (al cancelar).
 */
export async function devolverAnticiposOrden(
  ordenId: string,
  folio: string,
  motivo: string,
  sesionCajaId: string | undefined,
  devueltoPor: string
): Promise<number> {
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();

  // Obtener anticipos pendientes
  const { data: anticiposPendientes } = await supabase
    .from("anticipos_reparacion")
    .select("id, monto")
    .eq("orden_id", ordenId)
    .eq("estado", "pendiente");

  if (!anticiposPendientes || anticiposPendientes.length === 0) return 0;

  const totalDevuelto = anticiposPendientes.reduce(
    (sum: number, a: any) => sum + parseFloat(a.monto),
    0
  );

  // Marcar como devueltos
  await supabase
    .from("anticipos_reparacion")
    .update({ estado: "devuelto", fecha_devuelto: ahora, motivo_devolucion: motivo })
    .eq("orden_id", ordenId)
    .eq("estado", "pendiente");

  // Registrar salida de caja
  if (sesionCajaId && totalDevuelto > 0) {
    try {
      await supabase.from("caja_movimientos").insert({
        sesion_id: sesionCajaId,
        tipo: "devolucion_anticipo",
        monto: totalDevuelto,
        concepto: `Devolución anticipo reparación ${folio}. Motivo: ${motivo}`,
        autorizado_por: devueltoPor,
      });
    } catch (cajaErr) {
      console.error("Error registrando devolución en caja:", cajaErr);
    }
  }

  return totalDevuelto;
}

// =====================================================
// FASE 23: PIEZAS DE INVENTARIO EN REPARACIONES
// =====================================================

function mapPiezaFromDB(row: any): PiezaReparacion {
  return {
    id: row.id,
    ordenId: row.orden_id,
    productoId: row.producto_id,
    nombrePieza: row.nombre_pieza,
    cantidad: row.cantidad,
    costoUnitario: parseFloat(row.costo_unitario),
    costoTotal: row.cantidad * parseFloat(row.costo_unitario),
    notas: row.notas || undefined,
    agregadoPor: row.agregado_por || undefined,
    createdAt: new Date(row.created_at),
    producto: row.productos
      ? {
          nombre: row.productos.nombre,
          stock: row.productos.stock,
          imagen: row.productos.imagen || undefined,
        }
      : undefined,
  };
}

/**
 * Obtiene todas las piezas de inventario usadas en una orden
 */
export async function getPiezasReparacion(
  ordenId: string
): Promise<PiezaReparacion[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reparacion_piezas")
    .select("*, productos(nombre, stock, imagen)")
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Error al obtener piezas: ${error.message}`);
  return (data || []).map(mapPiezaFromDB);
}

/**
 * Agrega una pieza del inventario a la reparación y descuenta el stock
 */
export async function agregarPiezaReparacion(
  ordenId: string,
  productoId: string,
  cantidad: number,
  costoUnitario: number,
  tecnicoId: string,
  notas?: string
): Promise<PiezaReparacion> {
  const supabase = createAdminClient();

  // Verificar stock disponible
  const { data: producto, error: prodError } = await supabase
    .from("productos")
    .select("id, nombre, stock, imagen")
    .eq("id", productoId)
    .single();

  if (prodError || !producto) {
    throw new Error("Producto no encontrado en el inventario");
  }

  if (producto.stock < cantidad) {
    throw new Error(
      `Stock insuficiente. Disponible: ${producto.stock}, solicitado: ${cantidad}`
    );
  }

  // Descontar del stock
  const { error: stockError } = await supabase
    .from("productos")
    .update({ stock: producto.stock - cantidad })
    .eq("id", productoId);

  if (stockError) {
    throw new Error(`Error al actualizar stock: ${stockError.message}`);
  }

  // Registrar la pieza usada
  const { data, error } = await supabase
    .from("reparacion_piezas")
    .insert({
      orden_id: ordenId,
      producto_id: productoId,
      nombre_pieza: producto.nombre,
      cantidad,
      costo_unitario: costoUnitario,
      notas: notas || null,
      agregado_por: tecnicoId,
    })
    .select("*, productos(nombre, stock, imagen)")
    .single();

  if (error) {
    // Si falla el insert, revertir el stock
    await supabase
      .from("productos")
      .update({ stock: producto.stock })
      .eq("id", productoId);
    throw new Error(`Error al registrar pieza: ${error.message}`);
  }

  // Actualizar costo_partes en la orden
  await recalcularCostoPiezas(ordenId);

  return mapPiezaFromDB(data);
}

/**
 * Quita una pieza de la reparación y devuelve el stock al inventario
 */
export async function quitarPiezaReparacion(
  piezaId: string,
  ordenId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Obtener la pieza para saber qué devolver
  const { data: pieza, error: getError } = await supabase
    .from("reparacion_piezas")
    .select("producto_id, cantidad")
    .eq("id", piezaId)
    .eq("orden_id", ordenId)
    .single();

  if (getError || !pieza) {
    throw new Error("Pieza no encontrada en esta reparación");
  }

  // Devolver stock al inventario
  const { data: producto } = await supabase
    .from("productos")
    .select("stock")
    .eq("id", pieza.producto_id)
    .single();

  if (producto) {
    await supabase
      .from("productos")
      .update({ stock: producto.stock + pieza.cantidad })
      .eq("id", pieza.producto_id);
  }

  // Eliminar el registro de la pieza
  const { error: delError } = await supabase
    .from("reparacion_piezas")
    .delete()
    .eq("id", piezaId)
    .eq("orden_id", ordenId);

  if (delError) throw new Error(`Error al quitar pieza: ${delError.message}`);

  // Recalcular costo_partes en la orden
  await recalcularCostoPiezas(ordenId);
}

/**
 * Devuelve todas las piezas de una orden al inventario (al cancelar)
 * Se llama internamente cuando se cancela una reparación
 */
export async function devolverTodasLasPiezas(ordenId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: piezas, error } = await supabase
    .from("reparacion_piezas")
    .select("producto_id, cantidad")
    .eq("orden_id", ordenId);

  if (error || !piezas || piezas.length === 0) return;

  // Devolver stock de cada pieza
  for (const pieza of piezas) {
    const { data: producto } = await supabase
      .from("productos")
      .select("stock")
      .eq("id", pieza.producto_id)
      .single();

    if (producto) {
      await supabase
        .from("productos")
        .update({ stock: producto.stock + pieza.cantidad })
        .eq("id", pieza.producto_id);
    }
  }

  // Eliminar todos los registros de piezas de la orden
  await supabase
    .from("reparacion_piezas")
    .delete()
    .eq("orden_id", ordenId);
}

/**
 * Recalcula y actualiza costo_partes en la orden basado en las piezas registradas
 */
async function recalcularCostoPiezas(ordenId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: piezas } = await supabase
    .from("reparacion_piezas")
    .select("cantidad, costo_unitario")
    .eq("orden_id", ordenId);

  const totalPiezas = (piezas || []).reduce(
    (sum: number, p: any) => sum + p.cantidad * parseFloat(p.costo_unitario),
    0
  );

  // Obtener costo_reparacion actual para recalcular costo_total
  const { data: orden } = await supabase
    .from("ordenes_reparacion")
    .select("costo_reparacion")
    .eq("id", ordenId)
    .single();

  const costoReparacion = parseFloat(orden?.costo_reparacion || 0);

  await supabase
    .from("ordenes_reparacion")
    .update({
      costo_partes: totalPiezas,
      costo_total: costoReparacion + totalPiezas,
    })
    .eq("id", ordenId);
}

// =====================================================
// FASE 24: Solicitudes de Piezas al Distribuidor
// =====================================================

function mapSolicitudFromDB(s: any): SolicitudPieza {
  return {
    id: s.id,
    ordenId: s.orden_id,
    productoId: s.producto_id ?? undefined,
    nombrePieza: s.nombre_pieza,
    descripcion: s.descripcion ?? undefined,
    cantidad: s.cantidad,
    estado: s.estado as EstadoSolicitudPieza,
    solicitadoPor: s.solicitado_por ?? undefined,
    notas: s.notas ?? undefined,
    fechaEstimadaLlegada: s.fecha_estimada_llegada
      ? new Date(s.fecha_estimada_llegada)
      : undefined,
    createdAt: new Date(s.created_at),
    updatedAt: new Date(s.updated_at),
    orden: s.ordenes_reparacion
      ? { folio: s.ordenes_reparacion.folio }
      : undefined,
    producto: s.productos
      ? {
          nombre: s.productos.nombre,
          marca: s.productos.marca ?? undefined,
          modelo: s.productos.modelo ?? undefined,
        }
      : undefined,
  };
}

export async function getSolicitudesPieza(ordenId: string): Promise<SolicitudPieza[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("solicitudes_piezas")
    .select(`
      *,
      ordenes_reparacion(folio),
      productos(nombre, marca, modelo)
    `)
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(mapSolicitudFromDB);
}

export async function crearSolicitudPieza(
  ordenId: string,
  data: {
    productoId?: string;
    nombrePieza: string;
    descripcion?: string;
    cantidad: number;
    notas?: string;
    fechaEstimadaLlegada?: string;
  },
  tecnicoId: string
): Promise<SolicitudPieza> {
  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("solicitudes_piezas")
    .insert({
      orden_id: ordenId,
      producto_id: data.productoId ?? null,
      nombre_pieza: data.nombrePieza,
      descripcion: data.descripcion ?? null,
      cantidad: data.cantidad,
      notas: data.notas ?? null,
      fecha_estimada_llegada: data.fechaEstimadaLlegada ?? null,
      solicitado_por: tecnicoId,
      estado: "pendiente",
    })
    .select(`
      *,
      ordenes_reparacion(folio),
      productos(nombre, marca, modelo)
    `)
    .single();

  if (error) throw new Error(error.message);
  return mapSolicitudFromDB(inserted);
}

export async function actualizarEstadoSolicitud(
  solicitudId: string,
  estado: EstadoSolicitudPieza,
  notas?: string
): Promise<SolicitudPieza> {
  const supabase = createAdminClient();
  const updateData: any = { estado };
  if (notas !== undefined) updateData.notas = notas;

  const { data, error } = await supabase
    .from("solicitudes_piezas")
    .update(updateData)
    .eq("id", solicitudId)
    .select(`
      *,
      ordenes_reparacion(folio),
      productos(nombre, marca, modelo)
    `)
    .single();

  if (error) throw new Error(error.message);
  return mapSolicitudFromDB(data);
}

export async function eliminarSolicitudPieza(solicitudId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("solicitudes_piezas")
    .delete()
    .eq("id", solicitudId);

  if (error) throw new Error(error.message);
}

// =====================================================
// FASE 24: Garantías de Piezas
// =====================================================

function mapGarantiaPiezaFromDB(g: any): GarantiaPieza {
  return {
    id: g.id,
    ordenId: g.orden_id,
    piezaReparacionId: g.pieza_reparacion_id,
    nombrePieza: g.nombre_pieza,
    motivoGarantia: g.motivo_garantia,
    estado: g.estado as EstadoGarantiaPieza,
    tipoResolucion: g.tipo_resolucion ?? undefined,
    notasResolucion: g.notas_resolucion ?? undefined,
    solicitadoPor: g.solicitado_por ?? undefined,
    resueltoPor: g.resuelto_por ?? undefined,
    fechaResolucion: g.fecha_resolucion ? new Date(g.fecha_resolucion) : undefined,
    createdAt: new Date(g.created_at),
    updatedAt: new Date(g.updated_at),
    piezaReparacion: g.reparacion_piezas
      ? {
          nombrePieza: g.reparacion_piezas.nombre_pieza,
          cantidad: g.reparacion_piezas.cantidad,
          costoUnitario: parseFloat(g.reparacion_piezas.costo_unitario),
          productoId: g.reparacion_piezas.producto_id,
        }
      : undefined,
  };
}

export async function getGarantiasPieza(ordenId: string): Promise<GarantiaPieza[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("garantias_piezas")
    .select(`
      *,
      reparacion_piezas(nombre_pieza, cantidad, costo_unitario, producto_id)
    `)
    .eq("orden_id", ordenId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(mapGarantiaPiezaFromDB);
}

export async function crearGarantiaPieza(
  ordenId: string,
  piezaReparacionId: string,
  motivoGarantia: string,
  tecnicoId: string
): Promise<GarantiaPieza> {
  const supabase = createAdminClient();

  // Obtener el nombre de la pieza como snapshot
  const { data: pieza, error: piezaError } = await supabase
    .from("reparacion_piezas")
    .select("nombre_pieza, cantidad, costo_unitario, producto_id")
    .eq("id", piezaReparacionId)
    .single();

  if (piezaError || !pieza) throw new Error("Pieza no encontrada");

  const { data: inserted, error } = await supabase
    .from("garantias_piezas")
    .insert({
      orden_id: ordenId,
      pieza_reparacion_id: piezaReparacionId,
      nombre_pieza: pieza.nombre_pieza,
      motivo_garantia: motivoGarantia,
      estado: "pendiente",
      solicitado_por: tecnicoId,
    })
    .select(`
      *,
      reparacion_piezas(nombre_pieza, cantidad, costo_unitario, producto_id)
    `)
    .single();

  if (error) throw new Error(error.message);
  return mapGarantiaPiezaFromDB(inserted);
}

export async function resolverGarantiaPieza(
  garantiaId: string,
  tipoResolucion: TipoResolucionGarantiaPieza,
  notasResolucion: string,
  resueltoPorId: string
): Promise<GarantiaPieza> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("garantias_piezas")
    .update({
      estado: "resuelta",
      tipo_resolucion: tipoResolucion,
      notas_resolucion: notasResolucion,
      resuelto_por: resueltoPorId,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq("id", garantiaId)
    .select(`
      *,
      reparacion_piezas(nombre_pieza, cantidad, costo_unitario, producto_id)
    `)
    .single();

  if (error) throw new Error(error.message);
  return mapGarantiaPiezaFromDB(data);
}

export async function actualizarEstadoGarantia(
  garantiaId: string,
  estado: EstadoGarantiaPieza
): Promise<GarantiaPieza> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("garantias_piezas")
    .update({ estado })
    .eq("id", garantiaId)
    .select(`
      *,
      reparacion_piezas(nombre_pieza, cantidad, costo_unitario, producto_id)
    `)
    .single();

  if (error) throw new Error(error.message);
  return mapGarantiaPiezaFromDB(data);
}
