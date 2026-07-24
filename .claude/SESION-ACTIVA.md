# Sesión Activa — CREDIPHONE

## ✅ IMPLEMENTACIÓN — 2026-07-24 (worktree elated-kapitsa) — Ejecutando el plan de la auditoría #2 de abajo

Trini confirmó proceder con todos los puntos de la auditoría del 2026-07-23 (ver sección de abajo). Todo lo siguiente **ya está implementado y verificado con `tsc --noEmit` limpio**, pero **AÚN NO SE HA HECHO COMMIT/PUSH A MASTER** (sigue en el worktree local).

1. **Fix crítico `fecha_entrega`→`fecha_entregado`** — corregido en `src/app/api/pos/reparacion-cobro/route.ts` y `src/app/api/reparaciones/[id]/entregar/route.ts`. Verificado contra Supabase en vivo que `fecha_entregado` es el nombre real de la columna.
2. **Backfill ejecutado en Supabase (`ihvjjfsefnvcrczrcmhp`)** de las 47 órdenes atoradas en `listo_entrega`: 10 órdenes confirmadas pagadas al 100% se pasaron a `entregado` (anticipos aplicados, movimiento en bolsa virtual, puntos acumulados, historial de estado). **4 órdenes quedaron excluidas a propósito, pendientes de tu criterio:**
   - `ORD-20260530-0005` — precio_total = $0, sin anticipos (caso trivial, no se tocó)
   - `ORD-20260511-0003`, `ORD-20260629-0002`, `ORD-20260707-0002` — tienen anticipos que exceden el precio_total (sobrepago o error de captura) — no se procesaron automáticamente
3. **Bug visual del checklist de condiciones** (texto invisible en hover) — corregido en `src/components/reparaciones/condiciones/IconosFuncionamiento.tsx`.
4. **Buscador de cliente agregado en DOS lugares** (antes: `<select>` plano sin buscar ni ordenar, 139 clientes):
   - `src/components/reparaciones/ModalOrden.tsx` (crear orden nueva) — combobox con búsqueda por nombre/teléfono, ordenado alfabético, capado a 50 resultados.
   - `src/components/reparaciones/ModalEditarOrden.tsx` (editar orden existente, incluye cambiar el cliente asignado) — mismo patrón de combobox.
5. **Piezas al proveedor — cancelación individual + auto-transición:**
   - Nuevo `DELETE /api/reparaciones/[id]/pedidos-pieza/[pedidoId]` — cancela un pedido individual (solo desde `pendiente`/`en_camino`), revierte el gasto en bolsa virtual con un movimiento negativo compensatorio.
   - Nueva función `checkYTransicionarEsperandoPiezas()` en `src/lib/db/reparaciones.ts` — cuando todas las piezas de una orden en `esperando_piezas` quedan resueltas (instalada/defectuosa/cancelada), la orden pasa sola a `en_reparacion`. Conectada al DELETE nuevo y a `pedidos-pieza/[pedidoId]/verificar/route.ts`.
   - Botón "Cancelar" agregado en `OrdenDrawer.tsx` para pedidos en `pendiente`/`en_camino`.
6. **Drawer desincronizado del dashboard — 6 acciones corregidas** en `OrdenDrawer.tsx` para que llamen `onRefresh()` (antes solo actualizaban su propio estado local): editar nombre de pieza, ingresar pieza a inventario (crear producto), vincular pieza a producto existente, editar "Problema Reportado", editar "Notas Internas", guardar cotización de piezas editada.
7. **Verificado en vivo contra Supabase:** el fix de fuga entre franquicias en `obtener_tecnico_disponible()` (documentado como resuelto el 2026-05-30) sigue intacto — no hay regresión. El caller en `src/lib/db/reparaciones.ts:490-493` pasa `distribuidorId` correctamente, y `GET /api/empleados` también filtra bien por tienda.

**Pendiente de esta sesión:**
- Recomendación (no implementada, solo investigada): conectar el diagnóstico técnico (`partes_reemplazadas` JSONB) con "piezas por pedir al proveedor" (`pedidos_pieza_reparacion`) — hoy viven desconectados, un técnico puede duplicar un pedido sin darse cuenta. También: autocompletar precio de una "pieza libre" (sin catálogo) buscando el historial de la misma marca/modelo — no existe hoy, requeriría tabla nueva o query sobre `piezas_cotizacion` JSONB. Ver detalle en el mensaje de chat de esta sesión si se necesita retomar.
- Falta: `npm run lint` (revisar), commit, push a master (autorizado por Trini 2026-04-06), y decisión de Trini sobre las 4 órdenes excluidas del backfill.

---

## 🔎 AUDITORÍA COMPLETA #2 — 2026-07-23 (worktree elated-kapitsa) — SOLO DIAGNÓSTICO, SIN CAMBIOS APLICADOS AÚN

Trini pidió: verificar BD/frontend/backend de los puntos reportados y dar informe ANTES de proceder con ningún plan. **No se modificó ningún archivo ni se ejecutó ningún UPDATE en esta ronda** — solo lectura (código + Supabase vía MCP).

### 🔴🔴 HALLAZGO MÁS GRAVE DE TODA LA AUDITORÍA — Flujo de cobro/entrega roto por un typo, con impacto financiero histórico

