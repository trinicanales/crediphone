# Sesión Activa — CREDIPHONE

## Estado: CICLO DE PIEZAS COMPLETO ✅ — Deployado en master (2026-04-24)

**Última sesión:** 2026-04-24 — Ciclo de vida de piezas completo (backend + UI + visibilidad + corte)
**Historial:** `ARCHIVO/HISTORIAL-SESIONES.md`

---

## Módulos activos y funcionales

| Módulo | Estado | Notas |
|--------|--------|-------|
| Reparaciones (órdenes, drawer, stepper) | ✅ | F1-A/B/C corregidos |
| PDF de orden (firma en 1a hoja) | ✅ | maybeBreak 38mm |
| PDF versionado | ✅ | v1 al crear, v2+ en aprobaciones y entrega |
| Tracking cliente | ✅ | Token 64-char hex; piezas en_camino visibles al cliente |
| Bolsa Virtual en POS | ✅ | Tab "Órdenes activas" + tab "En disputa" |
| Movimientos bolsa virtual | ✅ | gasto_pieza / devolucion_cliente / ingreso_caja / en_disputa |
| Ciclo de vida de piezas | ✅ | pendiente→en_camino→recibida→verificada/defectuosa→instalada |
| Verificación de piezas (técnico) | ✅ | /verificar: llegó bien→instalada, defectuosa→congela bolsa |
| Badge piezas en OrdenCard | ✅ | "X por verificar" (amarillo) + "X en camino" (azul) |
| UI en OrdenDrawer — piezas | ✅ | Botones En camino / Recibida / Verificar inline |
| Resolución piezas no_reparable | ✅ | ModalCambiarEstado: paso extra con lista de piezas pendientes |
| Piezas sin catálogo al cancelar | ✅ | ModalCambiarEstado: lista de piezas físicas sin producto_id |
| Stock en sugerencias diagnóstico | ✅ | Badge azul "✓N" en ModalDiagnostico cuando hay existencia |
| Offline reparaciones | ✅ | Cola IndexedDB en ModalCambiarEstado, página reparaciones y técnico |
| Control de precio (aprobación admin) | ✅ | Vendedor propone → admin aprueba/rechaza |
| POS + Caja | ✅ | Bolsa virtual, corte con "Reparaciones cobradas este turno" |
| Badge "precio pendiente" en OrdenDrawer | ✅ | Header badge + tarjeta aprobación en tab presupuesto |
| Panel piezas pendientes (vendedor) | ✅ | PiezasPendientesPanel en página reparaciones |
| C4 — Columnas anticipo/saldo en POS | ✅ | Lista "Listos para cobrar" con anticipo + saldo por fila |
| SECURITY-003 — Cifrado wa_access_token | ✅ | AES-256-GCM, llave en CF secret WA_ENCRYPTION_KEY |
| PO1 — Sistema de puntos / loyalty | ✅ | $50=1pt, 1pt=$1 descuento, reseteo anual, visible en tracking |

---

## Commits de la sesión 2026-04-24 (todos en master)

| Commit | Descripción |
|--------|-------------|
| `25bc1a4` | refactor(puntos): upsertPuntosManual → RPC atómico; filtro server-side reparaciones-activas |
| `9ee8e1e` | feat(offline): soporte offline para cambios de estado en reparaciones |
| `86fb04b` | feat(piezas): ciclo de vida completo — recibida/instalada separados, verificar, en_camino, no_reparable, catálogo |
| `022cf69` | feat(reparaciones): UI OrdenDrawer — botones Verificar/En camino + badges por estado |
| `5c5bfa5` | feat(piezas): Fase B — badges OrdenCard, tracking en_camino, stock en diagnóstico, tab En disputa |
| `ab55cc1` | feat(piezas): A3/A4/P8 — resolución piezas, catálogo y bolsas corte |

---

## Tablas y columnas en Supabase

### Migradas 2026-04-22
- `movimientos_bolsa_virtual` — gastos, devoluciones, ingresos de caja por orden
- `versiones_pdf_reparacion` — historial de PDFs versionados con URL en R2
- `solicitudes_cambio_precio` — solicitudes de vendedores esperando aprobación de admin

### Migradas 2026-04-24 (pieza_lifecycle_estados_y_verificacion)
- `pedidos_pieza_reparacion`: +fecha_estimada_llegada, +motivo_defecto, +intentos_reemplazo, +verificado_por, +fecha_verificacion, +instalado_por, +fecha_instalacion
- `movimientos_bolsa_virtual`: +en_disputa, +pedido_pieza_id
- Índice: `idx_pedidos_pieza_estado` ON pedidos_pieza_reparacion(orden_id, estado)

---

## Pendiente (no urgente — esperar instrucción de Trini)

- **PO1-UI** — Redemption UI en POS (canjear puntos al momento de cobrar)
- **PO1-ADMIN** — Panel admin: ver puntos por cliente, historial
- **P7** — Área clientes: historial financiero (reparaciones activas + saldo bolsa por cliente)

---

## Reglas de negocio clave (NUNCA cambiar sin preguntar)

- Precio all-in: `precioUnitario` incluye pieza + instalación + envío, no se desglosa
- Bolsa Virtual: anticipos independientes de caja (`sesion_caja_id` puede ser null)
- Ingreso neto: `precio_total - sum(costo_pieza + costo_envio)` — solo ESO va a caja al entregar
- Cancelación + pieza llegó: costo de pieza SE RETIENE del anticipo (entra al inventario)
- Cancelación + pieza no llegó: se devuelve TODO el anticipo al cliente
- Pieza defectuosa: monto queda `en_disputa=true` en bolsa hasta resolver con distribuidor
- no_reparable: piezas pendientes requieren resolución manual (inventario o devolución)
- NUNCA eliminar funcionalidades existentes — solo agregar

---

## TypeScript / Deploy

```bash
# Verificar TypeScript (desde la raíz del repo):
node "C:\Users\usuario 1\crediphone\node_modules\typescript\bin\tsc" --noEmit

# Deploy: push a master → GitHub Actions → Cloudflare Workers automático
git push origin HEAD:master
```
