# Sesión Activa — CREDIPHONE

## Estado: AUDITORÍA FLUJO REPARACIÓN ✅ — Deployado en master

## Última actualización — 2026-04-17

---

## REGLAS DE NEGOCIO CONFIRMADAS POR TRINI (nunca cambiar sin consultar)

### Dinero y Caja
- TODO el dinero que entra a la tienda debe pasar por caja, sin excepción
- Los anticipos NO son ingresos directos — son prepagos del cliente para un servicio específico
- Un anticipo siempre está vinculado a UNA sola orden de reparación (no se mezclan)

### Precio de piezas en cotización (INTENCIONAL — NO CAMBIAR)
- El `precioUnitario` de cada pieza incluye TODO: costo de la pieza + instalación + envío
- Es un precio "all-in" para el cliente — no se desglosa por componente
- En UI: "Precio all-in (pieza + instalación + envío)"
- En PDF: cada pieza dice "(incl. instalación y envío)"

### PDF / Documento de la orden
- ✅ Completo: folio, fecha, QRs, T&C compacto, datos del cliente, diagnóstico, técnico,
  piezas, presupuesto desglosado, anticipos con método, cargo cancelación, garantía
- T&C condensado a 4 cláusulas a 8pt — todo en una sola hoja

### Ticket de recepción QR (LÓGICA ACTUALIZADA)
- QR apunta a `/reparacion/{folio}` — página de seguimiento de la orden
- Al escanear el ticket al momento de entrega → empleado ve la orden de inmediato
- **NO** apunta a subir fotos (eso era un bug de lógica)

---

## ESTADO DE IMPLEMENTACIÓN

### ✅ BLOQUE 1 — Reparaciones y Caja — COMPLETO
### ✅ BLOQUE 2 — PDF de la orden — COMPLETO
### ✅ BLOQUE 3 — Inventario — COMPLETO
### ✅ BLOQUE 4 — Visual/UI — COMPLETO
### ✅ BLOQUE 5 — POS y Funcionalidades — COMPLETO
### ✅ BLOQUE 6 — Tarjetas de Reparación + PDF + Ticket — COMPLETO
### ✅ BLOQUE 7 — Etiquetas Masivas + Auditoría Inventario — COMPLETO
### ✅ ÁREA TÉCNICA A1+B1 — Notificación técnico + Checklist apertura — COMPLETO

---

## BLOQUE 7 — Detalle de lo implementado

| Item | Descripción | Archivos |
|------|-------------|---------|
| ETIQ-1 | Modal "Imprimir todas" reescrito: usa `printRef` + `Code128SVG` + `QRCodeSVG` inline (igual que etiqueta individual) | `dashboard/productos/page.tsx` |
| ETIQ-2 | `exportarSVG` usa `foreignObject` con innerHTML real del `printRef` — incluye barcode y QR reales | `dashboard/productos/page.tsx` |
| ETIQ-3 | Margen 5mm carta: `@page { margin: 0 }` + `body { padding: 5mm }` — visible en pantalla Y en impresión | `dashboard/productos/page.tsx` |
| ETIQ-4 | Botón "Imprimir todas (N)" agregado en header superior (no solo al pie) | `dashboard/productos/page.tsx` |
| ETIQ-5 | Al crear producto nuevo → abre modal etiqueta automáticamente | `dashboard/productos/page.tsx` |
| INV-B1 | Módulo `inventario_avanzado` — confirmado funcional (Trini lo activó) | Configuración |
| INV-B2 | Faltaba `X-Distribuidor-Id` header en fetch de ubicaciones (GET) → datos mezclados | `inventario/ubicaciones/page.tsx` |
| INV-B5 | `distribuidorActivo?.id` faltaba en dependencia del `useEffect` de ubicaciones | `inventario/ubicaciones/page.tsx` |
| INV-B3 | Badge de categoría en tabla de productos (columna nombre) | `dashboard/productos/page.tsx` |
| INV-B4 | Filtro por categoría en barra superior de productos | `dashboard/productos/page.tsx` |

### Auditoría de inventario — hallazgos

**Funcional y conectado:**
- Categorías: CRUD completo (`/inventario/categorias`), API `/api/categorias` OK, badge y filtro en tabla de productos ✅
- Ubicaciones: CRUD completo (`/inventario/ubicaciones`), API OK — corregido header distribuidor ✅
- Verificar inventario: página funcional (`/inventario/verificar`), muestra productos con stock bajo
- Módulos sidebar: `inventario_avanzado` activa Categorías, Ubicaciones, Verificar, Alertas, Series, Importar