**Causa raíz confirmada:** en `src/app/api/pos/reparacion-cobro/route.ts:358` y `src/app/api/reparaciones/[id]/entregar/route.ts:159`, el UPDATE a `ordenes_reparacion` usa el campo `fecha_entrega`, que **no existe** en la tabla (la columna real es `fecha_entregado`, confirmado en `supabase/fase8-reparaciones.sql:59` y usado correctamente en `src/lib/db/reparaciones.ts:824`).

**Efecto en cadena:**
1. Supabase rechaza el UPDATE por columna inexistente → `updateError` queda con el error.
2. En `reparacion-cobro/route.ts`, el código SOLO llama a `ejecutarEntregaCompleta()` dentro del `else` (si NO hubo error) — como sí hay error, **`ejecutarEntregaCompleta()` nunca se ejecuta**: no se aplica el anticipo, no se registra en bolsa virtual, no se descuenta stock de piezas, no se acumulan puntos, no se registra en `historial_estado_orden`.
3. A pesar de eso, la respuesta al frontend regresa `{ success: true, entregado: true }` — **el empleado ve "entregado" en pantalla, pero en la base de datos la orden se queda en `listo_entrega`.**

**Verificado directamente en Supabase (project `ihvjjfsefnvcrczrcmhp`):**
| Métrica | Valor |
|---|---|
| Órdenes atoradas en `listo_entrega` (fecha_completado ya pasó, fecha_entregado = NULL) | **47** |
| Órdenes correctamente en `entregado` | 48 (llegaron ahí porque algún empleado usó el modal genérico "Cambiar estado", que sí usa el campo correcto — bypaseando por completo el flujo de cobro/entrega) |
| Anticipos con estado `pendiente` (nunca se marcaron `aplicado`) | **109 de 109 — el 100% histórico** |
| Filas en `movimientos_bolsa_virtual` | **0 — la tabla está completamente vacía** |

**Esto significa que la función `ejecutarEntregaCompleta()` nunca se ha ejecutado exitosamente en producción**, desde que existe. Ningún anticipo se ha aplicado automáticamente, ningún movimiento de bolsa virtual se ha registrado, y es probable que el stock de piezas instaladas y los puntos de lealtad por reparación tampoco se hayan acumulado correctamente en ninguna orden entregada por esta vía (aunque `acumularPuntos()` en la ruta de reparaciones sí se llama en un bloque separado — no depende de `ejecutarEntregaCompleta` — habría que confirmar aparte si esos sí corrieron).

**Las 47 órdenes atoradas** (folios completos en la query ejecutada esta sesión, ejemplos: `ORD-20260712-0002`, `ORD-20260717-0005`, `ORD-20260717-0003`, `ORD-20260707-0002`, `ORD-20260618-0002`... hasta `ORD-20260505-0002`) tienen anticipos en estado `pendiente` por montos que van de $50 a $1000+, nunca aplicados a la orden.

**Por qué NO lo corregí todavía:** cambiar el nombre del campo es un fix de código de bajo riesgo (1 línea en 2 archivos), pero **backfillear las 47 órdenes históricas + 109 anticipos + posible stock + posibles puntos es una operación financiera sobre datos reales** que puede duplicar puntos/stock si no se hace con cuidado (ej. si `acumularPuntos()` ya corrió por otro lado para algunas de estas). Prefiero tu confirmación antes de tocar esos datos.

---

### 🟠 Piezas al proveedor — confirmado roto (coincide con el reporte de Trini)

1. **No existe endpoint ni botón para cancelar un pedido de pieza individual.** El único código que cancela pedidos de pieza vive en `api/reparaciones/[id]/cancelar/route.ts:125-132`, y solo corre cuando se cancela la ORDEN COMPLETA, y solo cancela pedidos en estado `pendiente` o `en_camino` (pedidos ya `recibida`/`instalada` nunca se pueden revertir).
2. **No existe transición automática que saque una orden de `esperando_piezas`** cuando todos sus pedidos de pieza ya llegaron/se instalaron — requiere que un humano cambie el estado manualmente, y si se le olvida, la orden queda atorada indefinidamente aunque el trabajo del lado de piezas ya esté completo.
3. El tipo `"cancelada"` existe en el union type del frontend (`PiezasPendientesPanel.tsx`, `OrdenDrawer.tsx`) pero no hay forma de llegar a ese estado desde la UI para un pedido individual.

---

### 🟠 OrdenCard / OrdenDrawer / Stepper — confirmado: el Drawer es el eslabón débil

- **OrdenCard y el Stepper SÍ están sincronizados** entre sí — ambos son "stateless" y leen directo de la prop `orden` que viene del dashboard, así que cuando el dashboard hace `refreshSilencioso()`, ambos se actualizan solos.
- **El Drawer NO se entera de cambios que pasan afuera de él.** Mantiene su propio estado local (`fetchOrden()` solo al abrir), y si el estado de la orden cambia desde la card (o desde otro empleado) mientras el drawer está abierto, el drawer sigue mostrando datos viejos hasta que se cierra y reabre.
- Tres mutaciones dentro del Drawer (`handleGuardarNombrePieza`, `handleIngresarInventario`, `handleIngresarInventarioVincular` — `OrdenDrawer.tsx` líneas ~713-882) actualizan su propia vista local pero **nunca llaman a `onRefresh()`**, así que la card/lista del dashboard no se entera de esos cambios hasta un refresh manual.
- Tres ediciones locales más (`OrdenDrawer.tsx` líneas ~1444, 1573, 2645 — problema reportado, notas internas, piezas cotizadas editadas) hacen `setOrden()` optimista sin volver a confirmar contra el servidor.

