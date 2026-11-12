# MAPA DE CONEXIONES — qué está ligado con qué
> Se lee SOLO cuando no está claro qué más se afecta al cambiar algo (ver regla 16 de CLAUDE.md).
> Creado 2026-11-11 con lo VERIFICADO en código y en Supabase. **Cobertura parcial**: ver §7. Cada vez que se cambie o se descubra una conexión, se actualiza aquí (no de memoria).
> Leyenda: ✔ conectado y verificado · ◐ a medias · ✘ roto/ausente · (?) no verificado.

## 1. Cómo usarlo antes de cambiar algo
1. Busca aquí el dato/evento (§3 y §4). 2. Busca TODOS los usos con Grep (código) y consulta Supabase (columnas, FKs, triggers). 3. Lista a Trini qué pantallas/efectos se afectan. 4. Cambia. 5. Revisa en vivo las pantallas relacionadas (§5) y actualiza este mapa.

## 2. Reglas ÚNICAS (si cambias una, cambia en todos lados a la vez)
| Regla | Archivo único | Lo usan |
|---|---|---|
| Estados de orden, transiciones, "activa", pasos del stepper, ingreso de una orden | `src/lib/reparaciones/estados.ts` | `lib/db/reparaciones.ts`, `api/reparaciones/[id]`, ModalCambiarEstado, OrdenCard, StepperReparacion, BarraProgresoReparacion (seguimiento), `api/dashboard/resumen`, `lib/db/reparaciones-dashboard.ts` |
| "Hoy"/mes en hora de México (UTC-6) | `src/lib/fechas.ts` | resumen, P&L, comisiones, pagos, ventas, stats de distribuidores |
| Stock bajo (mínimo por defecto 1, negativos) | `src/lib/inventario/stock.ts` | `api/dashboard/resumen`, `dashboard/inventario/alertas/page.tsx`; función SQL `kpi_stock_bajo` (misma regla escrita en SQL) |
| Dinero (formato) | `src/lib/format.ts` | dashboards, reportes (quedan ~25 copias locales en POS/inventario) |
| Asignar orden a técnico/admin | `src/lib/reparaciones/asignacion.ts` | `api/reparaciones/[id]/tomar`, `/asignar-tecnico`; tabla `asignaciones_orden` |
| Alias de marcas / autocompletar | `src/lib/reparaciones/marcas.ts` + `api/reparaciones/sugerencias` | ModalOrden, SelectorPiezasCotizacion |
| Módulos apagados | `src/lib/features.ts` (+ `features-server.ts`) | PayJoy y Facturación (sidebar, páginas, 10 rutas payjoy) |
| Efectos de entregar | `src/lib/reparaciones/entrega.ts` (`ejecutarEfectosEntrega`) | `/api/reparaciones/[id]/entregar`, `/api/pos/reparacion-cobro` |

## 3. Datos y quién los toca
### Orden de reparación (`ordenes_reparacion`)
- **Precio:** `precio_total` (lo que paga el cliente) y `costo_total` (columna GENERADA = costo_reparacion + costo_partes). Regla: `precio_total || costo_total` (`ingresoOrden`). Escriben: `recalcularTotalesOrden` (precio_total, costo_partes), aprobar solicitud de precio (solo costos ◐). Lo leen: OrdenCard, seguimiento, POS cobro, entrega, P&L, Panel KPIs, dashboard.
- **FK que BORRAN en cascada al borrar la orden:** anticipos_reparacion, historial_estado_orden, tracking_tokens, notificaciones, imagenes_reparacion, reparacion_piezas, pedidos_pieza_reparacion, solicitudes_piezas, garantias_piezas, reparacion_tiempo_logs, confirmaciones_deposito, reparacion_diagnosticos, versiones_pdf_reparacion, solicitudes_cambio_precio, notificaciones_fallidas, historial_precios_orden, recordatorios_enviados, asignaciones_orden. **Bloquea el borrado** (NO ACTION): `movimientos_bolsa_virtual`. Sin FK: `garantias_reparacion.orden_id`. ✘ El DELETE de la API (solo super_admin) no pide motivo ni deja bitácora y borra órdenes entregadas con su dinero.
- **Trigger:** cambio de `estado` → fila en `historial_estado_orden` (✘ sin usuario). Esa tabla alimenta `v_ordenes_antiguedad` (días en estado): **no insertar filas manuales ahí** (reinicia la antigüedad).
- **Técnico:** `tecnico_id`. ✘ RPC `reasignar_tecnico` solo acepta role='tecnico' (ya no se usa para asignar).
### Dinero de reparaciones
- `anticipos_reparacion` (estado pendiente/aplicado/devuelto; `sesion_caja_id`) → bolsa virtual = pendientes de órdenes activas (hoy $51,690 en Principal). `caja_movimientos` (tipos: deposito, retiro, cobro_reparacion, entrada_anticipo, devolucion_anticipo, pay_in, pay_out). ✘ `caja_movimientos.distribuidor_id` casi siempre NULL y sin FK a la sesión: filtrar por las sesiones de la tienda (`caja_sesiones`).
- Cierre de caja (`lib/db/caja.ts cerrarCaja`): esperado = inicial + ventas efectivo + anticipos efectivo (de `anticipos_reparacion`, NO de caja_movimientos) + depósitos − retiros. ✘ alerta de descuadre no se crea (columnas inexistentes en `notificaciones`).
### Inventario y ventas
- `productos.stock`: lo cambian (1) trigger `decrementar_stock_venta` al insertar `ventas_items` (bloquea si no alcanza), (2) trigger `restaurar_stock_cancelacion` al pasar la venta de completada a cancelada/reembolsada (devuelve TODOS los items), (3) `devoluciones.ts` suma a mano (✘ duplica con el 2), (4) piezas de reparación al entregar (`entrega.ts`), (5) importar/verificar/ajustes. `stock_apartado` solo lo usan las refacciones de reparación.
- Venta POS: `lib/db/ventas.ts createVenta` → ventas, ventas_items, movimientos_stock, puntos. ✘ no exige caja abierta; confía en precio/descuento del cliente (D4 del informe).
### Seguimiento al cliente
- `/reparacion/[folio]` (público; ya NO devuelve token; verifica 4 dígitos del teléfono, 5 intentos → `tracking_intentos`) → `/tracking/[token]` (`tracking_tokens`, vigencia 90 días). No debe exponer costos internos (se filtran en `api/tracking/[token]`).

