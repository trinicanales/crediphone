# Sesión Activa — CREDIPHONE

## Estado: BLOQUE 5 COMPLETO ✅ — Deployado en master

## Última actualización — 2026-04-11

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
- ✅ Completo: folio, fecha, QRs, T&C, datos del cliente, diagnóstico, técnico,
  piezas, presupuesto desglosado, anticipos con método, cargo cancelación, garantía

---

## ESTADO DE IMPLEMENTACIÓN

### ✅ BLOQUE 1 — Reparaciones y Caja — COMPLETO
### ✅ BLOQUE 2 — PDF de la orden — COMPLETO (P1)
### ✅ BLOQUE 3 — Inventario — COMPLETO
### ✅ BLOQUE 4 — Visual/UI — COMPLETO
### ✅ BLOQUE 5 — POS y Funcionalidades — COMPLETO

| Item | Descripción | Estado |
|------|-------------|--------|
| PO3 | Alerta PROFECO órdenes sin recoger (stat "Vencidas") | ✅ |
| PO2 | Banner de promociones activas en el POS | ✅ |
| fix CRITICAL | `costo_total` GENERATED ALWAYS eliminado de INSERT/UPDATE | ✅ |
| fix PDF | Muestra error real al usuario (antes silencioso) | ✅ |
| fix PDF | Join `tecnico_id` usa columna `name` (corregido de nombre/apellido) | ✅ |

---

## PENDIENTE (baja prioridad — esperar que Trini lo pida)

- **PO1** — Sistema de Puntos / Loyalty (esfuerzo grande, diseñar desde cero)
- **P2** — PDF automático al aprobar/entregar (baja prioridad)
- **SECURITY-003** — wa_access_token encryption (riesgo mitigado)

## BUGS ACTIVOS (sin resolver)
Ver `.claude/BUGS-ACTIVOS.md`: RLS-001, PAGES-002, DB-002

---

**Si pierdes contexto:** Di "Lee SESION-ACTIVA y continúa con el plan"