---

### 🟡 Bug visual confirmado — checklist de condiciones del equipo (wifi, cámara, etc.)

**Archivo:** `src/components/reparaciones/condiciones/IconosFuncionamiento.tsx:99`

Es justo lo que describiste: al seleccionar una condición, el `hover` cambia el **fondo** del chip a un verde/rojo sólido (`var(--color-success)` / `var(--color-danger)`), pero el **color del texto** (línea 99) usa esa MISMA variable sin considerar el estado hover — entonces cuando el mouse está encima, el texto queda del mismo color que el fondo (invisible). Al quitar el mouse, el fondo vuelve a la versión clara (`-bg`) y el texto vuelve a ser legible. Es un fix de una línea (condicionar el color del texto también al estado `hovered`).

---

### 🟢 Sistema de puntos/lealtad — auditado a fondo, casi todo bien conectado

Corrección a lo reportado en la auditoría anterior (2026-07-09): **sí existe UI de canje de puntos**, vive en el POS (`src/app/dashboard/pos/page.tsx`, panel líneas ~1998-2051 + lógica de descuento líneas 987-990, 558) y llama a `canjearPuntos()` vía `POST /api/clientes/[id]/puntos`. Mi reporte anterior sobre "falta UI de canje" estaba desactualizado/incorrecto — quedó corregido con esta pasada más profunda.

**Confirmado bien centralizado:**
- Toda lectura de puntos (dashboard admin, portal cliente, tracking, POS) pasa por `getSaldoPuntos()` en `src/lib/db/puntos.ts`
- Otorgamiento de puntos centralizado vía `acumularPuntos()` en: entrega de reparación (`api/reparaciones/[id]/entregar/route.ts:222`), cobro de reparación en POS (`api/pos/reparacion-cobro/route.ts:140`), y venta POS (`src/lib/db/ventas.ts:382`)
- Existe página dedicada `/dashboard/clientes/loyalty` con ranking completo de puntos por cliente (admin/super_admin)
- Multi-tenant respetado en todos los queries de puntos

**Única brecha real encontrada:** cuando un cliente paga un abono de crédito (`POST /api/pagos`), **no se otorgan puntos** — a diferencia de ventas POS y reparaciones, donde sí. Si la regla de negocio es "todo dinero que entra genera puntos", este es el único flujo de dinero que se quedó fuera.

---

### ❓ Preguntas para decidir el plan (nada se toca hasta que confirmes)

1. **Fix del typo `fecha_entrega` → `fecha_entregado`** (2 archivos, 1 línea cada uno): ¿lo aplico ya? Es de bajo riesgo y desbloquea que las entregas futuras funcionen correctamente.
2. **Backfill de las 47 órdenes atoradas + 109 anticipos pendientes:** ¿quieres que audite orden por orden cuáles ya se cobraron en realidad (cruzando con lo que recuerden tú/tu equipo o con `sesion_caja`/movimientos de caja) antes de tocarlas, o prefieres que corra un script que asuma que todas están pagadas y las cierre en bloque? Esto toca dinero real — no lo haré sin luz verde explícita y sin un método de verificación que no duplique puntos/stock.
3. **Piezas al proveedor:** ¿construyo ya el endpoint+botón de "cancelar pedido individual" y la auto-transición de `esperando_piezas`, o prefieres priorizarlo después del fix crítico de entrega?
4. **Drawer sin sincronía:** ¿lo agrego a este plan (requiere trabajo más grande: suscribir el drawer a refresh externo) o lo dejamos para otra sesión?
5. **Color del checklist de condiciones:** fix trivial de 1 línea — ¿lo aplico junto con el fix del typo crítico?
6. **Puntos en pagos de crédito:** ¿confirmas que un abono de crédito debe generar puntos igual que una venta? Si sí, lo agrego al mismo paquete.

---

## 🔎 AUDITORÍA COMPLETA — 2026-07-09 (worktree elated-kapitsa)

Auditoría solicitada por Trini: estado del proyecto, huecos/lagunas de integración, errores de BD/API/frontend, y errores visuales/UX. Se verificó contra Supabase real (MCP), no contra archivos `.sql` locales.

### 🔴 CRÍTICO — Ya corregido y desplegado a master (commit `167f3a8`)

**Bug 1 — `/dashboard/clientes/[id]` (perfil de cliente en el panel admin) devolvía 404 para TODOS los clientes en producción.**
- Causa: `src/app/api/clientes/[id]/perfil/route.ts` seleccionaba `clientes.scoring`, `clientes.puntos_disponibles`, `clientes.puntos_acumulados` — ninguna de estas columnas existe en la tabla `clientes` (el scoring vive en `scoring_clientes`, los puntos en `puntos_cliente`). Como el query usa `.single()`, el error de columna inválida disparaba la rama "Cliente no encontrado" siempre.
- Fix: se quitaron esas columnas del SELECT; los puntos ahora se obtienen con el helper centralizado `getSaldoPuntos()`. El scoring se dejó fuera (no estaba en el alcance original, vive en tabla separada sin join).

