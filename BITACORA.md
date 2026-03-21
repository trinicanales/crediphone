# BITÁCORA DE DESARROLLO — CREDIPHONE
> **Para Claude:** Este es el PRIMER archivo que debes leer al inicio de cada sesión, ANTES que CLAUDE.md.
> Aquí está el estado real del proyecto: qué funciona, qué está roto, qué sigue.
> Si no ves instrucciones de sesión aquí, pídele a Trini que te diga en qué fase vas.

---

## 🔴 BUGS CRÍTICOS ACTIVOS — NO TOCAR HASTA RESOLVERLOS

### [SECURITY-001] 17 API Routes sin autenticación propia
**Severidad:** CRÍTICA
**Detectado:** 2026-03-18
**Estado:** ✅ RESUELTO — commit `7a5e4f5` (2026-03-18)
**Solución:** Creado `src/lib/auth/guard.ts` con helper `requireAuth(roles?)`.
Aplicado a las 17 rutas. tsc --noEmit: LIMPIO.

---

### [SECURITY-002] Multi-tenant roto en Reportes
**Severidad:** CRÍTICA
**Detectado:** 2026-03-18
**Estado:** ✅ RESUELTO — commit `7a5e4f5` (2026-03-18)
**Solución:** `/api/reportes/route.ts`, `/api/reportes/comisiones/route.ts` y
`/api/reportes/pdf/route.ts` ahora filtran por `distribuidor_id` cuando
el usuario no es super_admin.

---

### [REACT-001] 27 errores de ESLint — React/lógica
**Severidad:** ALTA
**Estado:** ✅ RESUELTO — commit `1085bd5` (2026-03-18)
**Archivos con errores CRÍTICOS (no solo warnings):**

| Archivo | Error | Impacto |
|---|---|---|
| `src/components/inventario/BarcodeScanner.tsx:32` | `stopCamera` usada antes de declarar | Crash en cleanup de cámara |
| `src/components/pos/ProductSearchBar.tsx:38` | Variable accedida antes de declarar | Comportamiento indefinido |
| `src/components/pos/PaymentMethodSelector.tsx:39` | Variable accedida antes de declarar | Comportamiento indefinido |
| `src/components/reparaciones/patron/CapturaPatron.tsx:37` | Mutación directa de valor inmutable | Error silencioso en React 19 |
| `src/components/reparaciones/cards/OrdenCard.tsx:185` | `Date.now()` llamado en render | Inconsistencia en hydration |
| `src/components/DistribuidorProvider.tsx:67` | `setState` síncrono en efecto | Renders en cascada, UI parpadea |
| `src/components/layout/DashboardShell.tsx:38` | `setState` síncrono en efecto | Renders en cascada |
| `src/components/layout/Header.tsx:16` | `setState` síncrono en efecto | Renders en cascada |
| `src/components/ui/Portal.tsx:16` | `setState` síncrono en efecto | Modales pueden parpadear |
| `src/components/reparaciones/confirmaciones/PanelConfirmacionesDeposito.tsx:279` | `setState` síncrono en efecto | Renders en cascada |
| `src/components/reparaciones/firma/SelectorTipoFirma.tsx:32` | `setState` síncrono en efecto | Renders en cascada |
| `src/app/catalogo/page.tsx:909,986` | Comillas sin escapar en JSX | Hydration error en prod |

**Warnings recurrentes (no bloquean pero deben resolverse):**
- 12 componentes con `useEffect` sin dependencias correctas (`react-hooks/exhaustive-deps`)
- 7 imágenes usando `<img>` en lugar de `<Image />` de Next.js (performance)

---

## ✅ FASES COMPLETADAS (no rehacer)

