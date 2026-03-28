# CREDIPHONE — Memoria del Proyecto para Claude

## ¿Qué es CREDIPHONE?

Sistema administrativo completo para **tiendas de crédito de celulares y electrónicos** en México.
Permite gestionar créditos, ventas en POS, pagos, reparaciones, inventario, empleados y reportes.
Es multi-tenant: un super_admin gestiona múltiples distribuidores (tiendas franquiciadas).

---

## Stack Técnico

| Componente | Tecnología |
|---|---|
| Framework | Next.js 15 App Router |
| Lenguaje | TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Estilos | Tailwind CSS |
| UI Components | Componentes propios en `src/components/ui/` |
| Tema | next-themes (defaultTheme: "light", enableSystem: true) |
| **Deploy** | **Cloudflare Workers** vía `@opennextjs/cloudflare` (antes: Vercel) |
| **Storage** | **Cloudflare R2** bucket `crediphone-storage` binding `R2_BUCKET` |

### Deploy a Cloudflare (migrado 2026-03-25)

```bash
# Desde el directorio del proyecto — requiere token de Cloudflare
CLOUDFLARE_API_TOKEN=<token> npx opennextjs-cloudflare build
CLOUDFLARE_API_TOKEN=<token> npx opennextjs-cloudflare deploy
# O combinado:
npm run deploy:cf   # requiere wrangler autenticado localmente
```

- **Worker name:** `crediphone` → `https://crediphone.com.mx`
- **Token para deploy:** `crediphone-wrangler-deploy` en dash.cloudflare.com/profile/api-tokens
- **Cuenta Cloudflare:** `5a93cb5abe3296c3514fa68939da455f` (trinicanales@gmail.com)
- **R2 URL pública:** `https://pub-89451411d31c49d9959b166475cda47a.r2.dev`
- **PROBLEMA:** `wrangler login` no persiste entre sesiones de Cowork VM. Usar `CLOUDFLARE_API_TOKEN` explícito.
- **VARIABLES `NEXT_PUBLIC_*`** se inyectan en **build time** desde `.env.local`. No se pueden sobreescribir en runtime desde `wrangler.jsonc [vars]`. Si cambian → rebuildar.
- **`.env.local` actualizado 2026-03-28:** `NEXT_PUBLIC_BASE_URL` y `NEXT_PUBLIC_APP_URL` corregidos a `https://crediphone.com.mx` (antes apuntaban a `localhost:3000`, lo que rompía links de WhatsApp/tracking).

---

## Arquitectura Multi-Tenant (FASE 21)

- Cada **distribuidor** es una tienda independiente con su propio conjunto de datos
- La tabla `distribuidores` tiene `id`, `nombre`, `slug`, `activo`, `configuracion`
- Casi todas las tablas tienen columna `distribuidor_id` como FK
- **super_admin** tiene `distribuidor_id = NULL` en `public.users` → ve TODOS los datos de todos los distribuidores
- **admin/vendedor/cobrador/tecnico** tienen `distribuidor_id` de su tienda → solo ven datos de su distribuidor

### Patron de Auth en API Routes

```typescript
// SIEMPRE usar getAuthContext() para API routes nuevas
import { getAuthContext } from "@/lib/auth/server";

const { userId, role, distribuidorId, isSuperAdmin } = await getAuthContext();
if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

// Para filtrar por distribuidor:
const filterDistribuidorId = role === "super_admin" ? undefined : (distribuidorId ?? undefined);
```

### Cliente de Supabase

- **Server-side (API routes, Server Components):** `createAdminClient()` de `@/lib/supabase/admin` — usa service_role, bypassea RLS
- **Client-side (Client Components):** `createClient()` de `@/lib/supabase/server` — respeta RLS

---

## Roles de Usuario

### `super_admin`
**Propósito:** Dueño/operador de toda la red. Gestiona múltiples distribuidores.

**Lo que puede hacer:**
- Todo lo que puede hacer un admin
- Ver datos de TODOS los distribuidores simultáneamente
- Crear, editar, activar/desactivar distribuidores (`/dashboard/admin/distribuidores`)
- Ver reportes globales de toda la red
- Configurar el sistema

**Características técnicas:**
- `distribuidor_id = NULL` en tabla `users`
- Las queries sin `filterDistribuidorId` devuelven datos de TODOS los distribuidores
- Aparece en sidebar: link "Distribuidores" (solo para super_admin)

**Páginas accesibles:**
- Todo el sistema sin excepción

---

### `admin`
**Propósito:** Gerente de una tienda/distribuidor. Tiene control total de SU tienda.

**Lo que puede hacer:**
- Gestionar clientes de su tienda
- Crear/editar/ver créditos de su tienda
- Ver y registrar pagos
- Gestionar productos e inventario de su tienda
- Usar POS y caja registradora
- Ver historial de ventas
- Gestionar empleados de su tienda (crear, editar, desactivar)
- Ver y gestionar reparaciones
- Ver KPIs de reparaciones
- Ver reportes de su tienda
- Ver comisiones de vendedores
- Enviar recordatorios de pago
- Configurar el sistema de su tienda (módulos, comisiones, mora, etc.)
- Ver cartera vencida

**Páginas accesibles:**
```
/dashboard
/dashboard/clientes
/dashboard/creditos
/dashboard/creditos/cartera-vencida
/dashboard/creditos/[id]
/dashboard/pagos
/dashboard/productos
/dashboard/admin/categorias
/dashboard/admin/proveedores
/dashboard/pos
/dashboard/pos/caja
/dashboard/pos/historial
/dashboard/inventario/verificar
/dashboard/inventario/ubicaciones
/dashboard/inventario/alertas
/dashboard/empleados
/dashboard/reparaciones
/dashboard/reparaciones/[id]
/dashboard/dashboard-reparaciones
/dashboard/reportes
/dashboard/reportes/comisiones
/dashboard/recordatorios
/dashboard/configuracion
```