**Bug 2 — Créditos rotos en ambos perfiles de cliente (portal `/cliente/perfil` y dashboard `/dashboard/clientes/[id]`).**
- Causa: ambas rutas (`api/cliente/perfil/route.ts` y `api/clientes/[id]/perfil/route.ts`) seleccionaban `creditos.saldo_pendiente` y `creditos.plazo_semanas` — ninguna existe (la columna real es `plazo`; `saldo_pendiente` nunca fue una columna real, debe calcularse).
- Fix: se seleccionó `plazo` real y se calculó `saldoPendiente = monto - SUM(pagos.monto WHERE estado != 'cancelado')`, reusando el patrón ya establecido en `getCarteraVencida()` (`src/lib/db/creditos.ts`).
- Efecto colateral positivo: ambas rutas ahora también excluyen registros `tipo = "apartado"` de la tabla `creditos` (apartados y créditos comparten tabla, diferenciados por `tipo`), evitando que un apartado se muestre como "crédito" al cliente o al admin.

**Archivos tocados:** `src/app/api/cliente/perfil/route.ts`, `src/app/api/clientes/[id]/perfil/route.ts`, `src/app/cliente/perfil/page.tsx`, `src/app/dashboard/clientes/[id]/page.tsx`. TypeScript limpio, pusheado a master.

---

### 🟠 HUECOS DE INTEGRACIÓN — Documentados, NO corregidos aún (requieren decisión de Trini)

**1. Piezas de reparación: dos fuentes de verdad que no se sincronizan (viola "Principio Espejo")**
- `piezas_cotizacion` (JSONB dentro de `ordenes_reparacion`) se llena al cotizar inicialmente.
- `reparacion_piezas` (tabla normalizada) se llena cuando se piden piezas después.
- Cuando se agrega una pieza nueva después de la cotización inicial, **no se sincroniza de vuelta** al JSONB `piezas_cotizacion`. Esto puede causar que el tracking del cliente, el PDF de la orden, o el ticket térmico muestren una lista de piezas distinta a la que realmente se pidió/instaló, dependiendo de qué fuente lea cada vista.
- Adicional: existen **dos tablas paralelas de solicitud de pieza sin vincular entre sí**: `pedidos_pieza_reparacion` (la que usa el flujo activo, con calidad/proveedor/notificaciones) y `solicitudes_piezas` (más antigua, no está claro si sigue en uso).

**Pregunta para Trini:** ¿`solicitudes_piezas` sigue en uso en algún flujo, o es candidata a deprecar? ¿Quieres que unifique `piezas_cotizacion` y `reparacion_piezas` en una sola fuente (probablemente la tabla normalizada, generando el JSONB solo como snapshot de lectura)?

**2. Sistema de puntos/lealtad: backend completo, sin UI de canje en POS**
- `acumularPuntos()` y `canjearPuntos()` existen y funcionan (`src/lib/db/puntos.ts`), centralizados y correctamente aislados por distribuidor/año.
- No hay ningún botón o modal en el POS que permita usar `canjearPuntos()` — el cliente acumula puntos pero nadie en la tienda puede aplicarlos a una venta.

**Pregunta para Trini:** ¿Quieres que construya el flujo de canje de puntos en el POS (aplicar puntos como descuento en una venta)? Es la única pieza faltante del módulo de lealtad.

**3. Franquicias — capa de negocio pendiente (sin cambios desde la auditoría anterior)**
- Infraestructura completa: `tipo_tenant`, `parent_distribuidor_id`, `can_access_distribuidor()`.
- Pendiente: facturación entre franquicia matriz/hijas, inventario compartido, contrato digital de franquicia. Ver `logica_negocio_franquicias.md` en memoria — sin cambios desde la última revisión, no se re-verificó línea por línea en esta sesión.

---

### 🟡 VISUAL / UX — Hallazgos menores, no corregidos

| Hallazgo | Archivo |
|---|---|
| Emojis usados como íconos (en vez de Lucide) | `src/app/fotos/[token]/page.tsx` (página pública) |
| Clases Tailwind de color directas (viola regla CSS vars) | `src/app/dashboard/admin/categorias/page.tsx` |
| Clases Tailwind de color directas (viola regla CSS vars) | `src/app/dashboard/admin/distribuidores/[id]/page.tsx` |

Fuera de esto, el cumplimiento general del sistema de diseño (CSS vars, hover con estado, tamaños de ícono) es bueno tras el polish de la sesión anterior (commit del 2026-06-12).

---

### ❓ Preguntas abiertas para Trini

