# Auditoría — Seguimiento de la orden, stepper de estados, OrdenCard y páginas relacionadas
> Fecha: 2026-10-19 · Solo lectura. Archivos revisados: `StepperReparacion`, `BarraProgresoReparacion` (tracking), `TimelineOrden`, `EstadoBadge`, `OrdenCard`, `AccionesOrdenPanel`, `ModalCambiarEstado`, `ModalWhatsAppEstado`, `app/tracking/[token]`, `app/reparacion/[folio]`, `api/tracking/[token]`, `api/reparacion/[folio]`, `dashboard/reparaciones`, `dashboard/tecnico`, dashboards, `ReparacionesPOSPanel`, `dashboard/clientes/[id]`, `cliente/perfil`, `lib/notificaciones-reparaciones`.

## Veredicto
**La unificación NO está completa.** Hay **un solo flujo de estados** en la base de datos y el servidor (ya unificado el 2026-10-19 en `lib/reparaciones/estados.ts`), pero **cada pantalla dibuja su propia versión**: 22 archivos con su propio mapa de etiquetas/colores, **dos steppers distintos** (staff y cliente) y varias pantallas que no conocen todos los estados. El cliente y el personal pueden ver **progresos diferentes de la misma orden**.

---

## A. Seguridad / privacidad del seguimiento (prioridad alta)
| ID | Hallazgo | Impacto |
|---|---|---|
| SEG-1 | `GET /api/reparacion/[folio]` (público, sin sesión) devuelve el **nombre del cliente, el historial de estados y el `trackingToken`**. Los folios son consecutivos (`ORD-AAAAMMDD-NNNN`) y adivinables | Cualquiera puede recorrer folios, obtener el token y abrir **el seguimiento completo** de otros clientes (precios, diagnóstico y botones de aprobar/rechazar presupuesto). El token deja de ser un secreto |
| SEG-2 | `GET /api/tracking/[token]` dice "solo información pública (sin datos sensibles)" pero devuelve `piezasCotizacion`, `snapshotCotizacionInicial` y `partesReemplazadas` **completos**, con `costoInterno`, `costoEnvio` y `proveedorId` | **El cliente (o quien tenga el link) ve el costo de compra y el margen de cada pieza** |
| SEG-3 | El token de seguimiento vence **90 días después de crearse** (primera transición), pero la garantía dura **90 días desde la entrega** | En órdenes largas el link/QR del documento **vence antes de que termine la garantía**. La columna `activa` no se usa; hay 101 tokens vencidos marcados activos |
| SEG-4 | La clave/patrón del equipo se imprime en el **ticket interno** y se guarda sin cifrar; la política publicada promete borrarla al entregar y **no se borra** (ver reporte de casos especiales §6.2) | Incumplimiento de lo prometido al cliente |

## B. Unificación de estados entre pantallas
| ID | Hallazgo |
|---|---|
| EST-1 | **Dos steppers con modelos distintos.** Tarjeta (staff): 6 pasos — Recibido · Diagnóstico[diagnóstico+presupuesto] · Aprobado[aprobado+**esperando piezas**] · Reparando · Listo[**completado**+listo] · Entregado. Seguimiento (cliente): 7 pasos — Recibido · Diagnóstico[diagnóstico+**esperando piezas**] · **Presupuesto** · Aprobado · Reparando[reparando+**completado**] · Listo · Entregado. Mismo estado, distinto paso: `esperando_piezas`, `presupuesto` y `completado` |
| EST-2 | `esperando_piezas` se alcanza desde "En reparación" (transición válida): en **ambos** steppers la barra **retrocede** (staff: a "Aprobado"; cliente: a "Diagnóstico"). Ningún stepper tiene un indicador propio de "esperando piezas" |
| EST-3 | **22 archivos** definen sus propias etiquetas/colores. Variantes reales de la misma etiqueta: "Esperando Piezas" (4), "Esperando piezas" (3), "Esp. Piezas" (3), "En espera de piezas" (1); "Presupuesto Pendiente" (4+1), "Pres. Pendiente", "Presupuesto enviado", "Presupuesto Listo"… |
| EST-4 | **Matriz de cobertura de estados**: el seguimiento del cliente (`tracking/[token]`) y la página pública por folio **no tratan `esperando_piezas`** (muestran las piezas en otra sección); **`cliente/perfil` y el perfil de cliente del dashboard no conocen `aprobado` ni `completado`** (muestran el texto crudo de la BD); `DashboardEjecutivo` ignora en_reparacion, completado, entregado y terminales; `ReparacionesPOSPanel` ignora `no_reparable`; `AccionesOrdenPanel` no tiene acciones para estados terminales (correcto) |
| EST-5 | El stepper de la tarjeta permite **hacer clic en cualquier paso**, incluso saltos inválidos (p. ej. de "Recibido" a "Reparando"): fallan en el servidor con un `alert`. El nodo "Listo" apunta a `listo_entrega` aunque desde "En reparación" hace falta pasar por `completado`. El nodo "Entregado" ahora responde 409 (correcto) pero debería **abrir el flujo de entrega** |
| EST-6 | **Cancelar desde la tarjeta/stepper usa el cambio de estado genérico** (`ESTADOS_CRITICOS` → `ModalCambiarEstado` → `PUT estado=cancelado`), que **no devuelve anticipos, no libera piezas apartadas y no revierte la bolsa virtual**. La cancelación completa (`/cancelar`, `ModalCancelacion`) solo se alcanza desde otros puntos (drawer / POS) → el mismo botón visual produce efectos distintos según desde dónde se use |
| EST-7 | La **cola offline** reproduce `reparacion_estado` con el mismo `PUT` genérico: hereda las mismas limitaciones (y ahora rechazará "entregado") |
| EST-8 | La lista de reparaciones no tiene realtime (M2): la tarjeta de otro usuario no refleja cambios hasta recargar; el drawer sí (agregado) |

