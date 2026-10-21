# Investigación — Dashboard, KPIs, reportes y unificación de páginas
> 2026-10-20 · SOLO LECTURA (no se cambió código ni datos). Base para trabajar por fases.
> Método: lectura de las páginas/APIs de KPIs y reportes + consultas a Supabase (datos reales) + `pg_stat_user_tables`.

## 0. Veredicto
1. **El dashboard está bien organizado por rol pero mide el negocio equivocado.** Está pensado para una tienda de crédito/POS; el uso real es **taller de reparaciones** (205 órdenes, 21 en los últimos 30 días; 0 créditos, 0 pagos de crédito, 6 ventas POS en total y 0 en 30 días).
2. **Varios KPIs muestran un número incorrecto** (zona horaria, columnas que no existen, tres definiciones de "activas", ingresos con la columna equivocada). Hay que corregir la exactitud ANTES de agregar gráficas nuevas.
3. **Hay ~1,100 líneas de dashboard antiguo que nunca se muestran** (código muerto) que además dispara 4–5 llamadas a la API en cada carga.
4. **Hay 40+ entradas de menú** y varias páginas que son la misma cosa partida en varias (reportes ×4 + panel KPIs, inventario ×14, catálogos de servicios ×2, cartera ×4). Se pueden compactar a ~12 secciones con pestañas **sin borrar funciones**.
5. **Se perdió información** respecto al dashboard anterior (riesgo crediticio, valor de inventario, tasa de recuperación, créditos que requieren atención) y el admin no ve en su pantalla principal lo que sí existe en "Panel KPIs" (ingresos del mes, carga de técnicos, aprobación de presupuestos).

## 1. Radiografía: qué se usa de verdad (filas en BD, 2026-10-20)
| Con datos | Filas | Sin datos (0) |
|---|---|---|
| historial_estado_orden | 803 | creditos, pagos, contratos, referencias_* |
| notificaciones / whatsapp_mensajes | 608 / 425 | garantias_reparacion (0 hasta hace 5 días), garantias_piezas |
| clientes | 216 | reparacion_piezas, reparacion_diagnosticos, reparacion_tiempo_logs |
| ordenes_reparacion | 205 (71 recibido, 59 entregado, 54 listo_entrega, 15 cancelado) | ordenes_compra(+items), lotes_piezas, lotes_series |
| caja_movimientos / caja_sesiones | 178 / 51 | kits, devoluciones, consignaciones |
| anticipos_reparacion | 172 | catalogo_servicios_reparacion (el catálogo de reparaciones) |
| productos | 137 | versiones_pdf_reparacion, log_autorizaciones, traspasos_anticipo |
| pedidos_pieza_reparacion | 38 | verificaciones (2 cabeceras, 0 items) |
| ventas / ventas_items | 6 / 6 | payjoy_* (desactivado) |

**Dinero real que se mueve (caja, últimos 90 días):** `entrada_anticipo` 52 movimientos = **$31,665**; `cobro_reparacion` 1 = $800. Nada de pagos de crédito.
**Conclusión:** el dashboard debería girar en torno a **órdenes + anticipos + caja + piezas pedidas**, no crédito.

## 2. Inventario de lo que existe hoy
**Dashboards por rol** (`dashboard/page.tsx` enruta): admin/super_admin → `DashboardEjecutivo` (6 KPIs + órdenes + stream + comparativa sucursales SA, polling 3 min); vendedor → `VendedorDashboard`; cobrador → `CobradorDashboard` (todo crédito); técnico → `TecnicoDashboard` (mis órdenes activas).
**APIs de KPIs:** `/api/dashboard/resumen`, `/api/dashboard/stream`, `/api/stats`, `/api/reparaciones/dashboard`, `/api/pos/stats`, `/api/reportes` (+`/pnl`, `/rentabilidad`, `/comisiones`, `/pdf`), `/api/equipos/stats`, `/api/admin/distribuidores/*`.
**Reportes (5 páginas):** Reportes (pestañas Créditos | P&L), Comisiones, Equipos, Rentabilidad, y "Panel KPIs" de reparaciones (`dashboard-reparaciones`).
**Base de datos:** 0 vistas materializadas; 5 vistas simples; **1 solo cron (`notificaciones-hora`, roto)**. Todos los KPIs se calculan en cada visita leyendo tablas completas.

