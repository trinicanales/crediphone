# Sesión Activa — CREDIPHONE

## Estado: BLOQUE 6 COMPLETO ✅ — Deployado en master

## Última actualización — 2026-04-12

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

## PENDIENTE (baja prioridad — esperar que Trini lo pida)

- **PO1** — Sistema de Puntos / Loyalty (esfuerzo grande, diseñar desde cero)
- **P2** — PDF automático al aprobar/entregar
- **SECURITY-003** — wa_access_token encryption (riesgo mitigado, no urgente)

---

**Si pierdes contexto:** Di "Lee SESION-ACTIVA y continúa con el plan"
