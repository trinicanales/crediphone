# Plan de automatizaciones — CREDIPHONE
> Fecha: 2026-10-19 · Investigación + propuesta (NADA de esto está implementado todavía; requiere OK de Trini por fases).
> Objetivo: que el sistema sea **uno solo** (un cambio en un punto se refleja en todos) usando automatizaciones en la base de datos, y alinear el flujo con lo que hacen hoy los negocios de reparación y venta de celulares.

---

## 1. Qué hace hoy la industria (investigación en internet)
**Software de talleres de reparación (RepairDesk, RepairShopr, CellSmart, RO App, etc.)** coincide en estas automatizaciones:
1. **Avisos automáticos al cliente por cada cambio de estado** (listo, esperando pieza, seguimiento) por SMS / correo / **WhatsApp**; no los dispara una persona, los dispara el cambio de estado. RepairShopr incluso expone *webhooks* de cada cambio.
2. **Inventario ligado a la orden:** al marcar la reparación como completada, **se descuenta la pieza solo**, y queda registrado SKU, cantidad usada y stock resultante. Alertas de **stock bajo** y **punto de reorden por SKU** calculado con el consumo promedio.
3. **Garantía por IMEI/serie:** al volver el cliente se escribe el IMEI y el sistema muestra el historial y crea la orden de garantía con un clic.
4. **Seguimiento de pedidos de pieza** desde que se piden hasta que se facturan, con orden especial de pieza cuando falta.
5. **POS enlazado a inventario** (la venta descuenta y registra sin que nadie lo capture dos veces).

**Inventario / retail:** punto de reorden = (consumo promedio × tiempo de entrega) + stock de seguridad → genera **borrador de orden de compra** automático; **conteo cíclico** por clase ABC (lo caro/rápido más seguido); **artículos con IMEI exigen 100 % de exactitud** y cualquier diferencia se investiga con un segundo conteo **antes** de ajustar, con motivo y rastro de auditoría.

**Patrón de base de datos recomendado (Postgres):** el inventario se maneja como un **libro de movimientos que solo se agrega** (cada entrada, salida, ajuste, traspaso es una fila con cantidad con signo, usuario, fecha y documento que lo causó); el stock actual es el resultado de esos movimientos, actualizado por un **trigger**, con `CHECK (stock >= 0)` para que una venta imposible haga rollback. Se separa **existencia física**, **apartado** (reservado) y **disponible** (= físico − apartado).

**Negocios que financian celulares (crédito/enganche):** automatizan **recordatorios de pago escalonados** (antes del vencimiento, el día, después), cálculo de mora y, en plataformas especializadas, **bloqueo remoto del equipo** al incumplir y desbloqueo al pagar (tipo PayJoy/NuovoPay/Trustonic) — esto último queda fuera por ahora (PayJoy apagado).

**WhatsApp:** para avisos automáticos se usa la **API oficial de WhatsApp Business** con **plantillas "utility"** (estado de pedido, recordatorio de pago, recibo) **pre-aprobadas por Meta**; tienen costo por conversación (Meta bajó tarifas de utilidad en LATAM desde agosto 2024). Tu sistema ya tiene la configuración `wa_*` y un modo "link" de respaldo.

**Supabase (tu base):** `pg_cron` programa tareas dentro de la base (SQL, funciones, Edge Functions o webhooks); `pg_net` hace llamadas HTTP desde SQL pero **es "dispara y olvida": si falla no reintenta ni avisa** → por eso se usa una **tabla de eventos pendientes (outbox)** con intentos y estado; `pgmq` (Supabase Queues) ofrece colas durables pero **no trae reintentos máximos ni cola de errores incluidos** (se arman a mano).