## 3. Hallazgos de exactitud (KPIs que hoy engañan)
| ID | Hallazgo | Evidencia | Efecto |
|---|---|---|---|
| D1 | **"Cobrado hoy" = solo pagos de créditos** (`pagos`), tabla con 0 filas | caja: 52 anticipos $31,665 en 90 d | Siempre $0; no cuenta anticipos ni cobros de reparación. El KPI principal de dinero del admin no sirve |
| D2 | **"Hoy" empieza a las 18:00 de ayer** (Cloudflare Workers corre en UTC; `setHours(0,0,0,0)` = medianoche UTC = 18:00 en Durango UTC-6). El comentario del código asume UTC-6 | `api/dashboard/resumen`; mismo patrón en **15 archivos** (`lib/db/caja,pagos,ventas,reparaciones…`, comisiones, pdf) | Los KPIs "de hoy", comisiones del día y cortes pueden mezclar días |
| D3 | **Stock crítico: filtro inválido** `stock.lte.stock_minimo` (PostgREST no compara columna con columna) | real: 5 críticos (2 agotados + 3 bajo mínimo); **55 de 137 productos activos no tienen mínimo definido** | KPI probablemente mal (a verificar con prueba); además sin mínimo no hay alerta |
| D4 | "Ventas POS hoy" suma `ventas` **sin filtrar estado** | ventas.estado ∈ completada/cancelada/reembolsada | Incluye canceladas/reembolsadas |
| D5 | **Tres definiciones de "reparaciones activas"**: resumen = todo menos cancelado/entregado (=130, incluye 71 "recibido" y 54 "listo"); Panel KPIs = recibido/diagnóstico/presupuesto/aprobado/en_reparación (excluye esperando piezas, completado, listo); widget = otra lista | código | Números distintos en pantallas distintas |
| D6 | **Ingresos de reparaciones con columna distinta según pantalla**: Panel KPIs usa `costo_total`; POS/entrega/P&L usan `precio_total` (o costo) | jun-2026: costo_total **$3,850** vs precio_total **$8,760**; may: 5,070 vs 6,120 | "Ingresos del mes" del Panel subestimado hasta 56 % |
| D7 | **P&L: costo de piezas = 0 siempre**: lee `reparacion_piezas.costo_total` (columna inexistente; tabla con 0 filas) | columnas reales: `costo_unitario`; las piezas viven en `pedidos_pieza_reparacion` (38) y JSON de la orden | Utilidad inflada; no hay costo real de refacciones |
| D8 | P&L: reparaciones se ubican por `fecha_entregado` pero **26 de 59 entregadas no la tienen**; ventas usan `neq cancelada` (incluye reembolsadas); no hay criterio explícito caja vs devengado (anticipos ignorados) | SQL | Meses incompletos / mezcla de criterios |
| D9 | Panel KPIs: **"Garantías próximas a vencer" siempre vacío** (`garantias_reparacion.activa` no existe; error se traga) | B7 de la auditoría | Alerta de garantías inútil |
| D10 | `/api/stats` (lo usan Vendedor y Cobrador) **descarga clientes, créditos, pagos y productos completos** solo para contar; "pagos recibidos" cuenta el histórico, no hoy; "Tasa de recuperación" = % de créditos ya no activos (no mide recuperación) | código | Lento al crecer y números mal rotulados |
| D11 | **Código muerto + doble carga**: `dashboard/page.tsx` líneas ~290–1423 nunca se pintan (los 5 roles retornan antes) pero los hooks del inicio ya llamaron `/api/stats`, `/api/reparaciones/dashboard`, `/api/reparaciones?detalladas`, caja y notificaciones; luego el componente por rol vuelve a pedir lo suyo | código | 4–5 llamadas desperdiciadas por visita, 1,100 líneas confusas |
| D12 | **Información que se perdió** del dashboard anterior: riesgo crediticio (scoring), créditos que requieren atención, valor del inventario, tasa de recuperación, estado de caja de otro empleado, alertas PayJoy. Y el admin **no ve en su pantalla principal**: ingresos del mes, tendencia, carga por técnico, tasa de aprobación de presupuestos (solo en Panel KPIs) | código | Pérdida de visibilidad |
| D13 | **No existen KPIs propios del taller**: antigüedad de órdenes por estado, "sin movimiento > N días", tiempo de ciclo, ticket promedio, margen por reparación, piezas pendientes/atrasadas, equipos abandonados, anticipos sin aplicar, devoluciones, productividad por técnico | — | Los problemas reales (54 listas sin entregar, 71 en "recibido", 63 anticipos huérfanos) no salen en ningún indicador |
| D14 | Los **técnicos no ven** su productividad ni comisión; **las comisiones** solo existen para vendedor/admin (ventas+créditos), no para técnicos por reparación | api/reportes/comisiones | Falta incentivo/visibilidad |
| D15 | Actualización: solo el Ejecutivo hace polling (3 min). Realtime solo en lista de órdenes y drawer | código | Vendedor/técnico ven datos viejos |

