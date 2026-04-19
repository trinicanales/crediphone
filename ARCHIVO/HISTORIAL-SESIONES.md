# Historial de sesiones — CREDIPHONE

## Sesión 2026-04-19 — Plan completo "PDF fix + Bolsa Virtual + Flujo de piezas"

### Bloques completados

| Bloque | Descripción | Archivos clave |
|--------|-------------|----------------|
| A | PDF fix: firma en 1a hoja (maybeBreak 60→38, sin divisor post-header, empresa a 6.5pt) | `lib/pdf/orden-pdf.ts`, PDF routes |
| B1 | PresupuestoSummary: sección "Cotización de apertura" con piezasCotizacion | `detail/PresupuestoSummary.tsx` |
| B2 | ModalDiagnostico: pre-carga piezasCotizacion como partes editables + botón "Nueva refacción" inline | `ModalDiagnostico.tsx` |
| C1 | GET /api/pos/reparaciones-activas — órdenes activas con anticipos, independiente de caja | `api/pos/reparaciones-activas/route.ts` |
| C2 | BolsaVirtualPanel — panel lateral POS con total bolsa, progreso por orden, anticipos por empleado | `components/pos/BolsaVirtualPanel.tsx` |
| C3 | POS header: icono bolsa con badge en $$ | `app/dashboard/pos/page.tsx` |
| D1 | Tabla `pedidos_pieza_reparacion` en Supabase (migración aplicada) | Supabase MCP |
| D2 | GET/POST /api/reparaciones/[id]/pedidos-pieza + POST .../recibir (un clic) | nuevas rutas API |
| D3-D5 | OrdenDrawer tab diagnóstico: sección "Piezas pedidas" con formulario + recibir un clic | `OrdenDrawer.tsx` |
| D6 | Promociones WA en tab presupuesto cuando listo_entrega + cliente acepta | `OrdenDrawer.tsx` |

### Correcciones técnicas

- `Buffer → Uint8Array` en NextResponse de ambas rutas PDF (error TS2345)
- `presupuestoTotal` mapper: `precio_total → presupuestoTotal` (ya existía desde bloque P1)
- Bolsa Virtual es independiente de caja — `sesion_caja_id` puede ser null

---

## Sesión 2026-04-17 — Auditoría flujo reparación completo

### Bugs críticos corregidos

| Item | Descripción |
|------|-------------|
| F1-A | PATCH→PUT en handleCambiarEstadoInline — endpoint /estado no existía → 404 |
| F1-A | Modal WhatsApp se abre DESPUÉS de confirmar éxito del cambio de estado |
| F1-B | Aprobación presencial visible para CUALQUIER usuario (no solo admin) |
| F1-B | Al aprobar presencialmente → aprobado_por_cliente = true en BD |
| F2-A | Barra financiera: total, anticipos, saldo pendiente en drawer |
| F2-B | Fecha estimada editable desde el drawer |
| F2-C | Toggle requiereAprobacion en tab resumen |
| F3-A | BarraProgresoReparacion — 7 pasos con checkmarks en tracking |
| F3-B | Costo visible desde estado "recibido" con badge "estimado" |
| F3-D | Sección ofertas movida arriba en tracking |

### Sugerencias piezas/servicios por marca+modelo

- `/api/productos` acepta `?q=&tipo=&marca=&modelo=`
- `/api/catalogo-servicios` acepta `?marca=&modelo=`
- SelectorPiezasCotizacion carga chips sugeridos automáticamente
- ModalDiagnostico muestra panel de sugerencias sobre tabla de partes

---

## Sesión 2026-04-19 — PDF restructura + piezas_cotizacion en tracking

| Cambio | Resultado |
|--------|-----------|
| Márgenes 11mm→5mm | CW: 194→206mm |
| Footer eliminado (20mm) | Info empresa bajo folio en header |
| CONTENT_MAX | 259→274mm (~36mm ahorro) |
| piezas_cotizacion | Columna JSONB en ordenes_reparacion, expuesta en tracking y PDF |
| PDF tracking | GET /api/tracking/[token]/pdf endpoint público |
| WA listo_entrega | Incluye link PDF si hay token |

---

## REGLAS DE NEGOCIO CONFIRMADAS (permanentes — no cambiar sin consultar a Trini)

- **Precio all-in**: `precioUnitario` de piezas incluye costo + instalación + envío (no se desglosa)
- **Bolsa Virtual**: los anticipos de reparaciones son independientes de caja — `sesion_caja_id` puede ser null
- **Ticket QR**: apunta a `/reparacion/{folio}`, no a subir fotos
- **NUNCA eliminar funcionalidades**: solo agregar; corregir sin borrar features existentes
- **Anticipo sin caja**: aparece con nota "Sin sesión" — comportamiento INTENCIONAL anti-fraude

---

## Implementación completa hasta 2026-04-19

Ver HISTORIAL-FASES.md para fases 1-55. Ver SESION-ACTIVA.md para el estado actual del sistema.
