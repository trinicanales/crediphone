# MAPA B — POS, Caja, Inventario, Productos y Servicios
> 2026-11-11 · SOLO LECTURA. Código del repo + Supabase `ihvjjfsefnvcrczrcmhp` (solo SELECT). Nada fue modificado ni escrito.
> **COMPROBADO** = visto en código y/o en la base real. **SUPUESTO** = deducido, no verificado. **NO REPRODUCIDO** = requiere escribir en la base; se probó solo leyendo el código y las restricciones (CHECK/FK) de la base.
> Partí de los cuatro informes previos (`AUDITORIA-POS-2026-10-21`, `INFORME-PROBLEMAS-REALES-2026-11-07`, `AUDITORIA-INTEGRACION-2026-10-19`, `MAPA-CONEXIONES`). Lo ya documentado lo marco **(ya documentado)** y solo lo confirmo; los hallazgos **NUEVOS** llevan la etiqueta **[NUEVO]**.

## 0. Datos reales de la base que importan (consulta de hoy)
| Dato | Valor |
|---|---|
| Productos | 137 (todos `tipo='accesorio'`, todos activos). 135 en CREDIPHONE Principal, 2 en "EL TALLER DE LALO" |
| Ventas POS en toda la historia | 6 (mar–jun 2026), suman $535; la última el 12-jun. 2 de las 6 tienen `distribuidor_id` NULL. 0 ventas de servicios (`es_servicio`=0) |
| Devoluciones / kits / lotes de series / lotes de piezas / órdenes de compra / apartados | **0 / 0 / 0 / 0 / 0 / 0** → todo ese código jamás se ha usado en producción: los fallos están latentes |
| `servicios` (catálogo del POS) | 2 filas ("Copias e impresiones" $0, "Enmicado" $20) |
| `catalogo_servicios_reparacion` (catálogo de reparaciones) | **0 filas** |
| `movimientos_stock` | 10 filas en toda la historia (9–20 jun) |
| Productos con `stock_minimo = 0` | 55 de 137 (40 %) |
| Productos sin costo (`costo` nulo o 0) | 113 de 137 (82 %) |
| `stock_apartado` > 0 | 0 productos |
| Ubicaciones: `ubicacion_id` y `ubicacion_fisica` | 65 de 65 coinciden; 70 productos sin ubicación; 2 con texto pero sin id |
| Cajas: sesiones / abiertas / cerradas con monto final $0 | 52 / **4** / **20** |
| `caja_movimientos` sin `distribuidor_id` | 165 de 196 |
| Verificaciones de inventario en proceso (atoradas) | 2 de 2 |

---

## 1. Inventario de pantallas, componentes y APIs

### 1.1 POS y Caja
| Ruta | Para qué sirve (lenguaje simple) | Roles (sidebar → API) | APIs que llama | Tablas |
|---|---|---|---|---|
| `/dashboard/pos` (`pos/page.tsx`, 2 682 líneas) | El mostrador: buscar/escanear producto, armar el carrito, cobrar (efectivo, tarjeta, transferencia, mixto), vender servicios/kits/promociones, abrir y cerrar turno, cobrar reparaciones (anticipos/saldo/entrega), apartados, venta a crédito, devoluciones | admin, vendedor, super_admin (la página redirige a otros) | `/api/productos`, `/api/pos/ventas` (GET stats/POST), `/api/pos/caja` (+`/[id]`), `/api/pos/reparaciones-activas`, `/api/pos/reparacion-buscar`, `/api/pos/reparacion-cobro`, `/api/apartados`, `/api/creditos/[id]/completar-apartado`, `/api/pos/venta-credito`, `/api/pos/devoluciones`, `/api/servicios?activos=true`, `/api/kits`, `/api/promociones`, `/api/clientes/*` (puntos, resumen-pos), `/api/asistencia/*`, `/api/pos/scan-session` | productos, ventas, ventas_items, caja_sesiones, caja_movimientos, anticipos_reparacion, ordenes_reparacion, creditos, servicios, kits, promociones, movimientos_stock, puntos |
| `/dashboard/pos/caja` (1 316 l.) | "Caja / Turno": abrir/cerrar turno, retiros/depósitos, reporte X/Z, historial de sesiones, bolsa virtual del turno, anticipos sin caja (anti-fraude) | admin, vendedor, super_admin | `/api/pos/caja`, `/api/pos/caja/[id]` (movimientos, anticipos, reporte, bolsas-cobradas), `/api/configuracion`, `/api/asistencia/*` | caja_sesiones, caja_movimientos, anticipos_reparacion, ventas, configuracion |
| `/dashboard/pos/historial` (893 l.) | Lista de ventas, ver detalle, reimprimir recibo, cancelar venta (admin), devolver (admin) | admin, vendedor, **cobrador**, super_admin | `/api/pos/ventas`, `/api/pos/ventas/[id]`, `/api/pos/ventas/[id]/recibo`, `/api/pos/devoluciones` | ventas, ventas_items, devoluciones |
| Componentes `src/components/pos/` (16) | `ShoppingCart`, `ProductSearchBar` (carga **todo** `/api/productos`), `ProductCategoryGrid`, `PaymentMethodSelector`, `DescuentoPOS` (+`ModalEsperaAutorizacion` → `/autorizar-descuento/[token]`), `ReciboModal`, `ServiciosPOSPanel`, `KitsPOSPanel`, `ReparacionesPOSPanel`, `BolsaVirtualPanel`, `ApartadoModal`, `VentaCreditoModal`, `DevolucionModal`, `MobileScannerQR`, `OfflineBanner` (cola `lib/offline/queue`) | — | — | — |
| Backend POS | `api/pos/{ventas,ventas/[id],ventas/[id]/recibo,caja,caja/[id],caja/[id]/bolsas-cobradas,devoluciones,devoluciones/elegibilidad,reparacion-buscar,reparacion-cobro,reparaciones-activas,bolsa-disputa,scan-session,stats,venta-credito}`; libs `lib/db/{ventas,caja,devoluciones}.ts` | ver §3 | | |

