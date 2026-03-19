import { createAdminClient } from "@/lib/supabase/admin";
import type { Configuracion } from "@/types";

/**
 * Obtiene la configuracion del sistema.
 * Si se pasa distribuidorId, filtra por ese distribuidor (multi-tenant).
 */
export async function getConfiguracion(
  distribuidorId?: string | null
): Promise<Configuracion> {
  const supabase = createAdminClient();

  let query = supabase.from("configuracion").select("*");

  if (distribuidorId) {
    query = query.eq("distribuidor_id", distribuidorId);
  }

  const { data, error } = await query.limit(1).single();

  if (error) throw error;
  return mapConfigFromDB(data);
}

/**
 * Actualiza la configuracion del sistema.
 * distribuidorId es requerido para multi-tenant — filtra la fila correcta.
 */
export async function updateConfiguracion(
  config: Partial<Configuracion>,
  updatedBy?: string,
  distribuidorId?: string | null
): Promise<Configuracion> {
  const supabase = createAdminClient();

  const updateData: Record<string, any> = {};

  // Mapear campos camelCase a snake_case
  if (config.nombreEmpresa !== undefined)
    updateData.nombre_empresa = config.nombreEmpresa;
  if (config.rfc !== undefined) updateData.rfc = config.rfc;
  if (config.direccionEmpresa !== undefined)
    updateData.direccion_empresa = config.direccionEmpresa;
  if (config.telefonoEmpresa !== undefined)
    updateData.telefono_empresa = config.telefonoEmpresa;
  if (config.whatsappNumero !== undefined)
    updateData.whatsapp_numero = config.whatsappNumero;
  if (config.comisionVendedorDefault !== undefined)
    updateData.comision_vendedor_default = config.comisionVendedorDefault;
  if (config.comisionCobradorDefault !== undefined)
    updateData.comision_cobrador_default = config.comisionCobradorDefault;
  if (config.tasaMoraDiaria !== undefined)
    updateData.tasa_mora_diaria = config.tasaMoraDiaria;
  if (config.diasGracia !== undefined)
    updateData.dias_gracia = config.diasGracia;
  if (config.diasGarantiaDefault !== undefined)
    updateData.dias_garantia_default = config.diasGarantiaDefault;
  if (config.notificacionesActivas !== undefined)
    updateData.notificaciones_activas = config.notificacionesActivas;
  if (config.modulosHabilitados !== undefined)
    updateData.modulos_habilitados = config.modulosHabilitados;
  // FASE 20: Campos Payjoy
  if (config.payjoyEnabled !== undefined)
    updateData.payjoy_enabled = config.payjoyEnabled;
  if (config.payjoyWebhookUrl !== undefined)
    updateData.payjoy_webhook_url = config.payjoyWebhookUrl;
  if (config.payjoyAutoSyncPayments !== undefined)
    updateData.payjoy_auto_sync_payments = config.payjoyAutoSyncPayments;
  // FASE 20: Campos Comisiones
  if (config.comisionTipo !== undefined)
    updateData.comision_tipo = config.comisionTipo;
  if (config.comisionMontoFijo !== undefined)
    updateData.comision_monto_fijo = config.comisionMontoFijo;
  if (config.comisionPorcentajeVenta !== undefined)
    updateData.comision_porcentaje_venta = config.comisionPorcentajeVenta;
  // FASE 33: Datos del negocio extendidos
  if (config.emailEmpresa !== undefined)
    updateData.email_empresa = config.emailEmpresa;
  if (config.regimenFiscal !== undefined)
    updateData.regimen_fiscal = config.regimenFiscal;
  // FASE 33: Créditos por defecto
  if (config.tasaInteresDefault !== undefined)
    updateData.tasa_interes_default = config.tasaInteresDefault;
  if (config.plazoMaximoSemanas !== undefined)
    updateData.plazo_maximo_semanas = config.plazoMaximoSemanas;
  if (config.engancheMinimoPct !== undefined)
    updateData.enganche_minimo_pct = config.engancheMinimoPct;
  if (config.frecuenciaPagoDefault !== undefined)
    updateData.frecuencia_pago_default = config.frecuenciaPagoDefault;
  if (config.montoMaximoCredito !== undefined)
    updateData.monto_maximo_credito = config.montoMaximoCredito;
  // FASE 33: POS
  if (config.permitirVentasSinCliente !== undefined)
    updateData.permitir_ventas_sin_cliente = config.permitirVentasSinCliente;
  if (config.descuentoMaximoPct !== undefined)
    updateData.descuento_maximo_pct = config.descuentoMaximoPct;
  if (config.diasMaxDevolucion !== undefined)
    updateData.dias_max_devolucion = config.diasMaxDevolucion;
  // FASE 33: Notificaciones avanzadas
  if (config.diasAnticipacionRecordatorio !== undefined)
    updateData.dias_anticipacion_recordatorio = config.diasAnticipacionRecordatorio;
  if (config.mensajeRecordatorio !== undefined)
    updateData.mensaje_recordatorio = config.mensajeRecordatorio;
  // FASE 28: Sonidos
  if (config.sonidosConfig !== undefined) {
    updateData.sonidos_config = config.sonidosConfig
      ? {
          habilitado: config.sonidosConfig.habilitado,
          volumen: config.sonidosConfig.volumen,
          sonido_default: config.sonidosConfig.sonidoDefault,
          mapeo_eventos: config.sonidosConfig.mapeoEventos,
          sonido_custom_url: config.sonidosConfig.sonidoCustomUrl ?? null,
        }
      : null;
  }
  // FASE 40: Caja — fondo fijo y tolerancia descuadre
  if (config.fondoCaja !== undefined)
    updateData.fondo_caja = config.fondoCaja;
  if (config.toleranciaDescuadre !== undefined)
    updateData.tolerancia_descuadre = config.toleranciaDescuadre;
  // FASE 47-lite: Datos del contador externo
  if (config.contadorNombre   !== undefined) updateData.contador_nombre   = config.contadorNombre;
  if (config.contadorTelefono !== undefined) updateData.contador_telefono = config.contadorTelefono;
  if (config.contadorEmail    !== undefined) updateData.contador_email    = config.contadorEmail;
  if (updatedBy) updateData.updated_by = updatedBy;

  // 1. Obtener el ID de la fila a actualizar (filtrando por distribuidor_id)
  let selectQuery = supabase.from("configuracion").select("id");
  if (distribuidorId) {
    selectQuery = selectQuery.eq("distribuidor_id", distribuidorId);
  }
  const { data: existing, error: selectError } = await selectQuery.limit(1).single();
  if (selectError || !existing) {
    throw new Error(
      "No se encontró la fila de configuración para actualizar. " +
        (selectError?.message || "")
    );
  }

  // 2. Actualizar por ID para garantizar que solo se modifica 1 fila
  const { data, error } = await supabase
    .from("configuracion")
    .update(updateData)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) throw error;
  return mapConfigFromDB(data);
}