**En el limbo (campos guardados en BD pero no visibles en UI de productos):**
- `subcategoriaId`: se guarda en producto, no se muestra ni filtra en tabla
- `proveedorId`: se guarda en producto, no se muestra ni filtra en tabla
- `ubicacionId`: se guarda en producto, visible en "Verificar" pero no en tabla principal

**No afecta flujo crítico** — los datos están en BD, solo falta superficie de UI si Trini lo pide.

---

## BLOQUE 5 — Detalle de lo implementado

| Item | Descripción | Archivos |
|------|-------------|---------|
| PO3 | Alerta PROFECO órdenes sin recoger (stat "Vencidas") | `reparaciones/page.tsx`, `configuracion.ts` |
| PO2 | Banner de promociones activas en el POS | `pos/page.tsx` |
| fix CRITICAL | `costo_total` GENERATED ALWAYS eliminado de INSERT/UPDATE | `lib/db/reparaciones.ts` |
| fix PDF | Muestra error real al usuario (antes silencioso) | `ModalOrden.tsx`, `OrdenDetailHeader.tsx` |
| fix PDF | Join `tecnico_id` usa columna `name` | `api/reparaciones/[id]/pdf/route.ts` |

## BLOQUE 6 — Detalle de lo implementado

| Item | Descripción | Archivos |
|------|-------------|---------|
| P1 | Tarjeta muestra precio correcto: costo técnico (verde) o cotización inicial (amarillo "est.") | `OrdenCard.tsx`, `lib/db/reparaciones.ts` |
| P2 | Badge de anticipo en tarjeta (batch-fetch, una sola query) | `OrdenCard.tsx`, `lib/db/reparaciones.ts`, `types/index.ts` |
| P3 | Stepper clickeable — clic en paso cambia estado directamente | `StepperReparacion.tsx`, `OrdenCard.tsx` |
| P4 | Transición `no_reparable` disponible desde estado `recibido` | `OrdenCard.tsx` |
| P5 | PDF T&C condensado: 4 cláusulas concisas a 8pt → cabe en una hoja | `api/reparaciones/[id]/pdf/route.ts` |
| P6 | Ticket QR apunta a `/reparacion/{folio}` (no a subir fotos) | `OrdenDetailHeader.tsx`, `lib/utils/reportes.ts` |
| ETIQ | Rediseño etiquetas producto: layout 2 columnas — QR derecha altura completa, código de barras + nombre + precio en columna izquierda | `dashboard/productos/page.tsx` |

---

## CAMBIOS TÉCNICOS CLAVE (para referencia futura)

### Mapper `mapOrdenFromDB` (lib/db/reparaciones.ts)
- Ahora mapea `precio_total` → `presupuestoTotal` (antes nunca se mapeaba)
- Ahora mapea `precio_mano_obra` → `presupuestoManoDeObra`
- Ahora mapea `precio_piezas` → `presupuestoPiezas`

### `getOrdenesReparacionDetalladas` (lib/db/reparaciones.ts)
- Después de fetch principal, hace batch-fetch de anticipos en una sola query
- Adjunta `totalAnticipos` a cada OrdenReparacionDetallada

### `OrdenReparacionDetallada` (types/index.ts)
- Nuevo campo: `totalAnticipos?: number`

### `StepperReparacion` (components/reparaciones/StepperReparacion.tsx)
- Nuevo prop: `onCambiarEstado?: (estado: EstadoOrdenReparacion) => void`
- Nodos clickeables con `title` (tooltip) + `cursor: pointer` cuando aplica

---

## ÁREA TÉCNICA — Detalle implementado

| Item | Descripción | Archivos |
|------|-------------|---------|
| A1 | Notificación al admin cuando técnico crea orden (fire-and-forget) | `api/reparaciones/route.ts` |
| A1+ | Si el sistema auto-asigna al mismo técnico creador → alerta ⚠️ en la notificación | `api/reparaciones/route.ts` |
| B1 | `ChecklistAperturaPanel`: sección colapsable en ModalDiagnostico | `ChecklistAperturaPanel.tsx`, `ModalDiagnostico.tsx` |
| B1 | 8 ítems: humedad, reparación previa, batería, placa, tornillos, conector, flex, cámara | `ChecklistAperturaPanel.tsx` |
| B1 | Ítems críticos con alerta roja; resultado serializado en notasInternas | `ModalDiagnostico.tsx` |

## ÁREA TÉCNICA — Tracking cliente (implementado esta sesión)