---

### `vendedor`
**Propósito:** Vendedor de la tienda. Vende equipos (POS y créditos), gestiona inventario.

**Lo que puede hacer:**
- Ver y crear clientes
- Crear créditos nuevos (con enganche)
- Ver pagos (NO registrar pagos — eso lo hace cobrador o admin)
- Gestionar productos (ver stock, editar)
- Usar POS para ventas de contado
- Abrir/cerrar caja
- Ver historial de ventas propias
- Verificar inventario físico
- Ver ubicaciones de almacén
- Enviar recordatorios de pago a clientes

**NO puede:**
- Crear/editar empleados
- Ver reportes de comisiones
- Configurar el sistema
- Ver reparaciones (a menos que admin las active en configuración)
- Ver cartera vencida

**Páginas accesibles:**
```
/dashboard
/dashboard/clientes
/dashboard/creditos
/dashboard/pagos
/dashboard/productos
/dashboard/pos
/dashboard/pos/caja
/dashboard/pos/historial
/dashboard/inventario/verificar
/dashboard/inventario/ubicaciones
/dashboard/recordatorios
```

---

### `cobrador`
**Propósito:** Especialista en cobranza. Recupera cartera, registra pagos, sigue deudores.

**Lo que puede hacer:**
- Ver clientes (para contactarlos)
- Ver créditos (para saber cuánto debe cada quien)
- Registrar pagos de créditos
- Ver y gestionar cartera vencida
- Ver historial de ventas (contexto de compras)
- Enviar recordatorios/notificaciones de cobro

**NO puede:**
- Crear créditos nuevos
- Usar POS / Caja
- Gestionar productos o inventario
- Ver reparaciones
- Crear/editar empleados
- Ver reportes

**Páginas accesibles:**
```
/dashboard
/dashboard/clientes
/dashboard/creditos
/dashboard/creditos/cartera-vencida
/dashboard/pagos
/dashboard/pos/historial
/dashboard/recordatorios
```

---

### `tecnico`
**Propósito:** Técnico de reparaciones. Solo trabaja en el módulo de reparaciones.

**Lo que puede hacer:**
- Ver órdenes de reparación asignadas a él
- Actualizar estado de reparaciones (recibido → diagnóstico → reparando → listo)
- Subir fotos de diagnóstico/reparación (vía QR)
- Registrar piezas usadas y anticipos cobrados
- Ver KPIs de su desempeño
- Solicitar piezas para reparaciones
- Gestionar garantías de piezas

**NO puede:**
- Ver clientes, créditos, pagos
- Usar POS
- Gestionar empleados
- Ver reportes generales

**Páginas accesibles:**
```
/dashboard
/dashboard/reparaciones
/dashboard/reparaciones/[id]
/dashboard/dashboard-reparaciones
/dashboard/tecnico
```

---

## Módulos del Sistema

### 1. Clientes (`/dashboard/clientes`)
- CRUD de clientes con nombre, teléfono, dirección, INE, curp, email
- Scoring crediticio automático por historial de pagos
- Historial de créditos por cliente
- Fotos de documentos

### 2. Créditos (`/dashboard/creditos`, `/dashboard/creditos/[id]`)
- Créditos de equipos con enganche, plazo (semanas), tasa de interés
- Mora automática después de días de gracia (configurable)
- Estados: activo, pagado, vencido, cancelado
- PDF de contrato de crédito
- Integración con Payjoy (financiamiento externo)
- Cartera vencida (`/dashboard/creditos/cartera-vencida`)
- Recalculo de mora automático

### 3. Pagos (`/dashboard/pagos`)
- Métodos: efectivo, transferencia, deposito, mixto, payjoy
- Registro de pagos con referencia, comprobante
- Abono a créditos específicos

### 4. Productos (`/dashboard/productos`)
- CRUD de productos con precio, stock, marca, modelo
- Código de barras / SKU (para escaneo)
- Categorías y proveedores
- Escaneo QR/barras desde cámara del celular

### 5. POS — Punto de Venta (`/dashboard/pos`)
- Venta de contado con carrito de compras
- Búsqueda de productos por nombre, marca, modelo, código de barras
- Escaneo de código de barras para agregar al carrito rápidamente
- Recibo de venta en PDF

### 6. Caja (`/dashboard/pos/caja`)
- Apertura/cierre de sesión de caja
- Control de efectivo, corte
- Historial de sesiones con totales

### 7. Inventario
- Verificación física de inventario (`/dashboard/inventario/verificar`)
- Ubicaciones de almacén (`/dashboard/inventario/ubicaciones`)
- Alertas de stock bajo (`/dashboard/inventario/alertas`)

### 8. Empleados (`/dashboard/empleados`)
- CRUD de empleados con todos sus datos de RH
- Al crear: genera contraseña temporal automática y crea cuenta en Supabase Auth
- Roles asignables: admin, vendedor, cobrador, tecnico
- Solo admin/super_admin pueden gestionar empleados

### 9. Reparaciones (`/dashboard/reparaciones`)
- Órdenes de reparación con: cliente, equipo, problema
- Flujo de estados: recibido → diagnóstico → esperando_piezas → reparando → listo → entregado
- Asignación de técnico
- Presupuesto que cliente debe aprobar
- Piezas utilizadas con solicitudes y garantías
- Fotos de diagnóstico/reparación vía QR (cliente puede subir desde celular)
- Anticipos cobrados en taller
- PDF de orden de reparación
- Notificaciones al cliente

