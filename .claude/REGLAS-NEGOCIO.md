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
