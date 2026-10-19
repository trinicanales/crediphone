# Auditoría de INTEGRACIÓN — ¿el sistema está unificado o parchado?
> Fecha: 2026-10-19 · Pedido de Trini: revisar inventario, órdenes de servicio, POS, bolsa virtual, ubicaciones, verificación de inventario, productos/servicios, y qué pasa al cancelar / eliminar / cambiar.
> Método: cruce código ↔ esquema REAL de Supabase (columnas, CHECK, FK, triggers) + lectura de cada flujo. Archivo pensado para **continuar en otra sesión** (ver "Pendiente de investigar").

---

## VEREDICTO CORTO
**No está unificado: está parchado.** La base de datos solo tiene **2 automatismos de inventario** (descontar stock al insertar `ventas_items` y restaurarlo al marcar una venta `cancelada`). Todo lo demás —reparaciones, órdenes de compra, ubicaciones, verificaciones, bolsa virtual, devoluciones— depende de que **cada pantalla/ruta "se acuerde"** de actualizar stock, caja, bolsa, puntos, historial y notificaciones. Resultado:
- **13 lugares distintos** escriben `productos.stock` a mano (leer → calcular → escribir, sin atomicidad); solo 1 usa la función atómica `incrementar_stock`.
- Cancelar una orden tiene **2 caminos con efectos distintos**; eliminar una orden **no libera reservas ni revierte dinero**.
- Cambiar la ubicación de un producto tiene **2 caminos** (uno deja historial, otro no) y **2 campos** (`ubicacion_id` y `ubicacion_fisica`) que pueden contradecirse.
- Hay **tablas y columnas que el código usa y no existen** → los errores se ignoran en silencio y la función "parece" funcionar.
- Importante: casi **nada de esto se ha usado en producción** (solo 6 ventas, 0 órdenes de compra, 0 piezas apartadas, 0 movimientos de ubicación, 0 devoluciones, 0 lotes). Los fallos están **latentes**: aparecerán cuando se empiece a usar cada módulo.

---

## A. Ya corregido en esta pasada (2026-10-19)
| # | Hallazgo | Acción |
|---|---|---|
| A1 | `pedidos_pieza_reparacion.estado` solo permitía `pendiente/recibida/cancelada`, pero el código usa 7 estados (`en_camino`, `verificada_ok`, `defectuosa`, `instalada`). **"Marcar en camino", "verificar/instalada" y el consumo de stock de piezas instaladas al entregar nunca funcionaron**, y el botón nuevo "Ya la pedí" fallaba | Migración `fase90` (CHECK ampliado a 7 estados). Aplicada en producción |

## B. Columnas / tablas que el código usa y NO existen en la BD (errores silenciosos)
Detectadas con script que compara cada `.from().select/insert/update/eq` contra el esquema real. Cada una devuelve error de PostgREST que el código ignora o trata como "no encontrado".

