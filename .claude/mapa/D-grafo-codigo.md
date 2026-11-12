# D · Grafo automático del código (páginas → APIs → tablas)
> Generado por `node scripts/mapa-sistema.js` el 2026-11-12. Lee el código real; la foto del esquema es `scripts/audit-schema.json` (se refresca tras cada migración). Consulta de impacto: `node scripts/mapa-sistema.js --impacto <tabla|/api/ruta|archivo|tabla.columna>`.
> Alcance de la lectura: detecta `.from("tabla")`, `.rpc()`, `fetch("/api/…")` e imports. No ve consultas armadas dinámicamente ni las llamadas hechas desde fuera del código (webhooks, cron externo).

## Resumen
- Archivos TS/TSX: **504** · APIs: **202** · Páginas: **71** · Tablas/vistas en BD: **91**
- APIs que nadie llama (sin contar webhook/cron/auth/público): **8** · APIs sin ninguna validación de sesión visible: **5** · Tablas sin ningún uso en el código: **19** · Tablas referenciadas que NO existen: **0**
- Archivos con su propio mapa de estados/etiquetas (fuera de estados.ts): **15** · Archivos > 900 líneas: **20**

## 1. Páginas → APIs → tablas
| Página | Archivo | Comp. | APIs | Tablas que lee/escribe | Escribe |
|---|---|---|---|---|---|
| `/` | `page.tsx` | 0 | 1 | productos | — |
| `/auth/actualizar-password` | `auth/actualizar-password/page.tsx` | 0 | 0 | — | — |
| `/auth/login` | `auth/login/page.tsx` | 0 | 0 | — | — |
| `/auth/reset-password` | `auth/reset-password/page.tsx` | 0 | 1 | users, configuracion, whatsapp_mensajes | whatsapp_mensajes |
| `/autorizar-descuento/[token]` | `autorizar-descuento/[token]/page.tsx` | 1 | 1 | users, permisos_empleado, configuracion, log_autorizaciones | configuracion, log_autorizaciones |
| `/catalogo` | `catalogo/page.tsx` | 4 | 1 | productos | — |
| `/cliente/acceso` | `cliente/acceso/page.tsx` | 0 | 1 | tokens_acceso_cliente | tokens_acceso_cliente |
| `/cliente/perfil` | `cliente/perfil/page.tsx` | 0 | 2 | tokens_acceso_cliente, clientes, ordenes_reparacion, garantias_reparacion, creditos, configuracion, pagos, puntos_cliente, movimientos_puntos | movimientos_puntos, tokens_acceso_cliente |
| `/cliente/solicitar-acceso` | `cliente/solicitar-acceso/page.tsx` | 0 | 1 | distribuidores, clientes, configuracion, tokens_acceso_cliente, whatsapp_mensajes | tokens_acceso_cliente, whatsapp_mensajes |
| `/confirmar-deposito/[token]` | `confirmar-deposito/[token]/page.tsx` | 1 | 1 | confirmaciones_deposito, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion, notificaciones | confirmaciones_deposito, caja_movimientos, caja_sesiones, anticipos_reparacion, notificaciones |
| `/dashboard` | `dashboard/page.tsx` | 41 | 64 | clientes, creditos, pagos, productos, scoring_clientes, users, permisos_empleado, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, notificaciones, versiones_pdf_reparacion, caja_sesiones, ventas, caja_movimientos, configuracion, push_subscriptions, folios_reparacion, imagenes_reparacion, movimientos_stock, notificaciones_fallidas, distribuidores, plantillas_notificacion, historial_precios_orden, whatsapp_mensajes, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, movimientos_bolsa_virtual, catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, sesiones_fotos_qr, confirmaciones_deposito, log_autorizaciones, reparacion_tiempo_logs, traspasos_anticipo | pedidos_pieza_reparacion, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, notificaciones, versiones_pdf_reparacion, caja_sesiones, push_subscriptions, plantillas_notificacion, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, solicitudes_cambio_precio, historial_precios_orden, tracking_tokens, movimientos_bolsa_virtual, notificaciones_fallidas, whatsapp_mensajes, distribuidores, configuracion, clientes, catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, sesiones_fotos_qr, log_autorizaciones, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo |
| `/dashboard/admin/catalogo-reparaciones` | `dashboard/admin/catalogo-reparaciones/page.tsx` | 4 | 2 | catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, users, permisos_empleado | catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor |
| `/dashboard/admin/categorias` | `dashboard/admin/categorias/page.tsx` | 3 | 0 | — | — |
| `/dashboard/admin/categorias/[id]` | `dashboard/admin/categorias/[id]/page.tsx` | 4 | 0 | — | — |
| `/dashboard/admin/categorias/nueva` | `dashboard/admin/categorias/nueva/page.tsx` | 4 | 0 | — | — |
| `/dashboard/admin/distribuidores` | `dashboard/admin/distribuidores/page.tsx` | 5 | 3 | users, permisos_empleado, distribuidores, configuracion | distribuidores, configuracion |
| `/dashboard/admin/distribuidores/[id]` | `dashboard/admin/distribuidores/[id]/page.tsx` | 5 | 5 | users, permisos_empleado, distribuidores, configuracion, clientes, creditos, productos, ventas | distribuidores, configuracion, users |
| `/dashboard/admin/distribuidores/nuevo` | `dashboard/admin/distribuidores/nuevo/page.tsx` | 4 | 0 | — | — |
| `/dashboard/admin/proveedores` | `dashboard/admin/proveedores/page.tsx` | 3 | 0 | — | — |
| `/dashboard/admin/proveedores/[id]` | `dashboard/admin/proveedores/[id]/page.tsx` | 4 | 0 | — | — |
| `/dashboard/admin/proveedores/nuevo` | `dashboard/admin/proveedores/nuevo/page.tsx` | 4 | 0 | — | — |
| `/dashboard/almacenaje` | `dashboard/almacenaje/page.tsx` | 0 | 1 | ordenes_reparacion, historial_estado_orden, recordatorios_enviados, configuracion, users, permisos_empleado | recordatorios_enviados |
| `/dashboard/asistencia` | `dashboard/asistencia/page.tsx` | 1 | 2 | users, permisos_empleado, asistencia_sesiones | asistencia_sesiones |
| `/dashboard/clientes` | `dashboard/clientes/page.tsx` | 9 | 6 | clientes, ordenes_reparacion, users, permisos_empleado, puntos_cliente, movimientos_puntos, scoring_clientes, configuracion, payjoy_api_logs | movimientos_puntos, clientes, scoring_clientes, configuracion, payjoy_api_logs |
| `/dashboard/clientes/[id]` | `dashboard/clientes/[id]/page.tsx` | 0 | 2 | clientes, ordenes_reparacion, garantias_reparacion, creditos, pagos, users, permisos_empleado, puntos_cliente, movimientos_puntos, distribuidores, configuracion, tokens_acceso_cliente, whatsapp_mensajes | movimientos_puntos, tokens_acceso_cliente, whatsapp_mensajes |
| `/dashboard/clientes/loyalty` | `dashboard/clientes/loyalty/page.tsx` | 0 | 1 | puntos_cliente, users, permisos_empleado | — |
| `/dashboard/compras` | `dashboard/compras/page.tsx` | 1 | 3 | users, permisos_empleado, ordenes_compra, productos, ordenes_compra_items, movimientos_stock, distribuidores | ordenes_compra, ordenes_compra_items, productos, movimientos_stock |
| `/dashboard/compras/[id]` | `dashboard/compras/[id]/page.tsx` | 3 | 1 | users, permisos_empleado, ordenes_compra, productos, ordenes_compra_items, movimientos_stock | ordenes_compra, ordenes_compra_items, productos, movimientos_stock |
| `/dashboard/compras/nueva` | `dashboard/compras/nueva/page.tsx` | 3 | 4 | proveedores, users, permisos_empleado, distribuidores, productos, ventas_items, ordenes_compra, ordenes_compra_items, movimientos_stock | proveedores, productos, ordenes_compra, ordenes_compra_items, movimientos_stock |
| `/dashboard/configuracion` | `dashboard/configuracion/page.tsx` | 7 | 10 | users, permisos_empleado, distribuidores, configuracion, log_autorizaciones, payjoy_api_logs, payjoy_webhooks, creditos, pagos, plantillas_notificacion, whatsapp_mensajes | distribuidores, configuracion, log_autorizaciones, payjoy_api_logs, creditos, payjoy_webhooks, pagos, plantillas_notificacion, whatsapp_mensajes |
| `/dashboard/creditos` | `dashboard/creditos/page.tsx` | 9 | 9 | creditos, pagos, clientes, users, permisos_empleado, payjoy_webhooks, payjoy_api_logs, distribuidores, productos | creditos, clientes, payjoy_webhooks, pagos, productos |
| `/dashboard/creditos/[id]` | `dashboard/creditos/[id]/page.tsx` | 3 | 5 | creditos, pagos, clientes, users, permisos_empleado | creditos, pagos, clientes |
| `/dashboard/creditos/cartera-vencida` | `dashboard/creditos/cartera-vencida/page.tsx` | 1 | 3 | users, permisos_empleado, creditos, pagos, clientes | creditos |
| `/dashboard/dashboard-reparaciones` | `dashboard/dashboard-reparaciones/page.tsx` | 12 | 1 | ordenes_reparacion, garantias_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, folios_reparacion, imagenes_reparacion, movimientos_stock, notificaciones | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones |
| `/dashboard/empleados` | `dashboard/empleados/page.tsx` | 7 | 4 | users, permisos_empleado, distribuidores, configuracion | distribuidores, configuracion, users, permisos_empleado |
| `/dashboard/facturacion` | `dashboard/facturacion/page.tsx` | 0 | 0 | — | — |
| `/dashboard/garantias` | `dashboard/garantias/page.tsx` | 0 | 1 | garantias_reparacion, users, permisos_empleado | — |
| `/dashboard/inventario` | `dashboard/inventario/page.tsx` | 0 | 1 | users, permisos_empleado, productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | verificaciones_inventario, verificaciones_items, productos, alertas_productos_nuevos |
| `/dashboard/inventario/alertas` | `dashboard/inventario/alertas/page.tsx` | 0 | 6 | distribuidores, productos, users, permisos_empleado, ventas, ventas_items, puntos_cliente, movimientos_puntos, movimientos_stock, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos, ordenes_compra, ordenes_compra_items | productos, ventas, ventas_items, movimientos_stock, movimientos_puntos, verificaciones_inventario, verificaciones_items, alertas_productos_nuevos, ordenes_compra, ordenes_compra_items |
| `/dashboard/inventario/discrepancias` | `dashboard/inventario/discrepancias/page.tsx` | 0 | 2 | users, permisos_empleado, productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | verificaciones_inventario, verificaciones_items, productos, alertas_productos_nuevos |
| `/dashboard/inventario/importar` | `dashboard/inventario/importar/page.tsx` | 0 | 2 | categorias, distribuidores, users, permisos_empleado, productos | productos |
| `/dashboard/inventario/movimientos` | `dashboard/inventario/movimientos/page.tsx` | 0 | 2 | movimientos_stock, productos, users, permisos_empleado | productos, movimientos_stock, users |
| `/dashboard/inventario/series` | `dashboard/inventario/series/page.tsx` | 0 | 4 | users, permisos_empleado, lotes_series, productos, lotes_series_items, movimientos_stock, proveedores, distribuidores | lotes_series, lotes_series_items, productos, movimientos_stock, proveedores |
| `/dashboard/inventario/ubicaciones` | `dashboard/inventario/ubicaciones/page.tsx` | 3 | 2 | users, permisos_empleado, ubicaciones_inventario, productos, movimientos_ubicacion | ubicaciones_inventario, productos, movimientos_ubicacion |
| `/dashboard/inventario/verificar` | `dashboard/inventario/verificar/page.tsx` | 4 | 3 | users, permisos_empleado, productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos, movimientos_ubicacion | verificaciones_inventario, verificaciones_items, productos, alertas_productos_nuevos, ubicaciones_inventario, movimientos_ubicacion |
| `/dashboard/lotes-piezas` | `dashboard/lotes-piezas/page.tsx` | 0 | 1 | lotes_piezas, lotes_piezas_items, reparacion_piezas, users, permisos_empleado | lotes_piezas, lotes_piezas_items, reparacion_piezas |
| `/dashboard/notificaciones/fallidas` | `dashboard/notificaciones/fallidas/page.tsx` | 0 | 2 | notificaciones_fallidas, users, permisos_empleado, configuracion, whatsapp_mensajes | notificaciones_fallidas, whatsapp_mensajes |
| `/dashboard/pagos` | `dashboard/pagos/page.tsx` | 6 | 4 | creditos, pagos, users, permisos_empleado, clientes | pagos, creditos, clientes |
| `/dashboard/payjoy` | `dashboard/payjoy/page.tsx` | 1 | 3 | creditos, pagos, users, permisos_empleado, configuracion, payjoy_api_logs | pagos, creditos, configuracion, payjoy_api_logs |
| `/dashboard/pos` | `dashboard/pos/page.tsx` | 39 | 69 | users, permisos_empleado, creditos, pagos, clientes, ordenes_reparacion, anticipos_reparacion, movimientos_bolsa_virtual, promociones, asistencia_sesiones, caja_sesiones, ventas, caja_movimientos, configuracion, notificaciones, ventas_items, productos, puntos_cliente, movimientos_puntos, movimientos_stock, distribuidores, scoring_clientes, categorias, servicios, traspasos_anticipo, pedidos_pieza_reparacion, reparacion_piezas, push_subscriptions, versiones_pdf_reparacion, historial_estado_orden, garantias_reparacion, solicitudes_piezas, garantias_piezas, folios_reparacion, imagenes_reparacion, confirmaciones_deposito, kits, kits_items, log_autorizaciones, pos_scan_sessions, historial_precios_orden, whatsapp_mensajes, notificaciones_fallidas, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, reparacion_tiempo_logs, sesiones_fotos_qr | creditos, promociones, asistencia_sesiones, caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos, ventas, ventas_items, movimientos_stock, movimientos_puntos, clientes, productos, categorias, servicios, configuracion, historial_estado_orden, ordenes_reparacion, traspasos_anticipo, movimientos_bolsa_virtual, push_subscriptions, versiones_pdf_reparacion, folios_reparacion, imagenes_reparacion, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, pedidos_pieza_reparacion, confirmaciones_deposito, kits, kits_items, log_autorizaciones, pos_scan_sessions, reparacion_diagnosticos, asignaciones_orden, solicitudes_cambio_precio, historial_precios_orden, tracking_tokens, notificaciones_fallidas, whatsapp_mensajes, distribuidores, reparacion_tiempo_logs, sesiones_fotos_qr |
| `/dashboard/pos/caja` | `dashboard/pos/caja/page.tsx` | 3 | 7 | users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion, notificaciones, distribuidores, ventas_items, productos, puntos_cliente, movimientos_puntos, movimientos_stock, asistencia_sesiones, movimientos_bolsa_virtual | caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos, ventas, ventas_items, movimientos_stock, movimientos_puntos, configuracion, distribuidores, asistencia_sesiones |
| `/dashboard/pos/historial` | `dashboard/pos/historial/page.tsx` | 4 | 5 | ventas, ventas_items, productos, caja_sesiones, pagos, caja_movimientos, anticipos_reparacion, configuracion, users, permisos_empleado, puntos_cliente, movimientos_puntos, movimientos_stock, notificaciones, devoluciones, payjoy_webhooks, devoluciones_items | ventas, ventas_items, movimientos_stock, caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos, movimientos_puntos, configuracion, devoluciones, devoluciones_items, productos |
| `/dashboard/productos` | `dashboard/productos/page.tsx` | 7 | 11 | movimientos_stock, productos, users, permisos_empleado, categorias, subcategorias, proveedores, ubicaciones_inventario, movimientos_ubicacion, distribuidores, ventas_items, ordenes_reparacion, configuracion | productos, movimientos_stock, categorias, subcategorias, proveedores, ubicaciones_inventario, movimientos_ubicacion, configuracion |
| `/dashboard/productos/kits` | `dashboard/productos/kits/page.tsx` | 3 | 3 | users, permisos_empleado, kits, kits_items, distribuidores, productos | kits, kits_items, productos |
| `/dashboard/promociones` | `dashboard/promociones/page.tsx` | 6 | 2 | promociones, users, permisos_empleado | promociones |
| `/dashboard/recordatorios` | `dashboard/recordatorios/page.tsx` | 5 | 4 | creditos, notificaciones, users, push_subscriptions, permisos_empleado, plantillas_notificacion | notificaciones, push_subscriptions, plantillas_notificacion |
| `/dashboard/reparaciones` | `dashboard/reparaciones/page.tsx` | 44 | 54 | configuracion, users, permisos_empleado, distribuidores, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, notificaciones, creditos, versiones_pdf_reparacion, push_subscriptions, tracking_tokens, solicitudes_cambio_precio, historial_precios_orden, movimientos_bolsa_virtual, notificaciones_fallidas, whatsapp_mensajes, catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, clientes, sesiones_fotos_qr, asignaciones_orden, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo | configuracion, distribuidores, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones, pedidos_pieza_reparacion, versiones_pdf_reparacion, push_subscriptions, solicitudes_cambio_precio, historial_precios_orden, tracking_tokens, movimientos_bolsa_virtual, notificaciones_fallidas, whatsapp_mensajes, catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, clientes, sesiones_fotos_qr, asignaciones_orden, movimientos_puntos, reparacion_diagnosticos, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo |
| `/dashboard/reparaciones/[id]` | `dashboard/reparaciones/[id]/page.tsx` | 23 | 28 | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, users, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, configuracion, notificaciones, creditos, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, push_subscriptions, distribuidores, solicitudes_cambio_precio, historial_precios_orden, movimientos_stock, imagenes_reparacion, movimientos_bolsa_virtual, folios_reparacion, notificaciones_fallidas, whatsapp_mensajes, clientes, confirmaciones_deposito, versiones_pdf_reparacion, puntos_cliente, movimientos_puntos, reparacion_tiempo_logs, sesiones_fotos_qr, traspasos_anticipo | solicitudes_cambio_precio, ordenes_reparacion, historial_precios_orden, historial_estado_orden, tracking_tokens, productos, movimientos_stock, notificaciones, anticipos_reparacion, imagenes_reparacion, reparacion_piezas, pedidos_pieza_reparacion, movimientos_bolsa_virtual, folios_reparacion, garantias_reparacion, caja_movimientos, solicitudes_piezas, garantias_piezas, notificaciones_fallidas, whatsapp_mensajes, caja_sesiones, push_subscriptions, distribuidores, configuracion, clientes, confirmaciones_deposito, versiones_pdf_reparacion, movimientos_puntos, reparacion_tiempo_logs, sesiones_fotos_qr, traspasos_anticipo |
| `/dashboard/reparaciones/[id]/ticket` | `dashboard/reparaciones/[id]/ticket/page.tsx` | 0 | 3 | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, users, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, configuracion, notificaciones, creditos, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, push_subscriptions, distribuidores, solicitudes_cambio_precio, historial_precios_orden, movimientos_stock, imagenes_reparacion, movimientos_bolsa_virtual, folios_reparacion, notificaciones_fallidas, whatsapp_mensajes, confirmaciones_deposito | solicitudes_cambio_precio, ordenes_reparacion, historial_precios_orden, historial_estado_orden, tracking_tokens, productos, movimientos_stock, notificaciones, anticipos_reparacion, imagenes_reparacion, reparacion_piezas, pedidos_pieza_reparacion, movimientos_bolsa_virtual, folios_reparacion, garantias_reparacion, caja_movimientos, solicitudes_piezas, garantias_piezas, notificaciones_fallidas, whatsapp_mensajes, caja_sesiones, push_subscriptions, distribuidores, configuracion, confirmaciones_deposito |
| `/dashboard/reportes` | `dashboard/reportes/page.tsx` | 1 | 3 | pagos, ventas, ventas_items, ordenes_reparacion, ordenes_compra, pedidos_pieza_reparacion, users, permisos_empleado, creditos, clientes | — |
| `/dashboard/reportes/comisiones` | `dashboard/reportes/comisiones/page.tsx` | 3 | 1 | users, ventas, creditos, permisos_empleado | — |
| `/dashboard/reportes/equipos` | `dashboard/reportes/equipos/page.tsx` | 0 | 1 | ventas_items, creditos, users, permisos_empleado | — |
| `/dashboard/reportes/rentabilidad` | `dashboard/reportes/rentabilidad/page.tsx` | 0 | 1 | ventas, users, permisos_empleado | — |
| `/dashboard/servicios` | `dashboard/servicios/page.tsx` | 4 | 3 | configuracion, users, permisos_empleado, distribuidores, servicios | configuracion, servicios |
| `/dashboard/tecnico` | `dashboard/tecnico/page.tsx` | 34 | 46 | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, users, permisos_empleado, creditos, notificaciones, versiones_pdf_reparacion, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, push_subscriptions, folios_reparacion, imagenes_reparacion, movimientos_stock, tracking_tokens, distribuidores, solicitudes_cambio_precio, historial_precios_orden, movimientos_bolsa_virtual, notificaciones_fallidas, whatsapp_mensajes, clientes, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, confirmaciones_deposito, reparacion_tiempo_logs, sesiones_fotos_qr, traspasos_anticipo | pedidos_pieza_reparacion, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, notificaciones, versiones_pdf_reparacion, caja_sesiones, push_subscriptions, solicitudes_cambio_precio, historial_precios_orden, tracking_tokens, movimientos_bolsa_virtual, notificaciones_fallidas, whatsapp_mensajes, distribuidores, configuracion, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, clientes, confirmaciones_deposito, reparacion_tiempo_logs, sesiones_fotos_qr, traspasos_anticipo |
| `/fotos/[token]` | `fotos/[token]/page.tsx` | 0 | 2 | sesiones_fotos_qr, ordenes_reparacion, imagenes_reparacion | sesiones_fotos_qr, imagenes_reparacion |
| `/pos/scan/[token]` | `pos/scan/[token]/page.tsx` | 3 | 1 | pos_scan_sessions | pos_scan_sessions |
| `/reparacion` | `reparacion/page.tsx` | 0 | 0 | — | — |
| `/reparacion/[folio]` | `reparacion/[folio]/page.tsx` | 0 | 1 | tracking_intentos, ordenes_reparacion, tracking_tokens, historial_estado_orden, configuracion | tracking_intentos, configuracion |
| `/terminos` | `terminos/page.tsx` | 0 | 0 | — | — |
| `/tracking/[token]` | `tracking/[token]/page.tsx` | 2 | 4 | tracking_tokens, clientes, users, anticipos_reparacion, imagenes_reparacion, pedidos_pieza_reparacion, ordenes_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, creditos, notificaciones, versiones_pdf_reparacion, configuracion, puntos_cliente, movimientos_puntos, caja_sesiones, ventas, pagos, caja_movimientos, push_subscriptions, folios_reparacion, movimientos_stock, promociones, servicios | tracking_tokens, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, notificaciones, versiones_pdf_reparacion, configuracion, movimientos_puntos, caja_sesiones, push_subscriptions, servicios, clientes |