### 10. Reportes (`/dashboard/reportes`)
- Reportes financieros por período
- Exportación a PDF
- Comisiones por vendedor (`/dashboard/reportes/comisiones`)

### 11. Configuración (`/dashboard/configuracion`)
- Datos de empresa (nombre, RFC, dirección, teléfono)
- Módulos habilitados/deshabilitados por distribuidor
- Tasas de mora y días de gracia
- Comisiones de vendedores y cobradores
- Configuración de Payjoy
- Notificaciones

### 12. Distribuidores (`/dashboard/admin/distribuidores`) — Solo super_admin
- Ver todos los distribuidores de la red
- Crear nuevo distribuidor
- Editar nombre, slug, logo
- Activar/desactivar distribuidor (toggle inline)
- Panel de referencia de módulos por rol

### 13. Técnico Panel (`/dashboard/tecnico`) — Solo tecnico/super_admin
- Vista específica para técnicos
- Órdenes asignadas al técnico actual

### 14. Recordatorios (`/dashboard/recordatorios`)
- Envío de recordatorios de pago a clientes
- Por WhatsApp, SMS, etc.

---

## Estructura de Base de Datos (tablas principales)

```
distribuidores          - Tiendas/franquicias
users                   - Empleados del sistema (referencia auth.users)
clientes                - Clientes con créditos
creditos                - Créditos de equipos
pagos                   - Pagos de créditos
productos               - Catálogo de productos
ventas                  - Ventas POS de contado
ventas_items            - Items de cada venta
caja_sesiones           - Sesiones de apertura/cierre de caja
reparaciones            - Órdenes de reparación
reparacion_piezas       - Piezas usadas en reparaciones
reparacion_fotos        - Fotos de reparaciones
reparacion_historial    - Log de cambios de estado
solicitudes_piezas      - Solicitudes de piezas a proveedor
garantias_piezas        - Garantías de piezas
configuracion           - Config del sistema (singleton por distribuidor)
categorias              - Categorías de productos
proveedores             - Proveedores de productos
inventario_ubicaciones  - Ubicaciones físicas de almacén
inventario_verificaciones - Verificaciones de inventario
scoring_clientes        - Scoring crediticio de clientes
notificaciones          - Notificaciones del sistema
payjoy_webhooks         - Webhooks recibidos de Payjoy (FASE 20)
payjoy_api_logs         - Logs de llamadas a API Payjoy
```

---

## Archivos y Patrones Clave

### Autenticación
- `src/lib/auth/server.ts` — `getAuthContext()` y `getDistribuidorId()`
- `src/lib/supabase/admin.ts` — `createAdminClient()` (service role)
- `src/lib/supabase/server.ts` — `createClient()` (user context)
- `src/components/AuthProvider.tsx` — Context para user en cliente
- `src/components/ConfigProvider.tsx` — Context para configuración en cliente
- `src/app/api/auth/me/route.ts` — Devuelve datos del usuario actual
- `src/middleware.ts` — Protege rutas /dashboard (redirige a login si no auth)

### DB Layer
- `src/lib/db/clientes.ts`
- `src/lib/db/creditos.ts`
- `src/lib/db/pagos.ts`
- `src/lib/db/productos.ts`
- `src/lib/db/empleados.ts` — createEmpleado() crea en auth.users primero, luego public.users
- `src/lib/db/distribuidores.ts`
- `src/lib/db/configuracion.ts`
- `src/lib/db/caja.ts`

### Tipos TypeScript
- `src/types/index.ts` — Todos los tipos principales
- `src/types/payjoy.ts` — Tipos para integración Payjoy

### Layout del Dashboard
- `src/app/dashboard/layout.tsx` → `DashboardShell`
- `src/components/layout/DashboardShell.tsx` — Wrappea AuthProvider + ConfigProvider + Sidebar
- `src/components/layout/Sidebar.tsx` — Filtra nav items por rol y módulos habilitados

---

## Reglas de Permisos en APIs

```
GET  /api/productos      → autenticado (filtra por distribuidor automático)
POST /api/productos      → admin, super_admin
GET  /api/clientes       → admin, vendedor, cobrador, super_admin
POST /api/clientes       → admin, vendedor, super_admin
GET  /api/creditos       → admin, vendedor, cobrador, super_admin
POST /api/creditos       → admin, vendedor, super_admin
GET  /api/pagos          → admin, vendedor, cobrador, super_admin
POST /api/pagos          → admin, cobrador, super_admin
GET  /api/empleados      → admin, super_admin
POST /api/empleados      → admin, super_admin
GET  /api/reparaciones   → admin, tecnico, super_admin
POST /api/reparaciones   → admin, super_admin
GET  /api/stats          → autenticado
GET  /api/configuracion  → autenticado (todos necesitan saber módulos habilitados)
PUT  /api/configuracion  → admin, super_admin
GET  /api/admin/distribuidores → super_admin SOLO
POST /api/admin/distribuidores → super_admin SOLO
PATCH/GET /api/admin/distribuidores/[id] → super_admin SOLO
```

---

## Creación de Empleados (Flujo Crítico)

```typescript
// PASO 1: Crear en Supabase Auth (genera UUID)
const { data: authData } = await supabase.auth.admin.createUser({
  email, password: tempPassword, email_confirm: true
});
const userId = authData.user.id;

// PASO 2: Insertar en public.users con ese UUID como id
await supabase.from("users").insert({ id: userId, ...datos, distribuidor_id });

// Si PASO 2 falla → rollback: deleteUser(userId)
// Retorna tempPassword al frontend para mostrar al admin
```

---

## Migraciones Aplicadas