## 4. Evento → qué debe pasar → estado (detalle en `REPORTE-INTEGRACION-IMPORTADOR-TENDENCIAS-2026-11-06.md` §1.2)
| Evento | Efectos | Estado |
|---|---|---|
| Cambiar estado de orden | historial, aviso (enlace WhatsApp manual), semáforo | ✔ / usuario ✘ |
| Entregar | anticipos aplicados, bolsa, stock piezas, puntos, PDF, garantía 90 d | ✔ (✘ no se está marcando en la práctica; contraseña y firma pendientes) |
| Cancelar orden | libera piezas, devuelve anticipos, bolsa, **caja abierta (nuevo)** | ✔ |
| Anticipo | caja del turno, bolsa | ✔ · alerta ✘ · ticket 58 mm ✘ |
| Cambiar piezas/presupuesto | recalcula total/saldo | ✔ · PDF versión ✘ · aviso ✘ |
| Aprobar cambio de precio | precio que paga el cliente | ◐ (no actualiza `precio_total`) |
| Vender POS | stock, caja, puntos | ✔ / caja ◐ |
| Devolver / cancelar venta | stock, caja, puntos | ✘ roto (ver informe A1, A10) |
| Cerrar caja | cuadre, alerta | ◐ / alerta ✘ |
| Reasignar / iniciar diagnóstico | dueño de la orden + historial | ✔ (K3a) |

## 5. Pantalla ↔ API ↔ tablas (para revisar en vivo después de un cambio)
| Pantalla | API | Tablas / funciones |
|---|---|---|
| Dashboard admin | `/api/dashboard/resumen`, `/api/dashboard/por-aprobar`, `/api/dashboard/stream`, `/api/reparaciones?detalladas=true` | ordenes_reparacion, caja_movimientos, caja_sesiones, ventas, pagos, productos, solicitudes_cambio_precio, confirmaciones_deposito, log_autorizaciones |
| Dashboard vendedor/cobrador | `/api/stats` | clientes, creditos, pagos, productos, scoring_clientes |
| Órdenes (lista) | `/api/reparaciones` (+ realtime sobre ordenes_reparacion) | ordenes_reparacion + joins |
| Panel técnico | `/api/reparaciones?tecnico_id=` | igual (super_admin ve TODAS las tiendas) |
| OrdenCard / Drawer | `/api/reparaciones/[id]/*` (tomar, asignar-tecnico, cancelar, anticipos, pedidos-pieza, entregar, solicitudes-precio) | las de §3 |
| Panel KPIs de reparaciones | `/api/reparaciones/dashboard` | `lib/db/reparaciones-dashboard.ts` |
| Reportes / P&L | `/api/reportes/pnl`, `/rentabilidad`, `/comisiones` | ventas, ventas_items, ordenes_reparacion, pedidos_pieza_reparacion, ordenes_compra |
| POS / Caja / Historial | `/api/pos/ventas`, `/pos/caja`, `/pos/devoluciones`, `/pos/reparacion-cobro` | ventas, ventas_items, caja_sesiones, caja_movimientos, devoluciones, anticipos_reparacion |
| Alertas de inventario | (cliente) `/api/productos` | productos, lib/inventario/stock.ts |

## 6. Automatismos en la base
- **Triggers:** ventas (folio, restaurar stock), ventas_items (decrementar stock), caja_sesiones (folio), ordenes (historial de estado, folios, updated_at). **Cron:** `kpi-snapshot-diario` 23:55 MX → `kpi_snapshots`. Funciones KPI: `kpi_taller`, `kpi_dinero`, `kpi_stock_bajo`, `kpi_resumen_semana`, `semaforo_orden`, vista `v_ordenes_antiguedad` (migración fase92). Solo service_role.
- **Columnas inexistentes que el código usa (fallan en silencio):** `ventas_items.nombre_producto`, `notificaciones.titulo/severidad/leida/metadata/distribuidor_id`, `ordenes_reparacion.motivo_garantia/checklist_apertura/total_anticipos`, `creditos.monto_credito/saldo_pendiente`, `scoring_clientes.score/categoria`, `users.nombre/apellido`, `reparacion_piezas.costo_total` (ya corregida en P&L), `garantias_reparacion.activa` (ya corregida en Panel KPIs). Detector: `scripts/audit-columnas.js` (hook lo corre al editar).

## 7. Cobertura (lo que NO está mapeado todavía — verificar antes de tocar)
Clientes + puntos de lealtad · créditos/cobranza/apartados (apartados incompleto) · empleados y asistencia · catálogo de servicios (hay 2 catálogos: `servicios` y `catalogo_servicios_reparacion`) · kits · lotes de piezas y de series · órdenes de compra · notificaciones push · PDFs/versiones · garantías (reclamo roto) · configuración · distribuidores/multitienda (4 tiendas, solo Principal activa).