## 2. APIs → tablas (lee/escribe) y quién las llama
| API | Escribe | Lee | RPC | Llamadores |
|---|---|---|---|---|
| `/api/admin/distribuidores` | distribuidores, configuracion | users, permisos_empleado, distribuidores | — | 5 |
| `/api/admin/distribuidores/[id]` | distribuidores, configuracion | users, permisos_empleado, distribuidores | — | 2 |
| `/api/admin/distribuidores/[id]/asignar-empleado` | users | distribuidores, users, permisos_empleado | — | 1 |
| `/api/admin/distribuidores/[id]/franquicia` | distribuidores, configuracion | users, permisos_empleado, distribuidores | — | 1 |
| `/api/admin/distribuidores/[id]/stats` | — | clientes, creditos, productos, users, ventas, permisos_empleado | — | 1 |
| `/api/admin/distribuidores/comparativa` | — | distribuidores, ordenes_reparacion, users, permisos_empleado | — | 1 |
| `/api/apartados` | creditos | users, permisos_empleado, creditos, pagos, clientes | total_pagado, saldo_pendiente | 2 |
| `/api/asistencia` | asistencia_sesiones | users, permisos_empleado, asistencia_sesiones | — | 4 |
| `/api/asistencia/activa` | asistencia_sesiones | users, permisos_empleado, asistencia_sesiones | — | 3 |
| `/api/asistencia/checkout` | asistencia_sesiones | users, permisos_empleado, asistencia_sesiones | — | 4 |
| `/api/auth/logout` | — | — | — | 1 |
| `/api/auth/me` | — | users | — | 2 |
| `/api/auth/reset-password` | whatsapp_mensajes | users, configuracion | — | 1 |
| `/api/autorizaciones` | configuracion, log_autorizaciones | users, permisos_empleado, configuracion, log_autorizaciones | — | 2 |
| `/api/autorizaciones/[id]` | configuracion, log_autorizaciones | users, permisos_empleado, configuracion, log_autorizaciones | — | 1 |
| `/api/autorizaciones/[id]/aprobar` | configuracion, log_autorizaciones | users, permisos_empleado, configuracion, log_autorizaciones | — | 1 |
| `/api/autorizaciones/[id]/declinar` | configuracion, log_autorizaciones | users, permisos_empleado, configuracion, log_autorizaciones | — | 1 |
| `/api/autorizar-descuento/[token]` | configuracion, log_autorizaciones | users, permisos_empleado, configuracion, log_autorizaciones | — | 1 |
| `/api/catalogo-servicios` | catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor | catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, users, permisos_empleado | — | 2 |
| `/api/catalogo-servicios/[id]` | catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor | catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, users, permisos_empleado | — | 1 |
| `/api/categorias` | categorias | categorias, users, permisos_empleado | — | 3 |
| `/api/cliente/auth` | tokens_acceso_cliente | tokens_acceso_cliente | — | 2 |
| `/api/cliente/enviar-acceso` | tokens_acceso_cliente, whatsapp_mensajes | clientes, distribuidores, users, permisos_empleado, configuracion | — | 1 |
| `/api/cliente/perfil` | movimientos_puntos | tokens_acceso_cliente, clientes, ordenes_reparacion, garantias_reparacion, creditos, configuracion, pagos, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 1 |
| `/api/cliente/solicitar-acceso` | tokens_acceso_cliente, whatsapp_mensajes | distribuidores, clientes, configuracion | — | 1 |
| `/api/clientes` | clientes | clientes, users, permisos_empleado | — | 6 |
| `/api/clientes/[id]` | clientes | clientes, users, permisos_empleado | — | 4 |
| `/api/clientes/[id]/consentimiento` | clientes | clientes, users, permisos_empleado | — | 1 |
| `/api/clientes/[id]/perfil` | movimientos_puntos | clientes, ordenes_reparacion, garantias_reparacion, creditos, pagos, users, permisos_empleado, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 1 |
| `/api/clientes/[id]/puntos` | movimientos_puntos | users, permisos_empleado, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 1 |
| `/api/clientes/[id]/resumen` | movimientos_puntos | clientes, ordenes_reparacion, users, permisos_empleado, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 2 |
| `/api/clientes/[id]/resumen-pos` | — | clientes, creditos, ventas, scoring_clientes, users, permisos_empleado | — | 1 |
| `/api/configuracion` | configuracion, distribuidores | configuracion, users, permisos_empleado, distribuidores | — | 7 |
| `/api/configuracion/limites-descuento` | configuracion, log_autorizaciones | users, permisos_empleado, configuracion, log_autorizaciones | — | 2 |
| `/api/confirmaciones-deposito` | confirmaciones_deposito, caja_movimientos | users, permisos_empleado, confirmaciones_deposito | — | 1 |
| `/api/confirmaciones-deposito/[id]/confirmar` | notificaciones, confirmaciones_deposito, caja_movimientos, caja_sesiones, anticipos_reparacion, push_subscriptions | users, permisos_empleado, confirmaciones_deposito, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion, push_subscriptions | — | 1 |
| `/api/confirmaciones-deposito/[id]/declinar` | notificaciones, confirmaciones_deposito, caja_movimientos, push_subscriptions | users, permisos_empleado, confirmaciones_deposito, push_subscriptions | — | 1 |
| `/api/confirmar-deposito/[token]` | confirmaciones_deposito, caja_movimientos, caja_sesiones, anticipos_reparacion, notificaciones | confirmaciones_deposito, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion | — | 1 |
| `/api/creditos` | creditos | creditos, pagos, clientes, users, permisos_empleado | total_pagado, saldo_pendiente | 3 |
| `/api/creditos/[id]` | creditos | creditos, pagos, clientes, users, permisos_empleado | total_pagado, saldo_pendiente | 3 |
| `/api/creditos/[id]/completar-apartado` | creditos | creditos, users, permisos_empleado, pagos, clientes | total_pagado, saldo_pendiente | 1 |
| `/api/creditos/[id]/pagos` | pagos, creditos | users, permisos_empleado, creditos, pagos, clientes | total_pagado, saldo_pendiente | 1 |
| `/api/creditos/[id]/pdf` | — | creditos, pagos, users, permisos_empleado | — | 2 |
| `/api/creditos/aging` | — | creditos, pagos, users, permisos_empleado | — | 1 |
| `/api/creditos/cartera-vencida` | creditos | users, permisos_empleado, creditos, pagos, clientes | total_pagado, saldo_pendiente | 1 |
| `/api/creditos/recalcular-mora` | creditos | users, permisos_empleado, creditos, pagos, clientes | total_pagado, saldo_pendiente | 2 |
| `/api/cron/recordatorios-reparaciones` | recordatorios_enviados | ordenes_reparacion, historial_estado_orden, recordatorios_enviados, configuracion | — | 0 |
| `/api/dashboard/por-aprobar` | configuracion, log_autorizaciones | solicitudes_cambio_precio, ordenes_reparacion, users, confirmaciones_deposito, permisos_empleado, configuracion, log_autorizaciones | — | 1 |
| `/api/dashboard/resumen` | — | caja_sesiones, ordenes_reparacion, pagos, ventas, creditos, productos, caja_movimientos, users, permisos_empleado | — | 1 |
| `/api/dashboard/stream` | — | ordenes_reparacion, pagos, ventas, users, permisos_empleado | — | 1 |
| `/api/distribuidor/perfil` | distribuidores, configuracion | users, permisos_empleado, distribuidores | — | 1 |
| `/api/empleados` | users | users, permisos_empleado | calcular_comision_vendedor, calcular_desempeno_cobrador | 3 |
| `/api/empleados/[id]` | users | users, permisos_empleado | calcular_comision_vendedor, calcular_desempeno_cobrador | 1 |
| `/api/empleados/[id]/permisos` | permisos_empleado | users, permisos_empleado | — | 1 |
| `/api/empleados/vendedores` | users | users, permisos_empleado | calcular_comision_vendedor, calcular_desempeno_cobrador | 0 |
| `/api/equipos/stats` | — | ventas_items, creditos, users, permisos_empleado | — | 1 |
| `/api/garantias` | — | garantias_reparacion, users, permisos_empleado | — | 1 |
| `/api/inventario/alertas` | verificaciones_inventario, verificaciones_items, productos, alertas_productos_nuevos | users, permisos_empleado, productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | — | 2 |
| `/api/inventario/importar` | productos | productos, categorias, users, permisos_empleado | — | 1 |
| `/api/inventario/movimientos` | productos, movimientos_stock | movimientos_stock, productos, users, permisos_empleado | — | 3 |
| `/api/inventario/plantilla` | — | categorias, distribuidores, users, permisos_empleado | — | 1 |
| `/api/inventario/ubicaciones` | ubicaciones_inventario, productos, movimientos_ubicacion | users, permisos_empleado, ubicaciones_inventario, productos, movimientos_ubicacion | — | 3 |
| `/api/inventario/ubicaciones/[id]` | ubicaciones_inventario, productos, movimientos_ubicacion | users, permisos_empleado, ubicaciones_inventario, productos, movimientos_ubicacion | — | 1 |
| `/api/inventario/verificaciones` | verificaciones_inventario, verificaciones_items, productos, alertas_productos_nuevos | users, permisos_empleado, productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | — | 2 |
| `/api/inventario/verificaciones/[id]` | verificaciones_inventario, verificaciones_items, productos, alertas_productos_nuevos | users, permisos_empleado, productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | — | 2 |
| `/api/kits` | kits, kits_items | users, permisos_empleado, kits | — | 2 |
| `/api/kits/[id]` | kits, kits_items | users, permisos_empleado, kits | — | 1 |
| `/api/lotes-piezas` | lotes_piezas, lotes_piezas_items, reparacion_piezas | lotes_piezas, lotes_piezas_items, reparacion_piezas, users, permisos_empleado | — | 1 |
| `/api/lotes-piezas/[id]` | lotes_piezas, lotes_piezas_items, reparacion_piezas | lotes_piezas, lotes_piezas_items, reparacion_piezas, users, permisos_empleado | — | 0 |
| `/api/lotes-piezas/[id]/distribuir-envio` | lotes_piezas, lotes_piezas_items, reparacion_piezas | lotes_piezas, lotes_piezas_items, reparacion_piezas, users, permisos_empleado | — | 0 |
| `/api/lotes-piezas/[id]/items` | lotes_piezas, lotes_piezas_items, reparacion_piezas | lotes_piezas, lotes_piezas_items, reparacion_piezas, users, permisos_empleado | — | 0 |
| `/api/lotes-piezas/[id]/items/[itemId]` | lotes_piezas, lotes_piezas_items, reparacion_piezas | lotes_piezas, lotes_piezas_items, reparacion_piezas, users, permisos_empleado | — | 0 |
| `/api/lotes-series` | lotes_series, lotes_series_items, productos, movimientos_stock | users, permisos_empleado, lotes_series, productos | — | 1 |
| `/api/lotes-series/[id]` | lotes_series, lotes_series_items, productos, movimientos_stock | users, permisos_empleado, lotes_series, productos | — | 1 |
| `/api/loyalty` | — | puntos_cliente, users, permisos_empleado | — | 1 |
| `/api/notificaciones` | notificaciones_fallidas, tracking_tokens, notificaciones, push_subscriptions, whatsapp_mensajes, distribuidores, configuracion | configuracion, tracking_tokens, notificaciones, creditos, users, push_subscriptions, distribuidores, permisos_empleado | — | 2 |
| `/api/notificaciones/fallidas` | — | notificaciones_fallidas, users, permisos_empleado | — | 2 |
| `/api/notificaciones/fallidas/[id]/resolver` | notificaciones_fallidas, whatsapp_mensajes | notificaciones_fallidas, users, permisos_empleado, configuracion | — | 1 |
| `/api/notificaciones/historial` | notificaciones | notificaciones, users, permisos_empleado | — | 2 |
| `/api/ordenes-compra` | ordenes_compra, ordenes_compra_items, productos, movimientos_stock | users, permisos_empleado, ordenes_compra, productos | — | 3 |
| `/api/ordenes-compra/[id]` | ordenes_compra, ordenes_compra_items, productos, movimientos_stock | users, permisos_empleado, ordenes_compra, productos | — | 1 |
| `/api/ordenes-compra/sugerencias` | — | productos, ventas_items, users, permisos_empleado | — | 2 |
| `/api/pagos` | pagos | creditos, pagos, users, permisos_empleado | — | 2 |
| `/api/pagos/[id]` | pagos | creditos, pagos, users, permisos_empleado | — | 1 |
| `/api/payjoy/creditos` | — | creditos, pagos, users, permisos_empleado | — | 1 |
| `/api/payjoy/export` | creditos, payjoy_webhooks, pagos | payjoy_webhooks, payjoy_api_logs, creditos, users, permisos_empleado, pagos | — | 1 |
| `/api/payjoy/import-customer` | configuracion, payjoy_api_logs | — | — | 1 |
| `/api/payjoy/link-credit` | creditos, payjoy_webhooks, pagos | payjoy_webhooks, payjoy_api_logs, creditos, pagos | — | 1 |
| `/api/payjoy/lookup-customer` | configuracion, payjoy_api_logs | — | — | 1 |
| `/api/payjoy/registrar-pago` | pagos, creditos | creditos, pagos, users, permisos_empleado | — | 1 |
| `/api/payjoy/sync-payments` | creditos, payjoy_webhooks, pagos | creditos, pagos, payjoy_webhooks, payjoy_api_logs, users, permisos_empleado | — | 1 |
| `/api/payjoy/test-connection` | configuracion, payjoy_api_logs | — | — | 1 |
| `/api/payjoy/unlink-credit` | creditos, payjoy_webhooks, pagos | payjoy_webhooks, payjoy_api_logs, creditos, pagos | — | 1 |
| `/api/payjoy/webhook` | payjoy_webhooks, pagos, creditos | payjoy_webhooks, creditos, pagos | — | 0 |
| `/api/plantillas-notificacion` | plantillas_notificacion | users, permisos_empleado, plantillas_notificacion | — | 3 |
| `/api/pos/bolsa-disputa` | — | movimientos_bolsa_virtual, users, permisos_empleado | — | 1 |
| `/api/pos/caja` | caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos | users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion | — | 3 |
| `/api/pos/caja/[id]` | caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos, ventas, ventas_items, movimientos_stock, movimientos_puntos | caja_sesiones, distribuidores, users, permisos_empleado, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion, ventas_items, productos, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 2 |
| `/api/pos/caja/[id]/bolsas-cobradas` | — | movimientos_bolsa_virtual, users, permisos_empleado | — | 1 |
| `/api/pos/devoluciones` | devoluciones, devoluciones_items, productos, movimientos_stock, ventas | users, permisos_empleado, devoluciones, ventas, payjoy_webhooks, ventas_items, productos, devoluciones_items | — | 1 |
| `/api/pos/devoluciones/elegibilidad` | devoluciones, devoluciones_items, productos, movimientos_stock, ventas, configuracion | users, permisos_empleado, devoluciones, ventas, payjoy_webhooks, ventas_items, productos, devoluciones_items, configuracion | — | 1 |
| `/api/pos/reparacion-buscar` | — | ordenes_reparacion, anticipos_reparacion, users, permisos_empleado | — | 1 |
| `/api/pos/reparacion-cobro` | anticipos_reparacion, historial_estado_orden, caja_movimientos, ordenes_reparacion, caja_sesiones, notificaciones, traspasos_anticipo, movimientos_bolsa_virtual, productos, movimientos_stock, push_subscriptions, versiones_pdf_reparacion, folios_reparacion, imagenes_reparacion, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, movimientos_puntos | ordenes_reparacion, anticipos_reparacion, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, traspasos_anticipo, pedidos_pieza_reparacion, reparacion_piezas, productos, creditos, notificaciones, push_subscriptions, versiones_pdf_reparacion, historial_estado_orden, garantias_reparacion, solicitudes_piezas, garantias_piezas, puntos_cliente, movimientos_puntos | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos, incrementar_puntos_cliente | 1 |
| `/api/pos/reparaciones-activas` | — | ordenes_reparacion, anticipos_reparacion, movimientos_bolsa_virtual, users, permisos_empleado | — | 3 |
| `/api/pos/scan-session` | pos_scan_sessions | users, permisos_empleado | — | 1 |
| `/api/pos/scan-session/[token]` | pos_scan_sessions | pos_scan_sessions | — | 2 |
| `/api/pos/stats` | ventas, ventas_items, movimientos_stock, movimientos_puntos | ventas, ventas_items, productos, users, permisos_empleado, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 1 |
| `/api/pos/venta-credito` | ventas, ventas_items, movimientos_stock, creditos, caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos | productos, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion | — | 1 |
| `/api/pos/ventas` | ventas, ventas_items, movimientos_stock, caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos, movimientos_puntos | ventas, ventas_items, productos, caja_sesiones, pagos, caja_movimientos, anticipos_reparacion, configuracion, users, permisos_empleado, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 3 |
| `/api/pos/ventas/[id]` | ventas, ventas_items, movimientos_stock, movimientos_puntos | users, permisos_empleado, ventas, ventas_items, productos, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 1 |
| `/api/pos/ventas/[id]/recibo` | ventas, ventas_items, movimientos_stock, configuracion, movimientos_puntos | ventas, ventas_items, productos, configuracion, users, permisos_empleado, puntos_cliente, movimientos_puntos | incrementar_puntos_cliente | 2 |
| `/api/print/network` | — | users, permisos_empleado | — | 1 |
| `/api/productos` | productos | distribuidores, productos, users, permisos_empleado | — | 14 |
| `/api/productos/[id]` | productos, movimientos_stock | productos, users, permisos_empleado | — | 2 |
| `/api/productos/compatibles` | — | productos, users, permisos_empleado | — | 1 |
| `/api/productos/historial-imei` | — | productos, ventas_items, ordenes_reparacion, users, permisos_empleado | — | 1 |
| `/api/productos/importar-remision` | productos | productos, users, permisos_empleado | — | 1 |
| `/api/productos/remision/pdf` | configuracion | productos, users, permisos_empleado, configuracion | — | 1 |
| `/api/productos/sugerencias` | — | productos, users, permisos_empleado | — | 1 |
| `/api/promociones` | promociones | promociones, users, permisos_empleado | — | 3 |
| `/api/promociones/[id]` | promociones | users, permisos_empleado | — | 2 |
| `/api/proveedores` | proveedores | proveedores, users, permisos_empleado | — | 3 |
| `/api/public/productos` | — | productos | — | 2 |
| `/api/push/send` | push_subscriptions | push_subscriptions | — | 0 |
| `/api/push/subscribe` | push_subscriptions | users, permisos_empleado | — | 2 |
| `/api/recordatorios` | notificaciones, push_subscriptions | creditos, notificaciones, users, push_subscriptions, permisos_empleado | — | 1 |
| `/api/recordatorios/[id]/enviar` | notificaciones, push_subscriptions | users, permisos_empleado, creditos, notificaciones, push_subscriptions | — | 1 |
| `/api/reparacion/[folio]` | tracking_intentos, configuracion | tracking_intentos, ordenes_reparacion, tracking_tokens, historial_estado_orden, configuracion | — | 1 |
| `/api/reparaciones` | pedidos_pieza_reparacion, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, notificaciones, versiones_pdf_reparacion, caja_sesiones, push_subscriptions | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, users, permisos_empleado, creditos, notificaciones, versiones_pdf_reparacion, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, push_subscriptions | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 5 |
| `/api/reparaciones/[id]` | solicitudes_cambio_precio, ordenes_reparacion, historial_precios_orden, historial_estado_orden, tracking_tokens, productos, movimientos_stock, notificaciones, anticipos_reparacion, imagenes_reparacion, reparacion_piezas, pedidos_pieza_reparacion, movimientos_bolsa_virtual, folios_reparacion, garantias_reparacion, caja_movimientos, solicitudes_piezas, garantias_piezas, notificaciones_fallidas, whatsapp_mensajes, caja_sesiones, push_subscriptions, distribuidores, configuracion | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, users, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, configuracion, notificaciones, creditos, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, push_subscriptions, distribuidores | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 10 |
| `/api/reparaciones/[id]/anticipos` | notificaciones, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, confirmaciones_deposito | ordenes_reparacion, users, permisos_empleado, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, confirmaciones_deposito | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 6 |
| `/api/reparaciones/[id]/anticipos/[anticipoId]` | caja_movimientos, anticipos_reparacion, historial_estado_orden | ordenes_reparacion, anticipos_reparacion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/[id]/anticipos/devolver` | historial_estado_orden, ordenes_reparacion, folios_reparacion, imagenes_reparacion, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, users, permisos_empleado, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/aprobar-presupuesto` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, caja_sesiones, notificaciones | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 2 |
| `/api/reparaciones/[id]/asignar-tecnico` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, asignaciones_orden, caja_sesiones, notificaciones | ordenes_reparacion, users, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, permisos_empleado | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/cancelar` | pedidos_pieza_reparacion, anticipos_reparacion, caja_movimientos, movimientos_bolsa_virtual, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, caja_sesiones, pedidos_pieza_reparacion, anticipos_reparacion, users, permisos_empleado, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 2 |
| `/api/reparaciones/[id]/comunicaciones` | — | ordenes_reparacion, whatsapp_mensajes, notificaciones_fallidas, users, permisos_empleado | — | 1 |
| `/api/reparaciones/[id]/diagnosticos` | reparacion_diagnosticos | ordenes_reparacion, users, permisos_empleado, reparacion_diagnosticos | — | 2 |
| `/api/reparaciones/[id]/diagnosticos/[diagId]` | reparacion_diagnosticos | users, permisos_empleado, reparacion_diagnosticos | — | 1 |
| `/api/reparaciones/[id]/editar-info` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, users, permisos_empleado | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/entregar` | ordenes_reparacion, historial_estado_orden, folios_reparacion, imagenes_reparacion, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones, movimientos_bolsa_virtual, versiones_pdf_reparacion, movimientos_puntos | ordenes_reparacion, anticipos_reparacion, users, permisos_empleado, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, versiones_pdf_reparacion, puntos_cliente, movimientos_puntos | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos, incrementar_puntos_cliente | 2 |
| `/api/reparaciones/[id]/garantia` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | users, permisos_empleado, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/garantias-piezas` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, users, permisos_empleado, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/historial` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, users, permisos_empleado | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/historial-precios` | — | ordenes_reparacion, historial_precios_orden, users, permisos_empleado | — | 1 |
| `/api/reparaciones/[id]/notificaciones` | notificaciones, notificaciones_fallidas, tracking_tokens, push_subscriptions, whatsapp_mensajes, distribuidores, configuracion | ordenes_reparacion, users, permisos_empleado, configuracion, tracking_tokens, notificaciones, push_subscriptions, creditos, distribuidores | — | 3 |
| `/api/reparaciones/[id]/pdf` | — | ordenes_reparacion, users, permisos_empleado, configuracion, anticipos_reparacion, reparacion_piezas, pedidos_pieza_reparacion, garantias_reparacion | — | 3 |
| `/api/reparaciones/[id]/pedidos-pieza` | pedidos_pieza_reparacion, productos, movimientos_bolsa_virtual, ordenes_reparacion, reparacion_piezas, notificaciones, push_subscriptions | ordenes_reparacion, pedidos_pieza_reparacion, anticipos_reparacion, movimientos_bolsa_virtual, users, permisos_empleado, creditos, notificaciones, push_subscriptions | incrementar_stock | 3 |
| `/api/reparaciones/[id]/pedidos-pieza/[pedidoId]` | pedidos_pieza_reparacion, movimientos_bolsa_virtual, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | pedidos_pieza_reparacion, users, permisos_empleado, ordenes_reparacion, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 2 |
| `/api/reparaciones/[id]/pedidos-pieza/[pedidoId]/recibir` | pedidos_pieza_reparacion, notificaciones, push_subscriptions | pedidos_pieza_reparacion, users, permisos_empleado, creditos, notificaciones, push_subscriptions | — | 1 |
| `/api/reparaciones/[id]/pedidos-pieza/[pedidoId]/verificar` | pedidos_pieza_reparacion, reparacion_piezas, ordenes_reparacion, movimientos_bolsa_virtual, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | pedidos_pieza_reparacion, ordenes_reparacion, users, permisos_empleado, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/piezas` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, productos, users, permisos_empleado, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 2 |
| `/api/reparaciones/[id]/presupuesto` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, users, permisos_empleado, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/renotificar-presupuesto` | ordenes_reparacion | ordenes_reparacion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/[id]/revertir-estado` | ordenes_reparacion, historial_estado_orden | ordenes_reparacion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/[id]/solicitudes-piezas` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, users, permisos_empleado, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/[id]/solicitudes-precio` | ordenes_reparacion, solicitudes_cambio_precio, historial_precios_orden | ordenes_reparacion, solicitudes_cambio_precio, users, permisos_empleado | — | 2 |
| `/api/reparaciones/[id]/tiempo` | reparacion_tiempo_logs | users, permisos_empleado, reparacion_tiempo_logs | — | 1 |
| `/api/reparaciones/[id]/tomar` | ordenes_reparacion, asignaciones_orden | ordenes_reparacion, users, permisos_empleado | — | 2 |
| `/api/reparaciones/[id]/tracking-link` | tracking_tokens | ordenes_reparacion, tracking_tokens, users, permisos_empleado | — | 2 |
| `/api/reparaciones/[id]/versiones-pdf` | versiones_pdf_reparacion | ordenes_reparacion, users, permisos_empleado, versiones_pdf_reparacion, configuracion, anticipos_reparacion, reparacion_piezas, pedidos_pieza_reparacion, garantias_reparacion | — | 1 |
| `/api/reparaciones/almacenaje` | recordatorios_enviados | ordenes_reparacion, historial_estado_orden, recordatorios_enviados, configuracion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/buscar` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/cancelar-folio` | folios_reparacion | — | — | 1 |
| `/api/reparaciones/dashboard` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, garantias_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, configuracion | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 1 |
| `/api/reparaciones/fotos` | imagenes_reparacion | ordenes_reparacion, imagenes_reparacion, users, permisos_empleado | — | 3 |
| `/api/reparaciones/fotos/[imagenId]` | imagenes_reparacion | imagenes_reparacion, ordenes_reparacion, users, permisos_empleado | — | 2 |
| `/api/reparaciones/fotos/ligar-sesion-qr` | imagenes_reparacion, sesiones_fotos_qr | sesiones_fotos_qr, ordenes_reparacion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/piezas-pendientes` | — | pedidos_pieza_reparacion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/qr/[token]` | sesiones_fotos_qr | sesiones_fotos_qr, ordenes_reparacion | — | 1 |
| `/api/reparaciones/qr/[token]/fotos` | — | sesiones_fotos_qr, imagenes_reparacion | — | 1 |
| `/api/reparaciones/qr/[token]/upload` | sesiones_fotos_qr, imagenes_reparacion | sesiones_fotos_qr | — | 1 |
| `/api/reparaciones/qr/generar` | sesiones_fotos_qr | ordenes_reparacion, users, permisos_empleado | — | 2 |
| `/api/reparaciones/reservar-folio` | folios_reparacion | users, permisos_empleado | generar_folio_orden | 1 |
| `/api/reparaciones/sugerencias` | — | ordenes_reparacion, pedidos_pieza_reparacion, users, permisos_empleado | — | 1 |
| `/api/reparaciones/tecnicos` | — | distribuidores, users, permisos_empleado | — | 2 |
| `/api/reparaciones/tecnicos/carga` | ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, notificaciones | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, configuracion, users, permisos_empleado | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos | 0 |
| `/api/reportes` | — | creditos, pagos, clientes, users, permisos_empleado | — | 1 |
| `/api/reportes/comisiones` | — | users, ventas, creditos, permisos_empleado | — | 1 |
| `/api/reportes/pdf` | — | creditos, pagos, clientes, users, permisos_empleado | — | 1 |
| `/api/reportes/pnl` | — | pagos, ventas, ventas_items, ordenes_reparacion, ordenes_compra, pedidos_pieza_reparacion, users, permisos_empleado | — | 1 |
| `/api/reportes/rentabilidad` | — | ventas, users, permisos_empleado | — | 1 |
| `/api/scoring/[id]` | scoring_clientes | scoring_clientes, users, permisos_empleado | calcular_scoring_cliente | 1 |
| `/api/scoring/[id]/recalcular` | scoring_clientes | scoring_clientes, users, permisos_empleado | calcular_scoring_cliente | 1 |
| `/api/servicios` | servicios | distribuidores, servicios, users, permisos_empleado | — | 3 |
| `/api/servicios/[id]` | servicios | servicios, users, permisos_empleado | — | 2 |
| `/api/servicios/categorias` | configuracion | configuracion, users, permisos_empleado | — | 3 |
| `/api/stats` | — | clientes, creditos, pagos, productos, scoring_clientes, users, permisos_empleado | — | 2 |
| `/api/storage/delete` | — | users, permisos_empleado | — | 2 |
| `/api/storage/upload` | — | users, permisos_empleado | — | 4 |
| `/api/subcategorias` | subcategorias | subcategorias, users, permisos_empleado | — | 1 |
| `/api/test-connection` | — | clientes, users, permisos_empleado | — | 0 |
| `/api/tracking/[token]` | tracking_tokens, ordenes_reparacion, folios_reparacion, imagenes_reparacion, historial_estado_orden, garantias_reparacion, anticipos_reparacion, caja_movimientos, productos, movimientos_stock, reparacion_piezas, solicitudes_piezas, garantias_piezas, notificaciones, versiones_pdf_reparacion, configuracion, movimientos_puntos, caja_sesiones, push_subscriptions | tracking_tokens, clientes, users, anticipos_reparacion, imagenes_reparacion, pedidos_pieza_reparacion, ordenes_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, creditos, notificaciones, versiones_pdf_reparacion, configuracion, puntos_cliente, movimientos_puntos, caja_sesiones, ventas, pagos, caja_movimientos, push_subscriptions | generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos, incrementar_puntos_cliente | 1 |
| `/api/tracking/[token]/pdf` | — | tracking_tokens, ordenes_reparacion, configuracion, anticipos_reparacion, reparacion_piezas, pedidos_pieza_reparacion, garantias_reparacion | — | 2 |
| `/api/tracking/[token]/preferencias` | clientes | tracking_tokens, ordenes_reparacion | — | 1 |
| `/api/tracking/[token]/promociones` | productos, servicios | tracking_tokens, ordenes_reparacion, promociones, productos, servicios | — | 1 |
| `/api/traspasos-anticipo` | traspasos_anticipo, caja_movimientos, notificaciones, push_subscriptions | users, permisos_empleado, traspasos_anticipo, creditos, notificaciones, push_subscriptions | — | 1 |
| `/api/traspasos-anticipo/[id]/confirmar` | caja_sesiones, anticipos_reparacion, notificaciones, caja_movimientos, traspasos_anticipo, push_subscriptions | users, permisos_empleado, caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, configuracion, traspasos_anticipo, creditos, notificaciones, push_subscriptions | — | 1 |
| `/api/whatsapp/mensajes` | — | whatsapp_mensajes, users, permisos_empleado | — | 1 |
| `/api/whatsapp/send` | whatsapp_mensajes | users, permisos_empleado, configuracion | — | 0 |
| `/api/whatsapp/test-connection` | — | configuracion, users, permisos_empleado | — | 1 |
| `/api/whatsapp/webhook` | whatsapp_mensajes | configuracion | — | 1 |