| Archivo | Descripción |
|---|---|
| fase21-*.sql | Multi-tenant: columna distribuidor_id en todas las tablas |
| fase25-*.sql | Caja sesiones: distribuidor_id nullable para super_admin |
| fase26-fix-users-distribuidor-nullable.sql | users.distribuidor_id nullable para super_admin |
| fase27-productos-campos-equipo.sql | Columnas imei, color, ram, almacenamiento, folio_remision en productos |

---

## Problema de Sesión al Cambiar de Usuario

**Síntoma:** Velo oscuro al cambiar de cuenta (ej: vendedor → admin).
**Causa:** Conflicto de cookies de sesión entre sesiones de Supabase.
**Solución:** Cerrar completamente el navegador entre cambios de cuenta, o usar ventana incógnita.

---

## Estado Actual del Proyecto

> **IMPORTANTE para Claude:** Este registro se mantiene actualizado. Antes de reportar una fase como "pendiente", verificar aquí. Muchas fases que parecen pendientes en versiones viejas del doc ya están implementadas.

### ✅ Fases COMPLETAMENTE implementadas:

#### Sistema base (FASES 1-27)
- FASE 1-10: CRUD base (clientes, créditos, pagos, productos, empleados, reparaciones)
- FASE 11-15: POS, caja, inventario avanzado, scoring, recordatorios
- FASE 16-19: Reparaciones avanzadas (fotos QR, piezas, garantías, anticipos), reportes PDF
- FASE 20: Integración Payjoy (webhooks, sincronización pagos, panel config)
- FASE 21: Multi-tenant (distribuidores)
- FASE 22-23: Cartera vencida, recálculo mora automático
- FASE 24: Solicitudes y garantías de piezas
- FASE 25: Caja con distribuidor nullable
- FASE 26: Users distribuidor_id nullable + fix crear empleados
- FASE 27: Campos equipo en productos (imei, color, ram, almacenamiento, folio_remision) + parser WINDCEL + PDF remisión

#### POS y Caja (FASES 28-33)
- FASE 28: POS + Caja unificados con gestión de turno (aviso caja abierta, cierre desde POS)
- FASE 29: POS dual mode — Standard (F-keys: F3/F4/F10/F12) + Visual (grid por categoría, touchscreen)
- FASE 30: Selección de cliente en POS + captura IMEI al vender equipo serializado + Notas por venta/ítem
- FASE 31: Reporte X (resumen turno sin cerrar) + Reporte Z (cierre formal PDF) + exportar CSV
- FASE 32: Tickets térmicos 58mm (venta POS, recepción reparación con QR, entrega, pago crédito)
- FASE 33: Devoluciones parciales por línea + Pedidos flotantes (poner venta en espera)

#### Reparaciones avanzadas (FASE 34)
- FASE 34: OrdenCard + OrdenDrawer con tabs (info, piezas, fotos, anticipos, historial)

#### Promociones y control financiero (FASES 35-40)
- FASE 35: Centro de Promociones con opt-in seguro — tabla `promociones`, CRUD admin, consentimiento presencial, integración en tracking page
- FASE 36: Servicios sin inventario en POS — tabla `servicios` con flag `precio_fijo`, catálogo configurable, área "Servicios" en POS, precios variables con min/max por servicio
- FASE 37: Control traspasos anticipo técnico→vendedor — tabla `traspasos_anticipo`, notificación inmediata al vendedor, confirmación de monto real, alerta discrepancia al admin
- FASE 38: Confirmación de depósitos/transferencias — tabla `confirmaciones_deposito`, estado pendiente_confirmacion, link único en WhatsApp para aprobar/declinar desde celular
- FASE 39: Control de descuentos con autorización — tablas `limites_autorizacion` + `log_autorizaciones`, zonas 0-5%/6-15%/>15%, aprobación remota admin vía push + link WhatsApp, descuentos en % y monto fijo
- FASE 40: Reporte Z con conteo ciego + Reporte X — conteo por denominaciones, fondo fijo, Pay In/Out, tolerancia de descuadre, alerta admin, historial 1 año

#### Caja avanzada y reparaciones (FASES 41-43)
- FASE 41: Bolsa virtual de reparaciones en caja + Tab "Reparaciones" en POS — vendedor busca por folio/cliente/teléfono, registra anticipo o cobra saldo final, auto-estado "entregado" cuando saldo=$0
- FASE 42: Sidebar acordeones colapsables, reorganización 7 grupos + Sistema Lotes de Piezas — tabla `lotes_piezas` + `lotes_piezas_items`, recepción/verificación de lotes de proveedor, distribución de costo de envío entre órdenes
- FASE 43: Aging report + tasa de mora real en cartera vencida

#### Dashboard, reportes y comunicación (FASES 44-53)
- FASE 44: Dashboard ejecutivo por rol (cobrador, técnico, vendedor, admin)
- FASE 45: Sistema WhatsApp — plantillas configurables + notificaciones automáticas
- FASE 46: Órdenes de Compra a Proveedores
- FASE 47-lite: Resumen para contador — WhatsApp + período configurable
- FASE 48: Mejoras portal tracking reparaciones (fotos, historial, anticipo con QR)
- FASE 49: Exportar tablas a CSV (créditos, pagos, clientes, reparaciones)
- FASE 50: Estado de Resultados (P&L) mensual en Reportes
- FASE 51: Sidebar reordenado por prioridad de negocio en 8 grupos funcionales
- FASE 52: Liquid Glass en íconos del sidebar (backdrop-filter, glow activo)
- FASE 53: Dashboard Ejecutivo Persistente — Command Center para admin/super_admin (KPIs, OrdenesWidget, AccionesRápidas, ActivityStream, auto-refresh 3min)

