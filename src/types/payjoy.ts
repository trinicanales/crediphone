// =====================================================
// FASE 20: TIPOS PARA INTEGRACIÓN CON PAYJOY
// =====================================================

// --- Event Types ---

/** Tipos de eventos que envía Payjoy vía webhook */
export type PayjoyEventType =
  | "payment.received"
  | "payment.reversed"
  | "order.completed"
  | "order.defaulted"
  | "device.locked"
  | "device.unlocked";

/** Métodos de pago reportados desde Payjoy */
export type PayjoyPaymentMethod =
  | "cash"
  | "card"
  | "transfer"
  | "mixed"
  | "other";

/** Estado de conexión con API de Payjoy */
export type PayjoyConnectionStatus = "connected" | "error" | "unknown";

// --- Webhook Payload ---

/** Payload que envía Payjoy en cada webhook */
export interface PayjoyWebhookPayload {
  event_type: PayjoyEventType;
  timestamp: string;
  data: {
    finance_order_id: string;
    customer_id: string;
    transaction_id?: string;
    amount?: number;
    currency?: string;
    payment_method?: PayjoyPaymentMethod;
    payment_date?: string;
    customer_name?: string;
    customer_phone?: string;
    device_imei?: string;
    remaining_balance?: number;
    total_paid?: number;
    installment_number?: number;
    total_installments?: number;
  };
}

// --- Webhook Record (DB) ---

/** Registro de webhook almacenado en payjoy_webhooks */
export interface PayjoyWebhookRecord {
  id: string;
  eventType: string;
  financeOrderId?: string;
  customerId?: string;
  transactionId?: string;
  amount?: number;
  currency: string;
  paymentDate?: Date;
  rawPayload: PayjoyWebhookPayload;
  signature?: string;
  ipAddress?: string;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  pagoId?: string;
  creditoId?: string;
  createdAt: Date;
}

// --- API Log Record (DB) ---

/** Registro de llamada a API de Payjoy almacenado en payjoy_api_logs */
export interface PayjoyApiLogRecord {
  id: string;
  endpoint: string;
  method: string;
  requestPayload?: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
  creditoId?: string;
  createdAt: Date;
}

// --- Cliente/Customer Payjoy ---

/** Datos de un cliente consultado desde Payjoy API */
export interface PayjoyCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  activeFinanceOrders: PayjoyFinanceOrderSummary[];
  totalOrders: number;
  creditScore?: number;
  hasActiveCredit: boolean;
}

/** Resumen de una orden de financiamiento en Payjoy */
export interface PayjoyFinanceOrderSummary {
  financeOrderId: string;
  deviceImei?: string;
  deviceModel?: string;
  totalAmount: number;
  remainingBalance: number;
  totalPaid: number;
  status: string;
  startDate: string;
  nextPaymentDate?: string;
  installmentsPaid: number;
  totalInstallments: number;
}

/** Orden de financiamiento detallada desde Payjoy API */
export interface PayjoyFinanceOrder {
  financeOrderId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deviceImei?: string;
  deviceModel?: string;
  deviceBrand?: string;
  totalAmount: number;
  downPayment: number;
  remainingBalance: number;
  totalPaid: number;
  monthlyPayment: number;
  interestRate: number;
  status: string;
  startDate: string;
  endDate?: string;
  nextPaymentDate?: string;
  installmentsPaid: number;
  totalInstallments: number;
  payments: PayjoyPaymentRecord[];
}

/** Registro de pago individual desde Payjoy */
export interface PayjoyPaymentRecord {
  transactionId: string;
  amount: number;
  paymentMethod: PayjoyPaymentMethod;
  paymentDate: string;
  installmentNumber: number;
}

// --- Configuración Payjoy ---

/** Configuración de Payjoy almacenada en la tabla configuracion */
export interface PayjoyConfig {
  payjoyEnabled: boolean;
  payjoyWebhookUrl?: string;
  payjoyAutoSyncPayments: boolean;
  payjoyLastConnectionTest?: Date;
  payjoyConnectionStatus?: PayjoyConnectionStatus;
}

/** Configuración de comisiones almacenada en la tabla configuracion */
export interface ComisionesConfig {
  comisionTipo: "fijo" | "porcentaje";
  comisionMontoFijo: number;
  comisionPorcentajeVenta: number;
}

// --- Request/Response Types para API Routes ---

/** Request para buscar cliente en Payjoy */
export interface LookupCustomerRequest {
  phoneNumber?: string;
  imei?: string;
  customerId?: string;
}

/** Request para vincular crédito con Payjoy */
export interface LinkCreditRequest {
  creditoId: string;
  financeOrderId: string;
  customerId: string;
  syncEnabled?: boolean;
}

/** Request para importar cliente desde Payjoy */
export interface ImportCustomerRequest {
  customerId: string;
  phoneNumber?: string;
}

/** Response estándar de la API de Payjoy */
export interface PayjoyApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Response de la prueba de conexión */
export interface TestConnectionResponse {
  connected: boolean;
  status: PayjoyConnectionStatus;
  message: string;
  latencyMs?: number;
  testedAt: Date;
}

/** Response de exportación de datos */
export interface ExportDataResponse {
  webhooks: PayjoyWebhookRecord[];
  apiLogs: PayjoyApiLogRecord[];
  stats: {
    totalWebhooks: number;
    processedWebhooks: number;
    failedWebhooks: number;
    totalApiCalls: number;
    avgLatencyMs: number;
  };
  exportedAt: Date;
}

// --- Stats para UI ---

/** Estadísticas de Payjoy para el cierre de caja */
export interface PayjoyCajaStats {
  totalPagosPayjoy: number;
  montoTotalPayjoy: number;
  desglosePagos: PayjoyCajaPagoDetalle[];
}

/** Detalle de un pago Payjoy en el cierre de caja */
export interface PayjoyCajaPagoDetalle {
  pagoId: string;
  transactionId: string;
  clienteNombre: string;
  monto: number;
  payjoyPaymentMethod: string;
  hora: Date;
}

/** Estadísticas generales de la integración Payjoy */
export interface PayjoyDashboardStats {
  webhooksHoy: number;
  webhooksFallidos: number;
  pagosPayjoyHoy: number;
  montoPayjoyHoy: number;
  creditosVinculados: number;
  ultimoWebhook?: Date;
}
