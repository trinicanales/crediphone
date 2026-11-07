# Informe de problemas REALES (con evidencia) — 2026-11-07
> Pedido de Trini: "el informe de los problemas reales, no solo la suposición del problema".
> Método: cada hallazgo se clasifica por **cómo se comprobó**. Las pruebas en la base se hicieron dentro de transacciones que se deshacen (se verificó después: 0 filas de prueba, mismos totales). No se tocó ningún dato.

**Niveles de evidencia**
- **A · Reproducido en la base real** (ejecuté la operación y vi el error o el resultado).
- **B · Dato real** (consulta que muestra el hecho).
- **C · Visto en pantalla** (navegador, sesión de Trini, 21-oct).
- **D · Solo por lectura de código** (condición clara en el código, NO reproducida para no tocar producción). Marcado como tal.

---
## A. Reproducidos en la base real
| ID | Problema | Resultado exacto de la prueba | Consecuencia comprobada |
|---|---|---|---|
| A1 | **Devoluciones de venta** | `column "nombre_producto" does not exist` (consulta que hace `devoluciones.ts:218`) | La devolución no encuentra los items y nunca se procesa |
| A2 | **Alerta de descuadre de caja y alertas de anticipos** | `column "titulo" of relation "notificaciones" does not exist` | Esas alertas **no pueden crearse** (se confirma en B2) |
| A3 | **Reclamar garantía** | `column "motivo_garantia" does not exist` (`ordenes_reparacion`) | La orden de garantía falla al crearse |
| A4 | Checklist de apertura | `column "checklist_apertura" does not exist` | Dato que el código intenta guardar/leer no existe |
| A5 | Costo de piezas del P&L (antes de K0) | `reparacion_piezas.costo_total` no existe | Corregido en K0 |
| A6 | Garantías por vencer (antes de K0) | `garantias_reparacion.activa` no existe | Corregido en K0 |
| A7 | Resumen del cliente en POS | `creditos.monto_credito` no existe (y `saldo_pendiente`, `scoring_clientes.score/categoria`) | Resumen incompleto |
| A8 | Resumen de cliente | `ordenes_reparacion.total_anticipos` no existe | Dato faltante |
| A9 | Nombre de quien recibió un anticipo | `users.nombre` no existe (la columna es `name`) | Nombre no se muestra |
| A10 | **Devolución total de una venta duplica el stock** | Producto con stock 271: vender 2 → 269; el código suma 2 a mano → 271; marcar la venta "reembolsada" (trigger) → **273**. Debería quedar en 271 | **+2 unidades fantasma** por cada devolución total |
| A11 | Vender más de lo que hay | Vender 2 con stock 1 → `Stock insuficiente… disponible: 1, solicitado: 2` | **Esto sí funciona** (el sistema bloquea la venta; no puede haber stock negativo por venta) |
| A12 | **Reasignar una orden a un admin** (función `reasignar_tecnico`) | `El técnico especificado no es válido o no está activo` | Un admin nunca pudo quedar asignado (corregido en K3a) |
| A13 | **Borrar una orden entregada** | Orden entregada con 1 anticipo: antes=1, después=0 | **La orden y su dinero desaparecen**; sin bitácora |

## B. Datos reales
| ID | Hecho | Dato |
|---|---|---|
| B1 | Cierres de caja con diferencia | 37 de 47 cierres tienen diferencia; suma **−$54,951.97**; 21 cierres con monto final $0 (suman −$39,320.97) |
| B2 | Alertas de descuadre creadas | **0** (con 37 cierres con diferencia); tipos de notificación existentes: solo cliente_aprobo, orden_actualizada, orden_completada, orden_lista_entrega |
| B3 | Cajas abiertas | 4, de 25 a 181 días; 63 anticipos por $36,415 dentro de ellas |
| B4 | Anticipos sin aplicar en órdenes ya entregadas/canceladas (Principal) | 43 anticipos, $17,230 |
| B5 | Entregas registradas | 0 en agosto, septiembre y octubre (mayo 16, junio 10, julio 11) |
| B6 | Ventas capturadas como órdenes de reparación | ORD-20261020-0003 ($3,650) y ORD-20260813-0005 ($4,700) |
| B7 | Anticipos registrados en ráfaga | 19 anticipos ($11,400) el 19-oct entre 10:10:49 y 10:11:22 hora local (≈ 30 segundos) |
| B8 | Solicitudes de cambio de precio sin atender | 6 (3 con la orden aún en $0): hasta 149 días |
| B9 | Técnicos con tienda incorrecta | Luis Arreola (tienda desactivada) con 19 órdenes activas; "tecnico Mañana" sin tienda (corregido) |
| B10 | `ventas.sesion_caja_id` | acepta nulo (`is_nullable = YES`) y no hay trigger que lo exija |

## C. Visto en pantalla (21-oct)
- Historial de cajas: los cierres hechos en $0 **no muestran** "Monto declarado/Diferencia".
- El POS muestra "Caja abierta CAJA-2026-00013" (181 días) y permite vender sobre ella.
- Órdenes: Total 182 vs Panel técnico "Todos" 205; tarjetas Diagnóstico/Esp. Piezas/Garantías en 0; sin tarjeta para Recibido (68).
- Alertas de inventario mostraban 5 y el dashboard 26 (corregido).

## D. Solo por lectura de código (NO reproducidas — dilo si quieres que las probemos en un entorno de pruebas)
| ID | Hallazgo | Dónde |
|---|---|---|
| D1 | Una devolución puede exceder lo vendido (se compara con lo vendido, no con lo ya devuelto) | `devoluciones.ts` |
| D2 | Cancelar una venta tras devolución parcial vuelve a sumar el stock de todo | `cancelarVenta` + trigger |
| D3 | Devolución/cancelación no registran dinero en caja | `devoluciones.ts`, `cancelarVenta` |
| D4 | El servidor acepta el precio y el descuento que manda la pantalla (sin tope; `descuento_maximo_pct` por defecto 100) | `createVenta` |
| D5 | Una venta acepta productos de otra tienda | `createVenta` |
| D6 | Apartados: crear no reserva producto ni registra el depósito; completar solo cambia el estado | `createApartado`, `completarApartado` |
| D7 | Abrir caja pega a la sesión nueva TODOS los anticipos en efectivo previos sin sesión | `abrirCaja` |
| D8 | Venta no atómica (venta→items→movimientos→puntos) | `createVenta` |

## Lo que NO pude medir
- **Frecuencia real de errores en producción** (cuántas veces falla cada cosa al día): la herramienta de registros de Supabase disponible no me permite consultarlos. Para eso sirve un monitor de errores (Sentry) o los registros de Cloudflare; no es una suposición mía, es un hueco de visibilidad.
- Dos respuestas HTTP 400 que aparecen en la consola de todas las páginas: origen sin identificar.

## Qué cambió en mi forma de trabajar (autorizado por Trini)
Hooks de verificación en `.claude/settings.json`: (1) al terminar, corre `tsc` si hay cambios sin confirmar en `src/` y bloquea el cierre si hay errores; (2) tras editar un `.ts/.tsx`, avisa si ese archivo usa columnas que no existen. Scripts en `scripts/hooks/`. Probados con casos reales (bloquea un error de tipo; detecta `nombre_producto`). Se activan al abrir una sesión nueva (en esta sesión el hook de columnas no se disparó: la configuración se carga al iniciar).