/**
 * Mapea los datos de la base de datos (snake_case) a la interfaz TypeScript (camelCase)
 */
function mapConfigFromDB(db: any): Configuracion {
  return {
    id: db.id,
    nombreEmpresa: db.nombre_empresa || "CREDIPHONE",
    rfc: db.rfc || "",
    direccionEmpresa: db.direccion_empresa || "",
    telefonoEmpresa: db.telefono_empresa || "",
    whatsappNumero: db.whatsapp_numero || "",
    emailEmpresa: db.email_empresa || "",
    regimenFiscal: db.regimen_fiscal || "",
    comisionVendedorDefault: parseFloat(db.comision_vendedor_default) || 5,
    comisionCobradorDefault: parseFloat(db.comision_cobrador_default) || 0,
    tasaMoraDiaria: parseFloat(db.tasa_mora_diaria) || 50,
    diasGracia: db.dias_gracia ?? 3,
    diasGarantiaDefault: db.dias_garantia_default ?? 90,
    notificacionesActivas: db.notificaciones_activas ?? true,
    modulosHabilitados: db.modulos_habilitados,
    // FASE 20: Payjoy
    payjoyEnabled: db.payjoy_enabled ?? false,
    payjoyWebhookUrl: db.payjoy_webhook_url || undefined,
    payjoyAutoSyncPayments: db.payjoy_auto_sync_payments ?? true,
    payjoyLastConnectionTest: db.payjoy_last_connection_test
      ? new Date(db.payjoy_last_connection_test)
      : undefined,
    payjoyConnectionStatus: db.payjoy_connection_status || undefined,
    // FASE 20: Comisiones
    comisionTipo: db.comision_tipo || "porcentaje",
    comisionMontoFijo: parseFloat(db.comision_monto_fijo) || 100,
    comisionPorcentajeVenta: parseFloat(db.comision_porcentaje_venta) || 1,
    // FASE 33: Créditos por defecto
    tasaInteresDefault: parseFloat(db.tasa_interes_default) || 0,
    plazoMaximoSemanas: db.plazo_maximo_semanas ?? 52,
    engancheMinimoPct: parseFloat(db.enganche_minimo_pct) || 10,
    frecuenciaPagoDefault: db.frecuencia_pago_default || "semanal",
    montoMaximoCredito: parseFloat(db.monto_maximo_credito) || 0,
    // FASE 33: POS
    permitirVentasSinCliente: db.permitir_ventas_sin_cliente ?? true,
    descuentoMaximoPct: parseFloat(db.descuento_maximo_pct) || 100,
    diasMaxDevolucion: db.dias_max_devolucion ?? 30,
    // FASE 33: Notificaciones avanzadas
    diasAnticipacionRecordatorio: db.dias_anticipacion_recordatorio ?? 3,
    mensajeRecordatorio: db.mensaje_recordatorio || "Hola {nombre}, te recordamos que tienes un pago de {monto} con vencimiento el {fecha}. ¡Evita cargos por mora!",
    updatedAt: new Date(db.updated_at),
    updatedBy: db.updated_by,
    // FASE 28: Sonidos y push
    sonidosConfig: db.sonidos_config
      ? {
          habilitado: db.sonidos_config.habilitado ?? true,
          volumen: db.sonidos_config.volumen ?? 0.7,
          sonidoDefault: db.sonidos_config.sonido_default ?? "cristal",
          mapeoEventos: db.sonidos_config.mapeo_eventos ?? {},
          sonidoCustomUrl: db.sonidos_config.sonido_custom_url ?? null,
        }
      : undefined,
    // FASE 40: Caja — fondo fijo y tolerancia descuadre
    fondoCaja: db.fondo_caja != null ? parseFloat(db.fondo_caja) : 500,
    toleranciaDescuadre: db.tolerancia_descuadre != null ? parseFloat(db.tolerancia_descuadre) : 0,
    // FASE 47-lite: Datos del contador externo
    contadorNombre:   db.contador_nombre   ?? undefined,
    contadorTelefono: db.contador_telefono ?? undefined,
    contadorEmail:    db.contador_email    ?? undefined,
  };
}
