# Bugs Activos — CREDIPHONE
> Leer al inicio de sesión si la tarea toca BD, auth, caja o reparaciones.
> Última actualización: 2026-04-06

---

## ✅ RLS-001 — Políticas RLS cross-tenant corregidas
**Severidad:** CRÍTICO → **RESUELTO 2026-04-06**

Todas las tablas tenían RLS habilitado, pero 17 políticas permitían acceso cross-tenant
(un empleado de Tienda A podía leer datos de Tienda B) o acceso anónimo a datos sensibles.

**Corregido en:** `supabase/migrations/fix-rls-cross-tenant-policies.sql`
- 3 tablas con acceso anónimo eliminado: `tracking_tokens`, `scoring_clientes`, `historial_scoring`
- 14 tablas con cross-tenant corregido: `ordenes_reparacion`, `clientes`, `creditos`, `productos`,
  `notificaciones`, `anticipos_reparacion`, `historial_estado_orden`, `imagenes_reparacion`,
  `referencias_laborales`, `referencias_personales`, `sesiones_fotos_qr`, `garantias_reparacion`,
  `movimientos_ubicacion`, `notificacion_preferencias`

---

## 🟡 SECURITY-003 — wa_access_token en texto plano
**Severidad:** MEDIO (mitigado)
**Estado:** ⚠️ Parcialmente resuelto

La columna `wa_access_token` de `configuracion` está en texto plano, PERO:
- La app nunca lo expone al frontend (`configuracion.ts:231` retorna `undefined`)
- La tabla tiene `distribuidor_isolation` — empleados de otra tienda no pueden leerlo
- Solo es un riesgo si la BD se compromete directamente (fuera de la app)

**Fix a largo plazo (baja urgencia):** Mover a variable de entorno Cloudflare por distribuidor,
o cifrar con `pgcrypto`. No es urgente mientras la app funcione correctamente.

---

## ✅ PAGES-002 — Race condition en fetches
**Severidad:** BAJO → **RESUELTO 2026-04-06**

5 páginas corregidas con `if (!user) return;` en el useEffect de fetch:
`clientes`, `creditos`, `pagos`, `promociones`, `compras`

---

## ✅ DB-002 — servicios.distribuidor_id nullable
**Severidad:** BAJO → **RESUELTO 2026-04-06**

`ALTER TABLE servicios ALTER COLUMN distribuidor_id SET NOT NULL` aplicado.
Verificado: 0 filas con NULL antes de aplicar.
Migración: `supabase/migrations/fix-servicios-distribuidor-id-not-null.sql`

---

## ✅ Resueltos recientemente (referencia rápida)
Ver `ARCHIVO/BUGS-RESUELTOS.md` para historial completo.
- CAJA-001, CAJA-002 ✅ commit feedae4
- MULTITENANT-001 a 007 ✅ commits feedae4, 2026-03-29
- REACT-301 ✅ commit 8530a69
- SECURITY-001, 002 ✅ commit 7a5e4f5
- DOCBUG-001, 002, 003 ✅ sesión 2026-03-29