| Item | Descripción | Archivos |
|------|-------------|---------|
| TRACK-1 | `GET /api/tracking/[token]` retorna `fotos[]` (imagenes_reparacion por orden_id, sin auth) | `api/tracking/[token]/route.ts` |
| TRACK-2 | `GET /api/tracking/[token]` retorna `checklistApertura` (extraído de notasTecnico — solo sección checklist, notas privadas se omiten) | `api/tracking/[token]/route.ts` |
| TRACK-3 | Tracking page: sección "Inspección del Equipo" — muestra problemas e ítems OK del checklist | `tracking/[token]/page.tsx` |
| TRACK-4 | Tracking page: galería de fotos 3 columnas con lightbox (tap para ampliar, botón cerrar) | `tracking/[token]/page.tsx` |

---

## ÁREA TÉCNICA — B2, B3 (implementados esta sesión)

| Item | Descripción | Archivos |
|------|-------------|---------|
| B2 | `ModalQAEntrega`: 7 ítems (4 obligatorios), intercepta `completado→listo_entrega` en AccionesOrdenPanel | `ModalQAEntrega.tsx`, `AccionesOrdenPanel.tsx` |
| B3 | Agrega `{cliente, whatsapp}` al estado `completado` — usa `generarMensajeReparacionCompletada` | `notificaciones-reparaciones.ts` |

## ÁREA TÉCNICA — C2, C3, INV-1/2/3 (implementados esta sesión)

| Item | Descripción | Archivos |
|------|-------------|---------|
| C2 | Ticket 80mm imprimible por taller: nueva ruta `/reparaciones/[id]/ticket`, auto-print + CSS @media print | `[id]/ticket/page.tsx`, `OrdenDrawer.tsx` |
| C3 | POS ReparacionesPOSPanel: lista auto "listos para cobrar" al abrir panel (sin buscar) | `ReparacionesPOSPanel.tsx` |
| INV-1 | Subcategoría en tabla de productos: se carga vía `/api/subcategorias` y se muestra junto a la categoría | `productos/page.tsx` |
| INV-2 | Proveedor en tabla de productos: ícono 🏭 + nombre del proveedor | `productos/page.tsx` |
| INV-3 | Ubicación estructurada: prefiere nombre de ubicacionId sobre texto libre `ubicacionFisica` | `productos/page.tsx` |

## FIX login (2026-04-17)

| Item | Descripción | Archivo |
|------|-------------|---------|
| LOGIN | `router.push + router.refresh` → `window.location.href` en login | `auth/login/page.tsx` |

**Causa:** `router.refresh()` llamado después de `router.push("/dashboard")` causaba race condition — el middleware de Supabase recibía la request antes de que la cookie de sesión se propagara y redirigía de vuelta a `/auth/login`. Con `window.location.href` el browser hace un full reload y las cookies ya están establecidas.

---

## Sugerencias piezas/servicios por marca+modelo (2026-04-17)

| Item | Descripción | Archivos |
|------|-------------|---------|
| API-1 | `/api/productos` acepta `?q=&tipo=&marca=&modelo=` | `api/productos/route.ts`, `lib/db/productos.ts` |
| API-2 | `/api/catalogo-servicios` acepta `?marca=&modelo=` | `api/catalogo-servicios/route.ts`, `lib/db/catalogo-servicios.ts` |
| SUGER-1 | `SelectorPiezasCotizacion` carga chips sugeridos cuando se pasa `marcaDispositivo` | `presupuesto/SelectorPiezasCotizacion.tsx` |
| SUGER-2 | `ComponentePresupuesto` pasa `marcaDispositivo`/`modeloDispositivo` al selector | `presupuesto/ComponentePresupuesto.tsx` |
| SUGER-3 | `ModalOrden` pasa marca/modelo del formulario al `ComponentePresupuesto` | `ModalOrden.tsx` |
| SUGER-4 | `ModalDiagnostico` muestra panel de sugerencias sobre tabla de partes | `ModalDiagnostico.tsx` |
| UX-FIX | `onFocus -> select()` en inputs numéricos de costo/cantidad | `ModalDiagnostico.tsx`, `SelectorPiezasCotizacion.tsx` |

---

## AUDITORÍA FLUJO REPARACIÓN — Detalle (2026-04-17)