#### Catálogo y asistencia (FASES 54a–55)
- FASE 54a: Catálogo de Servicios de Reparación — tabla `catalogo_servicios_reparacion`, CRUD admin en `/dashboard/admin/catalogo-reparaciones`, precarga en órdenes (migraciones `fase54a-catalogo-servicios-reparacion.sql` + `fase54b-orden-catalogo-servicio.sql`)
- FASE 55: Control de Asistencia / Reloj Checador — tabla `asistencia_registros`, check-in/out por QR o PIN, `WidgetChecador.tsx`, página `/dashboard/asistencia`, API `/api/asistencia/activa` + `/checkout` (migración `fase55-asistencia-checador.sql`)

---

### 🔜 Fases PENDIENTES (no iniciadas — esperar indicación):
- FASE 54: Facturación CFDI (integración Facturapi)
- FASE 56: WhatsApp Business API oficial (plantillas aprobadas Meta, historial, doble tick) — infraestructura parcial en `/api/whatsapp/` y `WhatsAppAPITab.tsx`, pendiente integración Meta completa
- FASE 57: Links de pago (Clip, Conekta) — enviar link de cobro al cliente por WhatsApp

### ⚠️ CÓDIGO SIN MIGRACIÓN BD (tablas no creadas — NO funcionan en producción):
- **Kits** (FASE 61): `src/lib/db/kits.ts`, `src/app/api/kits/`, `src/app/dashboard/productos/kits/`, `KitsPOSPanel.tsx` — las tablas `kits` y `kits_items` NO existen en Supabase todavía
- **Series por Lote** (FASE 62): `src/lib/db/lotesSeries.ts` — las tablas `lotes_series` y `lotes_series_items` NO existen en Supabase todavía

---

### Funcionalidades destacadas recientes:
- QR/barcode scan en POS para agregar productos rápido
- Parser WINDCEL con marcas-kb, PDF remisión reimprimible
- Página admin distribuidores: CRUD completo con toggle activo/inactivo
- Centro de Promociones con opt-in WhatsApp presencial
- Dashboard Ejecutivo con auto-refresh + OrdenDrawer integrado
- Descuentos con aprobación remota admin (>15% bloquea POS hasta respuesta)
- Tab Reparaciones en POS: vendedor cobra anticipos/saldo final sin salir del POS, auto-entrega al saldo=$0
- Lotes de Piezas: rastreo completo de pedidos a proveedor, verificación ítem a ítem, distribución proporcional de costo de envío
- Catálogo de Servicios de Reparación: precarga estándar en órdenes nuevas
- Control de Asistencia: check-in/out por QR o PIN, widget en dashboard

---

## Convenciones de Código

### Componentes UI reutilizables
```
src/components/ui/
  Button.tsx    — variant: default, secondary, danger, ghost
  Input.tsx     — con label opcional
  Modal.tsx     — isOpen, onClose, title, size (sm/md/lg/xl)
  Card.tsx      — contenedor con borde y sombra
  Badge.tsx     — variant: default, success, warning, danger
  Select.tsx
  Textarea.tsx
```

### API Routes pattern
```typescript
export async function GET() {
  try {
    const { userId, role, distribuidorId } = await getAuthContext();
    if (!userId) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    // lógica...
    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    return NextResponse.json({ success: false, error: "mensaje" }, { status: 500 });
  }
}
```

### Mappers DB → TypeScript
Todas las funciones en `src/lib/db/` convierten snake_case → camelCase mediante función `mapXFromDB(db: any)`.

---

## Variables de Entorno Requeridas

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Payjoy (FASE 20)
PAYJOY_API_KEY=
PAYJOY_BASE_URL=https://partner.payjoy.com/v1
PAYJOY_WEBHOOK_SECRET=
```

---

## Notas Importantes para Claude

1. **NUNCA usar `getDistribuidorId()` en código nuevo** — usar `getAuthContext()` que devuelve userId, role, distribuidorId, isSuperAdmin
2. **super_admin tiene distribuidorId = null** → usar como bandera para "ver todo"
3. **Siempre usar `createAdminClient()`** en server-side (API routes) — bypassea RLS
4. **Proteger páginas con redirect** en `useEffect` para roles no autorizados (ver empleados/page.tsx como ejemplo)
5. **Al crear empleados**: primero auth.admin.createUser → luego insert en public.users → rollback si falla
6. **Módulos del sidebar** se filtran por rol Y por configuración habilitada del distribuidor
7. **Todas las tablas** deben tener `distribuidor_id` para multi-tenant (excepto `distribuidores` misma)
8. **La tabla `configuracion`** puede tener múltiples filas (una por distribuidor) — no es un singleton global
9. **middleware.ts fue renombrado a `src/proxy.ts`** y la función a `proxy` (convención Next.js 16)
10. **Storage de imágenes — lógica de `obtenerUrlImagen()` (src/lib/storage.ts):**
    - `path.startsWith("http")` → URL completa de R2 (guardada directamente en BD en uploads nuevos) → devolver tal cual
    - path con **2 segmentos** y primer segmento = `"productos"` (ej. `productos/archivo.jpg`) → **Supabase Storage** legacy (imágenes anteriores a Mar 25, 2026)
    - Cualquier otro path multi-nivel (ej. `productos/productos/...`, `reparaciones/...`) → **Cloudflare R2**
    - **Al guardar imágenes en BD:** usar siempre la `url` (no el `path`) del resultado de `subirImagen()` para que quede como URL completa y no haya ambigüedad.
    - **6 productos tienen imágenes perdidas** (no existen en Supabase ni R2 — subidas durante transición Mar 25). Re-subir desde el panel de edición de productos.
11. **URLs dinámicas en API routes** (QR, tracking): usar `new URL(request.url)` para extraer `protocol+host`, NUNCA `process.env.NEXT_PUBLIC_BASE_URL` (que queda `localhost:3000` si el .env.local no se actualizó para producción).

---

## Entorno de Desarrollo — Claude Code en VS Code

### Extensiones Instaladas (aprovechar siempre)

| Extensión | Cómo Claude Code debe usarla |
|---|---|
| **ESLint** | Antes de terminar cualquier tarea, correr `npm run lint` para validar errores de reglas |
| **Tailwind CSS IntelliSense** | Detecta clases inválidas — si hay tokens custom (`var(--color-...)`), ir en `style={}` no en className |
| **Prettier** | Correr `npx prettier --write src/ruta/archivo.tsx` después de editar archivos grandes |
| **PostCSS Language Support** | Confirma que `globals.css` usa sintaxis Tailwind v4 (`@import "tailwindcss"` + `@theme {}`) |

### Comandos de Verificación Obligatorios

Después de cada cambio de código, Claude Code **DEBE correr estos checks en orden**:

```bash
# 1. TypeScript — atrapa errores de tipos antes de que lleguen al build
npx tsc --noEmit

