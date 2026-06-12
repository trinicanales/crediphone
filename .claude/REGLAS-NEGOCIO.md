# Reglas de Negocio — CREDIPHONE
> Leer si la tarea toca caja, anticipos, reparaciones o flujos de dinero.
> Si encuentras código que parece raro pero funciona, pregunta a Trini antes de cambiar.
> Si Trini explica la lógica, documéntala aquí.

---

## 🏦 FILOSOFÍA FUNDAMENTAL — TODO el dinero pasa por caja

**Regla:** Cada peso que entra a la tienda, sin importar el concepto, DEBE tener un registro en caja con: empleado, hora, concepto y método de pago.

**Esto incluye:** anticipos de reparaciones, pagos finales de reparaciones, créditos, ventas POS, cualquier entrada de efectivo o transferencia.

**Razón de negocio:** El sistema fue creado para evitar que empleados (técnicos, vendedores, cobradores) se queden con dinero sin registrarlo. Es la prioridad #1 del sistema — no solo gestión de inventario.

---

## 🔒 REGLAS ANTI-FRAUDE DE EMPLEADOS

1. **Ningún empleado puede recibir dinero sin que quede en caja** — ni el técnico, ni el vendedor
2. **Los técnicos son el mayor riesgo** — son quienes más oportunidad tienen de recibir efectivo directo
3. **Si no hay caja abierta**, el anticipo se registra igual PERO queda marcado como `registradoEnCaja: false` — esto es una alerta implícita que el admin debe revisar
4. **El admin puede ver** quién recibió cada pago, cuándo, y en qué sesión de caja
5. **Si hay diferencia al cuadrar** → el sistema identifica la sesión, el empleado, y notifica

### Comportamiento INTENCIONAL — Anticipos sin sesión de caja
Los anticipos sin sesión activa se marcan con `registradoEnCaja: false`.
**NO es un bug** — es una alerta anti-fraude implícita.
El admin los revisa en el reporte de "anticipos sin sesión asignada".
**NO eliminar ni ocultar este estado.**

### Regla actualizada — Anticipo sin caja abierta (confirmado por Trini 2026-04-07)
Si se recibe un anticipo y la caja del vendedor está cerrada:
- El anticipo se registra asignado al vendedor que tenga sesión iniciada en ese momento
- Se muestra mensaje: "Este anticipo se agregará a la caja de [Vendedor X] cuando la abra"
- Al abrir caja, esos anticipos pendientes se suman automáticamente
- **NO se bloquea el registro del anticipo** — se deja fluir pero queda pendiente de asignar

### Regla — Técnico recibe efectivo
El efectivo que recibe el técnico entra DIRECTO a caja (no via "traspaso pendiente").
Solo se envía una notificación al vendedor: "Técnico [Nombre] recibió $X del cliente [Y] — Orden #FOLIO"
El flujo de "traspaso_anticipo" que crea un pendiente es DEMASIADO COMPLEJO y se reemplaza por esto.

---

## 🔔 SISTEMA DE ALERTAS DE DESCUADRE (Implementado en FASE 40)

Si al cierre de sesión el monto declarado ≠ monto calculado:
- Diferencia mayor a `configuracion.tolerancia_descuadre` (default: $0 — cero tolerancia)
- Se genera notificación tipo `descuadre_caja` al admin y super_admin
- La alerta incluye: empleado, sesión, monto esperado, monto declarado, diferencia

---

## 💡 IDEAS DIFERIDAS (no iniciar hasta que Trini diga)

### Subdistribuidores
- Trini tiene 4 opciones de modelo de negocio
- Las columnas ya existen en BD: `modo_operacion`, `grupo_inventario`, `tipo_acceso`
- **No implementar** hasta recibir indicación explícita

### Cleanup de fotos huérfanas en R2
- Hay fotos "huérfanas" (temp sin orden, de órdenes canceladas) en Cloudflare R2
- **Pregunta pendiente para Trini:** ¿Cuántos meses conservar fotos post-entrega?
- No eliminar nada hasta tener respuesta

---

## 💰 CANCELACIÓN DE REPARACIÓN — Reglas confirmadas (Trini 2026-04-07)

- **Quién puede cancelar:** El vendedor desde el POS (sin necesitar técnico ni admin)
- **Cuándo se puede cancelar:** Solo si las piezas NO están instaladas aún
  - Si ya están instaladas (estado en_reparacion avanzado o completado) → requiere admin
