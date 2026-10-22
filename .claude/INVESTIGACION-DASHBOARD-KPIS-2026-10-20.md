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

---
# ANEXO A — Comparativa con el mercado (investigación en línea, 2026-10-20)
Fuentes consultadas: comparativas 2026 de software para talleres (GitNux, WifiTalents), sitios de RepairDesk, RepairShopr, CellSmart POS, CellStore, MiTallerControl y FixFlow (LatAm), blog de RepairDesk "vs RepairShopr 2026", artículos de KPIs de órdenes de trabajo (ServicePower, FieldServiceSoftware). Nota: son páginas de los propios fabricantes y rankings de terceros; sirven para ver **cómo organizan el menú**, no como verdad absoluta.

## A.1 Cómo organizan el menú los líderes (estructura de "organigrama")
| Producto | Módulos del menú principal | Qué UNEN | Qué SEPARAN |
|---|---|---|---|
| **RepairDesk** (el que más evoluciona: 170+ actualizaciones/año) | Tickets · POS · Inventario · Clientes (CRM) · Empleados · Reportes · Marketing · Comunicaciones | Orden + piezas + pago + cliente en un mismo ticket; cotización, depósito/anticipo, reembolso y pagos divididos dentro del POS; empleados con asistencia + comisión + productividad en un solo lugar | Marketing y Comunicaciones aparte (campañas, reseñas, SMS 2 vías, bandeja unificada "Connect") |
| **RepairShopr** | Clientes/Organizaciones · Tickets · Facturas y Estimaciones · Inventario · POS · Leads · Marketing · Reportes · Centro de apps | Ticket → factura con un clic; pedidos de piezas ligados al ticket; garantía/RMA ligados al inventario por serie | Leads y Marketing separados; "pantalla de taller" (monitor grande con tickets por estado) |
| **CellSmart / CellStore / RepairQ** | Reparaciones · POS · Inventario (nuevo, usado, piezas, **IMEI**) · CRM · Reportes | Venta + reparación + inventario de equipos con IMEI en una sola consola; firma electrónica y checklist de equipo en la recepción | Marketing/pagos integrados como módulos opcionales |
| **SpudgerHQ** (nuevo) | Recepción (croquis de daños, acuerdo y firma digital) · Piezas y servicios · Flujo del técnico · **QA** · Pagos · Historial de reparación | Todo el día a día en un solo espacio de trabajo | Control de calidad (QA) como etapa propia antes de entregar |
| **MiTallerControl / FixFlow** (LatAm) | Órdenes · Clientes y equipos · Caja/ingresos/gastos · Inventario de repuestos y accesorios · POS · WhatsApp con plantillas automáticas | Caja, POS e inventario juntos; WhatsApp ligado a cada cambio de estado | — |

**Patrón común:** el menú tiene **6–9 secciones**, nunca 30+. La unidad central es el **ticket/orden**; POS, inventario, clientes y pagos cuelgan de él. Los reportes son **un solo módulo** con subsecciones (ventas, inventario, clientes, tickets, empleados) y, en RepairDesk, **un constructor de reportes** personalizable. La comunicación (SMS/WhatsApp/correo) vive en **una bandeja unificada**.

