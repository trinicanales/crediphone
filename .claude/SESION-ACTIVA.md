# Sesión Activa — CREDIPHONE

## Estado: AUDITORÍA INTEGRAL COMPLETA ✅ — Deployado en Cloudflare Workers

**Última sesión:** 2026-04-22 — 5 hallazgos críticos + 3 UIs pendientes implementados y deployados.
**Historial:** `ARCHIVO/HISTORIAL-SESIONES.md`

---

## Módulos activos y funcionales

| Módulo | Estado | Notas |
|--------|--------|-------|
| Reparaciones (órdenes, drawer, stepper) | ✅ | F1-A/B/C corregidos |
| PDF de orden (firma en 1a hoja) | ✅ | maybeBreak 38mm |
| PDF versionado | ✅ | v1 al crear, v2+ en aprobaciones y entrega |
| Tracking cliente (barra progreso, costo, PDF) | ✅ | Token 64-char hex |
| Bolsa Virtual en POS | ✅ | Flujo de dinero completo |
| Movimientos bolsa virtual | ✅ | gasto_pieza / devolucion_cliente / ingreso_caja |
| Pedidos de piezas (auto + manual) | ✅ | Auto al crear orden; vendedor completa costo real |
| Cargo cancelación automático | ✅ | Lee cargo de la orden; piezas llegadas → retener |
| Control de precio (aprobación admin) | ✅ | Vendedor propone → admin aprueba/rechaza |
| POS + Caja | ✅ | Bolsa virtual con costos piezas y saldo real |
| Badge "precio pendiente" en OrdenDrawer | ✅ | Header badge + tarjeta aprobación en tab presupuesto |
| Versiones PDF en OrdenDrawer | ✅ | Sección "Documentos del servicio" con links descarga |
| Panel piezas pendientes (vendedor) | ✅ | PiezasPendientesPanel en página reparaciones |

---

## Pendiente (no urgente — esperar instrucción de Trini)

- **C4** — ReparacionesPOSPanel: columnas anticipo/saldo (puede hacerse cuando lo pida)
- **PO1** — Sistema de puntos / loyalty
- **SECURITY-003** — Encriptar wa_access_token en BD

---

## Tablas nuevas en Supabase (migradas 2026-04-22)

- `movimientos_bolsa_virtual` — gastos, devoluciones, ingresos de caja por orden
- `versiones_pdf_reparacion` — historial de PDFs versionados con URL en R2
- `solicitudes_cambio_precio` — solicitudes de vendedores esperando aprobación de admin
- Columnas: `pedidos_pieza_reparacion.{foto_comprobante_url, financiado_por, monto_de_caja}`
- Columnas: `ordenes_reparacion.precio_pendiente_aprobacion`

---

## Reglas de negocio clave (NUNCA cambiar sin preguntar)

- Precio all-in: `precioUnitario` incluye pieza + instalación + envío, no se desglosa
- Bolsa Virtual: anticipos independientes de caja (`sesion_caja_id` puede ser null)
- Ingreso neto: `precio_total - sum(costo_pieza + costo_envio)` — solo ESO va a caja al entregar
- Cancelación + pieza llegó: costo de pieza SE RETIENE del anticipo (entra al inventario)
- Cancelación + pieza no llegó: se devuelve TODO el anticipo al cliente
- Ticket QR → `/reparacion/{folio}` (no a subir fotos)
- NUNCA eliminar funcionalidades existentes — solo agregar

---

## TypeScript / Deploy

```bash
# Verificar TypeScript (desde la raíz del repo):
node "C:\Users\usuario 1\crediphone\node_modules\typescript\bin\tsc" --noEmit

# Deploy: push a master → GitHub Actions → Cloudflare Workers automático
git push origin master
```
