# Auditoría del POS — ventas, caja, devoluciones, apartados
> 2026-10-21 · SOLO LECTURA (sin cambios de código ni de datos). Código (`lib/db/ventas.ts`, `caja.ts`, `devoluciones.ts`, `creditos.ts`, rutas `api/pos/*`, `api/apartados`) + base real (triggers, constraints, cajas, anticipos).
> Uso real hoy: 6 ventas POS en total (ninguna en 30 días); el POS se usa sobre todo para **caja de reparaciones**: 172 anticipos, 51 sesiones de caja.

## Resumen
El POS de **productos** es funcional para vender (venta, items, stock por trigger, folio). Pero **devoluciones no funcionan**, **la caja no se está cerrando bien**, **apartados está incompleto** y hay validaciones que solo existen en pantalla, no en el servidor. Lo más grave por dinero está en la **caja**.

## A. Críticos
| ID | Hallazgo | Evidencia |
|---|---|---|
| POS-1 | **Devoluciones fallan siempre**: la consulta pide `ventas_items.nombre_producto` (la columna es `producto_nombre`) → "No se encontraron los items" | `lib/db/devoluciones.ts:218` |
| POS-2 | **(una vez arreglado POS-1) doble reintegro de stock en devolución total**: el código suma stock a mano y luego marca la venta `reembolsada`, y el trigger `restaurar_stock_cancelacion` vuelve a sumar TODOS los items | trigger + `devoluciones.ts` pasos 7–8 |
| POS-3 | **Se puede devolver más de lo vendido**: valida contra la cantidad vendida, no contra lo ya devuelto; una devolución parcial deja la venta "completada" y se puede repetir | `devoluciones.ts` |
| POS-4 | **Devolver o cancelar no registra el dinero en caja**: no hay movimiento; el cuadre no se entera. El CHECK de `caja_movimientos.tipo` no tiene un tipo para devolución de venta | CHECK tipos = deposito, retiro, cobro_reparacion, entrada_anticipo, devolucion_anticipo, pay_in, pay_out |
| POS-5 | **Cancelar venta**: no revisa el estado actual, sobrescribe `notas`, si hubo devolución parcial vuelve a sumar stock de todos los items (doble), no devuelve dinero ni puntos | `cancelarVenta` |
| POS-6 | **Cierre de caja sin conteo**: **21 de 47 cierres con monto final $0** (esperado de hasta $13,290) → "faltantes" por **−$39,320.97**; otros 16 cierres con conteo tienen diferencia (−$15,631). Total de diferencias registradas **−$54,951.97**. No se sabe si es dinero faltante o solo no contado | `caja_sesiones` |
| POS-7 | **4 cajas siguen abiertas** (25, 69, 162 y 181 días; una sin tienda) y acumulan **63 anticipos = $36,415** ($34,865 en efectivo). La de Paula Madrid (abierta el 13-ago) tiene 30 anticipos / $19,400 en efectivo | `caja_sesiones` + `anticipos_reparacion` |
| POS-8 | **La alerta de descuadre de caja nunca se crea** (y las de anticipos tampoco): insertan en `notificaciones` columnas que no existen (`titulo`, `severidad`, `leida`, `metadata`, `distribuidor_id`). Por eso nadie se enteró de los descuadres | `lib/db/caja.ts:326`, `api/reparaciones/[id]/anticipos` |
| POS-9 | **Apartados está incompleto**: (a) crear NO reserva el producto (el comentario dice que sí; `stock_apartado` solo se usa para refacciones de reparación); (b) el depósito NO se registra en caja ni en pagos (`montoRecibido` y método se ignoran); (c) "completar" solo cambia el estado a "pagado": no cobra el saldo, no crea venta, no descuenta stock, no registra dinero; (d) no hay cancelar ni vencimiento que libere el producto o devuelva el depósito | `createApartado`, `completarApartado` |