# 2. Lint — reglas ESLint del proyecto
npm run lint

# 3. (Opcional pero recomendado) Build completo para verificar que Next.js compila
npm run build
```

**Regla:** Si `tsc --noEmit` falla → **no dar la tarea por terminada**. Corregir primero.

### Flujo de Trabajo por Fase

```
1. Leer CLAUDE.md completo al iniciar sesión
2. git status → revisar qué hay pendiente sin commitear
3. Implementar cambios de la fase
4. npx tsc --noEmit → corregir errores
5. npm run lint → corregir warnings importantes
6. git diff → revisar exactamente qué cambió antes de commitear
7. git add [archivos específicos] → NUNCA git add -A sin revisar
8. git commit -m "FASE XX: descripción concisa"
```

### Convención de Commits

```
FASE 27: Campos imei/color/ram/almacenamiento en productos
FASE 28: POS + Caja unificados con gestión de turno
fix: corrige crash en importar remisión cuando folio es null
refactor: migra Sidebar.tsx a tokens CSS
```

### Archivos que NO se deben tocar sin revisión previa

- `src/proxy.ts` — afecta auth global (era `src/middleware.ts`, ya fue renombrado)
- `src/app/layout.tsx` — afecta fuentes y tema global
- `src/app/globals.css` — afecta todo el sistema visual
- `src/lib/auth/server.ts` — afecta todos los roles/permisos
- `src/lib/supabase/admin.ts` — cliente con service_role

---

---

# 🎨 SISTEMA VISUAL CREDIPHONE — APLICAR EN CADA SESIÓN DE FRONTEND

## ROL: FRONTEND SENIOR ANTI-AI-SLOP

Diseñador frontend senior de CREDIPHONE ERP.
Construye páginas completas, listas para producción.

**REFERENTES** (así debe verse):
→ Linear.app: densidad de datos + elegancia quirúrgica
→ Vercel Dashboard: sidebar oscuro + contenido respirable
→ Stripe Dashboard: tablas financieras + tipografía de datos

**ANTI-REFERENTES** (así NO debe verse):
→ Templates Tailwind UI 2020-2022
→ Output de Bolt/Lovable/v0 sin customizar
→ Dashboard con gradiente azul→morado en header

---

## ⚠️ PROHIBICIONES ABSOLUTAS — AI SLOP

### Colores prohibidos:
- `bg-indigo-500` / `bg-violet-500` / `bg-purple-*`
- Gradiente `from-blue-600 to-purple-600` en heroes/headers
- `#f8fafc` (Slate-50 genérico) como fondo
- `#0f172a` (Slate-900 genérico) como sidebar
- `#0ea5e9` (Sky-500) como accent
- Sombras genéricas `rgba(0,0,0,0.1)` sin tinte

### Tipografía prohibida:
- `font-family: Inter` — la fuente del AI slop
- `font-family: Roboto`
- `font-family: Open Sans`

### Layouts prohibidos:
- 3 cards con ícono+título+descripción en grid 3 columnas (sin contexto)
- Hero con título grande centrado + subtítulo + botón genérico
- Sidebar blanca con borde gris derecho
- **Clases Tailwind directas de color** — SIEMPRE usar `var(--color-...)` en `style=` o clases CSS custom

---

## 🎨 ESTADO ACTUAL DE LA IMPLEMENTACIÓN

### globals.css — ✅ IMPLEMENTADO
`src/app/globals.css` contiene el sistema completo de tokens, dark mode, utilidades y micro-interacciones.
Usa sintaxis Tailwind v4 (`@import "tailwindcss"` + `@theme {}`).

### layout.tsx — ✅ IMPLEMENTADO
`src/app/layout.tsx` carga Geist, Geist_Mono y JetBrains_Mono vía `next/font/google`.
Variables CSS: `--font-ui`, `--font-data`, `--font-mono`.

### Sidebar.tsx — ✅ IMPLEMENTADO
`src/components/layout/Sidebar.tsx` completamente migrado a tokens:
- Fondo: `var(--color-sidebar-bg)`
- Items activos: `var(--color-sidebar-active)` con `border-left 2px`
- Avatar de usuario con iniciales
- Hover con onMouseEnter/Leave (Tailwind no puede usar vars en hover directo)

### Componentes existentes
Los demás componentes aún usan clases Tailwind directas (`bg-blue-600`, etc.).
Al crear/refactorizar páginas: migrar a tokens. No refactorizar todo de golpe.

### Próximas páginas a construir (en orden):
1. Login (`/auth/login`) — primera pantalla del sistema
2. Dashboard (`/dashboard`) — KPIs y resumen
3. Lista de Reparaciones (`/dashboard/reparaciones`)

---

## 🎨 SISTEMA DE TOKENS — globals.css DESTINO