### 1.2 Productos, catálogo y servicios
| Ruta | Para qué sirve | Roles | APIs | Tablas |
|---|---|---|---|---|
| `/dashboard/productos` (3 409 l.) | Lista de productos con filtros de stock, alta/edición (ficha larga), eliminar, ajuste de stock con motivo, historial de movimientos del producto, historial por IMEI, **imprimir etiquetas** (individual y masiva, Code128: ~1 000 líneas), importar remisión (`components/productos/ImportRemisionModal`) | admin, vendedor, super_admin | `/api/productos` (+`/[id]` PUT/PATCH/DELETE), `/api/categorias`, `/api/subcategorias`, `/api/proveedores`, `/api/inventario/ubicaciones`, `/api/inventario/movimientos?productoId`, `/api/productos/{sugerencias,historial-imei,importar-remision,remision/pdf}` | productos, categorias, subcategorias, proveedores, ubicaciones_inventario, movimientos_stock |
| `/dashboard/productos/kits` (507 l.) | Combos de productos con precio propio (se venden desde el POS) | admin, super_admin | `/api/kits`, `/api/kits/[id]` | kits, kits_items |
| `/dashboard/servicios` (643 l.) | Catálogo de servicios de **mostrador** (copias, enmicado…) con precio fijo o rango; categorías propias | admin, super_admin (menú); `moduleKey: pos` | `/api/servicios`, `/api/servicios/[id]`, `/api/servicios/categorias` | servicios |
| `/dashboard/admin/catalogo-reparaciones` | Lista de precios de **reparaciones** por marca/modelo con tiempo estimado (alimenta `ModalOrden`) | admin, super_admin | `/api/catalogo-servicios`, `/[id]` | catalogo_servicios_reparacion (0 filas) |
| `components/configuracion/ServiciosManager.tsx` | Editor de `servicios` dentro de Configuración | — | `/api/servicios*` | servicios. **COMPROBADO: no está montado en ninguna pantalla** (`grep ServiciosManager` solo encuentra su propio archivo) → código huérfano |
| `/dashboard/admin/categorias` (104 l.), `/dashboard/admin/proveedores` (119 l.) | Alta/edición de categorías y proveedores (páginas de servidor) | admin, super_admin | `/api/categorias`, `/api/subcategorias`, `/api/proveedores` | categorias (19), subcategorias, proveedores (4) |
| `/catalogo` (público, 1 153 l.) | Tienda pública: productos con stock + "servicios de reparación" con precios "desde" | público | `/api/public/productos` | productos (join distribuidores) |

### 1.3 Compras e inventario (los "14 accesos" del menú lateral)
Menú: Catálogo [Productos, Kits, Servicios, Categorías, Proveedores] + Órdenes de Compra + Lotes de Piezas + Stock y Ubicaciones [Verificar, Ubicaciones, Alertas Stock, Movimientos, Discrepancias, Series x Lote, Importar Excel] = **14 entradas**. Además existe `/dashboard/inventario` (hub de 163 l.) que **no aparece en el menú** y solo enlaza a 6 de ellas.

| Ruta | Para qué sirve | Roles | APIs | Tablas |
|---|---|---|---|---|
| `/dashboard/compras`, `/[id]`, `/nueva` (628+513+743 l.) | Órdenes de compra a proveedor: borrador→enviada→recibida (parcial/total); recibir **sube el stock** y escribe `movimientos_stock`; "sugerencias" desde stock bajo y ventas 60 días | admin, super_admin | `/api/ordenes-compra`, `/[id]` (acción `recibir`), `/sugerencias` | ordenes_compra, ordenes_compra_items, productos, movimientos_stock |
| `/dashboard/lotes-piezas` (464 l.) | Pedidos de piezas para reparaciones en lote (llegada, costo de envío repartido entre reparaciones) | admin, super_admin | `/api/lotes-piezas*` | lotes_piezas, lotes_piezas_items, reparacion_piezas. **No toca `productos.stock`** (el archivo `lib/db/lotes-piezas.ts` no contiene `stock`) |
| `/dashboard/inventario/verificar` (1 529 l.) | Conteo físico por escaneo; compara contra stock; admin puede "ajustar stock" | admin, vendedor, super_admin | `/api/inventario/verificaciones*` | verificaciones_inventario, verificaciones_items, alertas_productos_nuevos, productos |
| `/dashboard/inventario/discrepancias` (566 l.) | Historial/resumen de conteos con faltantes/sobrantes (mismos datos que Verificar) | admin, super_admin | `/api/inventario/verificaciones*` | igual |
| `/dashboard/inventario/ubicaciones` (446 l.) | Catálogo de ubicaciones físicas (QR) y qué producto está en cada una; mover producto | admin, vendedor, super_admin | `/api/inventario/ubicaciones*` | ubicaciones_inventario (6), movimientos_ubicacion (0) |
| `/dashboard/inventario/alertas` (1 244 l.) | Tres cosas en una: (a) stock bajo/agotado + "alta demanda" cruzando `/api/pos/stats`, (b) botón crear OC de resurtido / descontinuar producto, (c) alertas de **producto nuevo** detectado al escanear (otra tabla) | admin, super_admin (+vendedor en la página, no en menú) | `/api/productos`, `/api/inventario/alertas`, `/api/pos/stats`, `/api/ordenes-compra*`, `PUT /api/productos/[id]` | productos, alertas_productos_nuevos, ordenes_compra |
| `/dashboard/inventario/movimientos` (286 l.) | Bitácora de movimientos de stock + alta manual de entrada | admin, super_admin | `/api/inventario/movimientos` | movimientos_stock |
| `/dashboard/inventario/series` (892 l.) | "Series x Lote": ingresar un lote de IMEIs de un producto, detectar duplicados, procesar/cancelar | admin, super_admin | `/api/lotes-series*`, `/api/productos`, `/api/proveedores` | lotes_series, lotes_series_items, productos |
| `/dashboard/inventario/importar` (484 l.) | Carga masiva Excel de productos/series (plantilla descargable) | admin, super_admin | `/api/inventario/importar`, `/api/inventario/plantilla` | productos, categorias |
| Componentes `src/components/inventario/` (4) | `BarcodeScanner`, `LocationSelector`, `ProductLocationCard`, `BannerInventarioSemanal` | | | |

---

## 2. Espejos y datos compartidos (qué pantallas ven/cambian lo MISMO)

### 2.1 El stock del producto (`productos.stock`) — 12 pantallas lo muestran, 13 sitios lo escriben
**Lo muestran:** POS (buscador + cuadrícula, `×stock`), Productos (lista + barra de mínimo), Alertas, Verificar (con desglose de apartado), Series, Ubicaciones, Kits (panel POS valida stock de cada componente), selector de piezas de reparación (`/api/productos/compatibles`, `hayStock = stock>0`), Sugerencias de OC, Dashboard (KPI `kpi_stock_bajo` / `esStockCritico`), **Catálogo público** (`stock>0`, caché 5 min) y la **página de seguimiento del cliente** (`getProductosEnStock`, promociones).