## C. "Total a pagar": tres versiones distintas
`ordenes_reparacion` tiene `precio_total` (lo que paga el cliente) y `costo_total` (otro cálculo). `recalcularTotalesOrden()` escribe **solo `precio_total`** y `costo_partes`. Cada pantalla elige distinto:
| Pantalla | Usa |
|---|---|
| POS cobro, Entregar, OrdenCard, P&L | `precio_total \|\| costo_total` ✔ |
| **Seguimiento del cliente** (`saldoPendiente`) y **ticket interno** | **solo `costo_total`** ✘ |
| **AnticipoCajaPanel** | **solo `presupuestoTotal` (`precio_total`)** ✘ |
| API pública por folio | `costo_total \|\| precio_total` |
- Datos reales (185 órdenes no canceladas): **52 tienen solo `precio_total`** (`costo_total = 0`) → el **saldo que ve el cliente en el seguimiento y en el ticket es incorrecto (cero o negativo)**; **2 tienen solo `costo_total`** (AnticipoCajaPanel muestra 0); **12 tienen ambos pero distintos**; 92 coinciden; 27 en cero.

## D. WhatsApp / avisos (aclara la duda de Trini sobre "no he podido verificar")
- **La API de WhatsApp está DESACTIVADA en las 4 franquicias** (`wa_enabled = false`; solo una tiene `phone_number_id` y ninguna tiene token). Por eso **todos los mensajes (406) están en modo "link" y estado "pendiente"**: el sistema solo **prepara el enlace `wa.me`** y **una persona tiene que hacer clic y enviar**. No hay forma de saber si se enviaron. No son automáticos.
- No existe aviso al **crear** la orden (`recibido` no está en la configuración de notificaciones).
- Ya existe el aviso para `esperando_piezas` (el punto #9 del backlog **ya estaba hecho**, pero también en modo link).
- Riesgo futuro: si se activa la API, la UI **seguirá abriendo `ModalWhatsAppEstado`** después de cada cambio → posible **doble envío** (automático + manual).

## E. Qué sí está unificado (para no perderlo)
- Estados de la BD = tipo TypeScript = servidor = modal = tarjeta (desde 2026-10-19, `estados.ts`).
- Historial de estado por trigger de BD (aunque sin usuario).
- Notificaciones por cambio de estado en el servidor, con registro en `notificaciones` y `whatsapp_mensajes`.

---

## F. Propuesta (aditiva, sin quitar nada que funcione)
1. **Catálogo único de estados** (`estados.ts` ampliado): por estado → etiqueta larga/corta, color, icono, **paso interno**, **paso para el cliente**, si es "espera", si se puede cancelar. Las 22 pantallas lo importan; se migra pantalla por pantalla.
2. **Un solo componente de progreso** con dos "vistas" (staff/cliente) que salen del mismo catálogo; indicador propio de "Esperando piezas" sin retroceso (insignia sobre el paso actual en vez de cambiar de paso).
3. **Cancelar y Entregar siempre por su flujo completo**: el stepper/tarjeta abre `ModalCancelacion` / flujo de entrega; el cambio genérico queda solo para transiciones simples.
4. **Una función `totalAPagar(orden)`** (servidor y cliente) y corregir seguimiento, ticket y AnticipoCajaPanel; backfill de `costo_total = precio_total` donde falte (requiere OK).
5. **API pública segura:** quitar `trackingToken` de la respuesta por folio (o exigir los últimos 4 dígitos del teléfono); filtrar `piezasCotizacion/partesReemplazadas` del seguimiento a nombre, cantidad y precio al cliente; extender la vigencia del token hasta entrega + garantía.
6. **WhatsApp:** decidir si se activa la API (plantillas Meta) o se mantiene el modo enlace; si se activa, quitar el modal manual o convertirlo en reenvío; aviso de "orden recibida" al crear.
7. Etiquetas y colores del portal del cliente y del perfil (`aprobado`, `completado`) vía el catálogo.
