# AUDITORÍA COMPLETA DEL SISTEMA CREDIPHONE
**Fecha:** 2026-05-09 | **Estado:** Post-fixes C1/C2/C3/C5

> Este documento es para uso de Claude en futuras sesiones. No requiere re-auditar desde cero.
> Actualizar al implementar nuevas correcciones.

---

## ESTADO GENERAL DE LA BD

- **88 tablas** en schema public — sin foreign keys rotas (163 FK verificadas)
- **Proyecto Supabase activo:** `ihvjjfsefnvcrczrcmhp`

### Conteo de registros clave (2026-05-09)
| Tabla | Registros | Estado |
|-------|-----------|--------|
| productos | 119 | ✅ Activo |
| ordenes_reparacion | 13 | ✅ Activo |
| anticipos_reparacion | 7 | ✅ Activo |
| caja_movimientos | 15 | ✅ Activo |
| ventas | 4 | ✅ Activo |
| ventas_items | 4 | ✅ Activo |
| movimientos_bolsa_virtual | 0 | ⚠️ Vacío (tabla recién creada 2026-05-09) |
| movimientos_stock | 0 | 🔴 Vacío — ventas POS no registran movimiento |
| lotes_series | 0 | ⚠️ Vacío — sistema existe pero sin uso |
| lotes_piezas | 0 | ⚠️ Vacío — sistema existe pero sin uso |
| ubicaciones_inventario | 5 | ✅ Datos reales |

---

## MÓDULOS Y SU ESTADO DE CONEXIÓN

### ✅ CONECTADO CORRECTAMENTE

| Módulo | Qué funciona |
|--------|-------------|
| Ubicaciones → Productos | Selector con ID estructurado, guarda `ubicacion_id` en BD |
| Formulario producto | Todos los campos (marca, modelo, proveedor, tipo, categoría, ubicación) correctamente mapeados |
| Reparaciones → Bolsa Virtual | Flujo anticipo (pendiente) → entrega (aplicado) correcto tras fix C3 |
| Reparaciones → Stock | Al entregar, descuenta stock de piezas del catálogo y registra en movimientos_stock |
| Reparaciones → Caja | Anticipo registra en caja_movimientos; saldo final también |
| Verificaciones de inventario | UI completa, escaneo, ajuste automático de stock, alertas |
| Lotes/Series código | Funciones de DB existen, lógica de IMEI implementada |
| POS → Caja | Ventas registran en caja_movimientos correctamente |

---

### 🔴 ROTO / INCOMPLETO

#### ~~P1 — POS ventas NO registra `movimientos_stock`~~ ✅ RESUELTO 2026-05-09
- **Fix aplicado:** `src/lib/db/ventas.ts` → `createVenta()` ahora registra un `movimientos_stock` por cada producto vendido (tipo `venta_pos`, con stock_antes/stock_despues, referencia al folio de venta). Fire-and-forget, no bloquea la venta.

#### ~~P2 — POS entrega directa NO ejecuta flujo completo de entrega~~ ✅ RESUELTO 2026-05-09
- **Fix aplicado:** `src/app/api/pos/reparacion-cobro/route.ts` → nueva función `ejecutarEntregaCompleta()` que al saldo=0 ejecuta: marcar anticipos como 'aplicado', INSERT `movimientos_bolsa_virtual` (ingreso_neto), descuento stock piezas instaladas + `movimientos_stock`, acumular puntos loyalty, INSERT `historial_estado_orden`.

#### P3 — Piezas pedidas para reparación NO ingresan al inventario
- **Dónde:** `src/app/api/reparaciones/[id]/pedidos-pieza/[pedidoId]/verificar/route.ts`
- **Problema:** Al verificar llegada de pieza, el sistema no ofrece opción de ingresarla al inventario. Las piezas existen solo en el contexto de la reparación.
- **Impacto:** El inventario nunca refleja piezas que llegan de proveedores vía reparaciones.
- **Fix:** En el modal de verificación de llegada, agregar pregunta "¿Registrar en inventario?" con campo de costo.