## 3. Tablas → quién las escribe y quién las lee
| Tabla | APIs que escriben | APIs que leen | Archivos |
|---|---|---|---|
| `alertas_productos_nuevos` | 3 | 3 | 1 |
| `anticipos_reparacion` | 30 | 36 | 12 |
| `asignaciones_orden` | 2 | 0 | 1 |
| `asistencia_sesiones` | 3 | 3 | 1 |
| `audit_log_accesos` | 0 | 0 | 0 |
| `caja_movimientos` | 33 | 30 | 8 |
| `caja_sesiones` | 29 | 30 | 4 |
| `catalogo_servicios_precios_distribuidor` | 2 | 2 | 1 |
| `catalogo_servicios_reparacion` | 2 | 2 | 1 |
| `categorias` | 1 | 3 | 3 |
| `clientes` | 4 | 22 | 16 |
| `config_notificaciones_reparacion` | 0 | 0 | 0 |
| `configuracion` | 24 | 57 | 14 |
| `confirmaciones_deposito` | 5 | 6 | 2 |
| `consignaciones` | 0 | 0 | 0 |
| `contratos` | 0 | 0 | 0 |
| `creditos` | 14 | 40 | 23 |
| `creditos_con_cliente` | 0 | 0 | 0 |
| `devoluciones` | 2 | 2 | 1 |
| `devoluciones_items` | 2 | 2 | 1 |
| `distribuidores` | 8 | 17 | 14 |
| `empleados_activos` | 0 | 0 | 0 |
| `factores_scoring` | 0 | 0 | 0 |
| `folios_reparacion` | 24 | 0 | 3 |
| `garantias_piezas` | 22 | 22 | 1 |
| `garantias_reparacion` | 22 | 28 | 6 |
| `historial_estado_orden` | 24 | 25 | 10 |
| `historial_precios_orden` | 2 | 1 | 3 |
| `historial_scoring` | 0 | 0 | 0 |
| `imagenes_reparacion` | 26 | 4 | 8 |
| `impersonacion_sesiones` | 0 | 0 | 0 |
| `kits` | 2 | 2 | 1 |
| `kits_items` | 2 | 0 | 1 |
| `kpi_snapshots` | 0 | 0 | 0 |
| `log_autorizaciones` | 7 | 7 | 1 |
| `lotes_piezas` | 5 | 5 | 1 |
| `lotes_piezas_items` | 5 | 5 | 1 |
| `lotes_series` | 2 | 2 | 1 |
| `lotes_series_items` | 2 | 0 | 1 |
| `movimientos_bolsa_virtual` | 7 | 4 | 9 |
| `movimientos_puntos` | 12 | 12 | 1 |
| `movimientos_stock` | 36 | 1 | 10 |
| `movimientos_ubicacion` | 2 | 2 | 1 |
| `notificacion_preferencias` | 0 | 0 | 0 |
| `notificaciones` | 38 | 13 | 11 |
| `notificaciones_fallidas` | 4 | 3 | 4 |
| `ordenes_compra` | 2 | 3 | 2 |
| `ordenes_compra_items` | 2 | 0 | 1 |
| `ordenes_reparacion` | 27 | 58 | 53 |
| `pagos` | 9 | 55 | 17 |
| `pagos_detallados` | 0 | 0 | 0 |
| `payjoy_api_logs` | 3 | 4 | 2 |
| `payjoy_webhooks` | 5 | 7 | 3 |
| `pedidos_pieza_reparacion` | 7 | 30 | 14 |
| `permisos_empleado` | 1 | 176 | 2 |
| `plantillas_notificacion` | 1 | 1 | 1 |
| `pos_scan_sessions` | 2 | 1 | 2 |
| `productos` | 40 | 54 | 25 |
| `promociones` | 2 | 2 | 3 |
| `proveedores` | 1 | 1 | 1 |
| `puntos_cliente` | 0 | 13 | 2 |
| `push_subscriptions` | 16 | 15 | 3 |
| `recordatorios_enviados` | 2 | 2 | 2 |
| `referencias_laborales` | 0 | 0 | 0 |
| `referencias_personales` | 0 | 0 | 0 |
| `reparacion_diagnosticos` | 2 | 2 | 1 |
| `reparacion_piezas` | 28 | 30 | 7 |
| `reparacion_tiempo_logs` | 1 | 1 | 1 |
| `scoring_clientes` | 2 | 4 | 3 |
| `servicios` | 3 | 3 | 1 |
| `sesiones_fotos_qr` | 4 | 4 | 5 |
| `solicitudes_cambio_precio` | 2 | 2 | 3 |
| `solicitudes_piezas` | 22 | 22 | 1 |
| `subcategorias` | 1 | 1 | 1 |
| `tokens_acceso_cliente` | 3 | 2 | 4 |
| `tracking_intentos` | 1 | 1 | 1 |
| `tracking_tokens` | 5 | 9 | 8 |
| `traspasos_anticipo` | 3 | 3 | 1 |
| `ubicaciones_inventario` | 2 | 5 | 2 |
| `users` | 4 | 179 | 20 |
| `usuarios` | 0 | 0 | 0 |
| `v_creditos_detalle` | 0 | 0 | 0 |
| `v_ordenes_antiguedad` | 0 | 0 | 0 |
| `v_permisos_empleado` | 0 | 0 | 0 |
| `ventas` | 8 | 41 | 11 |
| `ventas_items` | 6 | 11 | 7 |
| `verificaciones` | 0 | 0 | 0 |
| `verificaciones_inventario` | 3 | 3 | 1 |
| `verificaciones_items` | 3 | 3 | 1 |
| `versiones_pdf_reparacion` | 6 | 6 | 1 |
| `whatsapp_mensajes` | 9 | 2 | 4 |