```css
@import "tailwindcss";

@theme {
  /* FONDOS — 4 niveles de profundidad */
  --color-bg-base:      #EEF2F7;
  --color-bg-surface:   #FFFFFF;
  --color-bg-elevated:  #E4EAF2;
  --color-bg-sunken:    #D6DFE8;

  /* SIDEBAR */
  --color-sidebar-bg:       #0B1929;
  --color-sidebar-surface:  #112238;
  --color-sidebar-border:   #1A3352;
  --color-sidebar-text:     #7FA8C4;
  --color-sidebar-text-dim: #4D7A99;
  --color-sidebar-active:   #00B8D9;

  /* BRAND PRIMARY */
  --color-primary:        #09244A;
  --color-primary-mid:    #0E3570;
  --color-primary-light:  #E6EEF8;
  --color-primary-text:   #FFFFFF;

  /* ACCENT — Cian petróleo (NO el #0ea5e9 genérico) */
  --color-accent:         #0099B8;
  --color-accent-hover:   #007A94;
  --color-accent-light:   #DDF4FA;
  --color-accent-vivid:   #00D4F5;

  /* SEMÁNTICOS */
  --color-success:        #15803D;
  --color-success-bg:     #DCFCE7;
  --color-success-text:   #14532D;

  --color-warning:        #B45309;
  --color-warning-bg:     #FEF3C7;
  --color-warning-text:   #78350F;

  --color-danger:         #B91C1C;
  --color-danger-bg:      #FEE2E2;
  --color-danger-text:    #7F1D1D;

  --color-info:           #1D4ED8;
  --color-info-bg:        #DBEAFE;
  --color-info-text:      #1E3A8A;

  /* TEXTO — 4 niveles */
  --color-text-primary:   #0B1929;
  --color-text-secondary: #34556E;
  --color-text-muted:     #5A7A90;
  --color-text-inverted:  #EEF2F7;

  /* BORDES */
  --color-border:         #C2D4E0;
  --color-border-strong:  #7AAABB;
  --color-border-subtle:  #DAE5EE;

  /* SOMBRAS — con tinte azul marino (NO grises genéricas) */
  --shadow-xs: 0 1px 2px rgba(9, 36, 74, 0.06);
  --shadow-sm: 0 1px 4px rgba(9, 36, 74, 0.09);
  --shadow-md: 0 4px 16px rgba(9, 36, 74, 0.12);
  --shadow-lg: 0 8px 32px rgba(9, 36, 74, 0.16);
  --shadow-xl: 0 16px 56px rgba(9, 36, 74, 0.20);

  /* TIPOGRAFÍA */
  --font-ui:   'Geist', sans-serif;          /* NUNCA Inter */
  --font-mono: 'JetBrains Mono', monospace;  /* IMEIs, folios */
  --font-data: 'Geist Mono', monospace;      /* Tablas numéricas */

  /* RADIOS */
  --radius-2xl:  1rem;
  --radius-xl:   0.75rem;
  --radius-lg:   0.5rem;
  --radius-md:   0.375rem;
  --radius-full: 9999px;

  /* ANIMACIONES */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast:   100ms;
  --duration-normal: 200ms;
  --duration-slow:   350ms;
}

/* MODO OSCURO */
.dark {
  --color-bg-base:      #080F1A;
  --color-bg-surface:   #0D1825;
  --color-bg-elevated:  #132130;
  --color-bg-sunken:    #060C14;

  --color-sidebar-bg:       #050C16;
  --color-sidebar-surface:  #0B1829;
  --color-sidebar-border:   #102235;
  --color-sidebar-text:     #5A8FAA;
  --color-sidebar-text-dim: #3A6080;
  --color-sidebar-active:   #00D4F5;

  --color-primary:        #3B7DD8;
  --color-primary-mid:    #5A9AE8;
  --color-primary-light:  #0D1E35;
  --color-primary-text:   #FFFFFF;

  --color-accent:         #00C4E0;
  --color-accent-hover:   #00E5FF;
  --color-accent-light:   #071822;
  --color-accent-vivid:   #67E8F9;

  --color-success:        #22C55E;
  --color-success-bg:     #052012;
  --color-success-text:   #86EFAC;

  --color-warning:        #F59E0B;
  --color-warning-bg:     #1A0F00;
  --color-warning-text:   #FCD34D;

  --color-danger:         #EF4444;
  --color-danger-bg:      #1A0505;
  --color-danger-text:    #FCA5A5;

  --color-info:           #60A5FA;
  --color-info-bg:        #050F25;
  --color-info-text:      #BFDBFE;

  --color-text-primary:   #D8E8F2;
  --color-text-secondary: #7AAABB;
  --color-text-muted:     #4D7A90;
  --color-text-inverted:  #080F1A;

  --color-border:         #162840;
  --color-border-strong:  #254565;
  --color-border-subtle:  #0F2030;

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-sm: 0 1px 4px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);
  --shadow-xl: 0 16px 56px rgba(0,0,0,0.7);
}

/* Textura de fondo (rompe la planura) */
.app-bg {
  background-color: var(--color-bg-base);
  background-image: radial-gradient(
    circle,
    rgba(9, 36, 74, 0.04) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}

/* Glassmorphism para modales/overlays */
.glass {
  background: rgba(238, 242, 247, 0.85);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(194, 212, 224, 0.6);
}
.dark .glass {
  background: rgba(13, 24, 37, 0.85);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(22, 40, 64, 0.6);
}

/* Transición de dark mode */
*, *::before, *::after {
  transition: background-color 300ms ease,
              border-color 300ms ease,
              color 200ms ease;
}
/* Elementos con sus propias transiciones no necesitan heredar */
button, a, input, select, textarea {
  transition: none;
}
```