**Lo escriben** (todos distintos, solo 1 usa la función de base — y esa está rota, ver P-13):
1. Trigger `decrementar_stock_venta` al insertar `ventas_items` (con candado "Stock insuficiente") — COMPROBADO en la base.
2. Trigger `restaurar_stock_cancelacion` cuando la venta pasa a cancelada/reembolsada (suma TODOS los items).
3. `devoluciones.ts:308` (suma a mano → duplica con el 2).
4. `PATCH /api/productos/[id]` acción `ajustar_stock` (con motivo + movimiento + tenant: el único bien hecho).
5. `PUT /api/productos/[id]` → `updateProducto` acepta `stock` (`productos.ts:213`) **sin motivo ni movimiento** (la ficha lo manda siempre: `productos/page.tsx` envía `stock: Number(formData.stock)` si no cambió, ver P-14).
6. `POST /api/inventario/movimientos` (entrada manual).
7. Recepción de OC (`ordenes-compra.ts:332`).
8. Lote de series (`lotesSeries.ts:215/251`).
9. Verificación → "ajustar" (`verificaciones.ts:608`, pone `stock = contado`).
10. Importar Excel (`importar/route.ts:222/311`, **reemplaza** el stock del producto existente).
11. Importar remisión / crear producto (`createProducto`, stock inicial sin movimiento).
12. Reparaciones: piezas (apartar/liberar `stock_apartado`, `reparaciones.ts:1692-1842`; consumir al entregar `entrega.ts:108/142`; `/api/reparaciones/[id]/route.ts:486`).
13. `rpc("incrementar_stock")` al recibir pieza inmediata (`pedidos-pieza/route.ts:302`) — **no funciona**.

Solo se escriben `movimientos_stock` en: venta POS, venta a crédito (con columna equivocada), devolución, ajuste manual, entrada manual, recepción OC, lote de series, consumo de piezas al entregar. **No** se escriben en: edición de ficha (PUT), importar Excel, importar remisión/alta, verificación→ajustar, trigger de cancelación de venta, devolver piezas de reparación (parcial). Por eso la bitácora tiene 10 filas.

### 2.2 "Stock bajo": cuatro reglas distintas, cuatro números distintos (hoy, mismos 137 productos)
| Pantalla | Regla (archivo:línea) | Resultado hoy |
|---|---|---|
| Productos (filtro "Stock bajo", tarjeta) | `stockMinimo` definido **y** `stock<=stockMinimo` **y** `stock>0` (`productos/page.tsx:177-181, 240, 406`). Con mínimo 0 nunca marca | **3** |
| Alertas de inventario | `esStockCritico` (mínimo efectivo = 1 si es 0) y `stock>0` (`alertas/page.tsx:940`) | **24** bajos + 2 agotados |
| Dashboard / `kpi_stock_bajo` | `stock <= (mínimo>0 ? mínimo : 1)` incluye 0 y negativos (`lib/inventario/stock.ts`; SQL idéntica) | **26** |
| Sugerencias de OC | `stock=0` **o** (`stock_minimo` no nulo y `stock<=stock_minimo`) (`ordenes-compra/sugerencias/route.ts:37`) — con mínimo 0 solo cuenta si stock=0 | **5** |
| POS (aviso tras vender) | `stockDespues <= (stockMinimo ?? 0)` (`pos/page.tsx:171`) | depende; con mínimo 0 avisa solo si llega a 0 |
Además el "cuánto pedir": `alertas/page.tsx:25` usa `?? 5`; OC usa `(stock_minimo ?? 5)*2` (`sugerencias/route.ts:107`); el formulario de producto precarga mínimo **5** (`productos/page.tsx:1210`), el importar Excel pone **1** (`importar/route.ts:144`), el importar remisión pone `undefined`. **MAPA-CONEXIONES dice que la regla es única (`stock.ts`), pero solo la usan Dashboard y Alertas.** → **P-12**.

### 2.3 Buscar un producto: 6 formas distintas
| Pantalla | Cómo busca | ¿Solo activos? | ¿Descuenta apartado? |
|---|---|---|---|
| POS | descarga **todo** `/api/productos` (`getProductos`, sin `activo`, sin límite) y filtra en el navegador por nombre/marca/modelo/código | **No** (vende productos "descontinuados") | **No** (`producto.stock<=0` solo) |
| Productos | misma descarga completa | No (muestra todos, ok para administrar) | Muestra "N en rep." |
| `buscarProductos` (`/api/productos?q=`) | servidor, `activo=true`, límite 50, solo nombre/marca/modelo (no código/IMEI/SKU) | Sí | No |
| Alertas | descarga completa, filtra `activo !== false` | Sí | No |
| Verificar | escaneo por código (`scanProducto`) + faltantes | Sí | Sí (F1/F2) en pantalla; el **API de ajuste no** |
| Series, Kits, selector de piezas | cada uno con su consulta (`compatibles`: `activo` y tipo) | variable | No |
→ No existe un buscador/hook único. **P-17**.

### 2.4 Servicios: tres conceptos que se parecen
| Concepto | Dónde vive | Quién lo usa | Estado |
|---|---|---|---|
| `servicios` (mostrador: copias, enmicado) | tabla `servicios`; pantalla `/dashboard/servicios`; `ServiciosManager` (huérfano) | POS (`ServiciosPOSPanel`), `ventas_items.servicio_id` (FK) | 2 filas; **0 ventas de servicio** |
| `catalogo_servicios_reparacion` (precio base por marca/modelo + tiempo) | `/dashboard/admin/catalogo-reparaciones` | `ModalOrden` (precio sugerido). `ModalDiagnostico` y `SelectorPiezasCotizacion` lo **excluyen a propósito** (comentarios) | **0 filas** |
| Servicios del catálogo público | **lista fija escrita en el código** (`app/catalogo/page.tsx` `SERVICIOS_REPARACION`: precios "desde $599/$349…") | solo la web pública | no se enlaza a ninguna tabla |
| `productos.tipo='servicio'` | existe en el tipo TS y en el import de remisión, y la ficha lo trata como sin stock | — | 0 filas |
Ninguno se sincroniza con otro: cambiar un precio en uno no afecta a los demás. **P-22**.

### 2.5 Otros espejos
- **Piezas de reparación ↔ inventario:** `reparacion_piezas`, `pedidos_pieza_reparacion` y `lotes_piezas_items` (sin `producto_id`) son tres lugares donde "una pieza" existe; solo las dos primeras tocan `productos` (por `producto_id`). Lotes de piezas **no** suma stock aunque llegue la mercancía. (Al entregar, `entrega.ts` consume por **3a** `reparacion_piezas` y por **3b** `pedidos_pieza_reparacion`; si una misma pieza queda en ambas tablas podría descontarse dos veces — SUPUESTO, lo debe confirmar el mapa de reparaciones.)
- **Dinero de la caja:** `caja_movimientos` (auditoría) vs `anticipos_reparacion` (verdad del cierre) vs `ventas` vs `caja_sesiones.total_*`. El cierre usa tres fuentes diferentes (ver P-9) y guarda totales solo de ventas, no de anticipos.
- **Ubicación del producto:** `ubicacion_id` (nuevo) y `ubicacion_fisica` (texto) — hoy coinciden 65/65, pero `moverProducto` solo actualiza el id (`ubicaciones.ts:303`) y la ficha escribe ambos.
- **Alertas:** hay dos cosas llamadas "alertas": stock (calculado) y `alertas_productos_nuevos` (tabla, por escaneo). El hub de inventario cuenta **todas** las de producto nuevo (`/api/inventario/alertas` sin `?pending=true`) y las muestra en la tarjeta que lleva a "Alertas de Stock".
- **Verificar vs Discrepancias:** misma API y mismas filas; Discrepancias es solo una vista de resumen del historial.
- **Kits:** no tienen stock propio; el POS los "expande" a sus componentes (decrementa cada producto). Sin espejo en Alertas/Productos (un kit con un componente agotado no avisa).

