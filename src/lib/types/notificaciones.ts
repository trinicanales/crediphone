// =====================================================
// TIPOS PARA SISTEMA DE NOTIFICACIONES Y RECORDATORIOS
// =====================================================

/**
 * Tipo de notificación enviada al cliente
 */
export type TipoNotificacion =
  | 'proximo_vencer'  // Crédito próximo a vencer (3-7 días)
  | 'vencido'         // Crédito vencido (con mora)
  | 'mora_alta'       // Mora alta (>30 días)
  | 'pago_recibido';  // Confirmación de pago recibido

/**
 * Canal de comunicación utilizado
 */
export type CanalNotificacion =
  | 'whatsapp'   // WhatsApp Web (prioritario)
  | 'email'      // Correo electrónico
  | 'sms'        // Mensaje de texto
  | 'llamada'    // Llamada telefónica
  | 'visita';    // Visita presencial

/**
 * Estado actual de la notificación
 */
export type EstadoNotificacion =
  | 'pendiente'   // No enviada aún
  | 'enviado'     // Enviada pero no confirmada entrega
  | 'entregado'   // Confirmada entrega
  | 'fallido'     // Falló el envío
  | 'respondido'; // Cliente respondió

/**
 * Prioridad de la alerta
 */
export type PrioridadAlerta =
  | 'baja'      // Vence en 4-7 días
  | 'media'     // Vence en 1-3 días o mora 1-7 días
  | 'alta'      // Vence hoy/mañana o mora 7-30 días
  | 'urgente';  // Mora >30 días

/**
 * Interface para notificación completa
 */
export interface Notificacion {
  id: string;
  creditoId: string;
  clienteId: string;
  tipo: TipoNotificacion;
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  mensaje: string;
  telefono?: string;
  email?: string;
  enviadoPor?: string;
  fechaProgramada?: string;
  fechaEnviado?: string;
  fechaLeido?: string;
  respuesta?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface para alerta de recordatorio
 * (usado en dashboard y lista de recordatorios)
 */
export interface AlertaRecordatorio {
  credito: {
    id: string;
    folio: string;
    monto: number;
    saldoPendiente: number;
    fechaFin: string;
    diasMora: number;
    estado: string;
  };
  cliente: {
    id: string;
    nombre: string;
    apellido: string;
    telefono: string;
    whatsapp?: string;
    email?: string;
  };
  tipo: TipoNotificacion;
  prioridad: PrioridadAlerta;
  diasHastaVencimiento?: number;
  ultimaNotificacion?: {
    fecha: string;
    canal: CanalNotificacion;
  };
}

/**
 * Interface para preferencias de notificación
 */
export interface NotificacionPreferencias {
  id: string;
  clienteId: string;
  whatsappHabilitado: boolean;
  emailHabilitado: boolean;
  smsHabilitado: boolean;
  diasAnticipacion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface para respuesta de API de recordatorios
 */
export interface RecordatoriosResponse {
  success: boolean;
  data: {
    total: number;
    alertas: AlertaRecordatorio[];
    porPrioridad: {
      urgente: number;
      alta: number;
      media: number;
      baja: number;
    };
    alertasPorPrioridad: {
      urgente: AlertaRecordatorio[];
      alta: AlertaRecordatorio[];
      media: AlertaRecordatorio[];
      baja: AlertaRecordatorio[];
    };
  };
  error?: string;
  message?: string;
}

/**
 * Interface para opciones de filtrado
 */
export interface RecordatoriosOptions {
  diasAnticipacion?: number;
  soloVencidos?: boolean;
  prioridad?: PrioridadAlerta;
  vendedorId?: string;
  distribuidorId?: string;
}

/**
 * Interface para datos de envío de notificación
 */
export interface EnviarNotificacionData {
  creditoId: string;
  clienteId: string;
  canal: CanalNotificacion;
  mensaje: string;
  telefono?: string;
  email?: string;
}