| Item | Descripción | Archivos |
|------|-------------|---------|
| F1-A | PATCH→PUT en handleCambiarEstadoInline — endpoint /estado no existía → 404 | `reparaciones/page.tsx`, `tecnico/page.tsx` |
| F1-A | Modal WhatsApp se abre DESPUÉS de confirmar éxito del cambio de estado | `OrdenCard.tsx` |
| F1-B | Aprobación presencial visible para CUALQUIER usuario (no solo admin) | `AccionesOrdenPanel.tsx` |
| F1-B | Al aprobar presencialmente → `aprobado_por_cliente = true` en BD | `reparaciones.ts`, `[id]/route.ts` |
| F2-A | Barra financiera: total, anticipos, saldo pendiente en drawer (todas las tabs) | `OrdenDrawer.tsx` |
| F2-B | Fecha estimada editable desde el drawer (date picker inline, PUT a API) | `OrdenDrawer.tsx` |
| F2-C | Toggle `requiereAprobacion` en tab resumen del drawer | `OrdenDrawer.tsx` |
| F3-A | `BarraProgresoReparacion` — 7 pasos con checkmarks y colores en tracking page | nuevo `tracking/BarraProgresoReparacion.tsx` |
| F3-B | Costo visible desde estado "recibido" con badge "estimado"; "Por cotizar" si no hay monto | `tracking/[token]/page.tsx` |
| API  | Nueva Caso 3 en PUT /api/reparaciones/[id]: acepta `fechaEstimadaEntrega` y `requiereAprobacion` | `[id]/route.ts` |

## PDF RESTRUCTURA — Detalle (2026-04-19)

| Cambio | Resultado |
|--------|-----------|
| Márgenes 11mm → 5mm | CW: 194→206mm — texto envuelve menos |
| Footer eliminado (20mm) | Info empresa compacta bajo folio en header |
| Secciones 3B+4 fusionadas | Izq: Técnico→Diagnóstico→EstadoFísico→Acceso · Der: Presupuesto |
| hLine entre secciones eliminada | Sin divisora redundante |
| CONTENT_MAX | 259→274mm (~36mm ahorro total) |

## PIEZAS_COTIZACION — Detalle (2026-04-19)

| Capa | Cambio |
|------|--------|
| Supabase | `ALTER TABLE ordenes_reparacion ADD COLUMN piezas_cotizacion JSONB DEFAULT '[]'` |
| Tipo | `OrdenReparacion.piezasCotizacion?: PiezaCotizacion[]` |
| DB mapper | `mapOrdenFromDB` lee `piezas_cotizacion` |
| DB create | `createOrdenReparacion` guarda piezas (libres + catálogo) al insertar |
| API POST /reparaciones | Pasa `body.piezasCotizacion` — antes piezas libres se descartaban |
| API tracking GET | Expone `piezasCotizacion` en respuesta pública |
| Tracking page | Listado de piezas cotizadas en panel de autorización |
| PDF | Piezas cotizadas con precio en sección presupuesto |

## F3-D + P2 — Detalle (2026-04-19)

| Item | Descripción | Archivos |
|------|-------------|---------|
| F3-D | "Ofertas y Promociones" movida arriba: aparece después de Anticipos, antes de Historial | `tracking/[token]/page.tsx` |
| P2-1 | `src/lib/pdf/orden-pdf.ts` — `generarOrdenPDF(ordenId, host, proto)` extrae lógica completa | nuevo |
| P2-2 | `GET /api/tracking/[token]/pdf` — endpoint público sin auth, valida token, sirve PDF | nuevo |
| P2-3 | `POST /api/reparaciones/[id]/pdf` — refactorizado a wrapper delgado | `api/reparaciones/[id]/pdf/route.ts` |
| P2-4 | `generarMensajeListoEntrega(orden, pdfUrl?)` — incluye link PDF en WA si hay token | `lib/whatsapp-reparaciones.ts` |
| P2-5 | `notificaciones-reparaciones.ts` — para `listo_entrega`: busca token existente → `/api/tracking/{token}/pdf` | `lib/notificaciones-reparaciones.ts` |
| P2-6 | Tracking page: botón "Descargar PDF" apunta a `/api/tracking/{token}/pdf` | `tracking/[token]/page.tsx` |

## PENDIENTE (siguiente sesión si Trini lo pide)

- **PO1** — Sistema de Puntos / Loyalty (esfuerzo grande, diseñar desde cero)
- **SECURITY-003** — wa_access_token encryption (no urgente)

---

## REGLA CRÍTICA CONFIRMADA POR TRINI — 2026-04-16

**NUNCA eliminar funcionalidades existentes — solo agregar.**
Si hay que corregir algo, se corrige sin borrar lo que ya funciona.
Ejemplo: `exportarSVG` fue borrado accidentalmente → Trini lo señaló → se restauró.
Esta regla aplica a botones, funciones, modales, opciones de menú y cualquier feature visible.

---

**Si pierdes contexto:** Di "Lee SESION-ACTIVA y continúa con el plan"