## 4. Consistencia visual / técnica (plan "por fases visuales")
- **Reglas de diseño violadas** (colores Tailwind directos / `dark:`): `admin/distribuidores/[id]` 90, `reportes/comisiones` 48, `inventario/ubicaciones` 26, `dashboard-reparaciones` 19, `admin/proveedores` 14, `admin/categorias` 12, `lotes-piezas` 5 y las 3 gráficas del Panel KPIs.
- **4 implementaciones distintas de tarjeta KPI** (`StatCard`, `KpiCard` del Ejecutivo, `KPIsReparaciones`, `CreditoStat`) y **34 archivos con su propio `formatCurrency/formatMXN`**.
- Páginas gigantes que conviene dividir: `productos` 3,409 líneas, `pos` 2,682, `tracking/[token]` 2,355, `verificar` 1,529, `configuracion` 1,484, `dashboard/page` 1,423 (1,100 muertas).
- Páginas con 140–300 líneas que son accesos sueltos (`inventario/page` hub, `notificaciones/fallidas`, `facturacion`).

## 5. Páginas que conviene unificar (propuesta aditiva: se conservan TODAS las funciones; solo cambia dónde viven)
| # | Hoy (separado) | Propuesta | Motivo |
|---|---|---|---|
| U-A | Reportes (Créditos/P&L), Comisiones, Equipos, Rentabilidad, Panel KPIs reparaciones (5 entradas) | **Centro de Reportes** con pestañas: Resumen · Ventas y P&L · Reparaciones (ingresos, margen, tiempos, aprobación) · Inventario · Caja · Comisiones (vendedor + técnico) · Equipos · Rentabilidad · Cartera (solo si hay crédito) | Un solo selector de periodo, una sola definición de ingreso, un solo exportar |
| U-B | Inventario: Productos, Kits, Servicios, Categorías, Proveedores, Compras, Lotes piezas, Verificar, Ubicaciones, Alertas, Movimientos, Discrepancias, Series, Importar (**14 entradas**) | **Inventario** (Productos·Alertas·Movimientos·Conteos[Verificar+Discrepancias]·Ubicaciones·Series/Lotes·Importar) + **Abastecimiento** (Compras·Pedidos de piezas·Lotes de piezas·Proveedores). Kits, Categorías y Servicios dentro de Productos | 14 → 2 secciones. Ya existe un hub (`inventario/page`) que el menú ignora |
| U-C | `servicios` (2 filas, usado en POS) y `catalogo_servicios_reparacion` (0 filas, catálogo de reparaciones) — **dos catálogos de servicios** con APIs distintas | **Un solo catálogo de servicios/reparaciones** | Duplicidad de precios y de mantenimiento |
| U-D | Órdenes, Garantías, Almacenaje, Panel KPIs, Mi Panel Técnico, `reparaciones/[id]` (página) vs OrdenDrawer | **Reparaciones**: Órdenes · Tablero del taller · Garantías · Almacenaje (+ KPIs en Reportes). Retirar la página `[id]` si el drawer la cubre (verificar primero) | Un lugar para todo el ciclo del equipo |
| U-E | Créditos, Cobros y Pagos, Cartera vencida, Recordatorios | **Cartera** (pestañas). Con 0 créditos hoy: ocultar con `FEATURES` hasta que se use | Sin datos; ruido en el menú |
| U-F | Clientes, Programa de puntos, Promociones | **Clientes** con pestañas | Mismo público |
| U-G | Empleados, Asistencia, (Comisiones) | **Personal** | Mismo objeto |
| U-H | POS, Caja/Turno, Historial | Mantener páginas; unir Caja+Historial en pestañas de **Caja** | Cierre y consulta juntos |
| U-I | Notificaciones fallidas, Recordatorios, plantillas (en Configuración) | **Centro de mensajes**: bandeja "por enviar" (hoy 425 mensajes en modo enlace) + fallidos + plantillas | Es la tarea diaria real al estar en modo enlace |
**Efecto en el menú:** de ~37 entradas a ~12 (Inicio · Reparaciones · POS/Caja · Inventario · Abastecimiento · Clientes · Mensajes · Reportes · Personal · Cartera(oculta) · Configuración · Distribuidores(SA)).