## 4. Hallazgos automáticos
### 4.1 Tablas/vistas SIN ningún uso en el código (19)
`audit_log_accesos`, `config_notificaciones_reparacion`, `consignaciones`, `contratos`, `creditos_con_cliente`, `empleados_activos`, `factores_scoring`, `historial_scoring`, `impersonacion_sesiones`, `kpi_snapshots`, `notificacion_preferencias`, `pagos_detallados`, `referencias_laborales`, `referencias_personales`, `usuarios`, `v_creditos_detalle`, `v_ordenes_antiguedad`, `v_permisos_empleado`, `verificaciones`

### 4.2 Tablas que el código usa y NO existen en la BD (0)

### 4.3 APIs que nadie llama (8) — candidatas a código muerto o a uso externo
- `/api/empleados/vendedores`
- `/api/lotes-piezas/[id]/distribuir-envio`
- `/api/lotes-piezas/[id]/items`
- `/api/lotes-piezas/[id]/items/[itemId]`
- `/api/lotes-piezas/[id]`
- `/api/push/send`
- `/api/reparaciones/tecnicos/carga`
- `/api/whatsapp/send`

### 4.4 APIs sin validación de sesión visible (5) — revisar una por una
- `/api/cliente/perfil` (api/cliente/perfil/route.ts)
- `/api/cliente/solicitar-acceso` (api/cliente/solicitar-acceso/route.ts)
- `/api/push/send` (api/push/send/route.ts)
- `/api/reparacion/[folio]` (api/reparacion/[folio]/route.ts)
- `/api/reparaciones/cancelar-folio` (api/reparaciones/cancelar-folio/route.ts)