### Fuentes
- [RepairDesk — gestión de tickets](https://repairdesk.co/feature/repair-ticket-management) · [Running out of parts mid-repair (RepairDesk)](https://blog.repairdesk.co/2026/04/17/running-out-of-parts-mid-repair-fix-it-with-repairdesk/)
- [CellSmart POS — funciones que necesita un taller](https://www.cellsmartpos.com/blog/cell-phone-repair-shop-management-software) · [Top 10 software de taller de celulares 2026](https://gitnux.org/best/cell-phone-repair-shop-software/) · [RO App](https://roapp.io/phone-repair-shop/)
- [RepairShopr + WhatsApp](https://integrately.com/integrations/repairshopr/whatsapp-notifications-and-alerts-by-syncmate)
- [Supabase Cron (pg_cron)](https://supabase.com/docs/guides/cron) · [pg_cron en Supabase](https://supabase.com/docs/guides/database/extensions/pgcron) · [Supabase Queues (pgmq)](https://supabase.com/docs/guides/queues) · [pgmq en producción: reintentos y errores](https://dev.to/mwiginton/supabase-queues-in-production-dead-letter-queues-retries-and-poison-messages-with-pgmq-28dp)
- [Patrón de inventario con libro de movimientos](https://www.cleverence.com/articles/for-business/inventory-design-pattern-5381/) · [pg_accumulator](https://pgxn.org/dist/pg_accumulator/doc/pg_accumulator.html)
- [Conteo cíclico de series/IMEI](https://www.cleverence.com/articles/business-blogs/serial-number-cycle-count-4827/) · [Reorden automático](https://www.tacto.ai/en/procurement-glossary-downloads/reorder-point-system)
- [NuovoPay](https://nuovopay.com/) · [Trustonic](https://www.trustonic.com/?p=18011) (financiamiento de equipos con recordatorios y bloqueo)
- [WhatsApp Business Platform — precios](https://developers.facebook.com/docs/whatsapp/pricing) · [Plantillas utility](https://d7networks.com/whatsapp-business-api/whatsapp-message-templates/utility-templates/)

---

## 2. Estado real de tu base HOY (verificado en Supabase)
- **Extensiones:** `pg_cron` ✅ instalada · `pg_net` ❌ disponible sin instalar · `pgmq` ❌ disponible sin instalar · `supabase_vault` ✅ (para guardar secretos).
- **Única tarea programada:** `notificaciones-hora` (cada hora) llama a `generar_notificaciones_automaticas()` — **esa función NO existe → 6,574 corridas fallidas** (la última hoy 07:00). Es decir, hay automatización "puesta" pero muerta desde hace meses.
- **Triggers de negocio:** solo 2 (descontar stock al insertar `ventas_items`, restaurar al cancelar venta) + historial de estado de orden (sin usuario) + folios/`updated_at`.
- **Señales de que faltan automatismos (datos reales):** 48 órdenes en "Listo para entrega" > 30 días sin que nada las escale · 5 productos en o bajo su stock mínimo sin orden de compra · 4 sesiones de caja "abiertas" desde abril · 101 tokens de seguimiento vencidos pero marcados activos · el estado de garantía `vencida` **nunca se asigna** (nadie lo cambia).
- **Recordatorios de reparación:** existe el endpoint `/api/cron/recordatorios-reparaciones` pero **nada lo programa** (en `wrangler.jsonc` el cron está comentado) y además está roto por columnas inexistentes (B4).

---

## 3. Qué se puede automatizar en la base de datos (propuesta)
### A. Reglas que SIEMPRE se cumplen (triggers) — esto es lo que da "unificación"
| # | Automatización | Reemplaza / arregla |
|---|---|---|
| T1 | **Libro de movimientos de stock único:** una función `registrar_movimiento_stock(producto, tipo, cantidad, documento…)` + trigger que actualiza `productos.stock` y `stock_apartado`, con `CHECK(stock>=0)` y `stock_apartado<=stock` | Los **13 escritores manuales**, la falta de historial (10 filas en toda la historia), carreras entre usuarios, doble reintegro en devoluciones |
| T2 | **Máquina de estados de la orden en la BD** (`BEFORE UPDATE` valida la transición; `AFTER UPDATE` crea el evento) | Los 5 mapas de estados duplicados en el código; "Entregado" sin efectos |
| T3 | **Historial con usuario** (la función RPC fija `app.user_id` y el trigger lo lee) | `historial_estado_orden.usuario_id` siempre NULL |
| T4 | **Al pasar a `entregado`:** crear garantía (90 días), aplicar anticipos, movimientos de bolsa/caja, descontar piezas instaladas, puntos — todo en una función transaccional | Hoy vive en `ejecutarEfectosEntrega()` (varios pasos que pueden fallar a medias sin que nadie lo sepa) |
| T5 | **Al pasar a `cancelado`:** devolver/retener anticipos, liberar `stock_apartado`, revertir bolsa, cargo de cancelación a caja | Los 2 caminos de cancelar con efectos distintos |
| T6 | **Eliminar orden/cliente/producto → bloqueado** si hay dinero, reservas o historial; en su lugar "archivar" | Pérdida de historial financiero y reservas fantasma |
| T7 | **Ubicación:** un solo campo `ubicacion_id` (FK) + trigger que escribe `movimientos_ubicacion` y mantiene `ubicacion_fisica` | Dos campos y dos caminos para mover |
| T8 | **Auditoría genérica** (quién cambió qué y cuándo) en precios, stock, estados, ubicaciones | Falta de rastro |

### B. Tareas programadas (`pg_cron`, SQL puro — sin tocar la app)
| # | Tarea | Frecuencia |
|---|---|---|
| C0 | **Quitar/reemplazar** el job roto `notificaciones-hora` | una vez |
| C1 | Marcar garantías `vencida` al pasar su fecha | diaria |
| C2 | Desactivar `tracking_tokens` vencidos | diaria |
| C3 | Escalar órdenes `listo_entrega` por antigüedad (aviso al cliente a 7/15/30 días; alerta a admin a 60/90; marcar "para disposición" a 90 por tu cláusula PROFECO) y calcular almacenaje | diaria |
| C4 | **Stock bajo → borrador de orden de compra** por proveedor (punto de reorden por consumo real) | diaria |
| C5 | Alertar **sesiones de caja abiertas** > 24 h y verificaciones de inventario atoradas | cada hora |
| C6 | Liberar apartados/reservas vencidos (apartados de crédito, piezas de órdenes inactivas) | diaria |
| C7 | Recalcular mora de créditos y generar recordatorios escalonados (antes / día / después) | diaria |
| C8 | Resumen diario al admin (ventas, caja, órdenes atoradas, stock bajo) | diaria |
| C9 | **Conteo cíclico sugerido:** lista del día por clase ABC (equipos con IMEI siempre incluidos) | semanal |

### C. Salida hacia el cliente (WhatsApp) — tabla de eventos (outbox)
1. Un trigger/función inserta una fila en `eventos_pendientes` (tipo, orden, destinatario, plantilla, intentos, estado).
2. `pg_cron` (cada minuto) + `pg_net` llama a una ruta protegida de la app, que envía por la API de WhatsApp (o devuelve link si no hay API), marca `enviado/fallido`, **reintenta** hasta N veces y deja el error visible (hoy los fallos de notificación solo se ven si la tabla `notificaciones_fallidas` se revisa a mano).
3. Plantillas "utility" a registrar en Meta: orden recibida, presupuesto listo, pieza en camino/llegó, listo para entrega, recordatorio de recolección, recordatorio de pago, garantía por vencer.

### D. Operaciones atómicas (RPC) — la clave contra "parches"
Funciones SQL que hacen TODO o NADA (una sola transacción), llamadas desde la app: `entregar_orden`, `cancelar_orden`, `cancelar_venta`, `procesar_devolucion`, `recibir_orden_compra`, `mover_producto`, `aplicar_verificacion`, `registrar_anticipo` / `eliminar_anticipo`. Hoy cada una son 5-10 llamadas sueltas desde JavaScript donde un error intermedio se ignora y deja datos a medias (ya vimos varios).

---

## 4. Cómo se integra en cada módulo
| Módulo | Qué cambia para el usuario | Qué automatiza la BD |
|---|---|---|
| **Crear orden de servicio** | Igual de simple; sugerencias de pieza ya integradas | Folio, token de seguimiento y aviso "recibida" automáticos; (opcional) apartado de pieza si hay stock |
| **Diagnóstico / presupuesto** | Igual | Cambio de precio queda en historial con usuario; aviso al cliente solo si cambió y ya aprobó |
| **Piezas por pedir** | Botones "Ya la pedí" / "Cancelar" (ya existen) | Pedido ↔ bolsa virtual ↔ stock en una sola operación; recordatorio si una pieza lleva N días sin llegar |
| **Reparación → Listo → Entrega** | Un solo botón de entrega | T4 completo + garantía + aviso + PDF de acuse |
| **POS (venta)** | Igual | Stock y movimientos por T1; cancelar/devolver revierte stock, caja y puntos juntos |
| **Inventario / ubicación / verificación** | "Mover producto" siempre deja historial; verificación pide 2.º conteo si hay diferencia en IMEI | T7, T1 (ajuste con motivo), C9 |
| **Compras (órdenes de compra)** | Se generan borradores por stock bajo | C4; recepción suma stock vía T1 y actualiza costo (decisión de Trini: último costo vs promedio) |
| **Bolsa virtual / caja** | Saldos siempre cuadran | Cada movimiento nace de la misma función; cierre de caja usa los mismos datos; alerta de sesiones abiertas |
| **Clientes / créditos** | Recordatorios de pago automáticos | C7; baja de cliente bloqueada si hay saldo |
| **Garantías** | Se crean y vencen solas; reclamar es un clic | T4, C1, RPC de reclamo |
| **Notificaciones** | Una bandeja con estado de cada envío y reintento | Outbox (sección C) |

---

## 5. Hoja de ruta sugerida (de menor a mayor riesgo)
| Fase | Qué | Riesgo | Depende de |
|---|---|---|---|
| 0 | Arreglar columnas/tablas inexistentes (B1–B17 de la auditoría de integración) y reemplazar el cron roto | Bajo | — |
| 1 | **Tareas programadas** C1, C2, C5, C6, C8 (SQL puro, no cambia pantallas) | Bajo | Fase 0 |
| 2 | **Auditoría genérica + historial con usuario** (T3, T8) | Bajo | — |
| 3 | **Libro único de stock (T1)** y retirar los 13 escritores manuales *en el mismo despliegue* | **Alto** (si se activa el trigger sin retirar el código se cuenta doble) | Fase 0 |
| 4 | RPC atómicas: entregar, cancelar, devolver, mover, recibir compra (T4–T7) | Medio-Alto | Fase 3 |
| 5 | Outbox + WhatsApp con plantillas + reintentos (sección C) | Medio | `pg_net`, plantillas aprobadas por Meta |
| 6 | Reorden automático (C4) y conteo cíclico (C9) | Bajo | Fase 3 |
| 7 | Recordatorios de pago escalonados (C7) | Bajo-Medio | Fase 5 |

**Cómo probar sin riesgo:** cada fase se escribe como migración en `supabase/migrations/`, se prueba primero con consultas dentro de una transacción con `ROLLBACK` o en una rama de desarrollo de Supabase (la rama tiene costo — confirmar antes), y se activa con un interruptor en `configuracion` por franquicia cuando sea posible.

## 6. Precauciones
- **No activar un trigger de stock mientras el código siga escribiendo stock a mano** (doble conteo). Se despliega todo junto o con interruptor.
- Con `pg_net` no hay reintentos: siempre outbox.
- Cloudflare plan gratuito: las tareas pesadas deben vivir en la BD (`pg_cron`), no en el Worker (límite de 10 ms de CPU).
- Proyecto gratuito de Supabase se **pausa tras 1 semana sin actividad** — confirmar el plan.
- Plantillas de WhatsApp: aprobación de Meta (días) y costo por conversación.
- Mantener el **modo "link"** de WhatsApp como respaldo cuando la API falle.
- Todo lo de PayJoy/facturas sigue **fuera** hasta que Trini decida.