## 6. Dashboard propuesto (por rol)
- **Admin / SA:** (1) *Dinero hoy*: anticipos + cobros de reparación + POS − devoluciones (caja real); (2) *Taller*: órdenes por estado con **antigüedad** (verde/ámbar/rojo), listas sin entregar > N días, sin movimiento > N días; (3) *Piezas*: por pedir / pedidas atrasadas / por verificar; (4) *Alertas*: presupuestos sin respuesta, anticipos pendientes de aplicar, stock bajo mínimo, garantías por vencer, mensajes por enviar; (5) *Tendencia*: ingresos y órdenes 6 meses, ticket promedio, margen por reparación, tasa de aprobación; (6) *Sucursales* (SA).
- **Técnico:** mis órdenes por estado y antigüedad, piezas que me faltan, mi tiempo promedio, mis entregas del mes (+ comisión si se define).
- **Vendedor/recepción (mostrador):** caja abierta, ventas del turno, equipos listos para entregar hoy, mensajes por enviar.
- **Cobrador:** ocultar mientras no haya créditos (FEATURE).
- **KPIs estándar de taller de reparación a incluir (práctica de la industria):** tiempo de ciclo (recepción→entrega), antigüedad del WIP, % de reparaciones resueltas a la primera / retornos por garantía, ticket y margen promedio, % costo de piezas sobre ingreso, tasa de aprobación de presupuestos, utilización/productividad por técnico, equipos abandonados.

## 7. Plan por fases (cada una necesita tu OK; todo aditivo)
- **K0 — Exactitud (urgente, sin cambiar diseño):** zona horaria America/Mexico_City en todos los "hoy"/cortes; "Cobrado hoy" = caja real (anticipos+cobros−devoluciones); stock crítico con filtro correcto (o RPC) y definir mínimos; ventas solo `completada`; una sola definición de "activa" (en `estados.ts`); ingresos de reparación con `precio_total || costo_total` en todo; P&L: costo de piezas desde pedidos/orden; garantías `activa` → fecha de vencimiento; retirar la doble carga.
- **K1 — Limpieza:** eliminar las ~1,100 líneas muertas de `dashboard/page.tsx` (previa copia en el documento de cambios); `/api/stats` con conteos en SQL; un solo `formatMXN` y una sola `StatCard`.
- **K2 — Funciones SQL/vistas** (aditivas): `rpc_kpis_taller`, `rpc_dinero_dia`, `v_ordenes_antiguedad`, vistas por sucursal; cron de cierre diario/semanal que guarda un snapshot de KPIs (`kpi_snapshots`) para tendencias sin recalcular.
- **K3 — Dashboard admin nuevo** (secciones de §6) + técnico + mostrador, con realtime/refresh.
- **K4 — Centro de Reportes** (U-A) y **Centro de mensajes** (U-I).
- **K5 — Navegación:** Inventario/Abastecimiento (U-B), Reparaciones (U-D), Clientes (U-F), Personal (U-G), catálogo único (U-C); menú de ~12 entradas. Rutas antiguas redirigen (nada se rompe).
- **K6 — Visual:** pasar las páginas con colores directos a tokens, dividir páginas gigantes.
- **K7 — Ocultar con FEATURES** módulos sin uso (crédito, kits, lotes, órdenes de compra) hasta que se usen; no se borra código.

## 8. Preguntas para Trini (necesarias para K0–K5)
1. **"Ingreso del día/mes":** ¿lo medimos por **dinero que entra a caja** (anticipos + cobro final) o por **servicios entregados** (precio total al entregar)? Recomiendo mostrar ambos, con "caja" como principal.
2. ¿**Crédito** (créditos, cartera, cobrador, scoring) se usa o se usará? Si no, lo oculto del menú y dashboards (queda guardado).
3. ¿**Kits, lotes de piezas, lotes de series, órdenes de compra** se usan? (hoy 0 registros). ¿Ocultar por ahora?
4. **Umbrales de alerta:** ¿cuántos días es "listo para entrega sin recoger" (hoy 54 equipos), "sin movimiento" y "presupuesto sin respuesta" (propongo 7/5/3)?
5. ¿Los **técnicos** deben ver su comisión/productividad? ¿Se les paga comisión por reparación (% o monto fijo)?
6. ¿Qué mínimo de stock por defecto para los 55 productos sin mínimo (propongo 1 para accesorios, 0 para piezas por encargo)?
7. ¿Apruebas el **menú unificado** (~12 entradas con pestañas) o prefieres mantener algunos accesos separados (cuáles)?
8. ¿El **Panel KPIs de reparaciones** se integra en Reportes y se quita del menú, o lo quieres como pestaña del dashboard principal?
9. Para tendencias: ¿activo el **snapshot diario** de KPIs (cron en Supabase)?

## 9. Evidencia (consultas ejecutadas)
`pg_stat_user_tables` (conteos), `ordenes_reparacion` por estado, ingresos por mes con `costo_total` vs `precio_total`, `caja_movimientos` por tipo (90 d), productos críticos (`stock=0 or stock<=stock_minimo` = 5; sin mínimo = 55), columnas reales de `reparacion_piezas`/`ventas`/`servicios`, `cron.job` (1 job), vistas (5), matviews (0).
