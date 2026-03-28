# 📋 NOTAS DE TRINI — Decisiones de Negocio y Pendientes

> **Para Claude:** Lee este archivo al inicio de cada sesión junto con CLAUDE.md.
> Aquí están los apuntes de diseño de negocio de Trini — la lógica detrás de por qué el sistema está construido de cierta manera, y los módulos pendientes con sus reglas de negocio exactas.

---

## 🏦 FILOSOFÍA DE CAJA — REGLA FUNDAMENTAL

**TODO el dinero que entra a la tienda, sin importar el concepto, DEBE pasar por caja.**

Esto incluye:
- Anticipos de reparaciones
- Pagos finales de reparaciones
- Créditos
- Ventas POS
- Cualquier entrada de efectivo o transferencia

**Razón de negocio:** El sistema fue creado específicamente para evitar que los empleados (técnicos, vendedores, cobradores) se queden con dinero de la tienda. Cada peso que entra debe tener un registro en caja con: empleado que lo recibió, hora, concepto, y método de pago.

---

## 💡 MÓDULO PENDIENTE: BOLSA VIRTUAL DE REPARACIONES EN CAJA

### El problema que resuelve
Los anticipos de reparaciones actualmente se registran en caja (ya implementado), pero no existe un cuadre visual que permita al vendedor/admin verificar que el dinero que debería estar en caja efectivamente está.

### Cómo debe funcionar

#### 1. Bolsa virtual por orden de reparación
- Cada orden de reparación tiene una "bolsa" que acumula todos los anticipos recibidos
- Esta bolsa es visible desde el módulo de Reparaciones (ya se ve en AnticipoCajaPanel)
- **NUEVO:** Esta bolsa también debe ser visible desde el módulo de Caja

#### 2. Vista del vendedor en Caja — Cuadre de anticipos
En el corte de caja / sesión activa debe aparecer:
- Subtotal de anticipos de reparación recibidos en esa sesión
- Desglose por orden (folio, cliente, monto, empleado que lo recibió)
- Comparación: "Lo que debería haber en caja por reparaciones vs. lo que hay físicamente"

#### 3. Sistema de alerta de descuadre
Si al momento del corte:
- El total físico declarado NO cuadra con el total registrado en sistema
- Se identifica automáticamente **qué empleado** recibió qué dinero y en qué turno
- Se genera una alerta inmediata al `admin` y `super_admin` del distribuidor
- La alerta incluye: empleado, turno, monto de diferencia, concepto(s)

#### 4. Quién puede ver qué
| Rol | Puede ver |
|---|---|
| `vendedor` | Bolsa total de su turno + cuadre de anticipos de reparación de su sesión |
| `admin` | Todo lo anterior + historial de descuadres + alertas de todos los empleados |
| `super_admin` | Todo lo anterior de todos los distribuidores |
| `tecnico` | Solo puede registrar el anticipo — NO ve el cuadre de caja |
| `cobrador` | No tiene acceso a este módulo |

#### 5. Flujo completo de un anticipo (cómo debe funcionar end-to-end)
```
Cliente llega y paga anticipo de reparación
  → Empleado abre OrdenDrawer o página de detalle de reparación
  → Tab "Presupuesto" → AnticipoCajaPanel → botón "Registrar Anticipo"
  → Modal pide: monto, método de pago, referencia (si transferencia)
  → Sistema registra en: anticipos_reparacion + movimiento en caja_sesiones activa
  → Bolsa virtual de la orden se actualiza
  → En el corte de caja, ese anticipo aparece como entrada de dinero
  → Si el corte físico no cuadra → alerta a admin/super_admin
```

---

## 🔔 SISTEMA DE ALERTAS DE DESCUADRE — Pendiente de diseño

### Dónde viven las alertas
La tabla `notificaciones` ya existe. Se puede usar para:
- Crear notificación tipo `descuadre_caja` con severidad alta
- El admin la ve en su panel de notificaciones
- El super_admin la ve en su vista global

### Reglas para disparar la alerta
1. Al cerrar una sesión de caja (`caja_sesiones.estado = 'cerrada'`)
2. Si `monto_declarado_cierre` ≠ `(monto_apertura + total_ventas + total_anticipos_reparacion + otras_entradas - salidas)`
3. Diferencia mayor a `configuracion.tolerancia_descuadre` (configurable, default: $0 — cero tolerancia)

### Qué contiene la alerta
```
- empleado_id (quién cerró la caja)
- sesion_id (referencia a la sesión)
- monto_esperado
- monto_declarado
- diferencia (puede ser positiva o negativa)
- desglose por concepto (ventas, anticipos reparacion, créditos, etc.)
- timestamp
- distribuidorid
```

---

