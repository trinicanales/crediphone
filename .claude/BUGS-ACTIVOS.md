# Bugs Activos — CREDIPHONE
> Leer al inicio de sesión si la tarea toca BD, auth, caja o reparaciones.
> Última actualización: 2026-04-12

---

## 🟡 SECURITY-003 — wa_access_token en texto plano
**Severidad:** MEDIO (mitigado)
**Estado:** ⚠️ Parcialmente resuelto — baja urgencia

La columna `wa_access_token` de `configuracion` está en texto plano, PERO:
- La app nunca lo expone al frontend (`configuracion.ts` retorna `undefined`)
- La tabla tiene `distribuidor_isolation` — empleados de otra tienda no pueden leerlo
- Solo es un riesgo si la BD se compromete directamente (fuera de la app)

**Fix a largo plazo:** Mover a variable de entorno Cloudflare por distribuidor,
o cifrar con `pgcrypto`. No es urgente mientras la app funcione correctamente.

---

## ✅ Resueltos recientemente (referencia rápida)

### Resueltos en sesión 2026-04-12
- **costo_total GENERATED ALWAYS** ✅ — eliminado de todos los INSERT/UPDATE en `reparaciones.ts`
- **PDF "orden no encontrada"** ✅ — join `tecnico_id` corregido a columna `name` (no `nombre/apellido`)
- **PDF error silencioso** ✅ — ahora muestra el error real al usuario
- **presupuestoTotal no mapeado** ✅ — `precio_total` ahora se mapea en `mapOrdenFromDB`
- **Ticket QR subía fotos** ✅ — ahora apunta a `/reparacion/{folio}` (consulta/entrega)

### Resueltos en sesión 2026-04-06
- RLS-001 ✅ — 17 políticas RLS cross-tenant corregidas
- PAGES-002 ✅ — Race condition en fetches (5 páginas corregidas)
- DB-002 ✅ — `servicios.distribuidor_id` NOT NULL aplicado

### Historial completo
Ver `ARCHIVO/BUGS-RESUELTOS.md`
- CAJA-001, CAJA-002 ✅ commit feedae4
- MULTITENANT-001 a 007 ✅ commits feedae4, 2026-03-29
- REACT-301 ✅ commit 8530a69
- SECURITY-001, 002 ✅ commit 7a5e4f5
- DOCBUG-001, 002, 003 ✅ sesión 2026-03-29
