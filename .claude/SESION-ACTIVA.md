# Sesión Activa — CREDIPHONE

## Estado: SISTEMA COMPLETO ✅ — Deployado en Cloudflare Workers

**Última sesión:** 2026-04-19 — Plan "PDF fix + Bolsa Virtual + Flujo de piezas" ejecutado completamente.
**Historial:** `ARCHIVO/HISTORIAL-SESIONES.md`

---

## Módulos activos y funcionales

| Módulo | Estado | Notas |
|--------|--------|-------|
| Reparaciones (órdenes, drawer, stepper) | ✅ | F1-A/B/C corregidos |
| PDF de orden (firma en 1a hoja) | ✅ | maybeBreak 38mm |
| Tracking cliente (barra progreso, costo, PDF) | ✅ | Token 64-char hex |
| Bolsa Virtual en POS | ✅ | Independiente de caja |
| Pedidos de piezas (pedidos_pieza_reparacion) | ✅ | Un clic recibir |
| Cotización en tarjetas (presupuestoTotal) | ✅ | Amarillo "est." |
| Sugerencias piezas/servicios por marca+modelo | ✅ | SelectorPiezasCotizacion |
| POS + Caja | ✅ | Bolsa virtual integrada |

---

## Pendiente (no urgente — esperar instrucción de Trini)

- **C4** — ReparacionesPOSPanel: columnas anticipo/saldo (puede hacerse cuando lo pida)
- **PO1** — Sistema de puntos / loyalty
- **SECURITY-003** — Encriptar wa_access_token en BD

---

## Reglas de negocio clave (NUNCA cambiar sin preguntar)

- Precio all-in: `precioUnitario` incluye pieza + instalación + envío, no se desglosa
- Bolsa Virtual: anticipos independientes de caja (`sesion_caja_id` puede ser null)
- Ticket QR → `/reparacion/{folio}` (no a subir fotos)
- NUNCA eliminar funcionalidades existentes — solo agregar

---

## Si pierdes contexto

Di: **"Continúa donde quedamos"** → Claude lee este archivo y sigue.

---

## TypeScript / Deploy

```bash
# Verificar TypeScript (desde la raíz del repo):
node "C:\Users\usuario 1\crediphone\node_modules\typescript\bin\tsc" --noEmit

# Deploy: push a master → GitHub Actions → Cloudflare Workers automático
git push origin master
```