---

## 3. Estado: qué funciona y qué no

### 3.1 Funciona (COMPROBADO en código y/o base)
- Vender producto: folio automático, el trigger **bloquea** vender más de lo que hay (`Stock insuficiente`), snapshot de nombre/marca/modelo en `ventas_items`, `movimientos_stock` con stock antes/después, puntos (si hay cliente).
- Validaciones del servidor en `createVenta`: descuento entre 0 y subtotal (`ventas.ts:239`), efectivo con monto suficiente, pago mixto suma exacta.
- Ajuste manual de stock (PATCH `ajustar_stock`): motivo obligatorio, tenant, movimiento.
- Recepción de OC: parcial/total, sube stock, escribe movimiento.
- Todas las consultas de `/api/productos*`, ventas, kits, servicios, lotes filtran por `distribuidor_id` cuando hay uno (con las excepciones de P-11).
- Catálogo público no expone costo/proveedor.
- Regla única de stock bajo en Dashboard y Alertas (misma función).
- Roles del menú coinciden con los de las APIs en POS, devoluciones (solo admin), cancelar venta (solo admin), kits/servicios (solo admin).

### 3.2 Problemas (P-xx)
Severidad: **Crítica** (dinero/inventario se falsea hoy), **Alta**, **Media**, **Baja**. "Hoy" = ocurre con el uso actual; "Latente" = romperá cuando se use la función (0 usos en la base).

#### Dinero y caja
**P-1 · Devoluciones imposibles de procesar — Crítica (Latente)** (ya documentado, **sigue sin corregir**)
- Evidencia: `lib/db/devoluciones.ts:219` pide `ventas_items.nombre_producto` (columna real: `producto_nombre`); también `:235` y `:367`. COMPROBADO contra columnas de la base. Efecto: "No se encontraron los items"; 0 devoluciones en la historia.
- Cómo comprobar sin escribir: `select nombre_producto from ventas_items` → error `column does not exist`.

**P-2 · Devoluciones: aun arreglando la columna, el proceso es inseguro — Alta (Latente)** (parcial ya documentado + **[NUEVO]** lo marcado)
- Doble reintegro de stock en devolución total (código `:300-315` + trigger) — documentado y reproducido A10.
- Se valida contra lo vendido, no contra lo ya devuelto (`:233`) — documentado.
- **[NUEVO]** `ventaItems` se busca solo por `id` (`:218-221`): no se exige que pertenezcan a `payload.ventaId` → se puede devolver (y reintegrar stock/dinero) con items de **otra venta o de otra tienda**; y `venta` se busca sin filtrar tienda.
- **[NUEVO]** `cantidadDevuelta` solo se compara con `>` el máximo; un valor 0 o **negativo** pasa y resta stock / da monto negativo. NO REPRODUCIDO (requiere escribir).
- **[NUEVO]** `devoluciones.metodo_reembolso` solo admite `efectivo|transferencia` (CHECK en la base): no se puede reembolsar a tarjeta; y no hay movimiento en `caja_movimientos` (CHECK de `tipo` sin "devolucion_venta") → el efectivo que sale no entra al cuadre (documentado POS-4).
- Efecto: stock y dinero falsos al empezar a usar devoluciones.

**P-3 · Cancelar venta incompleto — Alta (Latente)** (ya documentado, confirmado en `ventas.ts:425-455`)
- Solo cambia `estado`; sobrescribe `notas` con el motivo; no revisa si ya estaba cancelada/devuelta parcialmente; el trigger suma stock sin `movimientos_stock`; no revierte caja, puntos ni comisión.

**P-4 · Venta a crédito (enganche) no se puede guardar — Alta (NUEVO, no reproducido)**
- Evidencia: `api/pos/venta-credito/route.ts:87` inserta `ventas.metodo_pago = 'credito'`; la base tiene `CHECK ventas_metodo_pago_check` = `efectivo|transferencia|tarjeta|mixto` (COMPROBADO en `pg_constraint`). El INSERT debe fallar con violación de CHECK → el botón "Venta a crédito" del POS (`VentaCreditoModal`) siempre devuelve error. 0 créditos con productos vendidos por esta vía.
- Además (aunque se arregle el CHECK): `:151` escribe `movimientos_stock.creado_por` (no existe; la columna es `registrado_por`) y es "fire-and-forget"; `ventas.total` = precio completo aunque solo se cobra el enganche (infla "ventas de hoy" y estadísticas); `cerrarCaja` no tiene `case 'credito'` (el enganche en efectivo no entra al cuadre de efectivo, `caja.ts` switch del paso 2); el precio total lo manda el cliente sin comparar con los items.
- Cómo comprobar: leer el CHECK (hecho) y hacer la venta a crédito en un entorno de pruebas.

**P-5 · Vender una promoción en el POS falla — Alta (NUEVO, no reproducido)**
- Evidencia: `pos/page.tsx:468` mete la promo al carrito como servicio con `servicioId = "promo_<uuid>"`; al cobrar (`:542`, `:648`, `:711`) solo se quita el prefijo `svc_` y un sufijo `_<números>`; `ventas_items.servicio_id` es `uuid` con **FK a `servicios`** (COMPROBADO) → el INSERT falla ("invalid input syntax for type uuid") y `createVenta` borra la venta y lanza error. Las promociones son **imposibles de cobrar** en el POS.

**P-6 · Kits: tres rutas de cobro, solo una los expande — Alta (Latente, kits=0)** (NUEVO)
- `handleCompletarVenta` expande el kit en sus componentes (`pos/page.tsx:525-538`), pero **F9 (`handleCobroModal` :700) y F12 (`handlePagoRapido` :640) mapean los items sin expandir**: un kit sale con `productoId` indefinido y `esServicio` falso → `createVenta` lo descarta (`productItems`/`serviceItems` lo filtran) → **se cobra el kit pero no se registra ni se descuenta nada**.
- En la ruta que sí expande, el precio completo del kit va en el primer componente multiplicado por `ki.cantidad × cantidad` (`:535-538`): si el primer componente tiene cantidad 2, el kit se cobra doble en `ventas_items` (el total mostrado al cliente no coincide con lo guardado).
- Además F9/F12 mandan `descuento` pero no `descuentoPuntos`; con puntos canjeados el `total` en pantalla es menor que `subtotal-descuento`, y el servidor rechaza con "Monto recibido insuficiente" (`ventas.ts` validación de efectivo) → error visible, no silencioso.

