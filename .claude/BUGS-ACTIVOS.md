# Bugs Activos — CREDIPHONE
> Leer al inicio de sesión si la tarea toca BD, auth, caja o reparaciones.
> Última actualización: 2026-10-19


## ✅ BUG-ENTREGA-002 — "Entregado" asignable con el cambio de estado genérico (sin efectos de entrega)
**Severidad:** CRÍTICO | **Estado:** ✅ Resuelto 2026-10-19
**Archivos:** `src/lib/reparaciones/estados.ts` (nuevo), `src/lib/db/reparaciones.ts`, `src/app/api/reparaciones/[id]/route.ts`, `ModalCambiarEstado.tsx`, `OrdenCard.tsx`
**Causa:** `listo_entrega → entregado` estaba en el mapa de transiciones y el servidor lo aceptaba, pero ese camino no ejecuta `ejecutarEfectosEntrega()` (anticipos, caja virtual, stock, puntos, garantía, PDF).
**Solución:** `entregado` solo por `/entregar` o cobro POS; mapa de transiciones unificado en un archivo.

## ✅ BUG-TABLAS-003 — Código usando tablas inexistentes
**Severidad:** Alta | **Estado:** ✅ Resuelto 2026-10-19
`movimientos_caja`→`caja_movimientos` (anulación de anticipos; ya no borra el anticipo si falla la caja), `reparaciones`→`ordenes_reparacion` (reporte P&L), `ubicaciones`→`ubicaciones_inventario` (verificaciones).

## ✅ SEG-PAYJOY-004 — Rutas `/api/payjoy/*` sin autenticación
**Severidad:** CRÍTICO | **Estado:** ✅ Neutralizado 2026-10-19 (módulo apagado por decisión de Trini, no borrado)
Bandera `FEATURES.payjoy=false` en `src/lib/features.ts`. **Antes de reactivar PayJoy hay que autenticar las rutas (admin).** Mismo criterio para Facturación (`FEATURES.facturacion`).

## ✅ PIEZAS-005 — Panel "Piezas por pedir" sin acciones
**Estado:** ✅ Resuelto 2026-10-19 — botones "Ya la pedí" y "Cancelar pieza" + antigüedad por pedido.

## 🟡 PENDIENTES NUEVOS (no corregidos)
- Cancelación de orden: `caja_movimientos.tipo = 'entrada_efectivo'` viola el CHECK → cargo de cancelación no llega a caja.
- `getAuthContext()` no revisa `users.activo`.
- 21 rutas `[id]` sin filtro por franquicia; OC acepta cualquier estado; RPC de comisión abiertas a `anon`. Detalle completo en `.claude/SESION-ACTIVA.md` (sección 2026-10-14→19) y `.claude/AUDITORIA-2026-10-14.md`.

---

---

## ✅ BUG-ENTREGA-001 — Entrega de reparación (POS y flujo directo) fallaba en silencio
**Severidad:** CRÍTICO | **Estado:** ✅ Resuelto y desplegado a master 2026-07-24 (commit `e15b239`)
**Archivos:** `src/app/api/pos/reparacion-cobro/route.ts`, `src/app/api/reparaciones/[id]/entregar/route.ts`
**Causa:** El UPDATE a `ordenes_reparacion` usaba el campo `fecha_entrega`, que no existe en la tabla (el real es `fecha_entregado`). Supabase rechazaba el UPDATE, pero el código igual respondía `success: true` al frontend — el empleado veía "entregado" en pantalla mientras la orden se quedaba atorada en `listo_entrega` sin aplicar anticipo, bolsa virtual, stock ni puntos.
**Impacto medido antes del fix:** 47 órdenes atoradas, 109 anticipos nunca aplicados, tabla `movimientos_bolsa_virtual` completamente vacía.
**Backfill ejecutado en Supabase:** 10 órdenes confirmadas pagadas al 100% se pasaron a `entregado` con todos sus efectos secundarios (anticipo aplicado, bolsa virtual, puntos, historial).
**Pendiente de decisión de Trini (NO tocado, requiere su criterio):**
- `ORD-20260530-0005` — precio_total = $0, sin anticipos
- `ORD-20260511-0003`, `ORD-20260629-0002`, `ORD-20260707-0002` — anticipos que exceden el precio_total (posible sobrepago o error de captura)

---