## A.2 Funciones "nuevas" que ya son estándar en 2026 (y qué tienes tú)
| Función de mercado | Mercado | CREDIPHONE hoy | Brecha |
|---|---|---|---|
| Portal de seguimiento para el cliente (estado 24/7, aprobar presupuesto) | Estándar | ✅ `/tracking`, `/reparacion/[folio]` (recién protegido) | Unificar el progreso (hecho 2026-10-19) |
| Recepción con **firma digital** + checklist + croquis/fotos | Estándar (CellStore, SpudgerHQ, RepairQ) | ◐ checklist y fotos sí; firma solo en papel | Firma en entrega (aprobada por Trini, fase E) |
| **IMEI/serie** como identificador y lista negra | Estándar | ◐ IMEI opcional, sin validación; IFT manual | Validación (Fase E) |
| Pedido de piezas ligado a la orden + proveedores integrados | RepairDesk (MobileSentrix…) | ✅ pedidos de pieza por orden (38 registros) | Proveedores no integrados (normal en MX) |
| **WhatsApp automático** por cambio de estado | MiTallerControl, FixFlow, PhoneMistri | ◐ modo enlace manual (425 mensajes pendientes) | Trini decidió seguir en modo enlace → una **bandeja "por enviar"** reduce el trabajo |
| Comisión/productividad por empleado en el mismo módulo | RepairDesk | ◐ comisiones solo vendedor/admin | Técnicos sin comisión ni productividad |
| **Pantalla de taller** (monitor con órdenes por estado/antigüedad) | RepairShopr | ✗ | Propuesta K3 (tablero del taller) |
| **QA / control de calidad** antes de entregar | SpudgerHQ | ✗ (hay "completado" → "listo") | Opcional: paso de verificación (ligado a "No verificable") |
| Seguimiento posterior (14/90 días), reseñas, recompra | RepairShopr / RepairDesk | ✗ | Fácil con cron + plantilla (Fase 4 del plan de automatizaciones) |
| Constructor de reportes / reportes por sucursal | RepairDesk | ✗ (reportes fijos) | Centro de Reportes con filtros guardados (K4) |
| Reservas/citas, auto check-in (kiosko), trade-in, suscripciones | RepairDesk | ✗ | No prioritario para tu operación hoy |
| IA para limpiar notas técnicas / recepcionista IA | RepairDesk (ARIA, "Polish with AI") | ✗ | Opcional, costo recurrente; evaluar después |
| Contabilidad (QuickBooks/Xero) | Estándar | ✗ (facturación apagada por decisión) | Fuera de alcance por ahora |

## A.3 Comparación de estructura: lo tuyo vs. el estándar
| Aspecto | Estándar del mercado | CREDIPHONE hoy | Diagnóstico |
|---|---|---|---|
| Entradas de menú | 6–9 | **~37** | Demasiado fragmentado → propuesta ~12 (U-A…U-I) |
| Reportes | 1 módulo con subsecciones | **5 páginas** separadas (+ dashboard de reparaciones) | Unificar |
| Inventario | 1 módulo (productos, stock, series/IMEI, transferencias, conteos) | **14 entradas** | Unificar en Inventario + Abastecimiento |
| Catálogo de servicios | 1 | **2** (`servicios` y `catalogo_servicios_reparacion`) | Unificar |
| Comunicación | 1 bandeja unificada | mensajes sueltos en tarjeta/drawer/recordatorios/fallidas | Centro de mensajes |
| Empleados | asistencia + comisión + productividad juntos | Empleados, Asistencia y Comisiones separados | Unificar en Personal |
| Ticket como centro | Todo cuelga de la orden | ✅ ya es así (anticipos, piezas, garantía, entrega) | **Fortaleza**: conservar |
| Dashboard | KPIs de ticket/ingreso/empleado/inventario; pantalla de taller | KPIs de crédito/POS; sin antigüedad de órdenes | Reorientar al taller |
| Crédito/cartera | No es parte del estándar de talleres (es de tiendas de equipos a crédito) | Módulo completo, **0 datos** | Mantener, pero ocultable |

## A.4 Qué TIENES que el mercado no suele traer (ventajas a proteger)
- **Bolsa virtual / anticipos con trazabilidad** y confirmación de depósitos entre sucursales.
- **Multi-sucursal con franquicias** (4 distribuidores) y vista comparativa para super admin.
- **Cotización con piezas desde inventario y "agregar libre"**, política de garantías publicada con QR, tracking con aprobación presencial/parcial.
- **Crédito + scoring + cobranza** integrados con el taller (poco común) — vale la pena conservar aunque hoy no se use.

## A.5 Conclusión de la comparación
Tu **modelo de datos y flujo (orden como centro)** ya está al nivel del mercado y en varios puntos por encima. Lo que te separa de los líderes es la **navegación** (37 entradas contra 6–9), la **falta de reporte único/constructor**, la **ausencia de tablero de taller por antigüedad** y la **comunicación dispersa**. Todo se resuelve reorganizando y agregando vistas (K2–K5), sin tocar el flujo que ya funciona.

