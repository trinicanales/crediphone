# Sesión Activa — CREDIPHONE

## Estado: AUDITORÍA COMPLETA — PENDIENTE DE IMPLEMENTACIÓN 📋

## Última actualización — 2026-04-07

---

## REGLAS DE NEGOCIO CONFIRMADAS POR TRINI (nunca cambiar sin consultar)

### Dinero y Caja
- TODO el dinero que entra a la tienda debe pasar por caja, sin excepción
- Los anticipos NO son ingresos directos — son prepagos del cliente para un servicio específico
- Un anticipo siempre está vinculado a UNA sola orden de reparación (no se mezclan)
- El técnico y el vendedor pueden estar en la misma área física, pero el flujo de dinero debe quedar registrado con quién lo recibió

### Anticipos sin caja abierta
- Si se recibe un anticipo y la caja del vendedor está cerrada:
  → El anticipo se registra y queda asignado al vendedor que inició sesión en ese momento
  → Se muestra mensaje: "Este anticipo se agregará a la caja de [Vendedor X] cuando la abra"
  → Al abrir caja, esos anticipos pendientes se suman automáticamente
- Si el anticipo se registró en un turno diferente al cobro final: ambos quedan en sus respectivas sesiones (es normal, las reparaciones pueden durar más de un mes)

### Técnico registra efectivo
- El efectivo que cobra el técnico entra DIRECTO a caja (sin "traspaso pendiente" complicado)
- Solo se envía una notificación: "Técnico [Nombre] recibió $X del cliente [Y] para la orden #FOLIO"
- Esto reemplaza el flujo complejo actual de traspasos y confirmaciones

### Cancelación de reparación
- PUEDE cancelar: el vendedor desde el POS (sin necesitar al técnico ni al admin)
- CONDICIÓN: Solo si las piezas NO están instaladas aún
- Si ya están instaladas: no se puede cancelar desde POS (requiere admin)
- COSTO DE CANCELACIÓN: ~$100 MXN (cargo mínimo de envío/diagnóstico)
  → Se configura al CREAR la orden (campo en el modal de creación)
  → Aparece en el PDF/documento final de la orden
  → Al cancelar: se devuelve el anticipo MENOS el cargo de cancelación
- El vendedor busca la orden en POS por: folio, nombre del cliente o teléfono

### Garantía y responsabilidad
- Cada reparación tiene un técnico responsable asignado
- Ese técnico debe aparecer en el documento final
- La garantía aplica sobre el trabajo realizado (días configurables)

### PDF / Documento de la orden
El PDF es un documento legal (México, LFPC). DEBE contener:
  ✅ Ya tiene: folio, fecha, QR de seguimiento, T&C dinámicos, datos del cliente
  ❌ FALTA agregar:
    - Diagnóstico técnico (descripción del problema encontrado)
    - Técnico responsable asignado
    - Piezas usadas (listado con costo unitario y total)
    - Presupuesto desglosado (mano de obra + piezas + total)
    - Anticipos pagados (fecha, método, monto)
    - Saldo final a cobrar
    - Cargo de cancelación (el configurado al crear la orden)
    - Firma del cliente (se captura pero NO se renderiza en el PDF)
    - Días de garantía

---

## PLAN DE IMPLEMENTACIÓN ACORDADO

### BLOQUE 1 — Reparaciones y Caja (dinero real — PRIMERO)

#### R1 — Simplificar flujo técnico → caja (reemplaza traspasos)
**Qué hacer:** Eliminar el sistema de "traspaso_anticipo" cuando el técnico recibe efectivo.
El efectivo entra directo a caja + notificación de quién lo recibió.
**Archivos:** src/app/api/reparaciones/[id]/anticipos/route.ts líneas 82-154

#### R2 — Doble conteo en cierre de caja (BUG CRÍTICO)
**Qué hacer:** Los anticipos hoy se suman DOS VECES al cerrar caja:
  1. Desde `caja_movimientos` tipo 'entrada_anticipo' (línea 230)
  2. Desde `anticipos_reparacion` directamente (línea 242-254)
**Solución:** Eliminar una de las dos fuentes. Decidir cuál es la fuente de verdad.
**Archivos:** src/lib/db/caja.ts líneas 220-260

#### R3 — Anticipos sin sesión no cuadran al cierre
**Qué hacer:** Si un anticipo se registró sin sesión de caja activa, HOY no aparece en el cierre.
**Decisión Trini:** Deben aparecer en el turno del vendedor que estaba activo al registrarlo.
**Implementar:** Al abrir caja, buscar anticipos pendientes del vendedor sin sesión y agregarlos.
**Archivos:** src/lib/db/caja.ts (función abrirCaja), src/app/api/caja/abrir/route.ts