## ✅ BUG-PIEZAS-002 — Piezas al proveedor: sin cancelación individual ni auto-transición
**Severidad:** Media | **Estado:** ✅ Resuelto y desplegado a master 2026-07-24 (commit `e15b239`)
**Archivos:** `src/app/api/reparaciones/[id]/pedidos-pieza/[pedidoId]/route.ts` (nuevo DELETE), `src/lib/db/reparaciones.ts` (nueva función `checkYTransicionarEsperandoPiezas()`), `src/app/api/reparaciones/[id]/pedidos-pieza/[pedidoId]/verificar/route.ts`, `src/components/reparaciones/drawer/OrdenDrawer.tsx` (botón "Cancelar")
**Causa:** No existía forma de cancelar un pedido de pieza individual (solo se podían cancelar todos al cancelar la orden completa), y una orden en `esperando_piezas` no salía de ese estado automáticamente aunque todas sus piezas ya estuvieran resueltas — requería que un humano cambiara el estado a mano.
**Solución:** DELETE nuevo con reversa de bolsa virtual (movimiento negativo compensatorio) + auto-transición a `en_reparacion` cuando todas las piezas de la orden quedan en estado final (instalada/defectuosa/cancelada).

---

## ✅ UX-CLIENTES-001 — Selector de cliente sin buscador en creación/edición de orden
**Severidad:** Media (riesgo de clientes duplicados) | **Estado:** ✅ Resuelto y desplegado a master 2026-07-24 (commit `e15b239`)
**Archivos:** `src/components/reparaciones/ModalOrden.tsx` (crear orden), `src/components/reparaciones/ModalEditarOrden.tsx` (editar orden / cambiar cliente asignado)
**Causa:** Ambos formularios usaban un `<select>` plano listando los 139 clientes sin orden alfabético ni buscador — difícil encontrar un cliente que ya había venido antes, con riesgo de crear un cliente duplicado.
**Solución:** Combobox con input de búsqueda (filtra por nombre o teléfono), resultados ordenados alfabéticamente, capado a 50 resultados visibles.

---

## ✅ UX-VISUAL-001 — Texto invisible en hover del checklist de condiciones del equipo
**Severidad:** Baja | **Estado:** ✅ Resuelto y desplegado a master 2026-07-24 (commit `e15b239`)
**Archivo:** `src/components/reparaciones/condiciones/IconosFuncionamiento.tsx`
**Causa:** El color del texto no consideraba el estado `hovered`, quedando del mismo color que el fondo al pasar el mouse (texto invisible).

---

## ✅ SYNC-DRAWER-001 — OrdenDrawer no avisaba al dashboard tras editar datos
**Severidad:** Media | **Estado:** ✅ Resuelto y desplegado a master 2026-07-24 (commit `e15b239`)
**Archivo:** `src/components/reparaciones/drawer/OrdenDrawer.tsx`
**Causa:** 6 acciones dentro del Drawer (editar nombre de pieza, crear/vincular producto a inventario, editar "Problema Reportado", editar "Notas Internas", guardar cotización de piezas editada) actualizaban solo su estado local y nunca llamaban `onRefresh()` — la card/lista del dashboard no se enteraba del cambio hasta un refresh manual.
**Solución:** Las 6 acciones ahora llaman `onRefresh()` tras guardar exitosamente.

---

## 🟡 PENDIENTE — Recomendación sin implementar: integración diagnóstico ↔ piezas al proveedor
**Estado:** 🟡 Investigado, NO implementado — pendiente de decisión de Trini
Hoy el diagnóstico técnico (`partes_reemplazadas` JSONB en `ordenes_reparacion`) y "piezas por pedir al proveedor" (`pedidos_pieza_reparacion`) viven desconectados — un técnico puede registrar una parte a reemplazar en el diagnóstico sin que se cree un pedido, o duplicar un pedido sin darse cuenta de que ya existe uno. También se identificó que no existe autocompletar/sugerencia de precio para una "pieza libre" (sin catálogo) basado en el historial de la misma marca/modelo de dispositivo — viable con la data actual (`piezas_cotizacion` JSONB + `marca_dispositivo`/`modelo_dispositivo`), pero requeriría una tabla desnormalizada o nuevo endpoint para no depender de queries JSONB lentas.

---

## ✅ BUG-TRACK-001 — Token de tracking no se genera si se salta estado "presupuesto"
**Severidad:** Alta | **Estado:** ✅ Resuelto (verificado 2026-05-26)
**Solución:** `src/app/api/reparaciones/[id]/route.ts` línea ~336. Al cambiar a cualquier estado activo (excepto recibido, presupuesto, cancelado, no_reparable), se verifica si existe token y se genera automáticamente si no.

---