## B. Importantes
| ID | Hallazgo |
|---|---|
| POS-10 | **Se puede vender sin caja abierta** (la venta queda con `sesion_caja_id` nulo y no entra a ningún corte) |
| POS-11 | **El servidor confía en el precio** que manda la pantalla (`precioUnitario`): por API se puede vender a $1. El descuento solo se valida entre 0 y el subtotal; `descuento_maximo_pct` (por defecto **100 %**) y `limites_descuento` no se aplican en el servidor, solo en la pantalla |
| POS-12 | **Multi-tienda**: una venta acepta productos de otra tienda (y el trigger les resta stock); `crearDevolucion` busca la venta sin filtrar por tienda; ventas de super_admin quedan sin tienda |
| POS-13 | **La venta no es atómica**: venta → items → movimientos → puntos en pasos separados; si fallan los items se intenta borrar la venta; la validación de stock tiene una pequeña carrera si dos cajas venden la última pieza |
| POS-14 | **Pago mixto sin desglose** es aceptado |
| POS-15 | **Puntos de lealtad** no se revierten al cancelar/devolver |
| POS-16 | **Abrir caja** pega a la nueva sesión TODOS los anticipos en efectivo del usuario que estaban sin sesión (de cualquier fecha) → puede inflar el efectivo esperado |
| POS-17 | **Resumen de cliente en POS** (`api/clientes/[id]/resumen-pos`) pide columnas que no existen (`creditos.monto_credito`, `saldo_pendiente`, `scoring_clientes.score/categoria`): el resumen sale incompleto |
| POS-18 | `ordenes_reparacion.total_anticipos` no existe (resumen de cliente); `users.nombre/apellido` en el route de anticipos (nombre de quien recibió) |

## C. Lo que sí funciona
Venta con folio automático; stock se descuenta por trigger y no deja vender sin existencia ("Stock insuficiente"); monto recibido en efectivo validado; pago mixto suma exacta; snapshot de nombre/marca/modelo en los items; trazabilidad en `movimientos_stock`; cobro de reparación en POS crea anticipo, cuenta en el cierre y no se duplica; fechas "de hoy" ya en hora de México (K0).

## D. Plan propuesto (cada fase con tu aprobación)
- **P-1 Devoluciones y cancelaciones correctas:** corregir columna; una sola vía de stock (en la base, atómica); límite acumulado por línea; movimiento de caja de la devolución (nuevo tipo `devolucion_venta`, aditivo); reversa de puntos; validar tienda; no sobrescribir notas.
- **P-2 Caja confiable:** no permitir cierre en $0 si se esperaba efectivo (pedir conteo o motivo); alerta de descuadre funcional (columnas correctas); aviso si una caja lleva abierta más de 1 día; no pegar anticipos viejos al abrir; revisar las 4 cajas abiertas y los cierres en $0 contigo (decisión tuya: cierre administrativo con nota).
- **P-3 Apartados completos:** reservar producto; depósito en caja; abonos; completar = cobrar saldo + venta + descontar stock; cancelar/vencer liberando el producto (con tu regla de depósito).
- **P-4 Venta segura:** precio y descuento validados en servidor; productos de la tienda; pago mixto con desglose; venta atómica (función en la base); venta solo con caja abierta (si lo apruebas).
- **P-5 Detalles:** resumen de cliente en POS y nombre de quien recibe el anticipo.

## E. Preguntas para Trini
1. **Cierre de caja con $0:** ¿se bloquea? (propuesta: sí, pedir conteo; si de verdad es 0, motivo obligatorio).
2. **Las 4 cajas abiertas** ($36,415 en anticipos): ¿me dices con qué conteo real las cerramos, o las reviso contigo una por una?
3. **Devolución en efectivo:** ¿se registra como salida en la caja abierta de quien la hace? (propuesta: sí, nuevo tipo `devolucion_venta`).
4. **Venta sin caja abierta:** ¿se bloquea? (propuesta: sí).
5. **Apartados:** ¿% de depósito por defecto, días para recoger (hoy 15) y si el depósito se devuelve cuando el cliente no recoge?
6. **Descuento:** ¿máximo permitido sin autorización para vendedor y para admin? (hoy sin límite en servidor).