**P-7 · El precio se puede cambiar libremente en el carrito y el servidor lo acepta — Alta (NUEVO en su parte de interfaz; el servidor ya documentado POS-11)**
- `ShoppingCart.tsx:172-182`: cualquier vendedor puede teclear cualquier precio unitario ≥ 0 en cada línea, **sin autorización ni límite**, mientras que el descuento sí pasa por `DescuentoPOS` + `ModalEsperaAutorizacion` (`/autorizar-descuento/[token]`) con `limites_descuento`. Es una puerta trasera al control. `createVenta` no compara con `productos.precio` ni con el costo; `descuento_maximo_pct` (por defecto 100) y `limites_descuento` no se aplican en el servidor. Los rangos `precio_min/max` de servicios también solo se validan en `ServiciosPOSPanel`, no en el cobro.
- Comprobable: en el POS, agregar un producto y cambiar su precio a $1 (sin escribir si se cancela antes de cobrar).

**P-8 · Cierre de caja: en cero, sin alerta, cajas abiertas — Crítica (Hoy)** (ya documentado, **confirmado con datos de hoy**)
- 52 sesiones: **4 abiertas**, **20 cerradas con monto final $0** (eran 21; ahora 20). `PUT /api/pos/caja/[id]` acepta `montoFinal = 0` (`route.ts:205`, solo rechaza `< 0`).
- La alerta de descuadre usa columnas inexistentes de `notificaciones` (`caja.ts` paso 6; reproducido A2) → 0 alertas.
- `abrirCaja` pega a la sesión nueva TODOS los anticipos en efectivo del usuario sin sesión (de cualquier fecha) (`caja.ts:127-136`).

**P-9 · Cierre de caja: el cuadre mezcla fuentes y deja huecos — Media (NUEVO, mayormente latente)**
- Efectivo esperado = inicial + ventas efectivo (+ parte efectivo del mixto) + anticipos con `tipo_pago='efectivo'` + depósitos − retiros (`caja.ts:236-240`). **Quedan fuera:** la parte en efectivo de anticipos `mixto` (el CHECK de anticipos admite `mixto`; hoy 0 filas), el enganche en efectivo de ventas a crédito (P-4), devoluciones en efectivo (P-2) y cobros de reparación que el POS registra como `cobro_reparacion` en `caja_movimientos` (excluidos a propósito para no contar doble; dependen de que exista el anticipo asociado).
- No se guardan en `caja_sesiones` los totales de anticipos (ni por método) → el reporte X/Z los vuelve a calcular de otra fuente y puede diferir del cierre guardado.
- El bloque "Payjoy" (`:208-224`) suma **todos** los pagos Payjoy del **día** (`fecha_pago` por fecha, sin tienda ni sesión) a los totales de **cada** cierre de ese día. Payjoy está apagado (`FEATURES`), por eso hoy no pasa; al encenderlo, cada tienda/turno sumaría los pagos de todas.

**P-10 · Se puede vender sin caja abierta por la API, y las ventas de super_admin quedan sin tienda — Media** (ya documentado POS-10; **[NUEVO] el dato de ventas sin tienda**)
- La pantalla exige turno (`pos/page.tsx:506`) pero `POST /api/pos/ventas` crea la venta con `sesion_caja_id = null` si no hay turno (`route.ts`). Hoy 0 de 6 ventas sin sesión (todas con turno).
- **[NUEVO]** 2 de las 6 ventas tienen `distribuidor_id` NULL (las hizo un super_admin: `distId` = undefined): no aparecen en estadísticas ni historial de ninguna tienda (los filtros usan `.eq('distribuidor_id', …)`).

#### Aislamiento entre tiendas (multi-tenant)
**P-11 · Falta filtro por tienda en varias rutas — Alta (NUEVO en su mayoría; DELETE producto ya documentado)**
COMPROBADO por lectura de código (no probado con dos usuarios reales):
- `GET/PUT /api/pos/caja/[id]`: un `admin` de cualquier tienda lee/cierra/mueve la caja de otra si conoce el id (`caja/[id]/route.ts`: solo valida `usuario_id` para vendedores).
- `GET /api/pos/caja?action=activa&usuarioId=` acepta el id de **otro** usuario (cualquier vendedor ve el turno de otro; el POS lo usa legítimamente para "caja de otro empleado", pero lista a toda la tienda sin comprobar rol).
- `DELETE /api/productos/[id]` → `deleteProducto(id)` **sin** `distribuidorId` (`route.ts:221`; documentado). Sin guardas de stock/reservas/kits.
- `POST /api/inventario/movimientos`: busca el producto solo por id (sin tenant) y suma stock; además `tipo` viene del cliente (se puede registrar como "venta_pos" o cualquier otro).
- `DELETE /api/inventario/ubicaciones/[id]`, `moverProducto` y `getEstadisticasVerificacion()` sin filtro de tienda (esta última cuenta alertas/verificaciones de **todas** las tiendas).
- `GET/PATCH /api/ordenes-compra/[id]`: `getOrdenCompra(id)` sin tenant → un admin podría ver o recibir (subir stock de) una OC ajena.
- `createVenta` no verifica que `productoId` sea de la tienda (documentado POS-12); `crearDevolucion` tampoco (P-2).
- `GET /api/productos` no revisa rol: `tecnico` y `cobrador` reciben `costo`, `proveedorId` y márgenes (el modelo `Producto` los trae). Decisión de negocio (ver §6).
- `GET /api/public/productos` **sin** `distribuidorSlug` (dominio principal) devuelve los productos de **todas** las tiendas activas mezclados (hoy 2 de "El taller de Lalo" aparecerían en crediphone.com.mx). COMPROBADO en `public/productos/route.ts` (el filtro del slug es opcional).

#### Stock e inventario
**P-12 · Cuatro reglas de "stock bajo" + defaults distintos — Media (NUEVO, números en §2.2)**
Productos dice 3, Alertas 24(+2), Dashboard 26, OC 5. Defaults de mínimo: 5 / 1 / `undefined` / 0. 55 productos (40 %) con mínimo 0 que cada pantalla trata distinto. Efecto: la dueña ve números contradictorios y no sabe cuánto pedir.

