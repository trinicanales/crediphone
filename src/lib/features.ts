/**
 * Banderas de módulos del sistema (seguras para cliente y servidor).
 *
 * PayJoy y Facturación están FUERA del proyecto por decisión de Trini (2026-10-19):
 * se ocultan del menú y de las pantallas, y las rutas /api/payjoy/* responden "deshabilitado"
 * (ver features-server.ts). No se borró ningún código: para reactivar un módulo basta poner
 * su bandera en `true` (y, en PayJoy, volver a proteger sus rutas con sesión de admin ANTES de activarlo).
 */
export const FEATURES = {
  payjoy: false,
  facturacion: false,
} as const;