---

## ✍️ FUENTES — layout.tsx destino

```typescript
// src/app/layout.tsx
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-ui',
})
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-data',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
})

// En el <body>:
// className={`${geist.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased app-bg`}
```

---

## 📐 JERARQUÍA VISUAL

```
bg-base        ← El "suelo" de la app (#EEF2F7)
  bg-surface   ← Cards, paneles (#FFFFFF)
    bg-elevated ← Hover, seleccionados (#E4EAF2)
      bg-sunken ← Inputs, áreas recesadas (#D6DFE8)
```

**REGLA MÍNIMA POR COMPONENTE:**

```
SIDEBAR:
  bg:          var(--color-sidebar-bg)
  item hover:  var(--color-sidebar-surface)
  item activo: border-left 2px solid var(--color-sidebar-active) + bg-surface
  texto:       var(--color-sidebar-text)

CARDS:
  bg:          var(--color-bg-surface)
  border:      1px solid var(--color-border-subtle)
  shadow:      var(--shadow-sm)
  hover:       shadow → var(--shadow-md) + translateY(-1px)

BOTONES primary:
  bg: var(--color-primary) → hover: var(--color-primary-mid)
  transition: all 200ms cubic-bezier(0.34,1.56,0.64,1)  ← spring

INPUTS:
  bg:     var(--color-bg-sunken)
  border: var(--color-border)
  focus:  border → var(--color-border-strong)
          ring: 0 0 0 3px rgba(0,153,184,0.15)

BADGES DE ESTADO:
  En espera:   warning-bg / warning-text
  En proceso:  info-bg / info-text
  Completado:  success-bg / success-text
  Cancelado:   danger-bg / danger-text
```

---

## ✍️ ESCALA TIPOGRÁFICA

```
Títulos de página:    text-3xl font-bold tracking-tight   (--font-ui)
Títulos de sección:   text-xl  font-semibold               (--font-ui)
Labels formulario:    text-sm  font-medium tracking-wide   (--font-ui)
Texto cuerpo:         text-sm  font-normal                 (--font-ui)
Texto secundario:     text-xs  font-normal text-muted      (--font-ui)

Folios/IDs:           text-sm  font-mono tracking-widest   (--font-mono)
Precios/Importes:     text-xl  font-mono tabular-nums      (--font-data)
IMEIs/Códigos:        text-xs  font-mono tracking-wider    (--font-mono)
```

**REGLA CRÍTICA:** Números dinámicos (precios, folios, IMEIs, fechas) SIEMPRE en `--font-mono` o `--font-data`. NUNCA en `--font-ui`.

---

## 🧩 ESTÁNDARES DE COMPONENTES

### Todo componente DEBE tener 4 estados:
```typescript
type UIState = 'loading' | 'error' | 'empty' | 'data'
```

**Loading** → Skeleton con `animate-pulse` que refleje la forma real del contenido. NUNCA spinner centrado genérico.

**Empty** → Ícono temático + mensaje específico del dominio + CTA de acción. NUNCA solo "No hay datos".

**Error** → Mensaje específico + botón de retry.

**Data** → Contenido real con todas las interacciones.

---

## ✅ CHECKLIST ANTES DE ENTREGAR UNA PÁGINA

**Visual:**
- [ ] CERO valores hardcodeados — solo `var(--color-...)`
- [ ] CERO clases Tailwind de color directas (`bg-blue-500`, etc.)
- [ ] Fondo usa `var(--color-bg-base)` con clase `app-bg`
- [ ] Cards usan `var(--color-bg-surface)` con `border-subtle`
- [ ] Números/folios/IMEIs/precios en `font-mono` o `font-data`
- [ ] Sombras con tinte azul marino — NO grises genéricas
- [ ] Skeleton refleja forma real del contenido
- [ ] Dark mode funciona sin hardcodear colores

**Componentes:**
- [ ] 4 estados: loading, error, empty, data
- [ ] Empty state contextual con ícono temático + CTA
- [ ] Botones con micro-interacción spring
- [ ] Inputs con focus-ring de color accent

**Layout:**
- [ ] Sidebar en `var(--color-sidebar-bg)` — NO blanca
- [ ] Área de contenido en `var(--color-bg-base)`
- [ ] Topbar con breadcrumb + búsqueda + acciones
- [ ] Responsive: mobile 375px, tablet 768px, desktop 1440px

**Código:**
- [ ] CERO uso de Inter, Roboto, Open Sans
- [ ] CERO gradientes azul→morado
- [ ] CERO `bg-indigo` / `bg-violet` / `bg-purple`

---

## 🏗️ ESTRUCTURA DE LAYOUT — CREDIPHONE

```
SIDEBAR (240px, fixed):
  ┌──────────────────────┐
  │  CREDIPHONE (logo)   │  → font-mono, sidebar-active color
  │  ────────────────    │
  │  MENÚ PRINCIPAL      │  → items con 4 estados visuales
  │  ────────────────    │
  │  SUCURSAL BADGE      │  → nombre del distribuidor actual
  │  ────────────────    │
  │  USUARIO + ROL       │  → iniciales + nombre + rol
  │  Configuración       │
  │  Cerrar sesión       │
  └──────────────────────┘

CONTENT AREA (margin-left: 240px):
  ┌─────────────────────────────────────┐
  │  TOPBAR (56px)                      │
  │  breadcrumb │ búsqueda │ acciones   │
  ├─────────────────────────────────────┤
  │  CONTENT (padding: 24px)            │
  │  bg-base con textura de puntos      │
  │                                     │
  │  KPI Cards (si aplica)              │
  │  Tabla/Lista principal              │
  │  Detalles/Formularios               │
  └─────────────────────────────────────┘
```
