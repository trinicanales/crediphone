# MAPA MAESTRO DEL SISTEMA — 2026-11-11
> Hecho investigando código y Supabase directamente (no documentos viejos). Niveles: **A** comprobado en BD · **B** dato real contado · **D** solo código.
> Detalle por área: `A-reparaciones.md`, `B-pos-inventario-servicios.md` (agente; lo verificado está en E), `C-clientes-creditos-personal-config.md` (agente; idem), `E-verificacion-2026-11-11.md` (comprobaciones), `D-grafo-codigo.md` + `grafo.json` (generado: `node scripts/mapa-sistema.js`; impacto: `node scripts/mapa-sistema.js --impacto <tabla|/api/ruta|tabla.columna>`).

## 1. Tamaño real
202 APIs · 71 páginas · 91 tablas · 11 RPC. Solo **1 tienda activa** (de 4). Uso real hoy (B): 6 ventas POS, 0 devoluciones, 0 créditos, 0 pagos, 0 órdenes de compra, 0 lotes de piezas, 222 órdenes de reparación.
**Consecuencia:** casi todo lo roto del POS/créditos está *latente*: no se nota porque casi no se usa.

## 2. Capas
- **Base:** Postgres (Supabase). Triggers: ventas (folio, restaurar stock al cancelar), ventas_items (descontar stock), caja_sesiones (folio), ordenes_reparacion (historial de estado sin usuario, updated_at). Cron: snapshot diario de KPIs. Sin pg_net: la base **no puede** avisar sola a nadie.
- **Backend:** rutas `/api/*` con `createAdminClient()` (saltan RLS) → la seguridad depende de que cada ruta valide sesión, rol y tienda. Hay 3 niveles: bien (rol+tienda), solo rol, ninguno.
- **Frontend:** 71 páginas; el módulo de reparaciones concentra el detalle en `OrdenDrawer`.
- **Conectores:** WhatsApp **en modo enlace** (genera link `wa.me`, nada se envía solo: 444 mensajes `pendiente`, ninguno enviado); push (`/api/push/send` sin quien lo llame); PayJoy y Facturación apagados por `features.ts`.

## 3. Lo que funciona (comprobado)
- Estados de orden: los 11 de la BD = los 11 del historial = `estados.ts` (A).
- Stock de venta POS normal: trigger descuenta y bloquea si no alcanza (D).
- Descuento > subtotal se rechaza en servidor (D).
- Seguimiento al cliente: `/reparacion/[folio]` verifica teléfono con intentos limitados (D).
- Portal del cliente: `/api/cliente/perfil` exige token válido; `solicitar-acceso` no filtra el token (D).

## 4. Roto o expuesto, por prioridad
**Seguridad (arreglar primero, no depende de uso):**
1. Recuperar contraseña devuelve el enlace a quien conozca el teléfono de un empleado (D).
2. Empleado desactivado sigue entrando (D; hay 1 caso real) y puede quedar sin tienda → ve todo.
3. `/api/clientes` (incl. borrar) sin control de rol: un técnico puede borrar clientes (D).
4. `/api/configuracion` entrega RFC, contador y token de verificación WA sin sesión (D).
5. Vista `empleados_activos` expone sueldo/comisión de todas las tiendas a cualquier sesión; `anon` ejecuta `calcular_comision_vendedor` (A).
6. Rutas con rol pero **sin filtro de tienda**: `inventario/ubicaciones/[id]` y `ordenes-compra/[id]` (D); `productos/[id]` DELETE exige admin pero `deleteProducto(id)` no recibe tienda (D). Hoy solo hay 1 tienda activa, así que es riesgo para cuando se active otra.
7. `cancelar-folio` y `push/send` sin sesión (push usa secreto por defecto si falta la variable) (D).

**Dinero y datos (se rompen al usar la función):**
8. Venta a crédito imposible: el CHECK de `metodo_pago` no admite 'credito' (A).
9. Pagos de crédito: columna `detalle_pago` no existe → todo POST falla (A).
10. Promociones no cobrables: `servicio_id` es uuid (A). `incrementar_stock` rota (A).
11. Kits por F9/F12: se cobran y no descuentan stock (D); posible precio multiplicado (sospecha).
12. 4 reglas de stock bajo → 3 / 5 / 24 / 26 productos (A+B).
13. Caja: 4 abiertas (la más vieja de abril), 20 cierres en $0; alerta de descuadre no se crea (B).
14. Cron de recordatorios y almacenaje piden columnas que no existen (A).