| Fase | Descripción | Commit |
|---|---|---|
| 1-10 | CRUD base: clientes, créditos, pagos, productos, empleados, reparaciones | — |
| 11-15 | POS, caja, inventario avanzado, scoring, recordatorios | — |
| 16-19 | Reparaciones avanzadas: fotos QR, piezas, garantías, anticipos, PDFs | — |
| 20 | Integración Payjoy: webhooks, sync pagos, panel config | — |
| 21 | Multi-tenant: tabla distribuidores, distribuidor_id en todas las tablas | — |
| 22-23 | Cartera vencida, recálculo mora automático | — |
| 24 | Solicitudes y garantías de piezas | — |
| 25 | Caja con distribuidor nullable | — |
| 26 | users.distribuidor_id nullable + fix crear empleados | — |
| 27 | Campos equipo en productos (imei, color, ram, almacenamiento, folio_remision) + parser WINDCEL + PDF remisión | `edf2b37` |
| 28 | POS + Caja unificados: modal abrir/cerrar turno desde POS, aviso si otro empleado tiene caja abierta, badge de estado en header | `6a73b96` |
| 29 | POS dual mode — Standard (F-keys: F3 búsqueda, F4 cantidad, F9/F10 cobro) + Visual (grid por categoría, touchscreen) | `f69e173`, `0952bbf` |
| 30 | Selección cliente en POS + captura IMEI al vender equipo serializado + notas por venta/ítem + alertas demanda | `32ddc77`, `4ba6a5b` |
| 31 | Reporte X (snapshot turno sin cerrar) + Reporte Z (cierre formal PDF) + exportar cualquier tabla a Excel | `b91e299` |
| 32 | Tickets térmicos 58mm en todos los módulos (venta POS, recepción reparación con QR, entrega, pago crédito) | `5fe292a` |
| 33 | Devoluciones parciales por línea en POS + pedidos flotantes (venta en espera) + regla Payjoy + config extendida | `db0b158`, `4ff9c6e` |
| 34 | Tarjetas interactivas + Drawer lateral en reparaciones | `68afa8d` |
| 34b | Modal mixto + esperando_piezas + overdue WhatsApp | `98c9032` |
| 36 | Servicios sin inventario — POS integrado con carrito mixto productos+servicios + categorías dinámicas | `4bc4c50` |
| 37 | Control de traspasos anticipo técnico → vendedor (anti-fraude) | `07c89a8` |
| 38 | Confirmación de depósitos/transferencias | `97f5592` |
| 39 | Sistema de autorización de descuentos: zonas verde/amarillo/rojo, polling, WhatsApp token, panel admin, config | `614ede1` |
| SEC | SECURITY-001 + SECURITY-002: 17 API routes con auth + multi-tenant reportes | `7a5e4f5` |
| REACT-001 | 12 errores críticos ESLint: vars before declare, setState en effects, mutación state, Date.now en render, JSX quotes | `1085bd5` |
| Sesión Visual | Íconos corregidos (7) + Sidebar reorganizado en 7 grupos | `a05a948` |
| 40 | Conteo ciego, fondo fijo, Pay In/Out, tolerancia descuadre, alerta admin | `68ae3fc` |
| 44 | Dashboard ejecutivo por rol (widgets distintos: admin ve KPIs completos, vendedor ve su turno, técnico sus órdenes) | `1ede15d` |
| 45 | Sistema WhatsApp — plantillas configurables + notificaciones automáticas por cambio estado reparación | `63a8808` |
| 46 | Órdenes de Compra a Proveedores — flujo completo con recepción de mercancía y actualización de stock | `2ee1daf` |
| 47-lite | Resumen para contador — descarga PDF/WhatsApp con ingresos del período configurable | `a97b166` |
| 48 | Portal de tracking de reparaciones para cliente final (link público por orden) | `9892e0e` |
| 49 | Exportar tablas a CSV — créditos, pagos, clientes, reparaciones | `3e3ebef` |
| 50 | P&L básico mensual: Estado de Resultados en Reportes (ingresos − costos = utilidad) | `a643108` |
| Iconos-1 | Iconos PNG en checklist condiciones reparación + campo centroCarga | `bf29094` |
| Iconos-2 | Marco+Bisel unificados en un botón + todos los iconos PNG en estado físico | `90a8dd9` |
| Iconos-3 | Iconos contenidos en su cuadro (overflow-hidden + fill) en ambos grids | `366f22c` |
| Iconos-4 | Iconos nuevos (apagado, mojado, batería hinchada, QR, subir-foto) + nombres cortos en componentes | `fa99d25` |
| 35 | Centro de Promociones con opt-in seguro + tracking page con promos reales desde BD | `130e934`, `956e207` |
| 41+ | Tab "Cobrar Rep." en POS: buscador, anticipo, cobro final, auto-entrega saldo=$0 | `b540863` |
| 42+ | Sistema Lotes de Piezas: tabla BD, recepción, verificación, distribución costo envío | `36a0994` |
| 51 | Sidebar reorganizado en 8 grupos funcionales por prioridad de negocio | — |
| 52 | Liquid Glass en íconos del sidebar | — |
| 53 | Dashboard Ejecutivo Persistente — Command Center con auto-refresh 3min | `25205bf` |
| FIX | Hydration mismatch WhatsApp + async params Next.js 15/16 en lotes-piezas | `6d22fe4` |