- **Cargo de cancelación:** ~$100 MXN (costo de diagnóstico/envío)
  - Se configura al CREAR la orden (campo en el modal de creación de la orden)
  - Aparece en el PDF/documento generado de la orden
  - Al cancelar: anticipo acumulado - cargo de cancelación = devolución al cliente
- **Cómo busca el vendedor la orden en POS:** por folio, nombre del cliente o teléfono
- **Al cancelar:** se devuelve el anticipo menos el cargo, queda registrado en caja

---

## 🔧 PRESUPUESTO DE REPARACIÓN — Dos fases (confirmado Trini 2026-04-07)

### Fase 1 — Cotización sin pieza ("Presupuesto General")
- Al recibir el equipo, el técnico da una cotización ESTIMADA (sin saber exactamente qué pieza necesita)
- Esta cotización incluye: mano de obra aproximada + estimado de piezas
- El cliente aprueba ese presupuesto estimado para que se proceda con la reparación
- **En el PDF/documento:** se etiqueta como "PRESUPUESTO ESTIMADO" — no es el costo final

### Fase 2 — Costo real con pieza (cuando llega del taller)
- El técnico recibe la pieza y la registra desde el área técnica del sistema
- En ese momento se actualiza el costo real de piezas en la orden
- **En el PDF:** si hay piezas registradas, el costo es definitivo (se muestra la tabla de piezas)

### Precio de pieza — qué incluye (REGLA INTENCIONAL — NO CAMBIAR)
El `precioUnitario` de cada pieza en la cotización incluye TODO:
- Costo de la pieza/refacción
- Costo de instalación (mano de obra específica para esa pieza)
- Costo de envío si aplica

**Por qué:** Es un servicio más limpio para el cliente — ve un precio all-in por pieza,
sin tener que sumar conceptos. El empleado ya hace el cálculo al capturar el precio.

**En el modal de cotización:** el campo "Precio unitario" de cada pieza dice
"Incluye pieza + instalación + envío" — aclarado en el placeholder y en el tooltip.

**En el PDF:** cada línea de pieza incluye nota "(incl. instalación y envío)".

**Campo `manoDeObra` global en ComponentePresupuesto:**
Este campo es para la mano de obra del DIAGNÓSTICO INICIAL o cualquier trabajo general
que NO esté ligado a una pieza específica (ej: "diagnóstico de placa", "revisión general").
NO es la mano de obra de instalación de piezas — esa ya está en el precio de cada pieza.

### Regla para el PDF
- Si `reparacion_piezas` está VACÍO → el presupuesto es estimado → mostrar "COTIZACIÓN ESTIMADA — sujeta a cambio al confirmar piezas"
- Si `reparacion_piezas` tiene registros → el costo es definitivo → mostrar la tabla de piezas como "PIEZAS UTILIZADAS"
- **NUNCA mostrar la sección de piezas vacía** — confunde al cliente

---

## 📄 DOCUMENTO PDF — Campos obligatorios (Trini 2026-04-07)

El PDF es un documento legal bajo la LFPC (Ley Federal de Protección al Consumidor).
**Campos que DEBEN estar en el PDF** (algunos faltan — ver BLOQUE 2 del plan):
  1. Folio de la orden ✅ ya existe
  2. Fecha de recepción ✅ ya existe
  3. Datos del cliente ✅ ya existe
  4. Datos del dispositivo (marca, modelo, IMEI) ✅ ya existe
  5. Diagnóstico técnico ❌ FALTA
  6. Técnico responsable asignado ❌ FALTA
  7. Piezas usadas (listado con precios) ❌ FALTA
  8. Presupuesto desglosado (mano de obra + piezas) ❌ FALTA
  9. Anticipos pagados (tabla con fechas y métodos) ❌ FALTA
  10. Saldo final a cobrar ❌ FALTA
  11. Cargo de cancelación (el configurado al crear) ❌ FALTA
  12. Firma del cliente (se captura pero no se renderiza) ❌ FALTA
  13. Días de garantía ❌ FALTA
  14. QR de seguimiento ✅ ya existe
  15. Términos y condiciones ✅ ya existe

---

## 🔄 REVERTIR ESTADO DE SERVICIO — Regla confirmada (Trini 2026-05-25)