---
# ANEXO B — Decisiones de Trini (2026-10-20) sobre §8
1. Ingreso del día: **mostrar ambos** (dinero en caja y servicios entregados).
2. Crédito: se usará a futuro; por ahora solo para **apartados / pagos de algún producto** (poco uso). Se oculta lo demás de crédito (cartera, cobrador, scoring) sin borrar; se conserva lo necesario para apartados/abonos.
3. Kits, lotes de piezas, lotes de series, órdenes de compra: **ocultar por ahora**.
4. Umbrales propuestos (7/5/3 días) aprobados. Agregar **botón de envío al cliente en el stepper de estado y en la OrdenCard** (mensaje según el paso) y **colores en las tarjetas** para diferenciarlas (por situación/antigüedad).
5. Comisión de técnicos: **no por ahora** (la dueña hace las reparaciones hasta contratar técnico). Dejar listo el módulo para activarlo después.
6. Stock mínimo por defecto: **1**. Mostrar **inventario en negativo** (no bloquear ni ocultar) cuando se vende producto/servicio sin existencia, y alertarlo.
7. **Antes de aprobar el menú/dashboard quiere ver cómo quedaría** → maqueta visual enviada 2026-10-20 (pendiente de su aprobación/ajustes).
8. Panel KPIs de reparaciones: **integrarlo** (en Reportes / dashboard). Historial: la página existe desde el primer commit (2026-02-27); el dashboard principal se rehízo en FASE 53 (2026-03-19, "Command Center") sin incluir sus gráficas; no hay registro de una decisión de separarlos.
9. Registro diario de KPIs: **sí**, y **resumen semanal** al terminar la semana con el seguimiento.
**Regla de trabajo:** no hay permiso general. En cada fase Claude lista los cambios, Trini aprueba o ajusta, y recién entonces se ejecuta.

---
# ANEXO C — K0 ejecutado (2026-10-20, aprobado por Trini)
Archivos nuevos: `src/lib/fechas.ts` (hora de México), `src/lib/inventario/stock.ts` (mínimo por defecto 1, negativos), `estados.ts` (+`ESTADOS_ACTIVOS`, `ingresoOrden`).
1. Hora de México en: `api/dashboard/resumen`, `reportes/pnl` (rango del mes), `reportes/comisiones`, `lib/db/pagos` (getPagosDelDia), `lib/db/ventas` (ventas del día y estadísticas POS), `admin/distribuidores/[id]/stats`. **Pendiente** (no es de dashboard): `lib/db/creditos`, `notificaciones`, `verificaciones`, `caja.ts` (PayJoy), `empleados` (fechas tipo date).
2. Dashboard: tarjeta "Dinero en caja hoy" = anticipos + cobros de reparación + ventas POS completadas + pagos − devoluciones, con "Entregado hoy" (precio total) en el subtítulo. Nota: `caja_movimientos` trae `distribuidor_id` en solo 31 de 177 filas y no tiene FK a la sesión → se filtra por las sesiones de caja de la sucursal (últimos 3 días) o por su propio distribuidor_id.
3. Stock: mínimo efectivo = `stock_minimo` o 1; crítico = `stock <= mínimo`; negativos se cuentan aparte. Efecto real hoy: **5 → 26** productos en alerta (porque ahora el mínimo 1 aplica a los 55 sin mínimo). Hoy no hay stock negativo: el trigger `decrementar_stock_venta` impide vender sin existencia (no hay CHECK de stock ≥ 0, los negativos solo entrarían por ajustes manuales). Si Trini quiere poder vender en negativo, es un cambio de trigger → fase K2.
4. "Activas" = `ESTADOS_ACTIVOS` (8 estados) en resumen y Panel KPIs (hoy 130).
5. Ingresos de reparación con `precio_total || costo_total` en Panel KPIs (periodo, top dispositivos, por mes, ingresos del mes).
6. P&L: costo de piezas desde `pedidos_pieza_reparacion` (recibida/verificada_ok/instalada) de las órdenes entregadas en el mes; ventas solo `completada`; CMV ahora filtra por sucursal y por ventas completadas (antes tomaba items de todas las sucursales).
7. Panel KPIs: garantías por vencer con `estado='activa'` (la columna `activa` no existe).
8. `dashboard/page.tsx`: ya no ejecuta las 4–5 llamadas descartadas (el código muerto se retira en K1).