---

## ⏳ PLAN DE ACCIÓN — PRÓXIMAS SESIONES

### 🔧 SESIÓN INMEDIATA PENDIENTE: Seguridad + React
**Lo que debes decirle a Claude:**
> "Lee BITACORA.md. Vamos a corregir SECURITY-001, SECURITY-002 y REACT-001. Empieza por las 17 routes sin auth, luego los errores de React críticos."

**Orden de trabajo:**
1. Crear helper `requireAuth(roles?)` en `src/lib/auth/guard.ts`
2. Aplicar a las 17 routes en orden: pagos → creditos → empleados → productos → reportes → reparaciones → resto
3. Corregir 7 errores React críticos (variables antes de declarar, setState en effects)
4. Ejecutar `tsc --noEmit` y `eslint` al final para verificar

---

### 🎨 SESIÓN VISUAL: Íconos + Sidebar
**Lo que debes decirle a Claude:**
> "Lee BITACORA.md. Sesión de UX: corrige los 5 íconos críticos en Sidebar.tsx y reorganiza el sidebar de 25 ítems a 7 grupos con separadores."

**Cambios específicos de íconos (Sidebar.tsx):**
```
MapPin       → ClipboardCheck      (Inventario/verificar)
AlertTriangle (×2) → CalendarX2 y PackageX  (Cartera Vencida / Alertas Stock)
Settings     → Cpu                 (Técnico panel)
ShoppingCart → Store               (POS)
DollarSign   → BadgeDollarSign     (Comisiones)
Landmark     → Vault               (Caja)
Layers       → WarehouseIcon       (Ubicaciones)
```

**Reorganización sidebar (25 ítems → 7 grupos):**
```
── INICIO ──────────────────────────
  Dashboard
  Distribuidores (solo super_admin)

── VENTAS ──────────────────────────
  POS — Venta
  Caja / Turno
  Historial Ventas
  Payjoy

── CRÉDITOS Y CLIENTES ─────────────
  Clientes
  Créditos
  Cobros y Pagos
  Recordatorios

── INVENTARIO ──────────────────────
  Catálogo (Productos + Categorías + Proveedores como tabs)
  Stock y Ubicaciones (Verificar + Ubicaciones + Alertas como tabs)

── REPARACIONES ────────────────────
  Órdenes
  Panel Técnico (antes: KPI Reparaciones + Técnico)

── REPORTES ────────────────────────
  Reportes Financieros
  Cartera y Mora

── ADMINISTRACIÓN ──────────────────
  Empleados
  Configuración
```

---

### 📊 FASE 40 — ✅ COMPLETADA (commit `68ae3fc`, 2026-03-18)
Conteo ciego por denominaciones, fondo fijo configurable, Pay In/Out, tolerancia descuadre, alerta admin si descuadre > tolerancia.

---

### 📊 FASE 35 — ✅ COMPLETADA (commits `130e934` + `956e207`, 2026-03-19)
Centro de Promociones con opt-in seguro: tabla `promociones`, CRUD admin, consentimiento presencial WhatsApp, endpoint público `/api/tracking/[token]/promociones`, integración en tracking page con promo cards dinámicas (descuento %, botón WhatsApp contextual).