### 4.5 Funciones SQL (.rpc) usadas por el código
- `generar_folio_orden` → src/app/api/reparaciones/reservar-folio/route.ts, src/lib/db/reparaciones.ts
- `incrementar_stock` → src/app/api/reparaciones/[id]/pedidos-pieza/route.ts
- `total_pagado` → src/lib/db/creditos.ts
- `saldo_pendiente` → src/lib/db/creditos.ts
- `calcular_comision_vendedor` → src/lib/db/empleados.ts
- `calcular_desempeno_cobrador` → src/lib/db/empleados.ts
- `incrementar_puntos_cliente` → src/lib/db/puntos.ts
- `obtener_tecnico_disponible` → src/lib/db/reparaciones.ts
- `reasignar_tecnico` → src/lib/db/reparaciones.ts
- `obtener_carga_tecnicos` → src/lib/db/reparaciones.ts
- `calcular_scoring_cliente` → src/lib/db/scoring.ts

### 4.6 Páginas "espejo" (comparten ≥55 % de sus tablas)
| Página A | Página B | % tablas en común | Tablas comunes | APIs comunes |
|---|---|---|---|---|
| `/cliente/perfil` | `/dashboard/clientes/[id]` | 100% | tokens_acceso_cliente, clientes, ordenes_reparacion, garantias_reparacion, creditos, pagos, puntos_cliente, movimientos_puntos | 0 |
| `/dashboard/compras` | `/dashboard/compras/[id]` | 100% | ordenes_compra, productos, ordenes_compra_items, movimientos_stock | 0 |
| `/dashboard/creditos/cartera-vencida` | `/dashboard/creditos/[id]` | 100% | creditos, pagos, clientes | 0 |
| `/dashboard/creditos/cartera-vencida` | `/dashboard/pagos` | 100% | creditos, pagos, clientes | 0 |
| `/dashboard/creditos/[id]` | `/dashboard/pagos` | 100% | creditos, pagos, clientes | 1 |
| `/dashboard/inventario/discrepancias` | `/dashboard/inventario` | 100% | productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | 0 |
| `/dashboard/reparaciones` | `/dashboard/tecnico` | 94% | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, creditos, versiones_pdf_reparacion, tracking_tokens, solicitudes_cambio_precio, historial_precios_orden, movimientos_bolsa_virtual, clientes, sesiones_fotos_qr, asignaciones_orden, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo | 46 |
| `/dashboard/reparaciones/[id]` | `/dashboard/tecnico` | 94% | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, creditos, caja_sesiones, ventas, pagos, caja_movimientos, solicitudes_cambio_precio, historial_precios_orden, movimientos_stock, imagenes_reparacion, movimientos_bolsa_virtual, folios_reparacion, clientes, confirmaciones_deposito, versiones_pdf_reparacion, puntos_cliente, movimientos_puntos, reparacion_tiempo_logs, sesiones_fotos_qr, traspasos_anticipo | 28 |
| `/dashboard` | `/dashboard/reparaciones` | 92% | clientes, creditos, pagos, productos, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, caja_sesiones, ventas, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, historial_precios_orden, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, movimientos_bolsa_virtual, catalogo_servicios_reparacion, catalogo_servicios_precios_distribuidor, sesiones_fotos_qr, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo | 49 |
| `/dashboard/reparaciones` | `/dashboard/reparaciones/[id]` | 88% | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, creditos, versiones_pdf_reparacion, tracking_tokens, solicitudes_cambio_precio, historial_precios_orden, movimientos_bolsa_virtual, clientes, sesiones_fotos_qr, puntos_cliente, movimientos_puntos, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo | 28 |
| `/dashboard` | `/dashboard/tecnico` | 86% | clientes, creditos, pagos, productos, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, caja_sesiones, ventas, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, historial_precios_orden, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, movimientos_bolsa_virtual, sesiones_fotos_qr, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo | 44 |
| `/dashboard/inventario/discrepancias` | `/dashboard/inventario/verificar` | 83% | productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | 2 |
| `/dashboard/inventario` | `/dashboard/inventario/verificar` | 83% | productos, verificaciones_inventario, verificaciones_items, ubicaciones_inventario, alertas_productos_nuevos | 0 |
| `/dashboard` | `/dashboard/reparaciones/[id]` | 81% | clientes, creditos, pagos, productos, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, caja_sesiones, ventas, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, historial_precios_orden, puntos_cliente, movimientos_puntos, tracking_tokens, solicitudes_cambio_precio, movimientos_bolsa_virtual, sesiones_fotos_qr, confirmaciones_deposito, reparacion_tiempo_logs, traspasos_anticipo | 27 |
| `/dashboard/pos` | `/dashboard/tecnico` | 76% | creditos, pagos, clientes, ordenes_reparacion, anticipos_reparacion, movimientos_bolsa_virtual, caja_sesiones, ventas, caja_movimientos, productos, puntos_cliente, movimientos_puntos, movimientos_stock, traspasos_anticipo, pedidos_pieza_reparacion, reparacion_piezas, versiones_pdf_reparacion, historial_estado_orden, garantias_reparacion, solicitudes_piezas, garantias_piezas, folios_reparacion, imagenes_reparacion, confirmaciones_deposito, historial_precios_orden, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, reparacion_tiempo_logs, sesiones_fotos_qr | 43 |
| `/dashboard/reparaciones/[id]` | `/dashboard/reparaciones/[id]/ticket` | 76% | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, creditos, caja_sesiones, ventas, pagos, caja_movimientos, solicitudes_cambio_precio, historial_precios_orden, movimientos_stock, imagenes_reparacion, movimientos_bolsa_virtual, folios_reparacion, confirmaciones_deposito | 2 |
| `/dashboard` | `/dashboard/pos` | 75% | clientes, creditos, pagos, productos, scoring_clientes, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, caja_sesiones, ventas, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, historial_precios_orden, puntos_cliente, movimientos_puntos, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, movimientos_bolsa_virtual, sesiones_fotos_qr, confirmaciones_deposito, log_autorizaciones, reparacion_tiempo_logs, traspasos_anticipo | 44 |
| `/dashboard/dashboard-reparaciones` | `/dashboard/reparaciones/[id]/ticket` | 73% | ordenes_reparacion, garantias_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock | 0 |
| `/dashboard/pos` | `/dashboard/reparaciones` | 72% | creditos, pagos, clientes, ordenes_reparacion, anticipos_reparacion, movimientos_bolsa_virtual, caja_sesiones, ventas, caja_movimientos, productos, puntos_cliente, movimientos_puntos, movimientos_stock, traspasos_anticipo, pedidos_pieza_reparacion, reparacion_piezas, versiones_pdf_reparacion, historial_estado_orden, garantias_reparacion, solicitudes_piezas, garantias_piezas, folios_reparacion, imagenes_reparacion, confirmaciones_deposito, historial_precios_orden, reparacion_diagnosticos, asignaciones_orden, tracking_tokens, solicitudes_cambio_precio, reparacion_tiempo_logs, sesiones_fotos_qr | 43 |
| `/dashboard/pos` | `/dashboard/reparaciones/[id]` | 71% | creditos, pagos, clientes, ordenes_reparacion, anticipos_reparacion, movimientos_bolsa_virtual, caja_sesiones, ventas, caja_movimientos, productos, puntos_cliente, movimientos_puntos, movimientos_stock, traspasos_anticipo, pedidos_pieza_reparacion, reparacion_piezas, versiones_pdf_reparacion, historial_estado_orden, garantias_reparacion, solicitudes_piezas, garantias_piezas, folios_reparacion, imagenes_reparacion, confirmaciones_deposito, historial_precios_orden, tracking_tokens, solicitudes_cambio_precio, reparacion_tiempo_logs, sesiones_fotos_qr | 27 |
| `/dashboard/reparaciones/[id]` | `/tracking/[token]` | 71% | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, creditos, caja_sesiones, ventas, pagos, caja_movimientos, movimientos_stock, imagenes_reparacion, folios_reparacion, clientes, versiones_pdf_reparacion, puntos_cliente, movimientos_puntos | 0 |
| `/dashboard/reparaciones/[id]/ticket` | `/dashboard/tecnico` | 71% | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, creditos, caja_sesiones, ventas, pagos, caja_movimientos, solicitudes_cambio_precio, historial_precios_orden, movimientos_stock, imagenes_reparacion, movimientos_bolsa_virtual, folios_reparacion, confirmaciones_deposito | 2 |
| `/dashboard/compras/nueva` | `/dashboard/compras` | 67% | productos, ordenes_compra, ordenes_compra_items, movimientos_stock | 2 |
| `/dashboard/compras/nueva` | `/dashboard/compras/[id]` | 67% | productos, ordenes_compra, ordenes_compra_items, movimientos_stock | 0 |
| `/dashboard/dashboard-reparaciones` | `/tracking/[token]` | 67% | ordenes_reparacion, garantias_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock | 0 |
| `/dashboard/pos/caja` | `/dashboard/pos/historial` | 67% | caja_sesiones, ventas, pagos, caja_movimientos, anticipos_reparacion, ventas_items, productos, puntos_cliente, movimientos_puntos, movimientos_stock | 0 |
| `/dashboard/reparaciones` | `/dashboard/reparaciones/[id]/ticket` | 67% | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, creditos, tracking_tokens, solicitudes_cambio_precio, historial_precios_orden, movimientos_bolsa_virtual, confirmaciones_deposito | 3 |
| `/dashboard/tecnico` | `/tracking/[token]` | 67% | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, creditos, versiones_pdf_reparacion, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, tracking_tokens, clientes, puntos_cliente, movimientos_puntos | 0 |
| `/dashboard/reparaciones/[id]/ticket` | `/tracking/[token]` | 64% | ordenes_reparacion, tracking_tokens, pedidos_pieza_reparacion, productos, anticipos_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, creditos, caja_sesiones, ventas, pagos, caja_movimientos, movimientos_stock, imagenes_reparacion, folios_reparacion | 0 |
| `/dashboard/reparaciones` | `/tracking/[token]` | 63% | ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, creditos, versiones_pdf_reparacion, tracking_tokens, clientes, puntos_cliente, movimientos_puntos | 0 |
| `/dashboard` | `/dashboard/reparaciones/[id]/ticket` | 61% | creditos, pagos, productos, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, historial_precios_orden, tracking_tokens, solicitudes_cambio_precio, movimientos_bolsa_virtual, confirmaciones_deposito | 2 |
| `/dashboard/pos` | `/tracking/[token]` | 59% | creditos, pagos, clientes, ordenes_reparacion, anticipos_reparacion, promociones, caja_sesiones, ventas, caja_movimientos, productos, puntos_cliente, movimientos_puntos, movimientos_stock, servicios, pedidos_pieza_reparacion, reparacion_piezas, versiones_pdf_reparacion, historial_estado_orden, garantias_reparacion, solicitudes_piezas, garantias_piezas, folios_reparacion, imagenes_reparacion, tracking_tokens | 0 |
| `/dashboard` | `/tracking/[token]` | 58% | clientes, creditos, pagos, productos, ordenes_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, garantias_reparacion, reparacion_piezas, solicitudes_piezas, garantias_piezas, versiones_pdf_reparacion, caja_sesiones, ventas, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock, puntos_cliente, movimientos_puntos, tracking_tokens | 0 |
| `/dashboard/dashboard-reparaciones` | `/dashboard/reparaciones/[id]` | 55% | ordenes_reparacion, garantias_reparacion, anticipos_reparacion, pedidos_pieza_reparacion, historial_estado_orden, reparacion_piezas, productos, solicitudes_piezas, garantias_piezas, caja_sesiones, ventas, pagos, caja_movimientos, folios_reparacion, imagenes_reparacion, movimientos_stock | 0 |