1. ¿`solicitudes_piezas` se deprecа o sigue viva? (afecta si vale la pena unificar piezas ahora)
2. ¿Prioridad: sincronizar `piezas_cotizacion` ↔ `reparacion_piezas`, o dejarlo así si en la práctica no ha causado problemas reportados?
3. ¿Construyo ya el canje de puntos en POS, o queda en el backlog?
4. ¿La limpieza visual de `fotos/[token]`, `categorias` y `distribuidores/[id]` se hace ahora (rápido) o se agrupa con la próxima pasada de UX?
5. Facturación/inventario compartido entre franquicias — ¿sigue sin ser prioridad, o ya hay fecha objetivo?

---

## Estado: EN PROGRESO — Worktree elated-kapitsa (2026-06-12)

### Trabajo pendiente de esta sesión (merge a master cuando Trini apruebe)

| Item | Estado | Notas |
|------|--------|-------|
| Subdominios Fase 4 — page.tsx, catalogo/page.tsx, Footer.tsx | ⏳ Pendiente | Usar `useConfig()` en lugar de WA hardcodeado |
| Tracking URL con subdominio en WhatsApp | ⏳ Pendiente | `notificaciones-reparaciones.ts` — construir con slug del distribuidor |
| Apartados — panel gestión en POS | ⏳ Pendiente | Listar activos + botón "Completar apartado" |

### Implementado en esta sesión (worktree elated-kapitsa)

| Commit | Descripción |
|--------|-------------|
| (pendiente) | ux: UX polish + búsqueda IMEI global + módulo garantías + perfil cliente |
| `92ad56d` | feat: sistema de apartados — BD + API + ApartadoModal + botón POS |
| `6943de9` | fix: emojis residuales → íconos Lucide (MapPin, AlertTriangle, Lock, Smartphone, Check, Tag) |
| `79279f3` | feat: POS tabs reordenados + badge Cobrar Rep. + página facturación placeholder |
| `9c337c7` | security: 11 brechas multi-tenant corregidas (C1-C4, A1-A6, M1-M4) |
| `7a936d0` | feat: promociones automáticas desde inventario en tracking |
| `51c695c` | feat: subdominios Fases 1-3 |

### Cambios en el commit pendiente (2026-06-12)

**Fase 1 — UX Visual polish:**
- `BolsaVirtualPanel.tsx` — `✕` → `<X />` Lucide, colores `#fee2e2`/`#dc2626` → CSS vars
- `ReparacionesPOSPanel.tsx` — badge de estado con colores por tipo (`ESTADO_BADGE` map)
- `PaymentMethodSelector.tsx` — `text-gray-700 dark:text-gray-300` → CSS vars en todos los labels
- `IconosFuncionamiento.tsx` — Tailwind colors → CSS vars, sub-componente `ComponenteBtn` con hover state
- `pos/page.tsx` — tab icons `w-4 h-4` → `w-5 h-5`
- `VentaCreditoModal.tsx` — botón dos líneas: "Crear crédito" + "enganche $X.XX"
- `ApartadoModal.tsx` — botón dos líneas: "Apartar artículos" + "depósito $X.XX"
- `creditos/page.tsx` — columna Cliente: `max-w-[180px] truncate` + `title` tooltip
- `ReciboModal.tsx` — emojis `📄🖨️💬👁️` → Lucide `FileText Printer MessageCircle Eye`

**Fase 2 — Búsqueda IMEI global:**
- `api/reparaciones/buscar/route.ts` — nuevo endpoint que usa `searchOrdenes()` (incluye archivadas)
- `reparaciones/page.tsx` — debounced search (400ms), resultados globales con badge "Archivada"

**Fase 3 — Módulo Garantías:**
- `api/garantias/route.ts` — nuevo endpoint con join ordenes+clientes, filtro por distribuidor
- `dashboard/garantias/page.tsx` — página completa: activas, vence esta semana, reclamaciones, historial
- `Sidebar.tsx` — link "Garantías" en sección Reparaciones con `ShieldCheck` icon

**Fase 4 — Perfil completo del cliente:**
- `api/clientes/[id]/perfil/route.ts` — endpoint consolidado: órdenes + garantías activas + créditos + pagos
- `dashboard/clientes/[id]/page.tsx` — página completa: header, KPIs, reparaciones activas+archivadas, créditos, pagos
- `dashboard/clientes/page.tsx` — nombre del cliente es link a `/dashboard/clientes/${id}`

### Para hacer merge a master:
```bash
git checkout master
git merge claude/elated-kapitsa
git push origin master
```

---

## Estado anterior: COMPLETO — Auditoría cross-tenant + Anticipo 100% (2026-05-30)

## Implementado 2026-05-30 — Auditoría seguridad cross-tenant (6 brechas corregidas)