---

### 📊 FASE 41 — ✅ COMPLETADA (commits `cf1b789` + `b540863`)
- Bolsa virtual de reparaciones en caja: `sesion_caja_id` en `anticipos_reparacion`, `getAnticiposBySesion()`, `getAnticiposSinSesion()` (anti-fraude), sección "Bolsa de Reparaciones" en vista sesión activa, banner de anticipos sin sesión para admin/super_admin.
- Tab "Cobrar Rep." en POS (`b540863`, 2026-03-21): `ReparacionesPOSPanel.tsx`, búsqueda por folio/cliente/teléfono, modal anticipo, modal cobro final, auto-estado "entregado" cuando saldo=$0. APIs: `/api/pos/reparacion-buscar` y `/api/pos/reparacion-cobro`.

---

### 📊 FASE 42 — ✅ COMPLETADA (commits `a4f78c8` + `36a0994`)
- Sidebar con acordeones colapsables: NavAccordion + AccordionNavItem. INVENTARIO colapsado en 2 grupos (Catálogo + Stock), REPARACIONES panel por rol, REPORTES simplificado.
- Sistema Lotes de Piezas (`36a0994`, 2026-03-21): tablas `lotes_piezas` + `lotes_piezas_items` (migración `fase42_lotes_piezas_v2` aplicada en Supabase). `src/lib/db/lotes-piezas.ts`, 5 rutas API, página `/dashboard/lotes-piezas`, `distribuirCostoEnvio()` proporcional. Sidebar: ícono Package en grupo INVENTARIO. FK correcta: `ordenes_reparacion` (NO `reparaciones`).

---

### 📊 FASE 43 — ✅ COMPLETADA (commit `72bff11`, 2026-03-18)
Aging report + tasa de mora real: `/api/creditos/aging` con 6 buckets (corriente/1-30/31-60/61-90/91-120/+120), tasaMoraConteo, tasaMoraMonto, moraAcumulada. UI: panel sobre la lista con KPIs + tabla de buckets color-coded.

---

### 📊 FASE 51 — ✅ COMPLETADA
Sidebar reordenado por prioridad de negocio en 8 grupos funcionales.

---

### 📊 FASE 52 — ✅ COMPLETADA
Liquid Glass en íconos del sidebar: backdrop-filter, glow activo.

---

### 📊 FASE 53 — ✅ COMPLETADA (commit `25205bf`)
Dashboard Ejecutivo Persistente: Command Center para admin/super_admin, KPIs en tiempo real, OrdenesWidget, AccionesRápidas, ActivityStream, auto-refresh 3 min.

---

### 🔧 FIX — hydration mismatch + async params (commit `6d22fe4`, 2026-03-21)
- Footer, CarritoFlotante, FormularioCotizacion: número WhatsApp unificado a `NEXT_PUBLIC_WHATSAPP_SOPORTE || "526181245391"` (eliminado placeholder `5215512345678`)
- Rutas API `lotes-piezas/[id]` y subrutas: params migrados a `Promise<{...}>` (Next.js 15/16)

---

### 🔄 FASES PENDIENTES (no iniciadas — esperar indicación de Trini)
- FASE 54: Facturación CFDI (integración Facturapi)
- FASE 55: Control de asistencia / reloj checador por QR o PIN
- FASE 56: WhatsApp Business API oficial (plantillas aprobadas Meta, historial, doble tick)
- FASE 57: Links de pago (Clip, Conekta) — enviar link de cobro al cliente por WhatsApp

---

## 📋 PROTOCOLO DE INICIO DE SESIÓN — Lo que Trini dice y Claude hace

### Frase de inicio que Trini debe usar:
```
"Lee BITACORA.md. [Objetivo de la sesión]."
```