| ID | Archivo:línea | Qué intenta | Consecuencia real |
|---|---|---|---|
| B1 | `lib/db/reparaciones.ts:1205` | `ordenes_reparacion.motivo_garantia` | **Reclamar una garantía falla**: crea la orden nueva y revienta al marcarla como garantía; la garantía queda "activa" y queda una orden huérfana |
| B2 | `api/reparaciones/[id]/route.ts:644` | `ordenes_reparacion.checklist_apertura` | El checklist de apertura/QA **nunca se guarda** |
| B3 | `api/reparaciones/[id]/renotificar-presupuesto/route.ts:27` | `ordenes_reparacion.tracking_token` | "Re-notificar presupuesto modificado" siempre falla (el token está en `tracking_tokens`) |
| B4 | `api/reparaciones/almacenaje/route.ts:38` y `api/cron/recordatorios-reparaciones/route.ts:77` | `cliente_nombre, cliente_apellido, cliente_telefono, tecnico_nombre` en `ordenes_reparacion` | **Pantalla de Almacenaje y el cron de recordatorios no devuelven datos** (justo donde están las 50 órdenes >90 días) |
| B5 | `lib/db/devoluciones.ts:218` | `ventas_items.nombre_producto` (real: `producto_nombre`) | **Procesar una devolución es imposible** (por eso hay 0 devoluciones) |
| B6 | `api/creditos/aging/route.ts:82` | `pagos.estado` | Reporte de antigüedad de cartera ignora los pagos → saldos incorrectos |
| B7 | `lib/db/reparaciones-dashboard.ts:~461` | `garantias_reparacion.activa` (real: `estado`) | KPI de garantías por vencer falla |
| B8 | `api/cliente/perfil/route.ts:61` | `garantias_reparacion.distribuidor_id` (no existe) | Portal del cliente: garantías siempre vacías |
| B9 | `api/cliente/perfil/route.ts:124`, `api/clientes/[id]/perfil/route.ts:72` | `pagos.estado` | Perfil de cliente: lista de pagos falla |
| B10 | `api/reportes/pnl/route.ts:113` | `reparacion_piezas.costo_total` (real: `costo_unitario × cantidad`) | P&L no suma el costo de piezas de reparación |
| B11 | `api/clientes/[id]/resumen-pos/route.ts:43,74` | `creditos.monto_credito`, `creditos.saldo_pendiente`, `scoring_clientes.categoria`, `scoring_clientes.score` | Resumen del cliente en POS (crédito/score) sin datos |
| B12 | `api/clientes/[id]/resumen/route.ts:36` | `ordenes_reparacion.total_anticipos` | Resumen de cliente sin anticipos |
| B13 | `api/reparaciones/[id]/anticipos/route.ts:132,198,234` | `users.nombre`, `users.apellido` (real: `name`) | Nombres de vendedor/técnico en notificaciones de anticipos |
| B14 | `api/reparaciones/[id]/anticipos/route.ts:206,242`, `lib/db/caja.ts:326`, `api/notificaciones/historial/route.ts:35` | `notificaciones.titulo, severidad, leida, metadata, distribuidor_id` | Esas notificaciones internas **nunca se crean** (tabla real: `tipo, canal, estado, mensaje, datos_adicionales`) |
| B15 | `lib/db/pagos.ts:92` | `pagos.detalle_pago` | Detalle de pago mixto no se guarda |
| B16 | `lib/db/lotes-piezas.ts:415` | `reparacion_piezas.reparacion_id` (real: `orden_id`/`lote_id`) | Lotes de piezas (0 usados) |
| B17 | `lib/db/devoluciones.ts:148` | `payjoy_webhooks.tipo/venta_id` | PayJoy (apagado) |
- Mismo patrón ya corregido hoy: `movimientos_caja`, `reparaciones`, `ubicaciones` (tablas fantasma) y `caja_movimientos.tipo='entrada_efectivo'` (viola CHECK — sigue pendiente en `cancelar/route.ts`).