**Orden y limpieza operativa (B):**
15. 57 órdenes `listo_entrega` con mediana 117 días y 77 `recibido` (49 sin técnico).
16. 113/137 productos sin costo; bitácora de stock con 10 filas; 22 teléfonos de clientes duplicados.

## 5. Desconectado / sin terminar
- **Pantallas que llevan a la nada:** `lotes-piezas` navega a `/nuevo` y `/[id]` pero **solo existe `page.tsx`** (A: sistema de archivos). Sus 4 APIs de detalle no tienen quien las llame. Además 0 lotes en BD.
- **APIs sin llamadas:** `empleados/vendedores`, `reparaciones/tecnicos/carga`, `whatsapp/send`, `push/send`, 4 de lotes-piezas (8 en total; D).
- **Menú que redirige:** Categorías, Proveedores, Catálogo de Reparaciones aparecen a admin y el layout los manda a `/dashboard` (D). Ese catálogo tiene 0 filas.
- **Tres catálogos de servicios** que no se sincronizan: `servicios` (2), `catalogo_servicios_reparacion` (0), lista fija en código; `ServiciosManager` no está montado (B+D).
- **Portal del cliente por enlace:** no puede entregarse mientras WhatsApp sea modo enlace.
- **Tablas sin uso** (0 filas): créditos, pagos, notificaciones fallidas, autorizaciones de descuento, apartados, kits, lotes, órdenes de compra.

## 6. Espejos y cómo unificarlos (propuesta, sin implementar)
| Espejo | Evidencia | Unificación |
|---|---|---|
| Órdenes ↔ Panel técnico | mismas ~45 APIs, mismas tarjetas, mismo modal y drawer (D) | una pantalla "Órdenes" con vistas *Mis órdenes / Todas* |
| Detalle `[id]` ↔ `OrdenDrawer` | `[id]` no tiene diagnósticos, tomar, asignar, piezas, precio, PDF versiones (D) | todo abre el drawer; `[id]` solo redirige |
| 4 entradas al drawer | Órdenes, Técnico, Dashboard, POS (D) | está bien: es el mismo componente; mantenerlo único |
| Estados: 10 archivos con mapa propio de `listo_entrega` | DashboardEjecutivo, TecnicoDashboard, ReparacionesPOSPanel, EstadoBadge, TimelineOrden, tracking, reparacion/[folio], cliente/perfil, clientes/[id], notificaciones (D) | un `EstadoBadge`/`etiqueta` que lea `estados.ts`; los demás lo importan |
| Stock bajo ×4 | A+B | `stock.ts` para todos (Productos, Sugerencias, POS, Alertas, Dashboard) |
| Costo vs precio en la orden | 7 columnas de dinero (A) | definir cuál manda y esconder el resto |
| Catálogos de servicios ×3 | B | uno solo con campo de ámbito |
| Inventario: 14 accesos en menú | B (agente) | 4 áreas con pestañas, sin perder funciones |
| Cartera/clientes/portal | C (agente) | Clientes, Cartera y Mensajes como una sección |

## 7. Qué cuesta hoy (efecto en el negocio)
- Dinero sin controlar: cajas abiertas meses y cierres en $0 → no se sabe cuánto debería haber.
- Equipos entregados sin cerrar la orden (117 días) → anticipos que siguen contando en la bolsa virtual, KPIs y semáforo mentirosos.
- Stock "bajo" distinto en cada pantalla → compras guiadas por número equivocado; 113 productos sin costo → utilidad no calculable.
- Seguridad: cualquiera con un teléfono de empleado puede tomar su cuenta.

## 8. Decisiones que necesito de Trini (de B y C, resumidas)
Cuándo se considera una orden "entregada" (¿cierro las 57 juntas?), si el crédito se vende desde POS o solo por Créditos, qué hacer con los catálogos de servicios, si Lotes de piezas se termina o se oculta, qué roles pueden borrar clientes, y si se activan otras tiendas pronto (define la urgencia de los filtros por tienda).

## 9. Cómo se mantiene
Regenerar el grafo tras cambios grandes: `node scripts/mapa-sistema.js`. Antes de tocar un dato: `--impacto`. Cuando se corrija algo de arriba, tachar aquí y en `MAPA-CONEXIONES.md`.