### Lo que Claude DEBE hacer al leer eso:
1. Leer `BITACORA.md` (este archivo)
2. Leer `CLAUDE.md` (arquitectura del sistema)
3. Leer `NOTAS_TRINI.md` si la sesión involucra caja, reparaciones, o reglas de negocio
4. Hacer `git status` para ver qué hay sin commitear
5. Hacer `npx tsc --noEmit` para verificar que no hay errores TypeScript activos
6. Reportar a Trini: "Estoy listo. El estado actual es: [X bugs activos / Y errores TS / todo limpio]"
7. NUNCA empezar a codificar sin este chequeo

### Al TERMINAR cada sesión, Claude debe:
1. Actualizar BITACORA.md: mover tareas de PENDIENTE a COMPLETADO
2. Agregar nuevos bugs encontrados a la sección BUGS CRÍTICOS
3. Hacer `npx tsc --noEmit` y reportar resultado
4. Hacer el commit con el mensaje de fase correcto
5. Decirle a Trini: "Sesión terminada. [Resumen de lo hecho]. Próxima sesión: [qué sigue]."

---

## 🗂️ MAPA DE ARCHIVOS IMPORTANTES

| Archivo | Para qué leerlo |
|---|---|
| `BITACORA.md` | Estado actual del proyecto, bugs activos, plan de acción |
| `CLAUDE.md` | Arquitectura técnica, stack, convenciones de código |
| `NOTAS_TRINI.md` | Reglas de negocio, lógica de caja, bolsa virtual, anti-fraude |
| `src/lib/auth/server.ts` | Cómo funciona `getAuthContext()` — leer SIEMPRE antes de tocar auth |
| `src/types/index.ts` | Todos los tipos TypeScript — leer antes de crear tipos nuevos |
| `src/components/layout/Sidebar.tsx` | Navegación — leer antes de agregar rutas |
| `src/app/dashboard/configuracion/page.tsx` | Cómo agregar configuraciones nuevas |

---

## 📌 DECISIONES TÉCNICAS PERMANENTES (no revertir)

1. **Auth:** Siempre `getAuthContext()`, nunca `getDistribuidorId()` solo
2. **DB Server-side:** Siempre `createAdminClient()`, nunca `createClient()` en API routes
3. **Multi-tenant:** Toda tabla nueva necesita `distribuidor_id`
4. **Sidebar:** Usar `var(--color-...)` CSS tokens, NUNCA clases Tailwind de color directo
5. **Fuentes:** Geist (`--font-ui`), Geist Mono (`--font-data`), JetBrains Mono (`--font-mono`). NUNCA Inter
6. **Números/IMEIs/folios:** SIEMPRE `font-mono` en el UI
7. **Proxy/Middleware:** El archivo se llama `src/proxy.ts` (no `middleware.ts`) y la función se llama `proxy`
8. **Commits:** Formato `FASE XX: descripción concisa` o `fix: descripción`
9. **Checklist antes de terminar sesión:** `npx tsc --noEmit` debe pasar limpio

---

## 🧠 CONTEXTO QUE CLAUDE PIERDE ENTRE SESIONES

Claude no tiene memoria entre conversaciones. Cada sesión nueva empieza desde cero.
Por eso existe este archivo. Si algo importante pasa en una sesión (nueva decisión, bug nuevo, cambio de plan), **Trini debe pedirle a Claude que actualice BITACORA.md antes de terminar**.

**Qué información recupera Claude leyendo BITACORA.md + CLAUDE.md + NOTAS_TRINI.md:**
- ✅ Estado real del proyecto
- ✅ Bugs activos y severidad
- ✅ Qué fases están hechas
- ✅ Qué sigue en orden de prioridad
- ✅ Reglas de negocio críticas (anti-fraude, bolsa virtual)
- ✅ Decisiones técnicas que no se deben cambiar
- ✅ Qué archivos leer antes de tocar qué módulo

**Qué NO recupera (limitación real):**
- ❌ Código exacto que se escribió en sesiones anteriores (debe leer los archivos)
- ❌ Conversaciones previas (debe inferirlas del código)
- ❌ Tono de la sesión anterior

---

*Última actualización: 2026-03-21 — Trini + Claude (FASE 35 registrada, FASES 41+42 extendidas con trabajo de sesión, FASES 51-53 marcadas como completadas, fix hydration/async params registrado)*