| Fix | Archivo | Descripción |
|-----|---------|-------------|
| ✅ Supabase | `obtener_tecnico_disponible(p_distribuidor_id)` | Filtra técnicos por franquicia. Retorna NULL (no excepción) si no hay técnico local |
| ✅ Supabase | `obtener_carga_tecnicos(p_distribuidor_id)` | Filtra por `u.distribuidor_id` (corrige JOIN a tabla inexistente `empleados`) |
| ✅ `src/lib/db/empleados.ts` | `getEmpleadosPorRol()` | Agrega parámetro `distribuidorId?` |
| ✅ `src/lib/db/reparaciones.ts` | RPC call | Pasa `p_distribuidor_id` a `obtener_tecnico_disponible` |
| ✅ `src/app/api/empleados/vendedores/route.ts` | GET vendedores | Filtra por distribuidor del admin |
| ✅ `src/app/api/empleados/[id]/route.ts` | GET/PUT/DELETE | Ownership check cross-tenant en los 3 métodos |
| ✅ `src/app/api/reparaciones/[id]/asignar-tecnico/route.ts` | Bug crítico | Corrige tabla `empleados` → `users`, campo `user_id` → `id` |
| ✅ `supabase/fase8-reparaciones.sql` | Docs | `tecnico_id` nullable, `costo_total` columna regular, `distribuidor_id` en tabla |
| ✅ `supabase/seguridad-cross-tenant.sql` | Docs nuevo | Documenta todas las migraciones de seguridad de esta sesión |

## Implementado 2026-05-30 — Plan anticipo 100% + cotización (sesión anterior)

| Fix | Archivo | Descripción |
|-----|---------|-------------|
| ✅ | `AnticipoCajaPanel.tsx` | Usa `presupuestoTotal` (no `costoTotal`) + badge naranja cuando pagado pero no entregable |
| ✅ | `ReparacionesPOSPanel.tsx` | Botón "Entregar equipo" cuando saldo=0, `handleEntregarSinCobro` |
| ✅ | `api/pos/reparacion-cobro/route.ts` | Valida estado entregable antes de marcar como entregado |
| ✅ | `.claude/REGLAS-NEGOCIO.md` | Documenta `precio_total` vs `costo_total` |

## REGLA NUEVA (2026-05-30): Supabase = fuente de verdad
- Los archivos `supabase/*.sql` son documentación histórica, NO el estado actual
- Siempre verificar en Supabase MCP antes de referenciar columnas/funciones
- NO hacer sincronización masiva de SQL local — solo actualizar cuando se aplica una migración nueva
- Ver sección "Supabase como fuente de verdad" en CLAUDE.md

---

## Estado anterior: EN PROGRESO — Plan unificación piezas (2026-05-21)

**Última sesión:** 2026-05-17 — Plan auditoría inventario COMPLETO. Mergeado a master y pusheado.

## Implementado 2026-05-17 — Auditoría área de inventario (COMPLETO)

### Fase 1 — Bugs críticos
| Fix | Archivo | Descripción |
|-----|---------|-------------|
| P2 ✅ | `inventario/series/page.tsx` | Validación IMEI 15-17 dígitos estricta |
| P3 ✅ | `lib/db/ventas.ts` | movimientos_stock fire-and-forget → await |
| P4 ✅ | `inventario/verificar/page.tsx` | Búsqueda en lista de faltantes |
| P5 ✅ | `lib/db/devoluciones.ts` | movimientos_stock al reintegrar por devolución |
| P6 ✅ | `lib/db/lotesSeries.ts` | movimientos_stock al ingresar IMEI por lote |
| P7 ✅ | `lib/db/ordenes-compra.ts` | movimientos_stock al recibir mercancía de OC |
| P8 ✅ | `lib/db/reparaciones.ts` | movimientos_stock al usar/devolver piezas |

### Fase 2 — Consolidación UI
| Fix | Archivo | Descripción |
|-----|---------|-------------|
| U1 ✅ | `productos/page.tsx` | Historial de movimientos en modal del producto |
| U2 ✅ | `inventario/verificar/page.tsx` | Tab "Historial" con verificaciones pasadas (lazy load) |
| U3 ✅ | Ya existía | Catálogo unificado con filtros de tipo |

### Fase 3 — Delegación a empleados
| Fix | Archivo | Descripción |
|-----|---------|-------------|
| D1 ✅ | `inventario/alertas/page.tsx` | Vendedor ve alertas (lectura); solo admin puede actuar |
| D2 ✅ | `pos/page.tsx` | Alerta de stock bajo post-venta, auto-cierra 15s |
| D3 ✅ | `inventario/verificar/page.tsx` | Técnico puede acceder a verificación física |

### Fase 4 — Funcionalidades nuevas
| Fix | Archivo | Descripción |
|-----|---------|-------------|
| N1 ✅ | `compras/page.tsx` + `api/inventario/movimientos/route.ts` | Entrada directa sin OC formal |
| N2 ✅ | Ya cubierto en P5-P8 | Hoyos de auditoría cerrados |

**movimientos_stock ahora se registra en TODAS las operaciones de stock del sistema.**

---

## Implementado 2026-05-21 — Plan unificación del flujo de piezas (Fases 80+)

### Fase 1 ✅ — Base: compatibilidad y calidad en catálogo
| Cambio | Archivos |
|--------|---------|
| Migración BD: `modelos_compatibles text[]` (GIN) + `calidad` en `productos` | Supabase |
| Tipo `Producto`: `modelosCompatibles` + `calidad` union type | `src/types/index.ts` |
| Mapper: convierte DB → camelCase | `src/lib/db/productos.ts` |
| API `GET /api/productos/compatibles?modelo=...` | `src/app/api/productos/compatibles/route.ts` |
| UI catálogo: sección pieza_reparacion con calidad + tags de modelos | `src/app/dashboard/productos/page.tsx` |

