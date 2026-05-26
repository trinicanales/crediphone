# Bugs Activos — CREDIPHONE
> Leer al inicio de sesión si la tarea toca BD, auth, caja o reparaciones.
> Última actualización: 2026-05-26

---

## ✅ BUG-TRACK-001 — Token de tracking no se genera si se salta estado "presupuesto"
**Estado:** ✅ Resuelto (verificado 2026-05-26)
**Solución:** `src/app/api/reparaciones/[id]/route.ts` línea ~336. Al cambiar a cualquier estado activo (excepto recibido, presupuesto, cancelado, no_reparable), se verifica si existe token y se genera automáticamente si no.

---

## ✅ BUG-TRACK-002 — Costo y cotización ocultos en tracking cuando requiereAprobacion = false
**Estado:** ✅ Resuelto (verificado 2026-05-26)
**Solución:** `clienteAprobado = aprobadoPorCliente || !requiereAprobacion` en tracking page. El costo y los servicios cotizados se muestran correctamente cuando `requiereAprobacion = false`.

---

## ✅ BUG-WA-001 — WhatsApp en OrdenCard abre sin mensaje precargado
**Estado:** ✅ Resuelto (verificado 2026-05-26)
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
