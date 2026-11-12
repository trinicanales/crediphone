
# E — Verificación de hallazgos de los informes B y C (2026-11-11)
> Cada hallazgo se comprobó otra vez en el código actual y/o en Supabase (proyecto ihvjjfsefnvcrczrcmhp). Nada se tomó de documentos previos.
> Niveles: **A** reproducido/comprobado en la BD · **B** dato real contado en la BD · **D** solo lectura de código (no ejecutado).

## CONFIRMADOS
| ID | Hallazgo | Nivel | Prueba |
|---|---|---|---|
| P-4 | Venta a crédito imposible | A | CHECK `ventas_metodo_pago_check` = efectivo/transferencia/tarjeta/mixto |
| P-5 | Promociones no cobrables en POS | A | `ventas_items.servicio_id` es uuid |
| P-13 | `incrementar_stock` rota | A | actualiza `stock_actual` (no existe en `productos`; la columna es `stock`) |
| P-12 | 4 reglas de stock bajo con 4 resultados | A+B | misma BD: Productos=3 · Órdenes de compra=5 · Alertas=24 (stock.ts con stock>0) · Dashboard=26 (stock.ts incluyendo 0). Motivo: Productos y Sugerencias no usan el mínimo por defecto de `stock.ts` |
| P-6 | F9 y F12 no expanden kits | D | el cobro normal expande el kit en sus componentes (pos/page.tsx ~523); F12 (~650) y F9 (~715) mandan `item.producto?.id` sin expandir → el kit se cobra pero no descuenta stock |
| P-6b | Posible precio del kit multiplicado | D (sospecha) | al expandir, el primer componente lleva `precioUnitario` del kit pero con cantidad `ki.cantidad × item.cantidad`; si el componente es >1, el precio se multiplica. Por probar con un kit real |
| P-8 | Cajas | B | 4 cajas abiertas (desde 2026-04-23, 2026-05-13, 2026-09-26 y 2026-11-12) · 20 cierres con monto final 0 |
| P-14 | Stock sin bitácora | B | `movimientos_stock` = 10 filas; hay 6 ventas y 0 devoluciones en toda la historia |
| P-20 | Costos | B | 113 de 137 productos sin costo |
| P-22 | Catálogos de servicios | B | `servicios`=2 filas · `catalogo_servicios_reparacion`=0 |
| C-1 | Recuperar contraseña filtra el enlace | D | `/api/auth/reset-password` sin sesión; si WhatsApp está en modo enlace devuelve `waLink` con el enlace de recuperación (route.ts l.63-66). Basta saber el teléfono de un empleado |
| C-2 | Configuración sin sesión | D | `GET /api/configuracion` responde a anónimos (por subdominio o "primera config"); incluye RFC, contador y token de verificación de WhatsApp. El token de acceso de WhatsApp NO se devuelve |
| C-3 | Empleado desactivado sigue entrando | D+B | ni `middleware.ts` ni `auth/server.ts` revisan `activo`; existe 1 vendedor inactivo sin tienda (`distribuidor_id` null) |
| C-4 | Columnas inexistentes | A | `ordenes_reparacion` no tiene `cliente_nombre`, `cliente_telefono`, `tecnico_nombre` (cron de recordatorios y almacenaje las piden) |
| C-5 | Clientes sin control de rol | D | `/api/clientes` y `/api/clientes/[id]` (DELETE incluido) no tienen ninguna revisión de rol; créditos/[id] sí |
| C-7 | Menú que redirige | D | Sidebar muestra Categorías/Proveedores/Catálogo Reparaciones a "admin", pero `dashboard/admin/layout.tsx` manda a `/dashboard` a todo el que no es super_admin |
| C-10 | Pagos no se pueden guardar | A+B | `pagos` no tiene `detalle_pago`; 0 pagos en la tabla |
| C-11 | Vista de empleados | A | `empleados_activos` (sueldo, comisión) con SELECT para `authenticated`, sin security_invoker; `anon` puede ejecutar `calcular_comision_vendedor` |
| C-12 | Mensajes de WhatsApp | B | 444 mensajes en estado `pendiente`, ninguno enviado (modo enlace) |
| C-14 | Teléfonos duplicados | B | 22 teléfonos repetidos en `clientes` |

## REVISADOS Y NO CONFIRMADOS
- **`/api/cliente/solicitar-acceso`**: NO devuelve el token al que lo pide (responde solo `success`). Sin embargo, con WhatsApp en modo enlace el mensaje nunca llega al cliente, así que el portal del cliente no puede entrarse por ese camino (D).
- **`/api/cliente/perfil`**: exige cookie `cliente_sesion` válida contra `tokens_acceso_cliente` (no es público).

## HALLAZGOS NUEVOS al verificar (reparaciones, B)
- 57 órdenes en `listo_entrega`, mediana **117 días** esperando (máx. 182): casi seguro equipos ya entregados sin marcar. 
- 77 en `recibido` (49 sin técnico); 27 de ellas de agosto, 18 de septiembre, 14 de octubre → no se están moviendo.
- Datos por mes en `recibido`: may 2 · jun 1 · jul 12 · ago 27 · sep 18 · oct 14 · nov 3.

## SIN VERIFICAR TODAVÍA
P-7 (precio libre en carrito, parcial: el servidor sí valida descuento ≤ subtotal pero no el precio), P-11 (filtros entre tiendas, solo lectura de código), C-9, C-13 (campos de configuración sin efecto), duplicados de estados en 22 archivos, y las 11 preguntas de negocio de B y C.
