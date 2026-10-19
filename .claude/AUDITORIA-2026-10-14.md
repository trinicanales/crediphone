# Auditoría general del sistema — CREDIPHONE
> Fecha: 2026-10-14 · Solo lectura (no se modificó código ni base de datos en esta auditoría)
> Método: cruce código ↔ Supabase real (proyecto `ihvjjfsefnvcrczrcmhp`), cruce frontend ↔ rutas API, revisión de la máquina de estados, avisos de seguridad de Supabase y consultas de integridad de datos.

---

## Resumen en 30 segundos

| Área | Resultado |
|---|---|
| Frontend → API (216 URLs que llama el frontend vs 198 rutas) | ✅ **0 rutas rotas.** Todo lo que el frontend llama existe |
| Código → Base de datos (73 tablas usadas vs 82 existentes) | ⚠️ **3 tablas que el código usa NO existen** (ver C3, A3) |
| Seguridad de API | 🔴 **5 rutas de PayJoy sin login** + **21 rutas dinámicas sin filtro por franquicia** |
| Máquina de estados (11 estados) | ✅ Código, tipos y base de datos coinciden · ⚠️ 3 copias del mapa de transiciones, ya divergen |
| Entrega de equipos | 🔴 El cambio de estado genérico permite "Entregado" **sin** caja/stock/puntos/garantía |
| Notificaciones WhatsApp | ✅ Funcionan (0 fallos registrados). No hay actividad nueva desde el 21-sep porque **nadie ha avanzado órdenes** |
| Datos históricos | ⚠️ 63 anticipos sin aplicar y 49 órdenes entregadas sin movimiento de caja virtual |

---

## 🔴 CRÍTICOS (corregir primero)

### C1 · Rutas de PayJoy abiertas a cualquier persona en internet
`/api/payjoy/lookup-customer`, `link-credit`, `unlink-credit`, `import-customer`, `test-connection` **no verifican sesión**, y el middleware solo protege `/dashboard`, no `/api`. PayJoy está activo (`PAYJOY_ENABLED=true`).
- Cualquiera puede buscar clientes en PayJoy por teléfono/IMEI (fuga de datos personales).
- Cualquiera puede vincular/desvincular créditos o importar clientes.
- **Arreglo:** agregar `getAuthContext()` + rol admin a las 5 rutas (≈ 10 líneas por ruta).

### C2 · El cambio de estado genérico puede marcar "Entregado" sin efectos de entrega
`ModalCambiarEstado` ofrece "Entregado" desde `listo_entrega` y el servidor (`PUT /api/reparaciones/[id]`) lo acepta, pero **ese camino no ejecuta** `ejecutarEfectosEntrega()` (anticipos aplicados, caja virtual, descuento de stock, puntos, garantía, PDF de acuse). Es la misma clase de falla que BUG-ENTREGA-001.
- **Arreglo:** el servidor debe rechazar `estado: "entregado"` en ese endpoint y exigir `/entregar` (o el cobro de POS); el modal debe redirigir al flujo de entrega.

### C3 · Tablas que el código usa pero no existen
| Código | Problema | Efecto real |
|---|---|---|
| `anticipos/[anticipoId]/route.ts:81` → `movimientos_caja` | La tabla real es `caja_movimientos` y además no tiene columna `referencia_tipo` | Al borrar un anticipo, **el egreso de caja nunca se registra** (el error se ignora en silencio) y la respuesta dice "caja revertida" |
| `reportes/pnl/route.ts:101` → `reparaciones` | La tabla real es `ordenes_reparacion` | **El reporte P&L no muestra ingresos de reparaciones** |
| `lib/db/verificaciones.ts:514` → `ubicaciones` | La tabla real es `ubicaciones_inventario` | La mejora "C4-fix" de verificaciones nunca se aplica (cae al comportamiento básico) |

---

## 🟠 ALTOS

### A1 · 21 rutas dinámicas no filtran por franquicia (riesgo de ver/modificar datos de otra tienda)
Usan sesión pero ignoran `distribuidorId`, con cliente admin (sin RLS). Las más delicadas:
`creditos/[id]/pagos` · `creditos/[id]/pdf` · `ordenes-compra/[id]` (GET/PATCH/DELETE) · `reparaciones/[id]/pdf` · `reparaciones/[id]/historial` · `lotes-piezas/[id]/*` · `lotes-series/[id]` · `inventario/verificaciones/[id]` · `inventario/ubicaciones/[id]` · `scoring/[id]` · `recordatorios/[id]/enviar` · `traspasos-anticipo/[id]/confirmar` · `confirmaciones-deposito/[id]/*` · `autorizaciones/[id]`.
Un admin de la franquicia A que conozca/adivine un ID de la franquicia B puede leerlo o cambiarlo.

### A2 · Órdenes de compra: cualquier estado, sin validar transición
`PATCH /api/ordenes-compra/[id]` con `{estado}` acepta cualquier valor: se puede marcar "recibida" **sin que entre stock**, o cancelar una ya recibida. Además devuelve `String(err)` al cliente (filtra mensajes internos).

### A3 · Stock con lectura-luego-escritura (condición de carrera)
Recepción de OC, entrega, cancelación y POS leen `stock`, calculan y escriben. Si dos personas operan el mismo producto a la vez, se pierde una actualización. Ya existen las funciones SQL `incrementar_stock` / `decrementar_stock` (atómicas) pero no se usan en estos flujos.