**P-13 · `incrementar_stock` está roto — Media (NUEVO, no reproducido)**
- La función en la base es `incrementar_stock(producto_id uuid, cantidad integer)` y hace `UPDATE productos SET stock_actual = stock_actual + cantidad` — **`productos.stock_actual` no existe** (la columna es `stock`). Además `pedidos-pieza/route.ts:302` la llama con parámetros `p_producto_id/p_cantidad` (nombres que no existen) y con `.maybeSingle()` sin revisar el error. Dos fallos independientes: cuando se marca "recibir inmediatamente" una pieza del inventario, el stock **no sube** y nadie lo ve; luego al entregar, `entrega.ts` lo **descuenta** → el inventario baja de más.
- Comprobar: `select pg_get_functiondef(...)` (hecho). Prueba funcional requiere escribir.

**P-14 · Editar un producto puede pisar ventas hechas mientras tenía la ficha abierta — Media (NUEVO)**
- La ficha envía `stock: Number(formData.stock)` en el `PUT` siempre que no cambió el stock (`productos/page.tsx:1475` → `updateProducto` `productos.ts:213`). Si entre abrir y guardar hubo una venta, el stock vuelve al valor viejo sin movimiento. Mismo patrón "leer→calcular→escribir" en los 13 sitios.

**P-15 · Importar Excel reemplaza el stock sin bitácora — Alta (NUEVO)**
- `importar/route.ts:222` y `:311`: si el código de barras/SKU ya existe, `updates.stock = stock` (sustituye, no suma), también reemplaza precio, costo, categoría, tipo y `activo`; no escribe `movimientos_stock`; no respeta `stock_apartado`. Un Excel viejo deja el stock desfasado respecto a ventas posteriores.

**P-16 · "Ajustar stock" desde la verificación — Alta (parcialmente documentado; confirmado)**
- `verificaciones.ts:608` pone `stock = cantidadContada` sin `movimientos_stock`, sin marcar la verificación como aplicada (se puede repetir), sin tenant en `getDiferenciasVerificacion` (solo por id) y sin restar `stock_apartado` aunque la pantalla sí lo muestra (F1/F2: la pantalla compara contra "disponible", el API contra `stock` total, `:573`). 2 verificaciones "en proceso" atoradas (hoy 2 de 2).

**P-17 · El POS y el seguimiento ofrecen productos inactivos o reservados — Media (NUEVO)**
- `getProductos` (usado por el buscador del POS y `ProductCategoryGrid`) no filtra `activo`; "Descontinuar" (Alertas) deja el producto vendible. `getProductosEnStock` (promociones en `/tracking/[token]`) tampoco filtra `activo` ni resta apartado. `verificarStockBajoDespuesVenta` y el tope de cantidad usan `stock`, no `stock - stock_apartado`; el trigger de venta tampoco: se puede vender una pieza apartada para una reparación. Hoy `stock_apartado` = 0 en todo, por eso no se nota (Latente).

**P-18 · Lotes de series: stock sube en "borrador" y cancelar no revierte — Media (NUEVO, 0 usos)**
- `lotesSeries.ts`: el stock y los productos serializados se crean al **crear** el lote (estado `borrador`), no al "procesar"; `cancelarLote` solo cambia el estado (no resta stock ni borra los productos creados). Para productos serializados suma `stock` al producto base, lo registra en `movimientos_stock` y luego lo **restablece** a su valor anterior (`:251`), dejando una bitácora que no coincide con el stock real, y crea un producto por IMEI sin `distribuidor`/categoría completos.

**P-19 · Lotes de piezas: desconectado del inventario y con columna incorrecta — Media (ya documentado B16, confirmado)**
- `lotes-piezas.ts:415` consulta `reparacion_piezas.reparacion_id` (no existe; son `orden_id`/`lote_id`). `lotes_piezas_items` no tiene `producto_id` ni escribe stock/movimiento al recibir. 0 usos.

**P-20 · Compras no alimentan el costo — Media (NUEVO)**
- `recibirMercancia` (`ordenes-compra.ts`) sube stock pero **no actualiza `productos.costo`** (el archivo ni menciona costo). 113 de 137 productos no tienen costo → utilidad por producto, P&L y "precio < costo" son imposibles de calcular. Tampoco compara `precio_unitario` de la OC con el último costo.

**P-21 · Bitácora de movimientos casi vacía y escrituras "se lanzan y se olvidan" — Media (confirma y amplía el documento 19-oct)**
- 10 filas en toda la historia. Escrituras `fire-and-forget` (`.then(()=>{})` sin `await`, p. ej. `venta-credito/route.ts:155`, puntos en `ventas.ts:399`) pueden cortarse cuando el Worker de Cloudflare termina la respuesta (SUPUESTO sobre el runtime; el código de `createVenta` sí hace `await` de `movimientos_stock`).
- La ficha, el import y el alta inicial no registran movimiento (P-14, P-15).

#### Servicios y catálogo
**P-22 · Dos catálogos de servicios + uno fijo en la web + código huérfano — Media (ya documentado a medias; NUEVO el detalle)**
Ver §2.4. `ServiciosManager.tsx` (≈600 líneas) sin uso; `catalogo_servicios_reparacion` vacío (el taller cotiza a mano); precios del catálogo público fijos en el código; el POS jamás ha vendido un servicio (0 `es_servicio`); la tabla `servicios` tiene `precio_fijo/min/max` pero el servidor no los exige (P-7).

**P-23 · Catálogo público — Media (NUEVO)**
Mezcla tiendas sin slug (P-11); muestra todo producto activo con stock (incluye refacciones y accesorios internos si existieran); `stock` público sin descontar apartado y con caché de 5 min (`s-maxage=300`) → puede ofrecer lo ya vendido; el filtro `q` interpola texto en `.or()` (comas/paréntesis rompen o alteran el filtro; mismo patrón en `buscarProductos`).

#### Apartados, puntos, estadísticas y varios
**P-24 · Apartados incompletos — Alta cuando se use (ya documentado POS-9; sigue igual)**
`creditos.ts:519-522` aún dice que reserva stock pero no lo hace; depósito sin caja; completar solo cambia estado; sin cancelar/vencer. 0 apartados en la base.

**P-25 · Puntos de lealtad — Media (ya documentado POS-15 + [NUEVO] el canje)**
No se revierten al cancelar/devolver. El **canje** es una llamada aparte desde el navegador (`pos/page.tsx:591`) después de guardar la venta: si falla o se cierra la pestaña, la venta ya quedó con descuento y los puntos no se descuentan.

**P-26 · Estadísticas del POS — Baja (NUEVO)**
`getEstadisticasPOS`: los servicios (sin `producto_id`) se agrupan bajo una sola clave nula en "más vendidos"; no resta devoluciones; una venta a crédito cuenta su total completo (P-4). Alimenta "Alta demanda" en Alertas.

**P-27 · Ubicaciones — Baja (ya documentado; hoy 65/65 coinciden)**
`productos.ubicacion_id` sin FK (borrar la ubicación deja ids colgando; hoy 2 productos con texto sin id); `moverProducto` no actualiza `ubicacion_fisica`; `deleteUbicacion` sin tenant.