## 📌 PENDIENTES POR FASE (en orden de prioridad según Trini)

### ⏳ FASE 28: POS + Caja unificados con gestión de turno
- Aviso cuando la caja ya está abierta por otro empleado
- Cierre de turno desde el POS sin salir al módulo de caja
- Una sola sesión activa por caja física (no por usuario)

### ⏳ FASE 29: POS dual mode
- **Standard:** F-keys para teclado (F3 búsqueda, F4 cantidad, F10 pagar, F12 pago rápido)
- **Visual:** Grid por categoría, optimizado para pantalla táctil

### ⏳ FASE 30: POS con cliente + IMEI
- Selección de cliente en POS antes de completar venta
- Captura de IMEI al vender equipo serializado
- Notas por venta y por ítem

### ⏳ FASE 31: Reportes de turno
- **Reporte X:** Resumen del turno sin cerrar caja (para revisión en cualquier momento)
- **Reporte Z:** Cierre formal con PDF imprimible
- Exportar cualquier tabla del sistema a Excel

### ⏳ FASE 32: Tickets térmicos 58mm ✅ (según historial, ya implementado)
- Venta POS
- Recepción reparación con QR
- Entrega reparación
- Pago crédito

### ⏳ FASE 33: Devoluciones + Pedidos flotantes
- Devoluciones parciales por línea de venta
- Poner venta en espera y abrir nueva venta (pedidos flotantes)

### ⏳ FASE 34: Tarjetas interactivas + Drawer lateral ✅ (ya implementado)
### ⏳ FASE 34b: Modal mixto + esperando_piezas + overdue WA ✅ (ya implementado)

### ⏳ FASE 35 PENDIENTE: Tracking de servicio para CLIENTE (pantalla pública)
- El cliente puede ver el estado de su reparación desde su celular via QR o link
- NO requiere login
- Solo muestra: estado, dispositivo, fecha estimada, nombre del técnico
- Audiencia: cliente externo (no empleados)
- Diferente a las tarjetas de FASE 34 que son para uso interno del personal

---

## 🚨 REGLAS DE NEGOCIO CRÍTICAS (nunca olvidar)

### Anti-fraude de empleados
1. **Ningún empleado puede registrar dinero sin que quede en caja** — ni el técnico, ni el vendedor
2. **El técnico** solo puede registrar el anticipo mediante el módulo de reparaciones, que automáticamente lo asienta en la caja activa del empleado que opera en ese momento
3. **Si no hay caja abierta**, el anticipo se registra igual PERO queda marcado como "sin sesión de caja" — esto es una alerta implícita que el admin debe revisar
4. **El admin puede ver** quién recibió cada pago, cuándo, y en qué sesión de caja
5. **Si hay diferencia al cuadrar** → el sistema identifica la sesión, el empleado, y notifica

### Sobre los anticipos sin sesión de caja
- Ya existe este caso en el código (`registradoEnCaja: false`)
- Pendiente: hacer estos casos visibles en un reporte de "anticipos sin sesión asignada" para que el admin los revise

---

## 🗃️ TABLAS RELEVANTES PARA EL MÓDULO DE CAJA + REPARACIONES

```sql
-- Ya existen:
caja_sesiones          -- Sesiones de apertura/cierre por empleado
anticipos_reparacion   -- Anticipos registrados contra una orden
notificaciones         -- Sistema de notificaciones (para alertas de descuadre)
configuracion          -- Config del distribuidor (aquí iría tolerancia_descuadre)

-- Columnas importantes en caja_sesiones:
--   empleado_id, distribuidor_id, monto_apertura, monto_declarado_cierre
--   total_ventas (ya calculado al cerrar)
--   estado: 'activa' | 'cerrada'

-- Columnas importantes en anticipos_reparacion:
--   orden_id, monto, tipo_pago, sesion_caja_id (FK nullable), empleado_id
--   estado: 'pendiente' | 'aplicado' | 'devuelto'
```

---

## 📝 NOTAS SUELTAS DE TRINI

- "El sistema fue creado para que no tomen dinero precisamente para eso" — la prioridad #1 del sistema es control financiero, no solo gestión de inventario
- Los técnicos son los que más oportunidad tienen de recibir dinero directamente sin registrarlo — esto debe cerrarse completamente
- El cuadre visual en la pantalla de caja es la herramienta principal para el vendedor/admin — debe ser simple y claro: Verde = cuadra, Rojo = no cuadra
- Trini prefiere que se sienten bien las bases antes de implementar — no codificar sin entender el flujo completo
- La bolsa virtual de reparaciones es parte de la vista de la sesión de caja, no un módulo separado

---

*Última actualización: 2026-03-17 — Trini en sesión de diseño con Claude*
