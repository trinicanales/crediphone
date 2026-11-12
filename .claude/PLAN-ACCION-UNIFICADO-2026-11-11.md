# PLAN DE ACCIÓN UNIFICADO — 2026-11-11
> Junta el plan anterior (INFORME-PROBLEMAS-REALES, SESION-ACTIVA, pendientes P-1…P-3, K3b/K3c, importador) con el mapa maestro (`.claude/mapa/MAPA-SISTEMA-2026-11-11.md`) y las decisiones de Trini de hoy. Orden = más urgente primero. Cada fase se verifica con tsc + lint + revisión en vivo y se actualiza el mapa.

## Decisiones de Trini (2026-11-11)
1. **Dinero de reparaciones:** entregar el dinero desde el POS **o** desde Reparaciones son ambas válidas y **las dos entran a la venta del día** (un solo resultado en caja/corte).
2. **Crédito:** se puede vender desde POS y desde Créditos → **un solo proceso compartido** (espejo). Todo pago o anticipo (de crédito o de reparación), venga de donde venga, **genera ticket** para el cliente como comprobante.
3. **Catálogos de servicios:** ver "Los 3 catálogos" abajo.
4. **Lotes de piezas:** oculto por ahora (hecho en el menú, sin borrar código).
5. **Borrar clientes:** solo admin o super_admin (hecho).

## Los 3 catálogos de servicios (investigado hoy)
| Catálogo | Dónde vive | De quién es | Qué muestra hoy |
|---|---|---|---|
| `servicios` | tabla BD + pantalla Servicios (admin) + pestaña Servicios del POS + promociones del seguimiento | de cada tienda (`distribuidor_id`) | 2 filas, ambas de papelería: "Copias e impresiones" ($0) y "Enmicado" ($20). Con `precio_fijo`/`min`/`max`. Se cobran en el POS. Ninguna venta los ha usado aún |
| `catalogo_servicios_reparacion` | tabla BD + pantalla Admin › Catálogo Reparaciones (solo super_admin) + selector al crear una orden | de cada tienda | **0 filas.** Con marca, modelo, precio base y tiempo estimado. Lo lee el modal de nueva orden para sugerir precio |
| Lista fija del catálogo público | escrita dentro de `src/app/catalogo/page.tsx` (Cambio de pantalla $599, batería $349…) | de nadie: igual para todas las tiendas | Lo que ve el cliente en la web pública. No se puede editar desde el sistema |
**Propuesta (por aprobar):** un solo catálogo por tienda con "tipo" (papelería / reparación / otro) y, por servicio de reparación, marca-modelo-precio-tiempo. El POS, el modal de orden y el catálogo público leen de ahí. Mientras tanto no se toca nada.

## FASE 1 — Seguridad (EN CURSO, hecho hoy, sin publicar)
Hecho y verificado (tsc y lint limpios; permisos de BD comprobados):
- [x] Empleado desactivado ya no entra (`getAuthContext`).
- [x] Borrar cliente: solo admin/super_admin.
- [x] Ubicaciones, órdenes de compra y borrar producto: ahora verifican que el registro sea de **tu tienda** (`lib/auth/tienda.ts`).
- [x] `/api/configuracion` sin sesión ya no entrega datos del contador ni el token de verificación de WhatsApp.
- [x] `/api/push/send`: ya no acepta el secreto por defecto; si falta `INTERNAL_API_SECRET` queda deshabilitada.
- [x] Base: vista `empleados_activos` y función `calcular_comision_vendedor` cerradas a usuarios web (migración fase94, aplicada).
- [x] Lotes de piezas oculto del menú.
Pendiente de la fase (necesita decisión de Trini):
- [ ] **Recuperar contraseña** devuelve el enlace a quien conozca un teléfono. Opciones: (a) que el enlace lo genere un admin desde Personal y se lo pase al empleado; (b) correo de Supabase. Hoy, si se cierra sin alternativa, los empleados no podrían recuperar su clave.
- [ ] `cancelar-folio` sin sesión (diseñada para sendBeacon): exigir sesión o token del folio.
- [ ] Menú Admin que redirige: mostrar solo a super_admin, o abrir esas pantallas a admin.

## FASE 2 — Dinero correcto (lo que rompe cuentas)
1. **Ticket de anticipo/pago** (58 mm, comprobante para el cliente) para reparaciones y créditos.
2. **Un solo proceso de cobro** (`registrarPago`): reparación desde POS o desde Reparaciones → misma venta del día; crédito desde POS o desde Créditos → mismo pago; siempre con ticket.
3. Devoluciones y cancelación de venta (P-1, P-2): sin doble reintegro de stock, movimiento de caja.
4. Venta a crédito: ampliar `metodo_pago` o guardar el crédito aparte (decisión técnica a presentar). Pagos de crédito: columna `detalle_pago`.
5. Kits en F9/F12 (expandir como el cobro normal) y comprobar el precio del kit.
6. Promociones en el POS (`servicio_id` uuid) y `incrementar_stock`.
7. Caja: bloquear venta sin caja; cierre guiado de las 4 abiertas y los 20 cierres en $0 (en la próxima sesión de Trini); alerta de descuadre.

## FASE 3 — Órdenes de reparación al día
1. Cerrar las 57 `listo_entrega` (mediana 117 días) con el flujo de entrega: guiado, orden por orden, con Trini.
2. Revisar las 77 `recibido` (49 sin técnico).
3. Unificar estados: un solo `EstadoBadge`/etiqueta desde `estados.ts` (10 archivos con mapa propio).
4. Unificar pantallas: Órdenes + Panel técnico como una sola; `[id]` abre el drawer.
5. Columnas de dinero de la orden: definir cuál manda.

## FASE 4 — Inventario y compras
1. Una sola regla de stock bajo (`stock.ts`) en Productos, Sugerencias, POS, Alertas y Dashboard.
2. Todas las altas/bajas de stock dejan bitácora (hoy 10 filas de movimientos).
3. Importador de notas de compra (Aronium + cámara IMEI) cuando lleguen las muestras; costos de productos (113 sin costo).
4. Menú de inventario: de 14 accesos a 4 áreas con pestañas.

## FASE 5 — Servicios, clientes y limpieza
1. Catálogo único de servicios (propuesta arriba).
2. Duplicados de teléfono en clientes (22).
3. Apartados (1 mes, aviso +10 %, ticket 58 mm); descuentos (empleado ≤10 % con solicitud al admin; admin ≤100 %) validados en servidor.
4. Cron de recordatorios y almacenaje: arreglar columnas inexistentes.
5. WhatsApp: se mantiene modo enlace (sin costo); definir cómo entregar enlaces del portal del cliente.
6. Sentry pausado.