**P-28 · Hub de inventario y etiquetas confusas — Baja (NUEVO)**
`/dashboard/inventario` no está en el menú; su tarjeta "Alertas" cuenta todas las alertas de producto nuevo (incluidas ya resueltas) y lleva a una pantalla que principalmente muestra stock bajo. "Discrepancias" y "Verificar" comparten datos.

**P-29 · Pantallas gigantes — Baja (mantenimiento)**
`productos/page.tsx` 3 409 líneas (≈1 000 solo de etiquetas/Code128/IMEI), `pos/page.tsx` 2 682 con **tres copias** casi idénticas del armado de venta (Cobrar/F9/F12) — causa directa de P-6 —, y apertura/cierre de turno duplicados entre POS y `/pos/caja`.

### 3.3 Lo que no pude comprobar
Ninguna operación de escritura (ventas, devoluciones, cierres, importaciones) se reprodujo. P-2 (cantidad negativa/cross-venta), P-4, P-5, P-6, P-11 (aislamiento entre tiendas) y P-13 están **demostradas por código + restricciones de la base**, no ejecutadas. El comportamiento del Worker con promesas sin `await` (P-21) es un SUPUESTO. El PDF/recibo y el flujo offline (`lib/offline/queue`, la venta guardada se reenvía luego a `/api/pos/ventas` y se asocia al turno abierto en ese momento) no se auditaron a fondo.

---

## 4. Efectos que faltan (evento → qué debería reflejarse → qué pasa hoy)
| Evento | Debería afectar | Hoy |
|---|---|---|
| **Vender producto** | stock ✔, bitácora ✔ (con `await`), caja (esperado) ✔ por ventas efectivo, puntos ✔ (sin `await`), alerta de stock bajo (solo aviso en pantalla), comisión vendedor (?) | ✔ casi todo; falta alerta persistente y comisión no verificada |
| **Vender servicio / promoción** | ingreso, caja | servicio ✔ (0 usos); **promoción ✘ no se puede guardar** (P-5) |
| **Vender kit** | stock de cada componente, precio correcto | ✔ solo en "Cobrar"; ✘ en F9/F12; precio doble posible (P-6) |
| **Venta a crédito** | venta, enganche en caja, crédito, stock | ✘ falla por CHECK (P-4) |
| **Devolver** | stock **una vez**, dinero en caja, puntos, comisión, bitácora, límite acumulado | ✘ rota (P-1/P-2) |
| **Cancelar venta** | stock, bitácora, caja, puntos, comisión, motivo sin pisar notas | solo estado + stock por trigger (P-3) |
| **Recibir OC** | stock ✔, bitácora ✔, **costo del producto**, cuenta por pagar/gasto en P&L, estado del pedido | costo ✘, gasto: el P&L lee OC aparte (`reportes/pnl` líneas ~119) |
| **Recibir lote de piezas** | stock de la pieza o costo en reparaciones | ✘ no toca inventario (P-19) |
| **Recibir pieza "inmediata" en reparación** | stock +1, luego −1 al entregar | ✘ el +1 falla en silencio (P-13) |
| **Cambiar precio de producto** | cotizaciones abiertas (por diseño no), catálogo público (caché 5 min), etiquetas impresas, historial de precios | sin historial de precio de producto; sin aviso |
| **Cambiar costo** | utilidad histórica | no hay historial; 82 % sin costo |
| **Cambiar stock mínimo** | alertas | cada pantalla lo interpreta distinto (P-12) |
| **Descontinuar producto** | POS, catálogo, sugerencias de OC, selector de piezas, kits que lo contienen | catálogo ✔; **POS ✘, seguimiento ✘, kits ✘** (P-17) |
| **Eliminar producto** | kits (FK RESTRICT ✔), `piezas_cotizacion` JSON, ventas (RESTRICT ✔), otras tiendas | sin tenant ni guardas (P-11) |
| **Mover de ubicación** | `ubicacion_fisica`, historial | solo id; sin historial desde la ficha (P-27) |
| **Verificar inventario → ajustar** | bitácora, apartado, marcar aplicado, tenant | ✘ (P-16) |
| **Importar Excel / remisión** | bitácora, no pisar stock | ✘ (P-15) |
| **Cerrar caja** | cuadre completo, alerta, totales por método guardados, bloquear cierre en $0, cajas abiertas por días | alerta ✘, $0 permitido, huecos (P-8/P-9) |
| **Abrir caja** | solo anticipos del día/turno | pega todos los anteriores sin sesión (P-8) |
| **Cancelar/entregar orden con piezas** | stock disponible/apartado | ver mapa de reparaciones |

---

## 5. Propuesta de unificación (sin borrar funciones)

### 5.1 Principio
Primero **una sola verdad** (reglas y un único "escritor" de stock/caja), después **menos pantallas con pestañas**. Cada pantalla actual se conserva como pestaña/vista; lo que se elimina es solo código duplicado o huérfano.

### 5.2 Reglas y componentes únicos (orden de trabajo sugerido)
1. **Arreglos que cuestan poco y están rotos hoy** (sin rediseño): P-1 (columna), P-4 (decidir método `credito` y crear el CHECK aditivo), P-5 (id de promoción), P-13 (reescribir `incrementar_stock` o quitar la llamada), P-6 (usar una sola función `armarItemsVenta` para las tres rutas), P-8 (cierre en $0 con motivo, alerta con columnas correctas).
2. **`lib/inventario/stock.ts` ampliado**: `disponible(p) = stock − stock_apartado`, `estadoStock(p)` → `agotado | negativo | bajo | ok` con el mínimo efectivo (decisión de Trini 20-oct: mínimo vacío = 1). Todas las pantallas (Productos, Alertas, OC, POS, Dashboard, SQL `kpi_stock_bajo`) lo usan. Elimina P-12.
3. **Un solo escritor de stock en la base**: función SQL `mover_stock(producto, delta, tipo, referencia, usuario, nota)` atómica (bloquea la fila, respeta que no baje de 0 salvo permiso, escribe `movimientos_stock`) y que **reemplaza los 13 sitios**. El trigger de venta y el de cancelación pasan a usarla. Elimina P-2 (doble stock), P-14, P-15, P-16, P-18, P-21 y la mitad de P-3.
4. **Hook/endpoint único de búsqueda de productos** (`useProductos({activos, conStock, q})` + `/api/productos/buscar` que busque por nombre, SKU, código, IMEI y devuelva `disponible`). Lo usan POS, Productos, Alertas, Series, Kits, selector de piezas. Elimina P-17.
5. **`crearVentaPOS(payload)` único** (servidor: precio de `productos.precio` salvo autorización, descuento con `limites_descuento`, tienda del producto, caja abierta obligatoria, transacción única en SQL) y un solo `armarItemsVenta()` en el cliente (kits/servicios/promos). Elimina P-5, P-6, P-7, P-10, P-4 (venta a crédito pasa por el mismo camino con método `credito`).
6. **Un solo motor de caja**: `lib/db/caja.ts` calcula esperado con una función SQL `caja_resumen(sesion)` que devuelve efectivo/tarjeta/transferencia de ventas + anticipos + devoluciones + depósitos/retiros; se guarda en `caja_sesiones` al cerrar. Elimina P-9.
7. **Aislamiento de tiendas**: helper `exigirTienda(recurso)` en las rutas de P-11 y público con slug obligatorio.