- **Quién puede revertir:** Solo admin
- **Por qué existe:** Un empleado puede avanzar el estado por error (ej: marcar "en_reparacion" antes de tener las piezas)
- **Estados que se pueden revertir (consecutivo):**
  - `listo_entrega` → `en_reparacion`
  - `en_reparacion` → `en_revision` (o `esperando_piezas`)
  - `en_revision` → `recibido`
- **Estados terminales (NO se revierten nunca):** `entregado`, `cancelado`, `no_reparable`
- **Al revertir:** se guarda registro en `historial_estado_orden` con motivo de revertir
- **NO afecta:** anticipos ya registrados, piezas pedidas, historial de diagnósticos

## 📊 DESGLOSE INTERNO DE COSTOS — Visible solo internamente (Trini 2026-05-25)

- El precio al CLIENTE es all-in por pieza (pieza + instalación + envío) → NO cambiar
- Internamente el sistema DEBE permitir ver y editar:
  - `costoInterno`: costo real de la pieza al proveedor
  - `costoEnvio`: flete/envío de la pieza
  - `precioTotal`: lo que ve y paga el cliente
  - `margen`: precioTotal - costoInterno - costoEnvio (calculado)
- Esta vista es para admin/técnico en el drawer — el cliente nunca ve los costos internos
- El margen de utilidad del servicio se calcula con este desglose

## 🔗 PROPAGACIÓN DE CAMBIOS — Todo debe ser coherente (Trini 2026-05-25)

Si se modifica el precio/pieza de un servicio desde el drawer:
1. `precio_total` en `ordenes_reparacion` debe actualizarse
2. `saldo_pendiente` en bolsa virtual (precio_total - anticipos pagados) debe recalcularse
3. La página de tracking del cliente debe reflejar el nuevo total
4. El PDF al regenerarse debe tener el precio actualizado

**Por qué:** El servicio está vivo hasta que se entrega. Si el técnico encuentra algo diferente, el precio puede cambiar — todos los sistemas deben respetar esa actualización.

## 💲 PRECIO AL CLIENTE vs COSTO INTERNO — Regla crítica (confirmada Trini 2026-05-30)

### Dos columnas, dos propósitos distintos

| Columna DB | Tipo TS | Significado | ¿Quién la modifica? |
|------------|---------|-------------|---------------------|
| `precio_total` | `presupuestoTotal` | **Lo que paga el cliente** | Creación + técnico vía `recalcularTotalesOrden()` |
| `costo_total` | `costoTotal` | **Costo interno del servicio** | Creación + piezas (independiente) |

**REGLA:** La UI de cobro SIEMPRE usa `presupuestoTotal` (= `precio_total`), NUNCA `costoTotal`.
El `costoTotal` es información interna de margen — el cliente nunca debe verlo.

**Por qué difieren:** El técnico puede modificar `precio_mano_obra` (lo que cobra al cliente por mano de obra) sin cambiar los costos internos. `recalcularTotalesOrden()` actualiza `precio_total` pero NO `costo_total`. Son dos cálculos independientes.

**Flujo cuando el técnico modifica el presupuesto:**
1. Técnico cambia `precio_mano_obra` → PATCH `/api/reparaciones/[id]/presupuesto`
2. Se llama `recalcularTotalesOrden()` → actualiza `precio_total` en BD
3. `precio_total` queda correcto → `presupuestoTotal` en TS refleja el precio del cliente
4. `costo_total` NO cambia → sigue siendo el costo interno
5. La UI de cobro lee `presupuestoTotal` → muestra el precio correcto al cliente

**Casos reales que confirman la distinción:**
- ORD-20260522-0002: cliente paga $1,000 pero costo interno es $700
- ORD-20260519-0004: cliente paga $200 pero costo interno es $250 (servicio con descuento)

**NUNCA escribir:** `orden.costoTotal || orden.presupuestoTotal` — esto lee el costo interno primero y puede mostrar valores incorrectos (incluso cobrar de más al cliente como en el ejemplo de $250 vs $200).

---

## 🎯 ANTICIPO 100% — Flujo de entrega (confirmado Trini 2026-05-30)

### ¿Qué pasa cuando el anticipo cubre el 100% del servicio?

