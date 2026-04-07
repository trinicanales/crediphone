// Tipos principales del sistema CREDIPHONE

// Roles de usuario/empleado
export type UserRole = "super_admin" | "admin" | "vendedor" | "cobrador" | "tecnico";

// Módulo Franquicia — configuración independiente por distribuidor
export type ModoOperacion = "red" | "franquicia";
export type TipoAcceso = "incluido" | "renta";

export interface PagosHabilitados {
  efectivo: boolean;
  tarjeta: boolean;
  transferencia: boolean;
  deposito: boolean;
  payjoy: boolean;
}

export interface FranquiciaConfig {
  modoOperacion: ModoOperacion;
  grupoInventario?: string;
  accesoHabilitado: boolean;
  tipoAcceso: TipoAcceso;
  pagosHabilitados: PagosHabilitados;
  notasFranquicia?: string;
}

export interface Distribuidor {
  id: string;
  nombre: string;
  slug: string;
  logoUrl?: string;
  activo: boolean;
  configuracion?: Record<string, any>;
  // Módulo Franquicia
  franquicia?: FranquiciaConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  distribuidorId?: string; // FASE 21: Multi-tenant
  // Campos de RH (FASE 7)
  telefono?: string;
  direccion?: string;
  fechaIngreso?: Date;
  sueldoBase?: number;
  comisionPorcentaje?: number;
  fotoPerfil?: string;
  activo: boolean;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Alias para mayor claridad en el módulo de empleados
export type Empleado = User;

// Tipo para formularios de empleado (sin id, createdAt, updatedAt)
export type EmpleadoFormData = Omit<Empleado, "id" | "createdAt" | "updatedAt">;

// Tipos para estadísticas de desempeño
export interface DesempenoVendedor {
  totalCreditos: number;
  montoTotalVendido: number;
  comisionGanada: number;
}

export interface DesempenoCobrador {
  totalPagos: number;
  montoTotalCobrado: number;
}

export interface Cliente {
  id: string;
  distribuidorId?: string; // FASE 21
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  direccion: string;
  curp: string;
  ine: string;
  // Campos de INE (FASE 4)
  ineNumero?: string;
  ineOcr?: string;
  fechaNacimiento?: Date;
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  colonia?: string;
  municipio?: string;
  estado?: string;
  codigoPostal?: string;
  seccionElectoral?: string;
  vigencia?: Date;
  claveElector?: string;
  imagenIneFrontal?: string;
  imagenIneReverso?: string;
  // Alias para compatibilidad con formulario
  fotoIneFrontal?: string;
  fotoIneReverso?: string;
  fotoComprobanteDomicilio?: string;
  fotoAdicional1?: string;
  fotoAdicional2?: string;
  // Consentimiento WhatsApp (FASE 27)
  aceptaNotificacionesWhatsapp?: boolean;
  aceptaPromocionesWhatsapp?: boolean;
  preferenciasPromociones?: {
    accesorios?: boolean;
    combos?: boolean;
    celulares?: boolean;
  };
  fechaConsentimiento?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Credito {
  id: string;
  distribuidorId?: string; // FASE 21
  folio?: string; // Formato: CRED-2024-00001
  clienteId: string;
  monto: number; // Monto total a financiar (después de enganche)
  montoOriginal?: number; // Valor original del producto/crédito
  enganche?: number; // Enganche pagado (10% por defecto)
  enganchePorcentaje?: number; // Porcentaje de enganche (10-50%)
  plazo: number; // meses
  tasaInteres: number; // porcentaje anual
  frecuenciaPago?: "semanal" | "quincenal" | "mensual";
  montoPago?: number; // monto de cada pago según frecuencia
  pagoQuincenal: number; // mantener por compatibilidad con DB
  fechaInicio: Date;
  fechaFin: Date;
  estado: "activo" | "pagado" | "vencido" | "cancelado";
  diasMora?: number; // Días de retraso
  montoMora?: number; // Monto acumulado por mora
  tasaMoraDiaria?: number; // Cobro por día de retraso (default: 50 MXN)
  vendedorId: string;
  productosIds?: string[]; // IDs de productos asociados (para futuro)
  firmaCliente?: string; // Firma del cliente (base64 o texto)
  tipoFirma?: "manuscrita" | "digital"; // Tipo de firma
  fechaFirma?: Date; // Fecha de firma del contrato
  // FASE 20: Campos Payjoy
  payjoyFinanceOrderId?: string; // ID de orden de financiamiento en Payjoy
  payjoyCustomerId?: string; // ID de cliente en Payjoy
  payjoySyncEnabled?: boolean; // Sincronización automática habilitada
  payjoyLastSyncAt?: Date; // Última sincronización con Payjoy
  createdAt: Date;
  updatedAt: Date;
}

export interface DetallePagoMixto {
  metodo: "efectivo" | "transferencia" | "deposito";
  monto: number;
}

export interface Pago {
  id: string;
  distribuidorId?: string; // FASE 21
  creditoId: string;
  monto: number;
  fechaPago: Date;
  metodoPago: "efectivo" | "transferencia" | "deposito" | "mixto" | "payjoy";
  referencia?: string;
  detallePago?: DetallePagoMixto[];
  cobradorId: string;
  // FASE 20: Campos Payjoy
  metodoPagoTienda?: string; // Método real usado en tienda (editable, para cuadre de caja)
  payjoyTransactionId?: string; // ID único de transacción en Payjoy (idempotencia)
  payjoyPaymentMethod?: string; // Método de pago en Payjoy (readonly desde webhook)
  payjoyCustomerName?: string; // Nombre del cliente desde webhook
  payjoyWebhookId?: string; // Referencia al webhook que creó este pago
  createdAt: Date;
}

export interface Categoria {
  id: string;
  distribuidorId: string;
  nombre: string;
  descripcion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Proveedor {
  id: string;
  distribuidorId: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  rfc?: string;
  direccion?: string;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Producto {
  id: string;
  distribuidorId?: string; // FASE 21
  nombre: string;
  marca: string;
  modelo: string;
  precio: number;
  stock: number;
  imagen?: string;
  descripcion?: string;
  activo?: boolean;

  // FASE 22: Inventario Avanzado
  categoriaId?: string;
  subcategoriaId?: string; // FASE 57
  proveedorId?: string;
  costo?: number; // Precio de compra / base
  stockMinimo?: number; // Punto de reorden
  stockMaximo?: number; // Inventario ideal
  tipo?: "accesorio" | "pieza_reparacion" | "equipo_nuevo" | "equipo_usado" | "servicio";
  esSerializado?: boolean; // Requiere IMEI/Serie
  ubicacionFisica?: string; // Estante A1, etc.

  // FASE 19: Barcode and Location tracking
  codigoBarras?: string;
  sku?: string;
  ubicacionId?: string;
  ultimaVerificacion?: Date;
  verificadoPor?: string;

  // FASE 27: Campos dedicados para equipos celulares (importación de remisiones)
  imei?: string;          // IMEI único del equipo (15 dígitos). Solo equipo_nuevo/usado
  color?: string;         // Color del equipo: "Negro", "Azul", "Verde", etc.
  ram?: string;           // RAM del equipo: "4GB", "8GB". Null si no aplica
  almacenamiento?: string;// Almacenamiento: "128GB", "256GB", "512GB"
  folioRemision?: string; // Folio del ticket de compra: "WINDCEL-19/11/2025"

  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// FASE 36: Servicios sin inventario
// =====================================================

/** Categoría de servicio — puede ser uno de los valores por defecto o una cadena personalizada (FASE 37b) */
export type CategoriaServicio = string;

/** Valores por defecto de categorías de servicios */
export const CATEGORIAS_SERVICIO_DEFAULT = ["telefonia", "papeleria", "diagnostico", "reparacion", "otro"] as const;

/** Categoría de servicio personalizada (nombre + valor) */
export interface CategoriaServicioConfig {
  value: string;   // slug (ej: "telefonia", "mi-categoria")
  label: string;   // Nombre visible (ej: "Telefonía", "Mi Categoría")
}

export interface Servicio {
  id: string;
  distribuidorId?: string;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  precioFijo: boolean;   // true = no se puede modificar en POS; false = rango libre
  precioMin?: number;    // límite inferior cuando precioFijo = false
  precioMax?: number;    // límite superior cuando precioFijo = false
  categoria: CategoriaServicio;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ServicioFormData = Omit<Servicio, "id" | "createdAt" | "updatedAt">;

// =====================================================
// FASE 4: Tipos para INE y Referencias
// =====================================================

export interface ReferenciaPersonal {
  id: string;
  clienteId: string;
  nombreCompleto: string;
  parentesco?: string;
  telefono: string;
  telefonoAlternativo?: string;
  domicilio?: string;
  tiempoConocerlo?: string;
  ocupacion?: string;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenciaLaboral {
  id: string;
  clienteId: string;
  empresa: string;
  puesto: string;
  nombreSupervisor?: string;
  telefonoEmpresa: string;
  extension?: string;
  domicilioEmpresa?: string;
  antiguedad?: string;
  salarioMensual?: number;
  tipoContrato?: string;
  horario?: string;
  diasLaborales?: string;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Verificacion {
  id: string;
  clienteId: string;
  tipoVerificacion: "ine" | "referencia_personal" | "referencia_laboral";
  referenciaId?: string;
  resultado: "exitosa" | "fallida" | "pendiente";
  metodo?: string;
  notas?: string;
  verificadoPor?: string;
  fechaVerificacion: Date;
  createdAt: Date;
}

export interface DatosINE {
  numero?: string;
  ocr?: string;
  curp?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: Date;
  sexo?: "H" | "M";
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  colonia?: string;
  municipio?: string;
  estado?: string;
  codigoPostal?: string;
  seccionElectoral?: string;
  vigencia?: Date;
  claveElector?: string;
}

// =====================================================
// FASE 8: TIPOS PARA MÓDULO DE REPARACIONES
// =====================================================

export type EstadoOrdenReparacion =
  | "recibido"
  | "diagnostico"
  | "esperando_piezas"
  | "presupuesto"
  | "aprobado"
  | "en_reparacion"
  | "completado"
  | "listo_entrega"
  | "entregado"
  | "no_reparable"
  | "cancelado";

export type TipoGarantia = "garantia_pieza" | "falla_tecnico" | "daño_cliente";
export type EstadoGarantia = "activa" | "usada" | "vencida" | "cancelada";
export type PrioridadOrden = "baja" | "normal" | "alta" | "urgente";

export interface ParteReemplazada {
  parte: string;
  costo: number;
  cantidad: number;
  proveedor?: string;
  productoId?: string; // Referencia al inventario (opcional)
}

// Pieza en cotización (antes de crear la orden — para calcular presupuesto)
export interface PiezaCotizacion {
  id: string;                  // temp ID (Date.now())
  productoId?: string;         // si viene del catálogo
  nombre: string;              // nombre de la pieza
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  tieneStock: boolean;         // false = sin existencia (solo cotización)
  stockActual?: number;        // cantidad actual en inventario
  esLibre: boolean;            // true = agregada manualmente sin catálogo
}

// Pieza de inventario usada en una reparación (con tracking completo)
export interface PiezaReparacion {
  id: string;
  ordenId: string;
  productoId: string;
  nombrePieza: string; // snapshot del nombre al momento de agregar
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  notas?: string;
  agregadoPor?: string;
  createdAt: Date;
  // Datos del producto (join)
  producto?: {
    nombre: string;
    stock: number;
    imagen?: string;
  };
}

// Solicitud de pieza al distribuidor cuando no hay stock
export type EstadoSolicitudPieza = "pendiente" | "enviada" | "recibida" | "cancelada";

export interface SolicitudPieza {
  id: string;
  ordenId: string;
  productoId?: string;       // Si es un producto del catálogo (stock=0)
  nombrePieza: string;       // Nombre de la pieza solicitada
  descripcion?: string;      // Especificaciones adicionales
  cantidad: number;
  estado: EstadoSolicitudPieza;
  solicitadoPor?: string;    // userId del técnico
  notas?: string;
  fechaEstimadaLlegada?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Joins
  orden?: { folio: string };
  producto?: { nombre: string; marca?: string; modelo?: string };
}

// Garantía de una pieza que falló o estaba dañada
export type EstadoGarantiaPieza = "pendiente" | "enviada" | "aprobada" | "rechazada" | "resuelta";
export type TipoResolucionGarantiaPieza = "reemplazo" | "reembolso" | "reparacion" | "sin_resolucion";

export interface GarantiaPieza {
  id: string;
  ordenId: string;
  piezaReparacionId: string;  // Referencia a reparacion_piezas
  nombrePieza: string;        // snapshot
  motivoGarantia: string;     // Descripción del problema con la pieza
  estado: EstadoGarantiaPieza;
  tipoResolucion?: TipoResolucionGarantiaPieza;
  notasResolucion?: string;
  solicitadoPor?: string;     // userId del técnico
  resueltoPor?: string;       // userId del admin/técnico que resolvió
  fechaResolucion?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Joins
  piezaReparacion?: {
    nombrePieza: string;
    cantidad: number;
    costoUnitario: number;
    productoId: string;
  };
}

export interface OrdenReparacion {
  id: string;
  folio: string;
  distribuidorId?: string; // FASE 21 + FASE 55
  clienteId: string;
  tecnicoId: string;
  productoId?: string;
  creditoId?: string;

  // Información del dispositivo
  marcaDispositivo: string;
  modeloDispositivo: string;
  imei?: string;
  numeroSerie?: string;

  // Descripción del problema
  problemaReportado: string;
  diagnosticoTecnico?: string;

  // Estado de la orden
  estado: EstadoOrdenReparacion;

  // Costos
  costoReparacion: number;
  costoPartes: number;
  costoTotal: number;
  partesReemplazadas: ParteReemplazada[];

  // Fechas
  fechaRecepcion: Date;
  fechaEstimadaEntrega?: Date;
  fechaCompletado?: Date;
  fechaEntregado?: Date;

  // Notas y detalles
  notasTecnico?: string;
  notasInternas?: string;
  accesoriosEntregados?: string;
  condicionDispositivo?: string;

  // Sistema de garantías
  esGarantia: boolean;
  ordenOriginalId?: string;
  motivoGarantia?: TipoGarantia;

  // Aprobaciones y prioridad
  prioridad: PrioridadOrden;
  requiereAprobacion: boolean;
  aprobadoPorCliente: boolean;
  fechaAprobacion?: Date;
  aprobacionParcial?: boolean;
  notasCliente?: string;

  // Integración con scoring
  afectaScoring: boolean;

  // FASE 8B/8C: Campos avanzados
  patronDesbloqueo?: string;
  passwordDispositivo?: string;
  cuentasDispositivo?: any[];
  condicionesFuncionamiento?: any;
  estadoFisicoDispositivo?: any;
  deslindesLegales?: string[];
  firmaCliente?: string;
  tipoFirma?: "manuscrita" | "digital";
  fechaFirma?: Date;
  imagenesIds?: string[];
  presupuestoTotal?: number;
  /** Mano de obra ingresada en el formulario (desglose de presupuestoTotal) */
  presupuestoManoDeObra?: number;
  /** Costo de piezas calculado automáticamente (desglose de presupuestoTotal) */
  presupuestoPiezas?: number;
  anticiposData?: any[];
  /** ID del servicio del catálogo de reparaciones (FASE 54-B) */
  catalogoServicioId?: string;
  /** Cargo mínimo que se retiene si el cliente cancela antes de instalar piezas (default $100 MXN) */
  cargoCancelacion?: number;

  // Auditoría
  creadoPor?: string;
  createdAt: Date;
  updatedAt: Date;
  // Mensajería y almacenaje (FASE 27)
  fechaAvisoRecoleccion?: Date;
  cobroAlmacenajeInicio?: Date;
  descuentoRapidoOfrecido?: boolean;
  descuentoRapidoPorcentaje?: number;
}

export interface GarantiaReparacion {
  id: string;
  ordenId: string;
  clienteId: string;
  tipoGarantia: TipoGarantia;
  diasGarantia: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  estado: EstadoGarantia;
  ordenGarantiaId?: string;
  fechaReclamo?: Date;
  motivoReclamo?: string;
  aplicaCosto: boolean;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrdenReparacionDetallada extends OrdenReparacion {
  clienteNombre: string;
  clienteApellido?: string;
  clienteTelefono: string;
  tecnicoNombre: string;
}

// ─── FASE 56: Multi-diagnóstico ─────────────────────────────────────────────

export type EstadoDiagnostico =
  | "pendiente_aprobacion"
  | "aprobado"
  | "rechazado"
  | "cancelado_todo";

export type TipoAprobacionDiagnostico = "presencial" | "whatsapp" | "telefono";

export interface ReparacionDiagnostico {
  id: string;
  ordenId: string;
  numeroDiagnostico: number;
  tecnicoId?: string;
  tecnicoNombre?: string;
  descripcionProblema: string;
  diagnosticoTecnico?: string;
  costoLabor: number;
  costoPartes: number;
  partesNecesarias: Array<{ nombre: string; cantidad: number; costo: number }>;
  estado: EstadoDiagnostico;
  aprobadoPorCliente: boolean;
  fechaAprobacion?: Date | string;
  tipoAprobacion?: TipoAprobacionDiagnostico;
  aprobadoPorEmpleadoId?: string;
  notas?: string;
  esDiagnosticoInicial: boolean;
  distribuidorId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CrearDiagnosticoPayload {
  ordenId: string;
  descripcionProblema: string;
  diagnosticoTecnico?: string;
  costoLabor?: number;
  costoPartes?: number;
  partesNecesarias?: Array<{ nombre: string; cantidad: number; costo: number }>;
  notas?: string;
}

export interface AprobarDiagnosticoPayload {
  tipoAprobacion: TipoAprobacionDiagnostico;
  estado: "aprobado" | "rechazado" | "cancelado_todo";
}

export interface EstadisticasTecnico {
  tecnicoId: string;
  nombreTecnico: string;
  ordenesActivas: number;
  ordenesRecibidas: number;
  ordenesDiagnostico: number;
  ordenesEnReparacion: number;
  ordenesCompletadasHoy: number;
}

export interface TrackingToken {
  id: string;
  ordenId: string;
  token: string;
  accesos: number;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ConfigNotificacionesReparacion {
  id: string;
  horasSinRespuestaTecnico: number;
  horasListoSinNotificar: number;
  diasRecordatorioGarantia: number;
  notificarDiagnosticoCompletado: boolean;
  notificarPresupuestoAprobado: boolean;
  notificarReparacionCompletada: boolean;
  notificarListoEntrega: boolean;
  plantillaDiagnostico: string;
  plantillaPresupuestoPendiente: string;
  plantillaPresupuestoAprobado: string;
  plantillaReparacionCompletada: string;
  plantillaListo: string;
  plantillaRecordatorioGarantia: string;
  plantillaEscalacionVendedor: string;
  updatedAt: Date;
}

// Tipo para formularios de orden (sin id, folio, tecnicoId auto-asignado, etc.)
export type OrdenReparacionFormData = Omit<
  OrdenReparacion,
  "id" | "folio" | "tecnicoId" | "costoTotal" | "createdAt" | "updatedAt"
>;

// Tipo para actualizar diagnóstico
export interface DiagnosticoFormData {
  diagnosticoTecnico: string;
  costoReparacion: number;
  costoPartes: number;
  partesReemplazadas: ParteReemplazada[];
  fechaEstimadaEntrega?: Date;
  notasTecnico?: string;
  requiereAprobacion: boolean;
}

// =====================================================
// FASE 8B: TIPOS PARA CAPTURA AVANZADA DE ÓRDENES
// =====================================================

// Funcionamiento de componentes electrónicos (verde/rojo)
export interface CondicionesFuncionamiento {
  bateria: "ok" | "falla";
  pantallaTactil: "ok" | "falla"; // Pantalla y táctil unificados
  camaras: "ok" | "falla"; // Cámaras frontal y trasera unificadas
  microfono: "ok" | "falla";
  altavoz: "ok" | "falla";
  bluetooth: "ok" | "falla";
  wifi: "ok" | "falla";
  botonEncendido: "ok" | "falla";
  botonesVolumen: "ok" | "falla";
  sensorHuella: "ok" | "falla";
  centroCarga: "ok" | "falla"; // Puerto de carga USB/Lightning
  llegaApagado?: boolean;
  estaMojado?: boolean;
  bateriaHinchada?: boolean;
}

// Estado físico del dispositivo (estético/visual)
export type EstadoFisico = "perfecto" | "rallado" | "golpeado" | "quebrado";

export interface EstadoFisicoDispositivo {
  marco: EstadoFisico;
  bisel: EstadoFisico;
  pantallaFisica: EstadoFisico; // cristal, no touch
  camaraLente: EstadoFisico;
  tapaTrasera: EstadoFisico;
  tieneSIM: boolean;
  tieneMemoriaSD: boolean;
  observacionesFisicas?: string; // Para detalles adicionales
}

// Imágenes del dispositivo en diferentes etapas
export interface ImagenReparacion {
  id: string;
  ordenId: string;
  tipoImagen: "dispositivo" | "dano" | "accesorio" | "diagnostico" | "finalizado";
  urlImagen: string;
  pathStorage: string;
  ordenVisualizacion: number;
  descripcion?: string;
  subidoDesde: "web" | "mobile" | "qr";
  createdAt: Date;
}

// Cuentas del dispositivo (Google, Apple, etc.)
export interface CuentaDispositivo {
  tipo: "Google" | "Apple" | "Samsung" | "Microsoft" | "Otra";
  email?: string;
  usuario?: string;
  password?: string;
  notas?: string;
}

// Sesión temporal para captura de fotos vía QR
export interface SesionFotoQR {
  id: string;
  ordenId: string;
  token: string;
  activa: boolean;
  imagenesSubidas: number;
  maxImagenes: number;
  expiresAt: Date;
  createdAt: Date;
}

// Tipo de firma del cliente
export type TipoFirma = "manuscrita" | "digital";

// =====================================================
// FASE 8C: TIPOS PARA PRESUPUESTO Y ANTICIPOS
// =====================================================

// Tipo de pago
export type TipoPago = "efectivo" | "transferencia" | "deposito" | "tarjeta" | "mixto";

// Desglose de pago mixto
export interface DesglosePagoMixto {
  efectivo?: number;
  transferencia?: number;
  tarjeta?: number;
}

// Anticipo de reparación
export interface AnticipoReparacion {
  id: string;
  ordenId: string;
  monto: number;
  tipoPago: TipoPago;
  desgloseMixto?: DesglosePagoMixto;
  referenciaPago?: string; // Número de transacción, últimos 4 dígitos tarjeta, etc.
  notas?: string;
  recibidoPor?: string; // UUID del usuario que recibió el pago
  estado: "pendiente" | "aplicado" | "devuelto"; // Ciclo de vida del anticipo
  fechaAplicado?: Date;
  fechaDevuelto?: Date;
  motivoDevolucion?: string;
  fechaAnticipo: Date;
  createdAt: Date;
}

// FASE 41: Vista enriquecida de un anticipo dentro de una sesión de caja (bolsa virtual)
export interface AnticipoEnSesion {
  id: string;
  monto: number;
  tipoPago: TipoPago;
  fechaAnticipo: Date;
  estado: "pendiente" | "aplicado" | "devuelto";
  // Datos de la orden de reparación
  folioOrden: string;
  descripcionProblema?: string;
  ordenId: string;
  // Estado de la orden — determina si el dinero sigue "en bolsa" o fue liberado
  ordenEstado?: string;
  ordenEntregada?: boolean; // true cuando estado = "entregado"
  // Datos del cliente
  clienteNombre: string;
  // Empleado que recibió el pago
  empleadoNombre?: string;
  // Indica si fue registrado con sesión de caja
  registradoEnCaja: boolean;
}

// FASE 37: Traspaso de anticipo técnico → vendedor
export interface TraspasoAnticipo {
  id: string;
  distribuidorId?: string;
  reparacionId: string;
  anticipoId: string;
  tecnicoId: string;
  vendedorId?: string;          // se llena al confirmar
  folioOrden: string;           // snapshot
  clienteNombre: string;        // snapshot
  montoRegistrado: number;      // lo que el técnico dice que entrega
  montoConfirmado?: number;     // lo que el vendedor confirma haber recibido
  estado: "pendiente" | "confirmado" | "discrepancia";
  confirmadoAt?: Date;
  discrepancia?: number;        // montoRegistrado - montoConfirmado (positivo = faltante)
  notasVendedor?: string;
  createdAt: Date;
  // Joins opcionales (para mostrar en UI)
  tecnicoNombre?: string;
  vendedorNombre?: string;
}

// =====================================================
// FASE 38: Confirmación de depósitos/transferencias
// =====================================================

export type EstadoConfirmacionDeposito =
  | "pendiente_confirmacion"
  | "confirmado"
  | "rechazado";

export interface ConfirmacionDeposito {
  id: string;
  distribuidorId?: string;
  reparacionId: string;
  anticipoId?: string;          // se llena después de crear el anticipo
  monto: number;
  tipoPago: "transferencia" | "deposito";
  referenciaBancaria?: string;
  fotoComprobanteUrl?: string;
  registradoPor: string;        // userId
  estado: EstadoConfirmacionDeposito;
  confirmadoPor?: string;       // userId del admin
  confirmadoAt?: Date;
  razonRechazo?: string;
  linkToken: string;            // token único para WhatsApp
  whatsappEnviadoAt?: Date;
  // Campos desnormalizados para UI/notificaciones
  folioOrden?: string;
  clienteNombre?: string;
  registradorNombre?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joins opcionales
  confirmadorNombre?: string;
}

// Presupuesto de reparación
export interface PresupuestoReparacion {
  precioManoObra: number;
  precioPiezas: number;
  precioTotal: number; // Calculado automáticamente
  totalAnticipos: number; // Suma de anticipos
  saldoPendiente: number; // Calculado automáticamente
  notasPresupuesto?: string;
  anticipos?: AnticipoReparacion[];
}

// =====================================================
// FASE 17: CONFIGURACION DEL SISTEMA
// =====================================================

// Modulos que pueden habilitarse/deshabilitarse en el sidebar
export interface ModulosHabilitados {
  dashboard: boolean; // CORE - no se puede deshabilitar
  clientes: boolean;
  creditos: boolean; // Default: false
  pagos: boolean;
  productos: boolean;
  empleados: boolean;
  reparaciones: boolean; // CORE - no se puede deshabilitar
  "dashboard-reparaciones": boolean;
  reportes: boolean;
  recordatorios: boolean;
  tecnico: boolean;
  pos: boolean; // FASE 18: Punto de Venta
  inventario_avanzado: boolean; // FASE 19: Barcode & Location Management
  payjoy: boolean; // Área de ventas Payjoy (visible a todos los roles)
}

// Modulos esenciales que no se pueden deshabilitar
export const CORE_MODULES: (keyof ModulosHabilitados)[] = [
  "dashboard",
  "reparaciones",
];

// Configuracion general del sistema
// ─── FASE 39: Autorizaciones de descuento ─────────────────────────────────────

export interface LimitesDescuento {
  /** % máximo que vendedor puede dar SIN pedir nada (default 5) */
  vendedorLibrePct: number;
  /** % máximo con razón obligatoria pero sin aprobación remota (default 15) */
  vendedorConRazonPct: number;
  /** ¿Permite descuentos en monto fijo ($) además de %? (default true) */
  permiteMontFijo: boolean;
  /** Monto fijo máximo en $ sin requerir aprobación (default 500) */
  montoFijoMaximoSinAprobacion: number;
}

export type EstadoAutorizacion = "pendiente" | "aprobado" | "declinado" | "expirado";

export interface ItemContextoVenta {
  nombre: string;
  cantidad: number;
  precio: number;
}

export interface SolicitudAutorizacion {
  id: string;
  distribuidorId?: string;
  empleadoId: string;
  empleadoNombre?: string;
  autorizadorId?: string;
  autorizadorNombre?: string;
  tipo: "descuento";
  montoVenta: number;
  montoDescuento: number;
  porcentajeCalculado: number;
  esMontFijo: boolean;
  razon?: string;
  contexto?: { items: ItemContextoVenta[]; subtotal: number };
  estado: EstadoAutorizacion;
  respondidoAt?: Date;
  comentarioAutorizador?: string;
  linkToken: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Configuracion {
  id: string;
  distribuidorId?: string; // FASE 21
  // Datos del negocio
  nombreEmpresa: string;
  rfc: string;
  direccionEmpresa: string;
  telefonoEmpresa: string;
  whatsappNumero: string;
  emailEmpresa?: string;       // FASE 33
  regimenFiscal?: string;      // FASE 33
  // Comisiones por defecto
  comisionVendedorDefault: number;
  comisionCobradorDefault: number;
  // Mora
  tasaMoraDiaria: number;
  diasGracia: number;
  // General
  diasGarantiaDefault: number;
  notificacionesActivas: boolean;
  // Modulos
  modulosHabilitados: ModulosHabilitados;
  // FASE 20: Payjoy
  payjoyEnabled?: boolean;
  payjoyWebhookUrl?: string;
  payjoyAutoSyncPayments?: boolean;
  payjoyLastConnectionTest?: Date;
  payjoyConnectionStatus?: string;
  // FASE 20: Comisiones sub-distribuidoras
  comisionTipo?: "fijo" | "porcentaje";
  comisionMontoFijo?: number;
  comisionPorcentajeVenta?: number;
  // FASE 33: Créditos — parámetros por defecto para nuevos créditos
  tasaInteresDefault?: number;
  plazoMaximoSemanas?: number;
  engancheMinimoPct?: number;
  frecuenciaPagoDefault?: "semanal" | "quincenal" | "mensual";
  montoMaximoCredito?: number;
  // FASE 33: POS — configuración del punto de venta
  permitirVentasSinCliente?: boolean;
  descuentoMaximoPct?: number;
  /** FASE 37b: Categorías de servicios personalizadas por distribuidor */
  categoriasServicios?: CategoriaServicioConfig[];
  diasMaxDevolucion?: number;
  // FASE 33: Notificaciones avanzadas
  diasAnticipacionRecordatorio?: number;
  mensajeRecordatorio?: string;
  // FASE 39: Límites de descuento
  limitesDescuento?: LimitesDescuento;
  // FASE 40: Caja
  fondoCaja?: number;            // Monto sugerido de fondo al abrir caja (default: 500)
  toleranciaDescuadre?: number;  // Diferencia máxima permitida sin alerta (default: 0)
  // FASE 47-lite: Datos del contador externo
  contadorNombre?: string;       // Nombre del contador
  contadorTelefono?: string;     // Teléfono/WhatsApp del contador (con código de país)
  contadorEmail?: string;        // Email del contador
  // Auditoria
  updatedAt: Date;
  updatedBy?: string;

  // FASE 55: WhatsApp Business API oficial
  waEnabled?: boolean;
  waPhoneNumberId?: string;
  /** SECURITY: write-only — al leer, usar waAccessTokenConfigured. Al escribir, enviar el nuevo token o omitir para no cambiar. */
  waAccessToken?: string;
  /** true si hay un token guardado. El token real nunca se expone en la API. */
  waAccessTokenConfigured?: boolean;
  waBusinessAccountId?: string;
  waApiVersion?: string;
  waWebhookVerifyToken?: string;
  waLogMensajes?: boolean;

  // Sonidos y push (FASE 28)
  sonidosConfig?: {
    habilitado: boolean;
    volumen: number;
    sonidoDefault: import("@/lib/sounds").SoundId;
    mapeoEventos: Record<string, import("@/lib/sounds").SoundId>;
    sonidoCustomUrl?: string | null;
  };
}

// =====================================================
// FASE 18: SISTEMA POS (PUNTO DE VENTA)
// =====================================================

// Métodos de pago para ventas POS
export type MetodoPagoVenta = "efectivo" | "transferencia" | "tarjeta" | "mixto";

// Estados de una venta
export type EstadoVenta = "completada" | "cancelada" | "reembolsada";

// Estados de sesión de caja
export type EstadoCajaSesion = "abierta" | "cerrada";

// Tipos de movimientos de caja
export type TipoMovimientoCaja =
  | "deposito"
  | "retiro"
  | "entrada_anticipo"
  | "devolucion_anticipo"
  | "pay_in"    // FASE 40: entrada de efectivo sin relación a venta (fondos, reembolso de proveedor, etc.)
  | "pay_out";  // FASE 40: salida de efectivo sin relación a venta (gastos chicos, pago a proveedor, etc.)

// FASE 40: Conteo de efectivo por denominaciones (para conteo ciego en cierre)
export interface ConteoDenominaciones {
  b1000: number;   // Billetes de $1,000
  b500:  number;   // Billetes de $500
  b200:  number;   // Billetes de $200
  b100:  number;   // Billetes de $100
  b50:   number;   // Billetes de $50
  b20:   number;   // Billetes de $20
  monedas: number; // Total en monedas (monto libre)
}

// Desglose de pago mixto para ventas
export interface DesglosePagoMixtoVenta {
  efectivo?: number;
  transferencia?: number;
  tarjeta?: number;
}

// Venta POS
export interface Venta {
  id: string;
  distribuidorId?: string; // FASE 21
  folio: string; // VENTA-YYYY-#####
  clienteId?: string; // Opcional para ventas sin cliente registrado
  vendedorId: string;
  sesionCajaId?: string;

  // Montos
  subtotal: number;
  descuento: number;
  total: number;

  // Métodos de pago
  metodoPago: MetodoPagoVenta;
  desgloseMixto?: DesglosePagoMixtoVenta;
  referenciaPago?: string; // Número de transacción, últimos 4 dígitos tarjeta, etc.

  // Solo para efectivo
  montoRecibido?: number;
  cambio?: number;

  // Metadata
  notas?: string;
  estado: EstadoVenta;
  fechaVenta: Date;

  createdAt: Date;
  updatedAt: Date;
}

// Item de venta (línea de producto)
export interface VentaItem {
  id: string;
  ventaId: string;
  productoId?: string;    // nullable para ítems de servicio (FASE 36)

  // FASE 36: Servicios sin inventario
  servicioId?: string;
  esServicio?: boolean;

  cantidad: number;
  precioUnitario: number;
  subtotal: number;

  // Snapshot del producto/servicio (para historial)
  productoNombre?: string;
  productoMarca?: string;
  productoModelo?: string;
  servicioNombre?: string;

  createdAt: Date;
}

// Sesión de caja (turno)
export interface CajaSesion {
  id: string;
  distribuidorId?: string; // FASE 21
  folio: string; // CAJA-YYYY-#####
  usuarioId: string;
  usuarioNombre?: string; // FASE 28: nombre del empleado que abrió el turno

  // Apertura
  montoInicial: number;
  fechaApertura: Date;
  notasApertura?: string;

  // Cierre
  montoFinal?: number;
  montoEsperado?: number; // Calculado: inicial + ventas efectivo + depósitos - retiros
  diferencia?: number; // Calculado: final - esperado (positivo = sobrante, negativo = faltante)
  fechaCierre?: Date;
  notasCierre?: string;

  // Estado
  estado: EstadoCajaSesion;

  // Estadísticas (calculadas al cierre)
  totalVentasEfectivo: number;
  totalVentasTransferencia: number;
  totalVentasTarjeta: number;
  totalRetiros: number;
  totalDepositos: number;
  numeroVentas: number;

  // FASE 40: Conteo ciego por denominaciones (guardado al cierre)
  conteoDenominaciones?: ConteoDenominaciones;

  // FASE 20: Stats de Payjoy (informativo, solo en respuesta de cierre)
  payjoyStats?: {
    totalPagosPayjoy: number;
    montoTotalPayjoy: number;
    desglosePagos: Array<{
      pagoId: string;
      transactionId: string;
      clienteNombre: string;
      monto: number;
      payjoyPaymentMethod: string;
      hora: Date;
    }>;
  };

  createdAt: Date;
  updatedAt: Date;
}

// Movimiento de caja (depósito o retiro)
export interface CajaMovimiento {
  id: string;
  sesionId: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  concepto: string;
  autorizadoPor?: string; // Nombre del supervisor/admin que autorizó
  createdAt: Date;
}

// Venta detallada (con joins)
export interface VentaDetallada extends Venta {
  vendedorNombre?: string;
  clienteNombre?: string;
  clienteApellido?: string;
  items?: VentaItemDetallado[];
}

// Item de venta detallado (con producto completo)
export interface VentaItemDetallado extends VentaItem {
  producto?: Producto;
}

// Formulario para crear nueva venta
export interface NuevaVentaFormData {
  clienteId?: string;
  items: {
    productoId?: string;      // undefined para servicios (FASE 36)
    servicioId?: string;      // FASE 36: ID del servicio sin inventario
    servicioNombre?: string;  // FASE 36: snapshot del nombre del servicio
    esServicio?: boolean;     // FASE 36: flag que indica ítem de servicio
    cantidad: number;
    precioUnitario: number;
    imei?: string;            // FASE 30: IMEI del equipo vendido (solo equipos serializados)
    notas?: string;           // FASE 30: Nota por línea de venta
  }[];
  descuento: number;
  metodoPago: MetodoPagoVenta;
  desgloseMixto?: DesglosePagoMixtoVenta;
  referenciaPago?: string;
  montoRecibido?: number;  // Para efectivo
  notas?: string;          // FASE 30: Nota global de la venta
  propina?: number;        // Propina/tip opcional
}

// Estadísticas del POS
export interface EstadisticasPOS {
  ventasHoy: number;
  totalHoy: number;
  ventasSemana: number;
  totalSemana: number;
  ventasMes: number;
  totalMes: number;
  productosMasVendidos: {
    productoId: string;
    productoNombre: string;
    cantidadVendida: number;
    totalVentas: number;
  }[];
}

// =====================================================
// FASE 19: Sistema de Códigos de Barras y Ubicaciones
// =====================================================

export type TipoUbicacion = "estante" | "vitrina" | "bodega" | "mostrador";
export type EstadoVerificacion = "en_proceso" | "completada" | "cancelada";
export type MotivoMovimiento = "remodelacion" | "reabastecimiento" | "promocion" | "verificacion" | "ajuste";
export type EstadoAlerta = "pendiente" | "revisado" | "registrado" | "descartado";

// Ubicación física de inventario
export interface UbicacionInventario {
  id: string;
  nombre: string;
  codigo: string;
  tipo: TipoUbicacion;
  descripcion?: string;
  capacidadMaxima?: number;
  qrCode?: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Movimiento de producto entre ubicaciones
export interface MovimientoUbicacion {
  id: string;
  productoId: string;
  ubicacionOrigenId?: string;
  ubicacionDestinoId?: string;
  usuarioId: string;
  motivo: MotivoMovimiento;
  notas?: string;
  fechaMovimiento: Date;
  createdAt: Date;
}

// Movimiento detallado con relaciones
export interface MovimientoUbicacionDetallado extends MovimientoUbicacion {
  producto?: Producto;
  ubicacionOrigen?: UbicacionInventario;
  ubicacionDestino?: UbicacionInventario;
  usuario?: User;
}

// Sesión de verificación de inventario
export interface VerificacionInventario {
  id: string;
  folio: string;
  usuarioId: string;
  ubicacionId?: string;
  fechaInicio: Date;
  fechaFin?: Date;
  estado: EstadoVerificacion;
  totalProductosEsperados: number;
  totalProductosEscaneados: number;
  totalProductosFaltantes: number;
  totalDuplicados: number;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Verificación detallada con relaciones
export interface VerificacionInventarioDetallada extends VerificacionInventario {
  usuario?: User;
  ubicacion?: UbicacionInventario;
  items?: VerificacionItem[];
}

// Item escaneado durante verificación
export interface VerificacionItem {
  id: string;
  verificacionId: string;
  productoId?: string;
  codigoEscaneado: string;
  cantidadEscaneada: number;
  esDuplicado: boolean;
  esProductoNuevo: boolean;
  ubicacionEncontradaId?: string;
  notasScan?: string;
  fechaScan: Date;
  createdAt: Date;
}

// Item detallado con relaciones
export interface VerificacionItemDetallado extends VerificacionItem {
  producto?: Producto;
  ubicacionEncontrada?: UbicacionInventario;
}

// Alerta de producto no registrado
export interface AlertaProductoNuevo {
  id: string;
  verificacionId: string;
  verificacionItemId: string;
  codigoEscaneado: string;
  escanadoPor: string;
  imagenUrl?: string;
  notas?: string;
  estado: EstadoAlerta;
  revisadoPor?: string;
  fechaRevision?: Date;
  fechaAlerta: Date;
  createdAt: Date;
}

// Alerta detallada con relaciones
export interface AlertaProductoNuevoDetallada extends AlertaProductoNuevo {
  verificacion?: VerificacionInventario;
  verificacionItem?: VerificacionItem;
  usuarioEscaner?: User;
  usuarioRevisor?: User;
}

// Form data para crear ubicación
export interface NuevaUbicacionFormData {
  nombre: string;
  codigo?: string;
  tipo: TipoUbicacion;
  descripcion?: string;
  capacidadMaxima?: number;
}

// Form data para iniciar verificación
export interface NuevaVerificacionFormData {
  ubicacionId?: string;
  notas?: string;
}

// Form data para escanear producto
export interface ScanProductoFormData {
  verificacionId: string;
  codigoEscaneado: string;
  cantidad?: number;          // FASE 30: unidades contadas físicamente (default 1)
  ubicacionEncontradaId?: string;
  notasScan?: string;
}

// Diferencia entre conteo físico y stock del sistema
export interface DiferenciaVerificacion {
  productoId: string;
  nombre: string;
  marca: string;
  modelo: string;
  codigoBarras?: string;
  stockSistema: number;
  cantidadContada: number;
  diferencia: number;         // positivo = más de lo esperado, negativo = faltante
}

// Form data para mover producto
export interface MoverProductoFormData {
  productoId: string;
  ubicacionDestinoId: string;
  motivo: MotivoMovimiento;
  notas?: string;
}

// Stats de verificación
export interface EstadisticasVerificacion {
  verificacionesHoy: number;
  productosEscaneadosHoy: number;
  productosFaltantesHoy: number;
  alertasPendientes: number;
  ubicacionesActivas: number;
}

// =====================================================
// FASE 30: Bitácora de tiempo para técnicos
// =====================================================

export interface TiempoLog {
  id: string;
  ordenId: string;
  tecnicoId: string;
  tecnicoNombre?: string;
  distribuidorId?: string;
  inicioTrabajo: Date;
  finTrabajo?: Date;
  duracionMinutos?: number;
  notas?: string;
  createdAt: Date;
}

export interface TiempoResumen {
  totalMinutos: number;
  totalSesiones: number;
  sesionActiva?: TiempoLog; // sesión sin finTrabajo
  logs: TiempoLog[];
}

// =====================================================
// FASE 33: Devoluciones parciales de venta POS
// =====================================================

export type MetodoReembolso = "efectivo" | "transferencia";
export type EstadoDevolucion = "procesada" | "anulada";

/** Encabezado de devolución */
export interface Devolucion {
  id: string;
  distribuidorId?: string;
  ventaId: string;
  folio: string;               // DEV-VENTA-2026-00001
  procesadoPor?: string;
  montoDevuelto: number;
  metodoReembolso: MetodoReembolso;
  referenciaReembolso?: string;
  bloqueadoPayjoy: boolean;
  motivo?: string;
  notas?: string;
  estado: EstadoDevolucion;
  createdAt: Date;
  updatedAt: Date;
}

/** Línea de devolución */
export interface DevolucionItem {
  id: string;
  devolucionId: string;
  ventaItemId: string;
  productoId?: string;
  cantidadDevuelta: number;
  precioUnitario: number;
  subtotalDevuelto: number;
  stockReintegrado: boolean;
  createdAt: Date;
}

/** Devolucion con datos enriquecidos (para UI) */
export interface DevolucionDetallada extends Devolucion {
  ventaFolio?: string;
  ventaFecha?: Date;
  clienteNombre?: string;
  procesadoPorNombre?: string;
  items: DevolucionItemDetallado[];
}

export interface DevolucionItemDetallado extends DevolucionItem {
  productoNombre?: string;
  productoMarca?: string;
  productoModelo?: string;
  imei?: string;
}

/** Payload para crear una devolución */
export interface NuevaDevolucionPayload {
  ventaId: string;
  items: {
    ventaItemId: string;
    cantidadDevuelta: number;
  }[];
  metodoReembolso: MetodoReembolso;
  referenciaReembolso?: string;
  motivo?: string;
  notas?: string;
}

/** Validación de elegibilidad para devolver una venta */
export interface DevolucionElegibilidad {
  elegible: boolean;
  razon?: string;            // Mensaje si NO es elegible
  diasTranscurridos: number;
  limiteMaximoDias: number;
  esPayjoy: boolean;
  primerPagoPayjoy?: boolean; // true = cliente ya pagó → bloqueado
}

// =====================================================
// FASE 46: Órdenes de Compra a Proveedores
// =====================================================

export type EstadoOrdenCompra =
  | "borrador"
  | "enviada"
  | "recibida_parcial"
  | "recibida"
  | "cancelada";

export interface OrdenCompraItem {
  id: string;
  ordenCompraId: string;
  productoId: string | null;
  descripcion: string;
  sku?: string;
  marca?: string;
  modelo?: string;
  cantidad: number;
  cantidadRecibida: number;
  precioUnitario: number;
  descuentoPct: number;
  subtotal: number;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrdenCompra {
  id: string;
  distribuidorId: string | null;
  proveedorId: string | null;
  folio: string;
  estado: EstadoOrdenCompra;
  fechaOrden: string;          // YYYY-MM-DD
  fechaEsperada?: string;
  fechaRecibida?: string;
  subtotal: number;
  descuento: number;
  total: number;
  moneda: string;
  condicionesPago?: string;
  notas?: string;
  notasRecepcion?: string;
  creadoPor?: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations (joins)
  items?: OrdenCompraItem[];
  proveedor?: { id: string; nombre: string; telefono?: string; email?: string };
}

export type OrdenCompraFormData = Omit<
  OrdenCompra,
  "id" | "folio" | "subtotal" | "total" | "createdAt" | "updatedAt" | "items" | "proveedor"
> & {
  items: Omit<OrdenCompraItem, "id" | "ordenCompraId" | "subtotal" | "createdAt" | "updatedAt">[];
};

// =====================================================
// FASE 35: Centro de Promociones
// =====================================================

export interface Promocion {
  id: string;
  distribuidorId?: string;
  titulo: string;
  descripcion?: string;
  imagenUrl?: string;
  precioNormal?: number;
  precioPromocion?: number;
  categoria: "accesorios" | "combos" | "celulares" | "servicios" | "general";
  activa: boolean;
  fechaInicio?: Date;
  fechaFin?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// FASE 42: Lotes de Piezas — Gestión de compras con distribución de envío
// =====================================================

export type EstadoLotePiezas = "pedido" | "en_camino" | "recibido" | "verificado" | "cancelado";
export type EstadoLotePiezasItem = "pendiente" | "recibido_ok" | "recibido_danado" | "faltante";

export interface LotePiezasItem {
  id: string;
  loteId: string;
  reparacionId?: string;
  descripcion: string;
  cantidadPedida: number;
  cantidadRecibida?: number;
  costoUnitario?: number;
  estadoItem: EstadoLotePiezasItem;
  notas?: string;
  createdAt: Date;
}

export interface LotePiezas {
  id: string;
  distribuidorId: string;
  proveedor: string;
  numeroPedido?: string;
  fechaPedido: Date;
  fechaEstimadaLlegada?: Date;
  fechaLlegada?: Date;
  costoEnvioTotal: number;
  estado: EstadoLotePiezas;
  notas?: string;
  recibidoPor?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  items?: LotePiezasItem[];
  cantidadItems?: number;
}

export type LotePiezasFormData = Omit<
  LotePiezas,
  "id" | "distribuidorId" | "createdBy" | "createdAt" | "updatedAt" | "items" | "cantidadItems" | "recibidoPor"
> & {
  items?: Omit<LotePiezasItem, "id" | "loteId" | "createdAt">[];
};

// =====================================================
// FASE 54-A: CATÁLOGO DE SERVICIOS DE REPARACIÓN
// =====================================================

export interface CatalogoServicioReparacion {
  id: string;
  nombre: string;
  descripcion?: string;
  marca?: string;       // NULL = aplica a cualquier marca
  modelo?: string;      // NULL = aplica a cualquier modelo
  precioBase: number;
  tiempoEstimadoMinutos?: number;
  activo: boolean;
  distribuidorId?: string; // NULL = servicio global
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // Campo calculado: precio efectivo para un distribuidor específico
  // (precio_base si no hay sobrescritura, precio personalizado si la hay)
  precioEfectivo?: number;
}

export interface CatalogoServicioPrecioDistribuidor {
  id: string;
  servicioId: string;
  distribuidorId: string;
  precio: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CatalogoServicioFormData = Omit<
  CatalogoServicioReparacion,
  "id" | "createdBy" | "createdAt" | "updatedAt" | "precioEfectivo"
>;

// ─── FASE 55: Control de Asistencia / Reloj Checador ─────────────────────────

export interface AsistenciaSesion {
  id: string;
  distribuidorId?: string;
  usuarioId: string;
  usuarioNombre?: string;
  fechaEntrada: Date;
  fechaSalida?: Date;
  duracionMinutos?: number;   // GENERATED ALWAYS en la DB
  notasEntrada?: string;
  notasSalida?: string;
  estado: "activo" | "cerrado";
  createdAt: Date;
  updatedAt: Date;
}

export interface EstadisticasAsistencia {
  presentes: number;          // empleados con turno activo ahora mismo
  totalHorasHoy: number;
  totalHorasMes: number;
  promedioHorasDia: number;
  resumenEmpleados: {
    usuarioId: string;
    nombre: string;
    horasMes: number;
    diasTrabajados: number;
    estadoActual: "presente" | "ausente";
  }[];
}

// ─── FASE 61: Kits y bundles ────────────────────────────────────────────────────

export interface KitItem {
  id:          string;
  kitId:       string;
  productoId:  string;
  cantidad:    number;
  // Relación opcional
  producto?:   Producto;
}

export interface Kit {
  id:             string;
  distribuidorId: string;
  nombre:         string;
  descripcion?:   string;
  precio:         number;
  activo:         boolean;
  imagen?:        string;
  createdAt:      Date;
  updatedAt:      Date;
  // Relación
  items?:         KitItem[];
}

export interface NuevoKitFormData {
  nombre:        string;
  descripcion?:  string;
  precio:        number;
  imagen?:       string;
  items:         { productoId: string; cantidad: number }[];
}

// ─── FASE 62: Series por lote ──────────────────────────────────────────────────

export type EstadoLoteSerie = "borrador" | "procesado" | "cancelado";
export type EstadoSerieItem = "valido" | "duplicado" | "invalido";

export interface LoteSerieItem {
  id:         string;
  loteId:     string;
  imei:       string;
  estado:     EstadoSerieItem;
  productoId?: string;
  notas?:     string;
  createdAt:  Date;
}

export interface LoteSerie {
  id:             string;
  distribuidorId: string;
  productoId:     string;
  folio:          string;
  referencia?:    string;
  proveedorId?:   string;
  totalEsperado:  number;
  totalRecibido:  number;
  totalDuplicado: number;
  totalInvalido:  number;
  estado:         EstadoLoteSerie;
  notas?:         string;
  creadoPor?:     string;
  createdAt:      Date;
  updatedAt:      Date;
  // Relaciones
  producto?:      Partial<Producto>;
  proveedor?:     { id: string; nombre: string } | null;
  items?:         LoteSerieItem[];
}

export interface NuevoLoteSerieFormData {
  productoId:     string;
  referencia?:    string;
  proveedorId?:   string;
  totalEsperado:  number;
  notas?:         string;
  imeis:          string[];  // lista ya parseada y validada
}

// =====================================================
// FASE 56: Permisos Granulares por Empleado
// =====================================================

/** Un registro en la tabla permisos_empleado */
export interface PermisosEmpleado {
  usuarioId:      string;
  permiso:        string;   // clave del tipo Permiso (src/lib/permisos.ts)
  activo:         boolean;  // true = concedido, false = revocado
  otorgadoPor?:   string;   // userId del admin que lo configuró
  createdAt:      Date;
  updatedAt:      Date;
}

/** Mapa plano de permisos para un empleado: { [key: Permiso]: boolean } */
export type MapaPermisos = Record<string, boolean>;

// =====================================================
// FASE 55: Control de Asistencia / Reloj Checador
// =====================================================

export interface AsistenciaSesion {
  id: string;
  distribuidorId?: string;
  usuarioId: string;
  usuarioNombre?: string;
  fechaEntrada: Date;
  fechaSalida?: Date;
  duracionMinutos?: number;   // GENERATED ALWAYS — calculado en DB
  notasEntrada?: string;
  notasSalida?: string;
  estado: 'activo' | 'cerrado';
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumenEmpleadoAsistencia {
  usuarioId: string;
  nombre: string;
  horasMes: number;
  diasTrabajados: number;
  estadoActual: 'presente' | 'ausente';
}

export interface EstadisticasAsistencia {
  presentes: number;             // empleados con turno activo ahora
  totalHorasHoy: number;
  totalHorasMes: number;
  promedioHorasDia: number;
  resumenEmpleados: ResumenEmpleadoAsistencia[];
}

// =====================================================
// FASE 55-WA: WhatsApp Business API
// =====================================================

export type CanalEnvioWA = "api" | "link" | "manual";
export type EstadoMensajeWA = "pendiente" | "enviado" | "entregado" | "leido" | "fallido" | "recibido";
export type TipoMensajeWA = "outbound" | "inbound" | "status";
export type EntidadTipoWA = "credito" | "reparacion" | "pago" | "recordatorio" | "otro";

export interface WhatsAppMensaje {
  id: string;
  distribuidorId?: string;
  entidadTipo?: EntidadTipoWA;
  entidadId?: string;
  telefono: string;
  mensaje: string;
  tipo: TipoMensajeWA;
  canal: CanalEnvioWA;
  estado: EstadoMensajeWA;
  waMessageId?: string;
  errorDetalle?: string;
  enviadoPorId?: string;
  enviadoPorNombre?: string;
  createdAt: Date;
  updatedAt: Date;
}