### 5.3 Fusión de pantallas (qué se junta y qué se conserva)
| Hoy | Propuesta | Se conserva | Pros | Contras / cuidado |
|---|---|---|---|---|
| 14 accesos de inventario + hub | **4 entradas**: **Productos** (lista, ficha, kits, categorías, proveedores, etiquetas, historial IMEI como pestañas) · **Existencias** (Alertas/Resurtido, Movimientos, Verificar+Discrepancias como "Conteos", Ubicaciones) · **Entradas de mercancía** (Órdenes de compra, Lotes de piezas, Series por lote, Importar Excel/Remisión) · **Servicios** | todas las funciones, las mismas APIs; los enlaces actuales redirigen a la pestaña | menú corto, un solo lugar por tarea, el hub deja de ser huérfano | mover rutas rompe marcadores/permisos: hay que mantener los mismos `moduleKey`/roles por pestaña |
| Verificar + Discrepancias | una pantalla "Conteos" con historial | ambas vistas | mismos datos | — |
| `servicios` + `catalogo_servicios_reparacion` + lista fija del catálogo público | **un catálogo de servicios** con `ámbito` (mostrador / taller), `marca/modelo/tiempo` opcionales, `precio_fijo/min/max`; el POS filtra ámbito=mostrador, `ModalOrden` ámbito=taller, la web pública lee los publicados | las dos pantallas siguen como pestañas hasta migrar; el POS y `ModalOrden` no cambian de comportamiento | un precio, un lugar; la web deja de tener precios inventados | hay que migrar 2 filas + 0; decidir qué ve el público (ver §6) |
| `productos/page.tsx` (3.4k) | partir en `ProductoForm`, `EtiquetasModal`/`EtiquetasMasivasModal`/`Code128`, `HistorialImeiModal`, `HistorialMovimientosModal`, tabla; las etiquetas van a `components/productos/etiquetas/` | todo | cada archivo <600 líneas, se prueba cada parte; menos riesgo de romper | trabajo de mover código sin cambiar comportamiento; hacerlo después de §5.2 |
| `pos/page.tsx` (2.6k) | extraer `useCarrito`, `useTurnoCaja` (+`TurnoCaja` compartido con `/pos/caja`), `PanelCobro` (una sola ruta de cobro), modales de apertura/cierre | todo | quita las 3 copias de cobro y el turno duplicado | es la pantalla más crítica: probar en vivo cada atajo (F3, F9, F12) |
| Alertas (stock) + alertas de producto nuevo | separar nombres: "Stock bajo" y "Productos por registrar" | ambas | fin de la confusión | — |
| Catálogo público | filtro por tienda obligatorio, solo `tipo` publicable, stock − apartado, mostrar servicios desde el catálogo único | todo | evita mezclar tiendas | decidir si lo público debe mostrar refacciones |

### 5.4 Orden recomendado
1) Cirugías de P-1, P-4, P-5, P-13 y atajos F9/F12 (rápidas, rotas hoy). 2) Reglas únicas (`stock.ts`, `mover_stock`, `crearVentaPOS`). 3) Caja confiable (cierre/alerta/cuadre) — es lo que más dinero mueve hoy (anticipos, 4 cajas abiertas). 4) Aislamiento de tiendas. 5) Hooks y fusión de pantallas. 6) Partir archivos grandes. Todo en fases pequeñas con revisión en vivo por Trini, como pide `MAPA-CONEXIONES §1`.

---

## 6. Preguntas abiertas para Trini (solo decisiones de negocio)
1. **Venta a crédito en el POS:** ¿se usa de verdad (enganche + crédito) o se atiende en la pantalla de Créditos? Si se queda, ¿el enganche en efectivo debe entrar a la caja del turno y la venta contar solo el enganche o el total?
2. **Promociones en el POS:** ¿se deben poder cobrar como ítem (precio promocional) o solo informativas?
3. **Cambiar el precio en el carrito:** ¿puede hacerlo cualquier vendedor, solo con autorización del admin (como el descuento), o con un tope (% sobre el precio de lista)? ¿Se permite vender por debajo del costo?
4. **Servicios:** ¿quieres un solo catálogo (mostrador + taller) y que la web pública muestre los precios reales? ¿Qué servicios son públicos?
5. **Stock mínimo:** confirmar que "mínimo vacío o 0 = 1" aplica en todas las pantallas (Productos, Órdenes de compra, POS) y qué hacer con los 55 productos que hoy tienen 0. ¿Cuánto pedir cuando está bajo (hoy 2× el mínimo o déficit+50 %)?
6. **Productos descontinuados:** ¿deben desaparecer del POS y del seguimiento o poder venderse hasta agotar existencia?
7. **Piezas apartadas para reparación:** ¿el POS/catálogo deben ver solo el "disponible" (stock − apartado)?
8. **Importar Excel:** si el producto ya existe, ¿el stock del archivo debe **sumar**, **reemplazar** o ignorarse? ¿Debe pedir confirmación?
9. **Verificar inventario → ajustar:** ¿quién autoriza (solo admin ya está) y debe quedar un motivo y una marca de "aplicado"? ¿Las piezas apartadas se cuentan o no?
10. **Cierre de caja:** ¿bloquear cierre en $0? ¿las 4 cajas abiertas y los 20 cierres en $0 se cierran administrativamente con nota? (pregunta repetida del informe 21-oct)
11. **Costo:** ¿al recibir una OC el costo del producto se actualiza (último costo / promedio)? ¿Quieres capturar los 113 costos faltantes por Excel?
12. **Quién ve el costo y márgenes:** hoy lo recibe cualquier usuario autenticado (técnico y cobrador incluidos) en `/api/productos`. ¿Se restringe a admin/vendedor?
13. **Catálogo público:** ¿cada tienda tiene su subdominio/slug obligatorio? ¿se muestran refacciones o solo accesorios/equipos?
14. **Series/IMEI por lote y lotes de piezas:** ¿se usan o se pueden esconder del menú hasta que se necesiten (0 usos hoy)?
15. **Devoluciones:** ¿reembolso a tarjeta también (hoy solo efectivo/transferencia)? ¿plazo de días (hoy configurable, Payjoy 7)?