### Fases 2+3 ✅ — Autosugerencia mejorada + costos internos en cotización
| Cambio | Archivos |
|--------|---------|
| `PiezaCotizacion`: nuevos campos `costoInterno`, `costoEnvio`, `proveedorId`, `calidad` | `src/types/index.ts` |
| Fetch doble (compatibles GIN + fallback clásico), deduplicado | `SelectorPiezasCotizacion.tsx` |
| Pre-llena `costoInterno` desde catálogo al agregar inventario | `SelectorPiezasCotizacion.tsx` |
| Formulario libre: campos costo pieza + envío + utilidad en tiempo real | `SelectorPiezasCotizacion.tsx` |
| Badge calidad en chips de sugerencias | `SelectorPiezasCotizacion.tsx` |

### Utilidad visible ✅ — Todos los roles ven la rentabilidad
| Cambio | Archivos |
|--------|---------|
| Quita restricción `isAdmin` de sección rentabilidad | `OrdenDrawer.tsx` |
| Elimina referencias a `presupuestoTotal` (columna inexistente) | `OrdenDrawer.tsx` |
| Mensaje si no hay piezas pedidas aún | `OrdenDrawer.tsx` |

### Fase 4 ✅ — Calidad visible al cliente en tracking
| Cambio | Archivos |
|--------|---------|
| `PiezaTrackingRow`: botón "Ver detalles" expandible por pieza | `tracking/[token]/page.tsx` |
| Muestra calidad en lenguaje amigable (Original, Genérica, OEM...) | `tracking/[token]/page.tsx` |
| Solo aparece si la pieza tiene calidad registrada | `tracking/[token]/page.tsx` |

### Fase 5 ✅ — Conectar downstream (2026-05-21)
| Cambio | Archivos |
|--------|---------|
| BD: columnas `calidad` + `proveedor_id` en `pedidos_pieza_reparacion` | Supabase migration |
| POST `/pedidos-pieza`: acepta calidad + proveedorId, propaga a INSERT y piezas_cotizacion | `api/reparaciones/[id]/pedidos-pieza/route.ts` |
| F5b: pieza libre → auto-crea producto en catálogo con stock=0 y vincula al pedido | idem |
| F5c: notificación fire-and-forget a admin+vendedores + técnico asignado al agregar pieza | idem |
| Ticket 58mm: fuentes +20% (11-15px), más peso; piezas, presupuesto, anticipo, notas técnico | `reparaciones/[id]/ticket/page.tsx` |

**Plan unificación piezas: COMPLETO.** Todas las fases 1–5 implementadas.

---

## Implementado 2026-05-21 — Puntos pendientes post-auditoría

| Punto | Descripción | Archivos |
|-------|-------------|---------|
| P1 ✅ | Migración almacenaje — ya estaba aplicada en BD | Supabase (verificado) |
| P2 ✅ | Nota de calidad discreta en PDF, sección PIEZAS UTILIZADAS | `src/lib/pdf/orden-pdf.ts` |
| P3 ✅ | BUG-PIEZAS-001: WhatsApp usa `generarMensajePiezaEnEspera` centralizado | `PiezasPendientesPanel.tsx` |
| P4 ✅ | Venta de teléfonos en POS a crédito con IMEI | `VentaCreditoModal.tsx` + `api/pos/venta-credito/route.ts` + `pos/page.tsx` |
| P5 ✅ | RLS habilitado en 3 tablas sin protección: `pedidos_pieza_reparacion`, `solicitudes_cambio_precio`, `versiones_pdf_reparacion` | Supabase migration |
| P6 ✅ | WhatsApp al proveedor desde panel piezas pendientes — botón por pieza con mensaje pre-compuesto | `PiezasPendientesPanel.tsx` + `api/reparaciones/piezas-pendientes/route.ts` |


**Historial:** `ARCHIVO/HISTORIAL-SESIONES.md`

---

## Módulos activos y funcionales

| Módulo | Estado | Notas |
|--------|--------|-------|
| Reparaciones (órdenes, drawer, stepper) | ✅ | Completo + mejoras 2026-05-13 |
| PDF de orden | ✅ | Con cláusula legal almacenaje (T4) |
| Tracking cliente | ✅ | Fix requiereAprobacion + colores |
| Ticket térmico 58mm | ✅ | Con QR de entrega en header (T1) |
| /reparacion/{folio} — QR entrega | ✅ | Banner empleado con botón al dashboard (T2) |
| Panel Almacenaje | ✅ | /dashboard/almacenaje — con WA por fila (T3) |
| Cron recordatorios | ✅ | POST /api/cron/recordatorios-reparaciones (T3b) |
| movimientos_stock en ventas POS | ✅ | P1 — fire-and-forget en createVenta() |
| Flujo entrega completo desde POS | ✅ | P2 — ejecutarEntregaCompleta() en reparacion-cobro |
| Cobro reparación POS | ✅ | Bug presupuesto_total resuelto |

---

## Implementado 2026-05-13 — Plan de mejoras reparaciones