## ✅ BUG-TRACK-002 — Costo y cotización ocultos en tracking cuando requiereAprobacion = false
**Severidad:** Media | **Estado:** ✅ Resuelto (verificado 2026-05-26)
**Solución:** `clienteAprobado = aprobadoPorCliente || !requiereAprobacion` en tracking page. El costo y los servicios cotizados se muestran correctamente cuando `requiereAprobacion = false`.

---

## ✅ BUG-WA-001 — WhatsApp en OrdenCard abre sin mensaje precargado
**Severidad:** Media | **Estado:** ✅ Resuelto (verificado 2026-05-26)
**Solución:** `OrdenCard.tsx` usa `generarLinkWhatsApp(orden.clienteTelefono, generarMensajeSeguimiento(orden))` en `PhoneMenu`.

---

## ✅ BUG-PIEZAS-001 — PiezasPendientesPanel sin botón WhatsApp por pieza
**Estado:** ✅ Resuelto (sesión 2026-05-21, P6)
**Solución:** `PiezasPendientesPanel.tsx` tiene botón WA por pieza usando `generarMensajePiezaEnEspera()`. También tiene botón WA al proveedor desde la API `/api/reparaciones/piezas-pendientes`.

---

## ✅ DEPLOY-BUG-006 — useSearchParams rompe build Turbopack
**Severidad:** CRÍTICO | **Estado:** ✅ Resuelto 2026-05-09
**Páginas afectadas:** `/dashboard/productos/page.tsx`, `/dashboard/reparaciones/page.tsx`
**Causa:** Turbopack 16.2.1 detecta `useSearchParams()` en análisis estático de build aunque esté en `"use client"` y aunque esté envuelto en `<Suspense>` en el mismo archivo. `export const dynamic = "force-dynamic"` tampoco funciona.
**Solución:** `window.location.search` dentro de `useEffect` con `useRef` para ejecutar solo una vez. Ver `.claude/DEPLOY.md` sección DEPLOY-BUG-006.
**Regla permanente:** NUNCA usar `useSearchParams()` en `page.tsx` en este proyecto.

---

## ✅ BUG-COBRO-001 — "Orden no encontrada" al cobrar reparación desde POS
**Severidad:** CRÍTICO | **Estado:** ✅ Resuelto 2026-05-09
**Archivo:** `src/app/api/pos/reparacion-cobro/route.ts`
**Causa:** El SELECT incluía columna `presupuesto_total` que no existe en `ordenes_reparacion`. PostgREST devolvía error → el código lo interpretaba como 404 "Orden no encontrada".
**Solución:** Removida `presupuesto_total` del SELECT y del fallback. Solo usa `precio_total || costo_total`.

---

## ✅ SECURITY-003 — wa_access_token cifrado
**Severidad:** RESUELTO
**Estado:** ✅ Implementado 2026-05-01

Cifrado AES-256-GCM aplicado al `wa_access_token` en `configuracion`.
Llave almacenada en Cloudflare secret `WA_ENCRYPTION_KEY`.
El frontend nunca recibe el token (retorna `undefined` en `configuracion.ts`).

---

## ✅ Resueltos recientemente (referencia rápida)

### Resueltos en sesión 2026-04-12
- **costo_total GENERATED ALWAYS** ✅ — eliminado de todos los INSERT/UPDATE en `reparaciones.ts`
- **PDF "orden no encontrada"** ✅ — join `tecnico_id` corregido a columna `name` (no `nombre/apellido`)
- **PDF error silencioso** ✅ — ahora muestra el error real al usuario
- **presupuestoTotal no mapeado** ✅ — `precio_total` ahora se mapea en `mapOrdenFromDB`
- **Ticket QR subía fotos** ✅ — ahora apunta a `/reparacion/{folio}` (consulta/entrega)

### Resueltos en sesión 2026-04-06
- RLS-001 ✅ — 17 políticas RLS cross-tenant corregidas
- PAGES-002 ✅ — Race condition en fetches (5 páginas corregidas)
- DB-002 ✅ — `servicios.distribuidor_id` NOT NULL aplicado

### Historial completo
Ver `ARCHIVO/BUGS-RESUELTOS.md`
- CAJA-001, CAJA-002 ✅ commit feedae4
- MULTITENANT-001 a 007 ✅ commits feedae4, 2026-03-29
- REACT-301 ✅ commit 8530a69
- SECURITY-001, 002 ✅ commit 7a5e4f5
- DOCBUG-001, 002, 003 ✅ sesión 2026-03-29
