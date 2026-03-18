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
| 27 | Campos equipo en productos (imei, color, ram, almacenamiento, folio_remision) + parser WINDCEL + PDF remisión | — |
| 34 | Tarjetas interactivas + Drawer lateral en reparaciones | — |
| 34b | Modal mixto + esperando_piezas + overdue WhatsApp | — |
| 36 | (ver historial) | — |
| 37 | (ver historial) | — |
| 38 | (ver historial) | — |
| 39 | Sistema de autorización de descuentos: zonas verde/amarillo/rojo, polling, WhatsApp token, panel admin, config | `614ede1` |
| SEC | SECURITY-001 + SECURITY-002: 17 API routes con auth + multi-tenant reportes | `7a5e4f5` |
| REACT-001 | 12 errores críticos ESLint: vars before declare, setState en effects, mutación state, Date.now en render, JSX quotes | `1085bd5` |
| Sesión Visual | Íconos corregidos (7) + Sidebar reorganizado en 7 grupos | `sesion-visual` |
| 40 | Conteo ciego, fondo fijo, Pay In/Out, tolerancia descuadre, alerta admin | `68ae3fc` |

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

### 📊 FASE 41 — ✅ COMPLETADA (commit `cf1b789`, 2026-03-18)
Bolsa virtual de reparaciones en caja: `sesion_caja_id` en `anticipos_reparacion`, `getAnticiposBySesion()`, `getAnticiposSinSesion()` (anti-fraude), sección "Bolsa de Reparaciones" en vista sesión activa, banner de anticipos sin sesión para admin/super_admin.

---

### 🔄 FASES FUTURAS (en orden)
- FASE 42: Sidebar reorganización (ver arriba)
- FASE 43: Aging report + tasa de mora real
- FASE 44: Dashboard ejecutivo por rol (widgets distintos por rol)
- FASE 45: Notificaciones WhatsApp automáticas por cambio estado reparación
- FASE 46: Órdenes de compra a proveedores
- FASE 47: Facturación CFDI (integración Facturapi)
- FASE 48: Portal de tracking de reparaciones para cliente final
- FASE 49: Exportar cualquier tabla a CSV/Excel
- FASE 50: P&L básico mensual

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

*Última actualización: 2026-03-18 — Trini + Claude (FASE 41: bolsa virtual reparaciones en caja, anticipos sin sesión anti-fraude)*