### 4.7 Archivos que definen su PROPIO mapa de estados/etiquetas (15)
- `src/app/api/dashboard/stream/route.ts`
- `src/app/cliente/perfil/page.tsx`
- `src/app/dashboard/clientes/[id]/page.tsx`
- `src/app/dashboard/reparaciones/page.tsx`
- `src/app/dashboard/tecnico/page.tsx`
- `src/components/dashboard/DashboardEjecutivo.tsx`
- `src/components/dashboard/TecnicoDashboard.tsx`
- `src/components/pos/BolsaVirtualPanel.tsx`
- `src/components/pos/ReparacionesPOSPanel.tsx`
- `src/components/reparaciones/AccionesOrdenPanel.tsx`
- `src/components/reparaciones/cards/OrdenCard.tsx`
- `src/components/reparaciones/EstadoBadge.tsx`
- `src/components/reparaciones/ModalCambiarEstado.tsx`
- `src/components/reparaciones/ModalWhatsAppEstado.tsx`
- `src/components/reparaciones/TimelineOrden.tsx`

### 4.8 Sidebar vs páginas
- Enlaces del menú sin página: ninguno
- Páginas de /dashboard sin enlace en el menú: `/dashboard/admin/categorias/nueva`, `/dashboard/admin/distribuidores/nuevo`, `/dashboard/admin/proveedores/nuevo`, `/dashboard/compras/nueva`, `/dashboard/inventario`, `/dashboard/notificaciones/fallidas`