#### R4 — Cancelación de reparación desde POS (FEATURE NUEVO)
**Qué implementar:**
  - Campo "cargo de cancelación" en el modal de creación de orden (default $100)
  - Sección en POS: buscar orden activa (folio / nombre / teléfono)
  - Al encontrarla: mostrar detalle (costo total, anticipos, saldo, cargo cancelación)
  - Botón "Cancelar servicio" → confirmar → devolver anticipo - cargo cancelación → registrar en caja
  - Validar: si piezas ya instaladas (estado en_reparacion avanzado o completado) → bloquear con mensaje
**Archivos nuevos/modificados:**
  - src/components/reparaciones/ModalOrden.tsx (agregar campo cargoCancelacion)
  - src/app/dashboard/pos/page.tsx (sección búsqueda de reparaciones)
  - src/app/api/reparaciones/[id]/cancelar/route.ts (nueva o modificar existente)

#### R5 — Validar transiciones de estado en el servidor (SEGURIDAD)
**Problema:** Un técnico podría llamar la API directamente y saltar estados (ej: recibido → entregado)
**Qué hacer:** Agregar validación de transiciones en `cambiarEstadoOrden()` en el servidor
**Archivos:** src/lib/db/reparaciones.ts línea ~627

#### R6 — Validar costoUnitario de piezas contra precio real del producto
**Problema:** El técnico puede manipular el precio de una pieza al agregarla vía API
**Qué hacer:** Al agregar pieza, ignorar el costoUnitario que manda el cliente y siempre leer el costo del producto desde la BD
**Archivos:** src/app/api/reparaciones/[id]/piezas/route.ts línea ~80-85

---

### BLOQUE 2 — PDF de la orden (después de Bloque 1)

#### P1 — Agregar campos faltantes al PDF
**Campos a agregar al generador de PDF:**
  1. Diagnóstico técnico (campo diagnostico_tecnico de la orden)
  2. Técnico responsable (nombre del técnico asignado)
  3. Listado de piezas usadas (nombre, cantidad, costo unitario, subtotal)
  4. Presupuesto desglosado (mano de obra + piezas + total)
  5. Anticipos registrados (tabla: fecha, método, monto)
  6. Saldo final a cobrar
  7. Cargo de cancelación (el configurado al crear)
  8. Firma del cliente (renderizar la imagen base64 capturada)
  9. Días de garantía
**Archivos:** src/app/api/reparaciones/[id]/pdf/route.ts

#### P2 — Generar PDF en momentos clave (no solo on-demand)
**Cuándo generar automáticamente:**
  - Al aprobar presupuesto → PDF de presupuesto (cliente se lleva una copia)
  - Al entregar → PDF final con piezas, anticipos y saldo cobrado
**Archivos:** src/app/api/reparaciones/[id]/pdf/route.ts + lógica en entregar/route.ts

---

### BLOQUE 3 — Inventario (después de Bloques 1 y 2)

| # | Problema | Prioridad |
|---|---|---|
| I1 | Productos creados sin ubicación (formulario no tiene campo) | Alta |
| I2 | Dos campos de ubicación en conflicto: ubicacion_id vs ubicacion_fisica | Alta |
| I3 | Kits NO descuentan stock de componentes al venderse | CRÍTICO |
| I4 | stockMinimo puede ser NULL → nunca genera alerta | Media |
| I5 | IMEI no obligatorio al vender equipos serializados | Media |
| I6 | Alertas e ubicaciones se mezclan entre distribuidores | Alta |
| I7 | Devoluciones solo funcionan todo-o-nada | Baja |
| I8 | Productos legacy sin categoría no aparecen en filtros | Baja |

---

### BLOQUE 4 — Visual/UI (después de Bloque 3)
- Creditos: filas clickeables + stat cards con hover (mismo patrón que clientes ya hecho)
- Otras páginas de lista pendientes

---

## AUDITORÍA ÁREA TÉCNICA — HALLAZGOS DETALLADOS

### ✅ Flujos que SÍ funcionan bien
- Piezas del inventario: el stock se descuenta automáticamente al agregar una pieza a la reparación ✓
- Piezas eliminadas: el stock se restaura correctamente ✓
- Solicitud de piezas sin stock: existe el flujo y el estado "esperando_piezas" ✓
- Fotos: se vinculan correctamente a la orden, modo QR funciona ✓
- AnticipoCajaPanel: el técnico SÍ puede ver el saldo pendiente del cliente ✓
- Firma del cliente: se captura al recibir (digital o manuscrita) ✓
- Garantías de piezas: existe la estructura en BD ✓

### ❌ Desconectes encontrados