### Bugs resueltos
- **BUG-0:** Fallas checklist siempre visibles bajo campo "problema reportado" en ModalOrden
- **BUG-1:** StatPills clickeables — todas filtran con visual de estado activo
- **BUG-2+M12:** Tracking muestra servicios cuando `requiereAprobacion=false` (clienteAprobado unificado)
- **BUG-3:** Formulario piezas pedidas tenía solo texto libre — agregado selector de inventario

### Mejoras UX visual (Fase 2)
- **M4:** Colores de borde en OrdenCard según estado (success=listo, warning=esperando, info=presupuesto, accent=reparacion, danger=cancelado)
- **M5:** Todas las StatPills clickeables + indicador activo con outline
- **M6:** Sección "Listos para Entregar" prominente separada al inicio del dashboard
- **M7:** Archivar por defecto entregados/cancelados/no_reparables. Toggle "Ver archivadas"
- **M8:** Badge verde "Cliente aprobó" visible en tab diagnóstico antes de piezas pedidas

### Nuevos flujos (Fase 3)
- **M1+M2:** Búsqueda de inventario con debounce en form de piezas pedidas. Campo `precio_cliente`. Al seleccionar, pre-llena nombre + costo + precio
- **M3:** Edición inline de nombre de pieza (admin): ícono lápiz al hover, input inline, Enter/Escape/OK
- **M9:** Botón "Reingresar como Garantía" para CUALQUIER orden entregada. Form con motivo. Reutiliza `/garantia` API existente
- **M10:** Botón "Re-enviar cotización al cliente (WA)" cuando precio cambió y cliente ya había aprobado. Reset aprobación + abre WhatsApp con mensaje pre-compuesto
- **M11:** QA checklist sin bloqueo. 3 estados por ítem: sin_verificar → ok → no_aplica. Botón confirmar siempre habilitado. Solo guía visual.

### Migración BD aplicada
```sql
ALTER TABLE public.pedidos_pieza_reparacion ADD COLUMN IF NOT EXISTS precio_cliente NUMERIC(10,2);
```

### Archivos modificados
| Archivo | Cambios |
|---------|---------|
| `src/app/dashboard/reparaciones/page.tsx` | StatPills, listo_entrega section, archivar, filtros |
| `src/app/tracking/[token]/page.tsx` | clienteAprobado unificado |
| `src/components/reparaciones/ModalOrden.tsx` | Banner fallas siempre visible |
| `src/components/reparaciones/ModalQAEntrega.tsx` | Checklist flexible 3 estados |
| `src/components/reparaciones/cards/OrdenCard.tsx` | Colores borde por estado |
| `src/components/reparaciones/drawer/OrdenDrawer.tsx` | M1+M2+M3+M8+M9+M10 + sugerencias cotización |
| `src/app/api/reparaciones/[id]/pedidos-pieza/[pedidoId]/route.ts` | PATCH soporta nombrePieza |
| `src/app/api/reparaciones/[id]/renotificar-presupuesto/route.ts` | NUEVO — reset aprobación |

---

## ⚠️ PENDIENTE — Aplicar migración en Supabase (almacenaje)

**Archivo:** `supabase/migrations/fase70-almacenaje-recordatorios.sql`

Contiene:
1. `ALTER TABLE configuracion ADD COLUMN tarifa_almacenaje_diaria NUMERIC(10,2) DEFAULT 30.00`
2. `CREATE TABLE recordatorios_enviados (...)` con RLS

---

## Implementado 2026-05-13 — P3 + correcciones UX

- **P3** ✅ Prompt "¿Registrar en catálogo?" al verificar pieza sin productoId. Stock=0 (consumida). OrdenDrawer.tsx + 2 API routes.
- **refreshSilencioso** ✅ Cambiar estado de orden ya no salta al inicio de la página (sin setLoading)
- **OrdenCard fondos** ✅ listo_entrega=success-bg, esperando_piezas=warning-bg. Badge "por verificar" ahora con borde warning (no fondo sólido que se confundía)
- **ModalQAEntrega scroll** ✅ Header+footer fijos, cuerpo scrollable. Botón Confirmar siempre visible en PC

## ⏳ PENDIENTE — Plan de mejoras (aprobado, no implementado)

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| P4 | Venta de teléfonos en POS (contado vs crédito con IMEI) | Media |

---

## Reglas de negocio clave (NUNCA cambiar sin preguntar)

- Precio all-in: `precioUnitario` incluye pieza + instalación + envío
- Bolsa Virtual: anticipos independientes de caja
- Ingreso neto: `precio_total - sum(costo_pieza + costo_envio)`
- Cancelación + pieza llegó: costo de pieza SE RETIENE del anticipo
- Cancelación + pieza no llegó: se devuelve TODO el anticipo
- Pieza defectuosa: monto queda `en_disputa=true` en bolsa
- no_reparable: piezas pendientes requieren resolución manual
- **Almacenaje: 30 días gratis → tarifa diaria → 90 días → disposición (LFPC Art. 63)**
- NUNCA eliminar funcionalidades existentes — solo agregar

---

## TypeScript / Deploy

```bash
# Verificar TypeScript (desde la raíz del repo):
node "C:\Users\usuario 1\crediphone\node_modules\typescript\bin\tsc" --noEmit

# Deploy: push a master → GitHub Actions → Cloudflare Workers automático
git push origin HEAD:master
```