#### P4 — Teléfonos/Lotes sin UI en POS
- **Dónde:** POS `src/app/dashboard/pos/page.tsx`
- **Problema:** Existen tablas `lotes_series`, `lotes_series_items` y código de BD pero no hay sección en POS para vender teléfonos distinguiendo contado vs crédito.
- **Impacto:** Las ventas de teléfonos se registran igual que un accesorio — sin IMEI vinculado a la venta, sin distinción contado/crédito.
- **Fix:** Agregar tab/sección "Teléfonos" en POS con flujo diferenciado.

#### ~~P5 — costo_envio sin campo visible en "Piezas por pedir"~~ ✅ RESUELTO 2026-05-09
- **Fix aplicado:** `src/components/reparaciones/drawer/OrdenDrawer.tsx` → formulario de piezas ahora muestra dos campos lado a lado: "Costo pieza" y "Costo envío". El API ya aceptaba `costoEnvio`, solo faltaba exponerlo en la UI.

---

### ⚠️ ADVERTENCIAS / PUNTOS A VIGILAR

#### W1 — `movimientos_bolsa_virtual` tiene 0 registros (era tabla inexistente)
Creada 2026-05-09 con migración fase71. Los datos históricos no existen. Es correcto — no hay datos previos que recuperar.

#### W2 — `fecha_entregado` vs `fecha_entrega` (normalizado en fase71)
Campo `fecha_entregado` existe en BD (columna antigua). `fecha_entrega` es el campo canónico desde fase71. Ambos pueden coexistir; el código ahora usa `fecha_entrega`.

#### W3 — POS íconos demasiado pequeños en móvil/tablet
Reportado por Trini. Afecta especialmente: Productos, cobro de reparaciones ("Cobrar Rep." → renombrar).
Orden deseado: 1) Productos 2) Reparaciones 3) Teléfonos

#### W4 — `lotes_series` y `lotes_piezas` sin datos
Sistema completo implementado pero sin uso. Requiere que la tienda empiece a registrar lotes de teléfonos para activarse.

---

## PREGUNTAS PENDIENTES DE TRINI

1. ¿Teléfonos en POS: venta a crédito se conecta al módulo de créditos existente?
2. ¿Piezas llegadas de proveedor: si ya existe producto en inventario, solo actualizar precio y sumar stock? (**Trini respondió: SÍ**)
3. ¿Prioridad: POS (íconos + entrega vinculada) o Inventario/Ubicaciones?

---

## FIXES APLICADOS EN ESTA SESIÓN (2026-05-09)

| ID | Descripción | Archivo |
|----|-------------|---------|
| C1 | Crear tabla `movimientos_bolsa_virtual` | migración fase71 |
| C2 | Columnas faltantes en `anticipos_reparacion` | migración fase71 |
| C3 | POS: estado='pendiente', precio_total, sesion_caja_id | pos/reparacion-cobro |
| C5 | Normalizar fecha_entrega | migración fase71 + pos/reparacion-cobro |

---

## PLAN DE CORRECCIONES PENDIENTES (en orden de prioridad)

| Prioridad | ID | Descripción | Esfuerzo |
|-----------|-----|-------------|----------|
| 🔴 Alta | P2 | Vincular entrega POS con flujo completo de entrega | Medio |
| 🔴 Alta | P1 | Registrar movimientos_stock en ventas POS | Bajo |
| 🟠 Media | P5 | Costo de pieza en formulario "Piezas por pedir" | Bajo |
| 🟠 Media | P3 | Piezas verificadas → opción de ingresar a inventario | Medio |
| 🟡 Normal | W3 | Rediseño íconos POS para móvil/tablet | Medio |
| 🟡 Normal | P4 | Sección Teléfonos en POS (contado/crédito) | Alto |