### A4 · Funciones SQL de comisión/desempeño abiertas a usuarios anónimos
`calcular_comision_vendedor` y `calcular_desempeno_cobrador` son `SECURITY DEFINER` y ejecutables por `anon` vía `/rest/v1/rpc/` (ya estaba en el backlog, #14). Igual `can_access_distribuidor`, `get_my_distribuidor_id`, `get_user_distribuidor_id`, `is_super_admin`, `verify_contrato`.
Además: vista `empleados_activos` es `SECURITY DEFINER` (nivel ERROR del linter), protección contra contraseñas filtradas desactivada, y 117 funciones sin `search_path` fijo.

### A5 · Aprobación de presupuesto "pública" por UUID
`POST /api/reparaciones/[id]/aprobar-presupuesto` funciona sin sesión usando solo el UUID de la orden (a diferencia de tracking, que usa token de 64 caracteres). El UUID no es adivinable, pero se filtra si se comparte un link/PDF; el token de tracking es la vía correcta.

---

## 🟡 MEDIOS

### M1 · Tres copias del mapa de transiciones de estado — ya divergen
`OrdenCard.tsx`, `ModalCambiarEstado.tsx` y `lib/db/reparaciones.ts (TRANSICIONES_VALIDAS)`. Diferencia hoy: la card permite `recibido → no_reparable`, el modal y el servidor no (el servidor lo rechaza). Hay además mapas propios en `StepperReparacion`, `BarraProgresoReparacion` y `TimelineOrden`. **Esto es parte de la causa de la falta de "espejo" que notas.** Arreglo: un solo archivo `lib/reparaciones/estados.ts` importado por todos.

### M2 · La lista de reparaciones no se entera de cambios ajenos
`dashboard/reparaciones/page.tsx` no tiene realtime (solo se refresca con acciones propias). El drawer sí (agregado en esta sesión).

### M3 · Historial de estados sin usuario
Los registros que crea el trigger `registrar_cambio_estado_orden` guardan `usuario_id = NULL` (todos los de las últimas 3 semanas). No se puede saber **quién** cambió el estado.

### M4 · Órdenes de compra no actualizan el costo del producto
`recibirMercancia` suma stock pero no actualiza `productos.costo`; el cálculo de utilidad usa ese costo. Requiere tu decisión (¿último costo o costo promedio?).

### M5 · Las anulaciones/reversiones no deshacen efectos
`revertir-estado` solo cambia el estado (sin reversar caja, stock ni puntos).

---

## 📊 Datos reales que piden atención del negocio (no son bugs de código)

| Hallazgo | Dato |
|---|---|
| Órdenes en **Listo para entrega** sin recoger | **50**, promedio **107 días** sin moverse (la más vieja: 13-may). Ya pasaron los 90 días de tu cláusula de resguardo |
| Órdenes en **Recibido** sin diagnosticar | **68**, promedio 56 días |
| Entregadas sin movimiento en caja virtual | 49 de 59 |
| Anticipos aún "pendiente" en órdenes ya entregadas | 63 (reportes de ingreso subestimados) |
| Entregadas sin fecha de entrega | 26 |
| Entregadas sin garantía | 59 (normal: la garantía automática se creó hoy; solo aplica de aquí en adelante) |
| Historial de precios / garantías | 0 / 0 registros (las correcciones de hoy empiezan a llenarlos) |
| Tablas sin ningún uso en el código | `consignaciones`, `contratos`, `factores_scoring`, `historial_scoring`, `referencias_*`, `impersonacion_sesiones`, `audit_log_accesos`, `usuarios`, `verificaciones`, `config_notificaciones_reparacion`, `notificacion_preferencias` |

---

## ✅ Lo que SÍ está bien conectado

- **Frontend ↔ API:** 100% de las llamadas del frontend apuntan a rutas existentes.
- **Estados:** los 11 estados coinciden entre el tipo TypeScript, la restricción de la BD y el servidor.
- **WhatsApp / notificaciones:** se registran 405 mensajes y 577 notificaciones, **0 fallidas**. La última actividad (21-sep) coincide con el último avance real de órdenes; desde entonces solo se han creado órdenes nuevas (que no notifican). **No hay evidencia de que WhatsApp esté roto**: simplemente no se ha probado con una orden nueva avanzando de estado.
- **Trigger de historial** (`registrar_cambio_estado_orden`) escribe en cada cambio (766 registros).
- **Tracking:** 120 tokens; solo 1 orden activa sin token.
- **Realtime:** ya habilitado para `ordenes_reparacion`, `historial_estado_orden` y `notificaciones`.
- Sin órdenes huérfanas de franquicia (`distribuidor_id` nunca nulo).

---

## Plan de corrección sugerido (en este orden)

1. **C1** Autenticar las 5 rutas de PayJoy.
2. **C2** Bloquear "Entregado" en el cambio de estado genérico.
3. **C3** Corregir las 3 tablas fantasma (anticipos→`caja_movimientos`, P&L→`ordenes_reparacion`, verificaciones→`ubicaciones_inventario`).
4. **A1/A2** Filtro por franquicia en las 21 rutas + validar transiciones de OC.
5. **A4** `REVOKE EXECUTE` a `anon` en las 7 funciones y arreglar la vista `empleados_activos`.
6. **M1+M2** Un solo mapa de estados compartido + realtime en la lista (resuelve el "espejo").
7. Backfill de los 63 anticipos / 49 cajas virtuales (requiere tu criterio caso por caso, igual que el backfill anterior).
8. Revisar los 50 equipos que llevan >90 días en "Listo para entrega".

## Lo que NO cubrió esta auditoría (honestidad)
- No probé el sistema en navegador con sesión real (necesita login; no tengo credenciales de prueba).
- No audité a fondo el POS venta-a-venta, PDFs, scoring ni los avisos de rendimiento de Supabase.
- No revisé las 81 vulnerabilidades de dependencias (Dependabot).
- No hay acceso a las analíticas de Cloudflare (peticiones/CPU reales).