### 4.9 Archivos gigantes (> 900 líneas)
- `src/components/reparaciones/drawer/OrdenDrawer.tsx` — 4341 líneas
- `src/app/dashboard/productos/page.tsx` — 3410 líneas
- `src/app/dashboard/pos/page.tsx` — 2683 líneas
- `src/app/tracking/[token]/page.tsx` — 2356 líneas
- `src/lib/db/reparaciones.ts` — 2146 líneas
- `src/types/index.ts` — 1959 líneas
- `src/components/reparaciones/ModalOrden.tsx` — 1565 líneas
- `src/app/dashboard/inventario/verificar/page.tsx` — 1530 líneas
- `src/app/dashboard/configuracion/page.tsx` — 1485 líneas
- `src/app/dashboard/pos/caja/page.tsx` — 1317 líneas
- `src/app/dashboard/inventario/alertas/page.tsx` — 1245 líneas
- `src/components/reparaciones/ModalDiagnostico.tsx` — 1202 líneas
- `src/lib/utils/reportes.ts` — 1196 líneas
- `src/app/catalogo/page.tsx` — 1154 líneas
- `src/app/dashboard/reportes/page.tsx` — 1093 líneas
- `src/components/reparaciones/PiezasInventarioPanel.tsx` — 1085 líneas
- `src/components/pos/ReparacionesPOSPanel.tsx` — 1084 líneas
- `src/app/dashboard/creditos/[id]/page.tsx` — 1001 líneas
- `src/app/dashboard/admin/distribuidores/page.tsx` — 990 líneas
- `src/app/dashboard/payjoy/page.tsx` — 989 líneas