## C. Cancelar / eliminar / cambiar — ¿cambia en todos lados?
| Evento | Qué se actualiza hoy | Qué NO se actualiza |
|---|---|---|
| **Cancelar orden con `/cancelar`** (ModalCancelacion, POS) | Anticipos devueltos, piezas pendientes, `devolverTodasLasPiezas()` libera `stock_apartado`, historial | Cargo de cancelación **no llega a caja** (CHECK de `entrada_efectivo`) |
| **Cancelar orden con cambio de estado genérico** (`PUT estado=cancelado`, ModalCambiarEstado) | Devuelve stock de piezas instaladas | **No devuelve anticipos, no libera `stock_apartado`, no revierte bolsa virtual** → mismo evento, efectos distintos |
| **Eliminar orden** (`DELETE /api/reparaciones/[id]`, super_admin) | Borra anticipos, piezas, bolsa virtual, historial, tracking | **No revierte caja** (quedan `entrada_anticipo` huérfanos), **no libera `stock_apartado`** (reserva fantasma permanente), borra el rastro financiero/auditoría; `garantias_reparacion` no tiene FK a la orden → quedan garantías huérfanas |
| **Eliminar cliente** (FK) | `creditos`, `pagos`, puntos, scoring, notificaciones se borran en **CASCADE** | Una baja de cliente con créditos borra su historial de pagos sin reversa (revisar guardas de la ruta DELETE) |
| **Eliminar producto** | Protegido por FK RESTRICT en ventas/kits; CASCADE en `lotes_series` y `movimientos_ubicacion`; `movimientos_stock` queda con `producto_id` NULL | `piezas_cotizacion` (JSONB) y `partes_reemplazadas` guardan `productoId` sin FK → referencias colgantes |
| **Cambiar precio de producto** | Aplica a ventas nuevas | Cotizaciones ya hechas conservan precio viejo (por diseño); sin aviso |
| **Cambiar ubicación** | `moverProducto()` (con historial) vs. formulario de producto (sin historial) | `moverProducto` no actualiza `ubicacion_fisica`; el formulario no escribe `movimientos_ubicacion`; `productos.ubicacion_id` **no tiene FK** (borrar una ubicación deja productos colgando) |
| **Verificación de inventario → ajustar stock** | `productos.stock = cantidadContada` | No escribe `movimientos_stock`, no respeta `stock_apartado`, pisa ventas hechas después del conteo, no marca la verificación como aplicada (reaplicable); hay 2 verificaciones "en_proceso" atoradas |
| **Servicios** | `servicios` (POS) y `catalogo_servicios_reparacion` (reparaciones) son **dos catálogos independientes** sin relación | Cambiar un precio/servicio en uno no afecta al otro |
| **Bolsa virtual** | `gasto_pieza` se registra al pedir pieza, se revierte al cancelar un pedido individual | El tipo `anticipo` del CHECK nunca se escribe; 0 filas `gasto_pieza` (todos los pedidos tienen costo 0); borrar orden borra el libro |

## D. Estructura: duplicidades que explican la falta de "espejo"
- Triggers en BD: solo `ventas_items` (stock), `ventas` (restaurar stock), `ordenes_reparacion` (historial de estado sin usuario) y folios/`updated_at`. **Ningún trigger** mantiene `movimientos_stock`, `stock_apartado`, bolsa virtual, caja ni puntos.
- Tablas duplicadas: `users` / `usuarios`; `servicios` / `catalogo_servicios_reparacion`; `verificaciones` (sin uso) / `verificaciones_inventario`; `solicitudes_piezas` / `pedidos_pieza_reparacion`; `garantias_piezas` / `garantias_reparacion`. Varias consultas con `usuario:usuarios(...)` apuntan a la tabla equivocada.
- Dos representaciones de ubicación (`ubicacion_id` y `ubicacion_fisica` texto); `verificaciones.ts` mezcla ambas con `ilike`.
- Stock: 13 escritores manuales. `movimientos_stock` tiene solo **10 filas** en la historia del sistema (8 `ajuste`, 2 `venta_pos`) → la trazabilidad casi no existe aunque el código intenta registrarla.

---

## E. Ventas, devoluciones y bajas (investigado después del primer registro)
- **Cancelar venta** (`cancelarVenta`, `PATCH /api/pos/ventas/[id]`): solo cambia `estado='cancelada'`. El trigger `restaurar_stock_cancelacion` devuelve el stock, pero **no se escribe `movimientos_stock`**, **no se revierte caja**, **no se revierten puntos de lealtad** y no se ajusta comisión. El cierre de caja solo cuenta ventas `completada` (si se cancela *después* del corte, el corte ya guardado queda desfasado).
- **Devolución** (`procesarDevolucion`): reintegra stock a mano **y** escribe `movimientos_stock` (bien), pero si es devolución total marca la venta `reembolsada` → el trigger vuelve a sumar el stock de TODOS los items → **doble reintegro de stock**. Hoy no se nota porque procesar devoluciones es imposible (B5). **Al arreglar B5 hay que arreglar esto en el mismo cambio** (quitar el reintegro manual en devolución total, o que el trigger solo actúe en `cancelada`). Además no registra la salida de dinero del reembolso en caja ni revierte puntos.
- **Dar de baja un cliente** (`DELETE /api/clientes/[id]`): **cualquier usuario con sesión (incluso cobrador o técnico)** puede hacerlo; `creditos` y sus `pagos` se borran en CASCADE. Solo lo frenan las órdenes y garantías (RESTRICT, con error 500).
- **Dar de baja un producto** (`DELETE /api/productos/[id]`): solo admin, pero la ruta llama `deleteProducto(id)` **sin filtro de distribuidor** → un admin de una franquicia puede borrar productos de otra; sin guardas de stock/reservas; `piezas_cotizacion` y `partes_reemplazadas` (JSON) quedan con ids colgantes.
- **Trigger de descuento de stock**: correcto y con candado (`Stock insuficiente` bloquea la venta). El hueco es que no escribe `movimientos_stock`; lo escribe el código aparte (best-effort).
- **Tablas gemelas**: `users`/`usuarios`, `servicios`/`catalogo_servicios_reparacion`, `solicitudes_piezas`/`pedidos_pieza_reparacion`, `garantias_piezas`/`garantias_reparacion`.