- El anticipo vive en `anticipos_reparacion` con `estado = "pendiente"` hasta la entrega
- El dinero físico ya está en caja (o transferencia recibida), pero contablemente no "cierra" hasta la entrega
- La bolsa virtual recibe `ingresoNeto = precio_total - costos_piezas` SOLO cuando `ejecutarEntregaCompleta()` corre
- **Entregar con saldo=0:** se puede desde reparaciones (botón "Cobrar y Entregar" → modal sin selector de pago) y desde POS (botón "Entregar equipo")

### Estados válidos para entrega (constante en backend y frontend)

```typescript
const ESTADOS_ENTREGABLES = ["listo_entrega", "completado", "aprobado", "en_reparacion"];
```

**Si el estado NO está en esta lista (recibido, diagnostico, presupuesto):**
- El equipo NO se puede entregar aunque tenga saldo = $0
- El técnico todavía tiene que diagnosticar/reparar
- La UI muestra badge informativo: "Servicio pagado — pendiente de diagnóstico/reparación"

### Flujo correcto desde POS cuando saldo = 0
1. Buscar la orden por folio/nombre/teléfono
2. Si `saldoPendiente = 0` Y `ESTADOS_ENTREGABLES.includes(orden.estado)` → botón "Entregar equipo"
3. Click → llama `POST /api/reparaciones/[id]/entregar` con `metodoPago: "anticipo"`
4. El backend aplica los anticipos pendientes, registra entrega en bolsa virtual, marca "entregado"
5. **No se registra nada adicional en caja** (el dinero ya entró con el anticipo)

---

## 🛡️ MÓDULO DE GARANTÍAS — Lógica implementada (2026-06-12)

### Ciclo de vida de una garantía

1. **Creación:** Se genera automáticamente al cambiar estado de la orden a `entregado` (vía `ejecutarEntregaCompleta()` si la orden tiene configurado `dias_garantia > 0`)
2. **Estados posibles:**
   - `activa` — garantía vigente (`fecha_vencimiento > hoy`)
   - `usada` — cliente reclamó la garantía (se creó orden hija con `es_garantia = true`)
   - `vencida` — fecha_vencimiento ya pasó
   - `cancelada` — cancelada manualmente por admin

### Acceso en base de datos

Tabla: `garantias_reparacion`
Columnas clave: `orden_id`, `cliente_id`, `distribuidor_id` (vía join), `dias_garantia`, `fecha_vencimiento`, `estado`, `orden_garantia_id` (id de la orden hija si se reclamó)

### Filtro por distribuidor

La tabla no tiene `distribuidor_id` directo — se obtiene vía join con `ordenes_reparacion`. Por eso el filtro en `/api/garantias` se hace en código Python/JS post-query, no con `.eq()` en el join anidado de Supabase.

### Flujo de reclamación

1. Cliente llega con equipo dentro de vigencia → admin crea nueva orden desde el perfil del cliente o desde garantías
2. La orden nueva se crea con `es_garantia = true` y `orden_origen_id = orden_original.id`
3. La garantía original cambia a `estado = "usada"` y recibe el `orden_garantia_id` de la nueva orden

### Pantalla de garantías (`/dashboard/garantias`)

- **Vencen esta semana:** garantías activas con `fecha_vencimiento <= hoy+7días` — color warning
- **Activas:** garantías normales vigentes — color success
- **Reclamaciones abiertas:** garantías con `estado = "usada"` — color info
- **Historial:** vencidas y canceladas (colapsado por defecto)

---

## ❓ Preguntas abiertas para Trini

1. **Fotos post-entrega:** ¿Cuánto tiempo conservar después de entregar la reparación? ¿6 meses, 12, indefinido?
2. **Reporte Z:** ¿Quieres cobros de reparación como sección separada de ventas POS, o todo junto?
3. **Anticipo para pieza:** Cuando el técnico usa dinero del anticipo para comprar pieza, ¿cómo registrarlo?
4. **Órdenes en "listo_entrega" sin entregarse:** ¿Después de cuántos días hay alerta? ¿Qué pasa si el cliente no aparece en 30 días?

---

## 📌 Notas de comportamiento que Claude debe consultar con Trini

Si encuentras código que:
- Parece duplicar lógica → pregunta si hay razón de negocio
- Parece incompleto pero no genera error → puede ser intencional (como anticipos sin sesión)
- Tiene validaciones que parecen extrañas → puede ser anti-fraude

Pregunta: "Encontré que [módulo] hace X. ¿Tiene alguna razón de negocio o lo corrijo?"
Si Trini explica la razón → documenta aquí antes de continuar.