| # | Criticidad | Problema | Archivo | Línea |
|---|---|---|---|---|
| T1 | 🔴 CRÍTICO | Transiciones de estado solo se validan en frontend, NO en el servidor | lib/db/reparaciones.ts | ~627 |
| T2 | 🔴 CRÍTICO | PDF incompleto: falta diagnóstico, firma, piezas, garantía, anticipos, saldo | api/reparaciones/[id]/pdf/route.ts | 150-400 |
| T3 | 🔴 CRÍTICO | Técnico puede manipular costoUnitario de piezas vía API directa | api/reparaciones/[id]/piezas/route.ts | ~80-85 |
| T4 | 🟠 ALTO | Sin alerta visual de órdenes vencidas en dashboard del técnico | dashboard/tecnico/page.tsx | N/A |
| T5 | 🟠 ALTO | Órdenes quedan en "listo_entrega" indefinidamente sin timeout ni alerta | AccionesOrdenPanel.tsx | 206-232 |
| T6 | 🟡 MEDIO | PDF se genera on-demand; cliente no recibe copia automática al aprobar presupuesto | api/reparaciones/[id]/pdf/route.ts | 216+ |
| T7 | 🟡 MEDIO | Super_admin logueado ve todas las órdenes aunque no sea técnico asignado | dashboard/tecnico/page.tsx | 59-61 |

### Preguntas respondidas por Trini
- ¿Técnico puede registrar anticipos? → SÍ, pero el efectivo entra directo a caja + notificación
- ¿Cargo de cancelación? → ~$100 MXN, se define al crear la orden, aparece en el PDF
- ¿Anticipos entre sesiones diferentes? → Normal, las reparaciones duran semanas o meses
- ¿Órdenes en listo_entrega sin timeout? → Pendiente de respuesta (preguntar a Trini)

---

## AUDITORÍA INVENTARIO — HALLAZGOS (referencia rápida)

11 puntos ciegos identificados. Ver BLOQUE 3 arriba para prioridades.

---

## AUDITORÍA REPARACIONES/CAJA — HALLAZGOS (referencia rápida)

8 desconectes identificados. Ver BLOQUE 1 arriba para plan de acción.

---

---

## AUDITORÍA POS Y FUNCIONALIDADES PERDIDAS — HALLAZGOS

### ✅ Funciona bien
- Cliente en POS: SÍ existe búsqueda y selección de cliente al vender ✓
- Venta sin cliente (anónimo): SÍ funciona ✓
- Resumen del cliente en POS: muestra créditos activos, deuda, última compra, scoring ✓
- Tracking del cliente (QR): FUNCIONA COMPLETO — el cliente puede ver estado, aprobar presupuesto desde su teléfono ✓
- Preferencias de promociones del cliente (desde tracking): FUNCIONA ✓
- CRUD de promociones (panel admin): FUNCIONA ✓

### ❌ Funcionalidades NO implementadas o desconectadas

| # | Funcionalidad | Estado | Impacto |
|---|---|---|---|
| POS1 | **Sistema de Puntos / Loyalty** | NO EXISTE en absoluto | Alto — sin fidelización |
| POS2 | **Promociones visibles en el POS al vender** | EXISTE pero desconectada del POS | Alto — sin upsell en caja |
| POS3 | **Límite de días para órdenes sin recoger** (ley mexicana) | NO EXISTE | Jurídico — incumplimiento |
| POS4 | Captura de consentimiento de promociones en POS presencial | FALTA interfaz | Medio |
| POS5 | PDF: balance entre políticas y datos del servicio | Políticas muy condensadas, datos del servicio incompletos | Medio-Legal |

### Detalle POS1 — Sistema de Puntos (NUNCA implementado)
- No existe tabla en BD, no hay API, no hay UI
- Lo que SÍ existe con nombre "puntos" es el scoring crediticio (0-100) — es diferente
- Necesita diseñarse desde cero: tabla puntos_cliente, reglas de acumulación, canje en POS

### Detalle POS2 — Promociones desconectadas del POS
- La tabla `promociones` existe y tiene: título, descripción, precio normal, precio promoción, fechas, activa
- El cliente puede aceptar/rechazar desde el tracking
- Pero al momento de cobrar en el POS, el vendedor no ve las promociones activas
- Tampoco hay forma de aplicar una promoción a una venta

### Detalle POS1b — Auditoría crítica del POS (detalle completo)

#### CARRITO
- ✅ Búsqueda por nombre, marca, código de barras, SKU
- ✅ Editar cantidad y precio unitario en carrito
- ✅ Notas e IMEI por producto
- ❌ Sin descuento por item individual (solo descuento global)
- ❌ Carrito NO persiste si recarga el navegador (se pierde todo)
- ❌ Stock no es real-time (se carga una vez al montar — dos vendedores pueden vender lo mismo)
- ❌ Sin "pausar carrito" (cliente vuelve en 5 min)