---

## PENDIENTE DE INVESTIGAR (continuar en la siguiente sesión)
- [x] POS: cancelar venta → ver sección E.
- [x] `devoluciones.ts` → ver sección E (falta re-revisar PayJoy cuando se reactive).
- [x] `DELETE` de clientes y productos → ver sección E.
- [ ] Ventas a crédito / apartados (`creditos.tipo`, `stock_apartado` en creditos.ts:520): ¿se libera al cancelar/vencer el apartado?
- [ ] Caja: cierre de sesión — ¿incluye cobros de reparación, anticipos devueltos, retiros? (`caja.ts`).
- [ ] Cálculo de saldo de la bolsa virtual (pedidos-pieza POST) y su relación con anticipos eliminados/devueltos.
- [ ] Puntos de lealtad: ¿se revierten al cancelar venta o entrega? (`movimientos_puntos` solo admite `reparacion` y `venta_pos`).
- [ ] Lotes de piezas / lotes de series / kits: cómo tocan stock.
- [ ] Notificaciones al cambiar precio/pieza/ubicación (¿alguien se entera?).
- [ ] Tablas duplicadas `users`/`usuarios`: ¿cuál usan las FK de `usuario_id`?
- [ ] Revisar las ~60 coincidencias "relaciones embebidas" del script por si alguna relación PostgREST es ambigua (varias FK al mismo destino).

## Herramientas creadas para repetir esta auditoría
- `scratchpad/cols.js` (+ `schema.json`): compara columnas usadas en el código vs. BD. Conviene **guardarlo en el repo** (`scripts/audit-columnas.js`) y regenerar `schema.json` desde Supabase.
- Consultas SQL útiles (en esta sesión): triggers por tabla, reglas ON DELETE de las FK, CHECK por tabla.

---

## Habilidades (skills) y forma de trabajar — qué se encontró y qué se propone
- **Skills de claude.ai disponibles** (revisado con `ListSkills`/`SearchSkills`): solo documentos (docs, docx, pdf, xlsx, pptx, google-workspace), navegadores (built-in-browser, chrome-browser), computer-use, deep-research, skill-creator, import-memory y morning. **No existe ninguna skill de auditoría de código/BD ni de Supabase** (búsqueda por "audit, database, supabase, code review, security, testing" sin resultados).
- **Herramientas integradas útiles** (ya disponibles en Claude Code): `/code-review` (revisa el diff), `/security-review` (revisión de seguridad de la rama), `/simplify` (limpieza), y el MCP de Supabase (`get_advisors`, `execute_sql`, `list_tables`, `generate_typescript_types`).
- **Propuesta:** (1) guardar el script `cols.js` como `scripts/audit-columnas.js` + generar `schema.json` desde Supabase (o mejor, usar `generate_typescript_types` y tipar las consultas para que TypeScript detecte columnas inexistentes en compilación); (2) crear con `skill-creator` una skill de proyecto **`crediphone-auditoria`** con el procedimiento (consultas SQL de triggers / FK / CHECK + script de columnas + checklist por evento "cancelar/eliminar/cambiar") para que cualquier sesión futura la use sin repetir el trabajo; (3) para temas que cambian (Supabase/PostgREST, Cloudflare/OpenNext, Next.js) buscar documentación actualizada en el momento en lugar de depender de una skill genérica.