---
# ANEXO D — K1 ejecutado (2026-10-20, aprobado por Trini)
1. `src/app/dashboard/page.tsx`: de 1,426 a ~50 líneas (solo enruta por rol). Copia del cuerpo antiguo en `.claude/ARCHIVO/dashboard-page-legacy-2026-10-20.tsx.txt`. Rol sin panel → mensaje (antes caía en el cuerpo antiguo).
2. `/api/stats`: conteos y sumas en la base con columnas mínimas (antes `select *` de 4 tablas completas). `totalPagos` ahora = pagos de HOY (antes histórico; Cobrador mostraba "N pagos registrados" en la tarjeta "Cobrado hoy"). La fórmula de "tasa de recuperación" se mantiene (mide % de créditos ya no activos; se revisará si el crédito se activa).
3. Formato de dinero: `src/lib/format.ts` (`formatMXN` sin centavos, `formatMXNDec` con centavos) reemplaza 9 copias locales (dashboards, Panel KPIs, 4 reportes). Quedan ~25 copias en otras pantallas (POS, inventario…): se migran al tocar cada área.
4. Tarjeta de KPI: `components/dashboard/KpiCard.tsx` única para Ejecutivo y Cobrador (Vendedor no usa tarjetas propias). `StatCard` (Productos y Panel KPIs de reparaciones) sigue aparte: su fusión cambia el aspecto de esas pantallas → fase visual K6.
**Hallazgo al retirar el código muerto — funciones que se perdieron del dashboard (FASE 53, 2026-03-19):** `PanelConfirmacionesDeposito` y `PanelAutorizacionesPendientes` ya no se muestran en NINGUNA pantalla (solo vivían en el dashboard antiguo); `PanelTraspasosPendientes` solo sigue en `AnticipoCajaPanel`. Es decir, el admin no ve en su inicio las confirmaciones de depósito ni las autorizaciones de descuento pendientes. Los componentes siguen en el código; falta volver a mostrarlos (propuesto en K3).

---
# ANEXO E — K2 ejecutado (2026-10-21, aprobado por Trini)
Migración `supabase/migrations/fase92-kpis-sql.sql` (+ `-ROLLBACK.sql`), probada en seco antes de aplicar. Solo `service_role` puede ejecutar; RLS activo en `kpi_snapshots` sin políticas.
- Vista `v_ordenes_antiguedad`, función `semaforo_orden` (umbrales 7/5/3 días), `kpi_taller`, `kpi_dinero`, `kpi_stock_bajo`, `kpi_resumen_semana`, tabla `kpi_snapshots`, `kpi_snapshot_dia()`.
- Cron `kpi-snapshot-diario` 23:55 hora de México. Retirado `notificaciones-hora` (llamaba a una función inexistente: 6,641 fallos, 1 por hora).
- Primer snapshot generado a mano (4 sucursales).
## Números reales al momento de aplicar (21-oct-2026)
- Taller: 130 activas. Recibido 71 (68 en rojo, la más vieja 166 días); listo_entrega 54 (50 en rojo, hasta 162 días); aprobado 1 (96 días); presupuesto 1 (37 días); completado 3.
- **Anticipos sin aplicar en órdenes ya cerradas (entregadas/canceladas/no reparables): 65 por $30,840.**
- Semana 15–21 oct: 10 recibidas, 0 entregadas, 1 cancelada, anticipos $13,915.
- Stock: 26 productos en o bajo el mínimo (2 agotados), 0 negativos.
- Piezas: 30 pedidos cancelados (ya limpiados), 4 pendientes (en órdenes ya entregadas), 4 recibidas.
- Paneles perdidos: 6 solicitudes de cambio de precio pendientes (3 con la orden aún en $0: ORD-20260522-0001 → $300, ORD-20260706-0001 → $750, ORD-20260907-0004 → $850; 3 ya aplicadas pero sin cerrar la solicitud) y 1 confirmación de depósito pendiente ($150, orden cancelada ORD-20260522-0003).