#### MÉTODOS DE PAGO
- ✅ Efectivo con cálculo de cambio
- ✅ Tarjeta, transferencia, mixto
- ✅ Captura referencia y últimos 4 dígitos de tarjeta
- ❌ Sin número de autorización (approval code) para tarjeta
- ❌ Sin integración con terminal física
- ❌ Sin Payjoy en POS (existe en crédito pero no en venta directa)

#### CLIENTE EN POS
- ✅ Búsqueda por nombre y teléfono
- ✅ Muestra créditos activos, deuda, scoring
- ❌ NO se puede crear cliente nuevo desde el POS (hay que salir del módulo)
- ❌ No busca por CURP ni email
- ❌ Sin validación de cliente con deuda vencida (permite vender igual)
- ❌ Sin historial de compras visible
- ❌ Sin puntos de lealtad mostrados ni canjeables
- ❌ Sin debounce en búsqueda (cada letra genera un request)

#### VENTA A CRÉDITO
- ❌ NO existe desde el POS — el vendedor debe salir al módulo de Créditos

#### FLUJO DE COBRO
- ✅ Atajos de teclado (F3, F9, F10, F12, Escape)
- ✅ Modo offline con cola local
- ✅ Ticket con WhatsApp y opción de imprimir
- ❌ Modal de confirmación muestra muy poco detalle (no muestra items, cliente, cambio)
- ❌ Recibo no tiene folio fiscal, RFC ni timestamp de servidor (no es un documento oficial)
- ❌ IMEI no se valida (debería ser 15 dígitos, verificar duplicados)
- ❌ Si la venta falla en el servidor, NO se guarda localmente para retry

#### DEVOLUCIONES
- ✅ Existe DevolucionModal con selección de items y motivo
- ✅ Stock se reintegra automáticamente
- ❌ No muestra cuántos días quedan para poder devolver
- ❌ Sin flujo de cambio de producto (devolver + nueva venta son 2 operaciones separadas)
- ❌ Sin auditoría de quién autorizó la devolución

#### REPORTES
- ✅ Reporte X (durante turno) y Z (al cerrar)
- ❌ Sin desglose de descuentos autorizados
- ❌ Sin reporte de ventas por vendedor (visible para admin)
- ❌ Sin arqueo de caja (efectivo esperado vs real en detalle)

#### ARQUITECTURA
- ❌ Stock no es real-time (dos vendedores compiten por el mismo inventario)
- ❌ Carrito sin persistencia (recarga = pérdida total)
- ❌ Sin reserva de stock al agregar al carrito

**Estimado: POS está al 65% de lo que necesita para ser un sistema completo en producción**

---

### Detalle POS3 — Tiempos por ley mexicana (NUNCA implementado)
- El estado `listo_entrega` no tiene límite de tiempo
- No hay job/trigger que procese órdenes vencidas
- No hay configuración de días en la tabla `configuracion`
- Según PROFECO: la tienda tiene obligación de notificar antes de disponer del equipo

---

## BLOQUE 5 — POS y Funcionalidades Perdidas (agregar al plan)

#### P01 — Sistema de Puntos / Loyalty (diseñar e implementar desde cero)
**Qué implementar:**
- Tabla `puntos_cliente` (cliente_id, distribuidor_id, puntos_acumulados, historial)
- Regla de acumulación: X puntos por cada $Y de compra (configurable por distribuidor)
- En el POS: al asociar cliente → mostrar sus puntos disponibles
- En el POS: opción de canjear puntos como descuento o producto
- En el perfil del cliente: historial de puntos

#### P02 — Promociones en el POS
**Qué implementar:**
- Al registrar una venta en POS → mostrar banner/sección de "Promociones activas"
- El vendedor puede agregar una promoción al carrito
- Si hay cliente asociado y acepta → registrar su consentimiento

#### P03 — Límite de tiempo para órdenes sin recoger (ley mexicana)
**Qué implementar:**
- Campo en `configuracion`: `dias_maximos_sin_recoger` (default: 30 días según PROFECO)
- Alerta al técnico/admin cuando una orden lleva X días en `listo_entrega`
- Notificación WhatsApp automática al cliente (día 15, día 25, día 30)
- Al día 30+: la orden se marca como "abandonada" con registro

---

## ORDEN COMPLETO DE IMPLEMENTACIÓN (actualizado)

1. **Bloque 1** — Reparaciones y Caja (R1 a R6) — dinero real, PRIMERO
2. **Bloque 2** — PDF de la orden (P1, P2) — documento legal
3. **Bloque 3** — Inventario (I1 a I8) — integridad de datos
4. **Bloque 5** — POS y Funcionalidades (PO1 a PO3) — loyalty y promociones
5. **Bloque 4** — Visual/UI — mejoras de experiencia

---

## PRÓXIMO PASO
Trini confirma el orden y arrancamos con Bloque 1.

**Si pierdes contexto:** Di "Lee SESION-ACTIVA y continúa con el plan"
