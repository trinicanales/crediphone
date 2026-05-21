# Sesión Activa — CREDIPHONE

## Estado: LIBRE — sin tarea activa (2026-05-17)

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
