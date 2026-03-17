# 🔐 PLAN MAESTRO — CIERRE DE PUNTOS CIEGOS CREDIPHONE
> Versión: 2026-03-17 v2 · Estado: **APROBADO POR TRINI** · Listo para implementar en orden de fases

---

## CONTEXTO FÍSICO DE LA TIENDA (base del diseño)

```
┌──────────────────────────────────────────────────────────┐
│                     MOSTRADOR / FRENTE                    │
│                                                           │
│   [VENDEDOR]  ←————————————————————→  [TÉCNICO]          │
│    (POS, caja, créditos)                (taller, atrás)   │
│                                                           │
│   Ambos atienden clientes cuando se necesita              │
│   SOLO el vendedor maneja el dinero físico                │
│   El técnico registra — el vendedor confirma y cobra      │
└──────────────────────────────────────────────────────────┘
```

**Reglas de oro aprobadas por Trini:**
- El técnico puede **registrar** en el sistema (órdenes, anticipos, piezas)
- El técnico NUNCA retiene el dinero físico — lo entrega al vendedor de inmediato
- Si hay discrepancia entre lo que el técnico registró y lo que entrega → alerta al admin por WhatsApp + sistema
- Las notificaciones de descuadre van por TODOS los canales disponibles para evitar colusión técnico-vendedor
- Todo descuento >15% requiere aprobación remota del admin (link en WhatsApp o desde sistema en celular)

---

## PARTE 1 — FLUJOS DE DINERO (todos los que existen)

### 1.1 Flujo A: Venta POS (contado, equipo o accesorio)
```
Cliente llega → Vendedor escanea producto → Aplica descuento (si autorizado)
→ Cliente paga (efectivo / tarjeta / Payjoy) → Registra en POS
→ Venta queda asentada en sesión de caja activa → Stock se descuenta
→ Ticket impreso (o digital)
```
**Puntos ciegos cubiertos:**
- Descuento dentro del límite por rol (ver Parte 3)
- Descuento puede ser en % o en monto fijo (ej: $200 de descuento en equipo de contado)
- Si es Payjoy: sistema marca como "pendiente confirmación Payjoy"

---

### 1.2 Flujo B: Servicio sin inventario (recarga, copia, impresión, diagnóstico, etc.)
```
Cliente llega → Vendedor o Técnico abre POS → Sección "Servicios"
→ Selecciona servicio pre-configurado (precio fijo) O servicio variable (modifica precio)
→ Cliente paga → Registra en la misma sesión de caja activa del POS
→ Ticket de servicio generado
```
**Precios de servicios — dos modalidades (configuradas individualmente por servicio):**
- **Precio fijo:** Admin define precio, empleados NO pueden modificarlo (ej: Diagnóstico básico $200)
- **Precio variable:** Empleado puede modificar precio en el momento del POS (ej: Copias, Impresiones, Recargas)
  - El empleado puede modificar precio SOLO dentro del rango autorizado por su rol
  - La modificación queda registrada en el log

**Puntos ciegos cubiertos:**
- Servicios sin stock tienen su propio catálogo separado de productos
- Cada tipo de servicio tiene flag `precio_fijo: true/false` configurable desde admin
- Empleado no puede inventar un servicio con precio libre sin restricción de rol
- Registro de quién cobró, cuánto, a qué hora, con qué precio

---

### 1.3 Flujo C: Anticipo de reparación — el técnico lo recibe en efectivo
```
Cliente llega al taller → Técnico atiende
→ Técnico abre sistema → Crea orden O busca una existente
→ Técnico registra anticipo en sistema (monto + método: efectivo)
→ SISTEMA: Notificación inmediata al vendedor (push en app):
   "⚠️ [Técnico] registró anticipo de $X en orden [folio] — [cliente]
    Método: Efectivo. Recibes el dinero ahora."
→ Técnico entrega el efectivo FÍSICO al vendedor
→ Vendedor confirma en su pantalla el monto que realmente recibió
   (si recibe menos de lo registrado → el sistema captura la discrepancia)
→ Si hay discrepancia → ALERTA INMEDIATA al admin (sistema + WhatsApp)
   "🚨 Discrepancia en anticipo ORD-XXXX: Técnico registró $500, Vendedor confirmó $300.
    Revisa en el sistema — posible irregularidad."
→ El anticipo entra a caja con el monto que el VENDEDOR confirmó
→ La discrepancia queda como incidente registrado (no se cancela — queda para revisión)
→ El técnico NO puede confirmar su propio traspaso
```
**Por qué el admin recibe la alerta, no solo el vendedor:** Para evitar colusión entre ambos. Si se pusieran de acuerdo para reportar menos, el admin lo vería de inmediato.

---

### 1.4 Flujo D: Anticipo de reparación — pago por depósito / transferencia
```
Cliente hace depósito/transferencia
→ Técnico o Vendedor registra en sistema: monto + referencia bancaria + foto de comprobante
→ Estado: "pendiente_confirmacion" — NO entra a caja aún
→ SISTEMA genera link de aprobación:
   WhatsApp al admin: "📲 Pago por transferencia registrado — Orden [folio]
    Cliente: [nombre] · Monto: $X · Referencia: [ref]
    Empleado: [nombre] · [VER Y CONFIRMAR ←link]"
→ Admin abre el link desde su celular → Compara con el banco → Confirma o Declina
→ Si confirma → anticipo entra a caja automáticamente
→ Si declina → el registro queda en "rechazado" con razón del admin
→ Si admin NO responde en 30 min → recordatorio automático
```
**Puntos ciegos cubiertos:**
- El depósito no se da por hecho hasta verificación bancaria real del admin
- El link de WhatsApp lleva al admin directo a la pantalla de confirmación (no a la app completa)
- Queda registro de quién confirmó, cuándo, la referencia bancaria y desde qué dispositivo

---

### 1.5 Flujo E: Pago de crédito (cobrador o vendedor)
```
Cliente llega a pagar su crédito → Cobrador o Vendedor recibe pago
→ Busca el crédito en sistema → Registra el pago (monto + método)
→ Se asienta en sesión de caja activa
→ Ticket de pago generado → Crédito se actualiza
```
**Pendiente para crédito en campo (no en tienda):** "Pagos en campo" se marcan como pendientes
y se confirman al llegar a tienda — tema de FASE futura.

---

### 1.6 Flujo F: Cobro final de reparación (cobrar saldo y entregar equipo)
```
Orden en estado "listo_entrega" → Cliente llega a recoger
→ Vendedor abre drawer/detalle de la orden
→ Sistema muestra RESUMEN DE BOLSA VIRTUAL:

  RESUMEN FINANCIERO — ORD-2026-00412
  ─────────────────────────────────────────────
  Costo total de reparación:              $800.00
    ├─ Mano de obra:                      $400.00
    └─ Piezas utilizadas:                 $400.00
        ├─ Pantalla Samsung A54           $350.00  (jalada de inventario)
        │   └ Stock → SKU-0091 vinculado
        └─ Adhesivo UV                     $50.00  (sin folio, cargo directo)

  Costos adicionales:
    ├─ Envío de pieza (proveedor externo):  $80.00
    └─ Sin otros cargos

  TOTAL A COBRAR:                         $880.00

  ANTICIPOS REGISTRADOS:
    ├─ Anticipo 1: $300.00  efectivo      ✅ confirmado por vendedor
    └─ Anticipo 2: $200.00  transferencia ✅ confirmado por admin

  TOTAL ANTICIPOS:                        $500.00
  ─────────────────────────────────────────────
  SALDO PENDIENTE DEL CLIENTE:            $380.00  ← lo que debe pagar HOY
  ─────────────────────────────────────────────

→ Cliente paga $380.00 → Método de pago seleccionado
→ Se asienta en caja activa
→ Sistema verifica: anticipos + pago hoy = total reparación → ✅
→ Orden cambia a "entregado" (SOLO si saldo = $0)
→ Ticket de entrega + detalle de reparación generado
```
**Regla crítica:** El técnico NO puede marcar como "entregado" directamente — el cambio de estado a "entregado" solo ocurre cuando el POS procesa el pago completo y el saldo queda en $0.

---

## PARTE 1B — GESTIÓN DE PIEZAS VINCULADAS A REPARACIONES

Este es el punto más crítico para la bolsa virtual y para el control de inventario de refacciones.

### ¿De dónde viene una pieza para reparación?

```
OPCIÓN A — Pieza en inventario propio:
  → Técnico abre reparación → Tab "Piezas" → Busca pieza por nombre/SKU
  → Sistema muestra: Pantalla Samsung A54 · Stock: 3 · Costo: $350
  → Técnico vincula la pieza a la orden (con su folio)
  → Stock se descuenta automáticamente (igual que una venta POS)
  → La pieza queda registrada: de dónde salió, cuándo, quién la jalaba

OPCIÓN B — Pieza se pide al distribuidor / proveedor externo:
  → Técnico crea "Solicitud de pieza" en la orden
     (nombre de pieza + especificación + urgente sí/no + proveedor sugerido)
  → Orden pasa a estado "esperando_piezas" automáticamente
  → Admin recibe notificación: se necesita pedir pieza para ORD-XXXX
  → Admin hace el pedido físicamente y registra en sistema:
     monto de la pieza + costo de envío (si hay) + fecha estimada de llegada
  → Cuando llega el lote → admin o vendedor verifica contra el pedido
     (¿llegó completo? ¿llegó correcta? ¿hay daños?)
  → Si OK → pieza se vincula a la orden y se descuenta del lote
  → Si hay problema → se genera solicitud de garantía al proveedor
  → Costo de pieza + envío se carga a la bolsa virtual de esa reparación

OPCIÓN C — Pieza sin inventario, cargo directo:
  → Técnico registra pieza en la orden: descripción + costo manual
  → No descuenta stock (no estaba en inventario)
  → Queda como "cargo directo" en la bolsa virtual
```

### Seguimiento del lote de piezas
```
Lote llega → Recepción en sistema:
  ├─ ¿Qué venía en el pedido?  (lista de solicitudes vinculadas)
  ├─ ¿Qué llegó realmente?     (conteo físico)
  ├─ ¿Diferencias?             → alerta + solicitud de garantía al proveedor
  └─ ¿Costo de envío?          → se distribuye entre las órdenes del lote

Piezas del lote:
  ├─ Las que van a reparaciones específicas → se vinculan y la orden avanza
  └─ Las que son para stock general → entran al inventario con su SKU
```

---

## PARTE 2 — EL POS UNIFICADO

### Decisión: TODO EN UN SOLO POS con 4 áreas separadas visualmente

```
┌─────────────────────────────────────────────────────────────────┐
│  POS CREDIPHONE — Sesión: [Vendedor] · Turno desde 09:00        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [🔍 Buscar producto/servicio...]     [📷 Escanear código]       │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Equipos  │ │ Accesorios│ │ Servicios│ │Reparaciones│          │
│  │  📱      │ │   🎧     │ │   🔧    │ │   🗂️     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  CARRITO                              TOTAL: $0.00               │
│  ─────────────────────────────────────────────                   │
│  [Vacío — agrega productos o servicios]                          │
│                                                                  │
│                              [💳 COBRAR]                         │
└─────────────────────────────────────────────────────────────────┘
```

**Las 4 áreas del POS:**

| Área | Qué contiene | Descuenta stock | Precio modificable |
|---|---|---|---|
| **Equipos** | Celulares, tablets, laptops | Sí (+ IMEI) | Solo admin/con autorización |
| **Accesorios** | Fundas, cargadores, audífonos | Sí | Según límite de rol |
| **Servicios** | Recargas, copias, impresiones, diagnóstico, cualquier servicio sin stock | No | Fijo o variable por servicio |
| **Reparaciones** | Cobro de anticipo o saldo final de una orden existente | No | No (calculado por sistema) |

**Servicios — flag por servicio individual:**
- `precio_fijo: true` → Admin define precio, empleado ve pero no puede editar (ej: Diagnóstico $200)
- `precio_fijo: false` → Empleado puede modificar precio en POS (ej: Copias $1–$5, Recargas variable)
- El admin configura qué servicios son fijos y cuáles variables desde Configuración

---

## PARTE 3 — CONTROL DE DESCUENTOS Y AUTORIZACIONES

### Tipos de descuento permitidos

| Tipo | Ejemplo | Disponible para |
|---|---|---|
| Porcentaje | 10% descuento | Todos los roles autorizados |
| Monto fijo | $200 en equipo de contado | Todos los roles autorizados |
| Precio especial pre-configurado | "Promo equipo contado -$200" | Configurado por admin desde Configuración |

### Niveles de autorización por rol

| Acción | Técnico | Vendedor | Cobrador | Admin | Super Admin |
|---|---|---|---|---|---|
| Descuento 0–5% (o hasta monto fijo predeterminado) | ❌ | ✅ sin aprobación | ❌ | ✅ | ✅ |
| Descuento 6–15% | ❌ | ✅ con razón obligatoria | ❌ | ✅ | ✅ |
| Descuento >15% | ❌ | ❌ requiere aprobación remota admin | ❌ | ✅ con razón | ✅ |
| Cancelar venta / void | ❌ | ❌ | ❌ | ✅ con razón | ✅ |
| Devolución | ❌ | ❌ | ❌ | ✅ con razón | ✅ |
| Confirmar depósito/transferencia | ❌ | ❌ | ❌ | ✅ | ✅ |
| Confirmar traspaso anticipo | ❌ | ✅ propia | ❌ | ✅ | ✅ |
| Cerrar sesión de caja | ❌ | ✅ propia | ❌ | ✅ cualquiera | ✅ |

### Flujo de aprobación remota de descuento >15% (DECISIÓN TRINI)

```
Vendedor intenta descuento >15% en POS
→ Sistema muestra: "Esta operación requiere aprobación del administrador"
→ SIMULTÁNEAMENTE:
   📱 WhatsApp al admin: "⚠️ Solicitud de descuento
      Venta en proceso — [Producto] $X
      Descuento solicitado: 18% ($Y)
      Empleado: [nombre] · Razón: [texto que escribió el vendedor]
      [✅ APROBAR] [❌ DECLINAR] ← links directos"
   🔔 Push en app del admin (si tiene sistema abierto en celular)
→ Admin abre link → Aprueba o Declina desde donde esté
→ Si aprueba → POS del vendedor se desbloquea automáticamente para completar la venta
→ Si declina → POS muestra "Descuento no autorizado" + motivo si admin lo escribió
→ Si admin no responde en 5 min → POS muestra opción: "Esperar admin" o "Aplicar sin descuento"
→ El resultado queda en log: quién solicitó, quién aprobó/declinó, a qué hora, desde dónde
```

**Los límites (0–5%, 6–15%, >15%) son configurables por distribuidor desde Configuración.**

---

## PARTE 4 — CUADRE DE CAJA (Reporte X y Reporte Z)

### Reporte X — Snapshot en cualquier momento (sin cerrar)

```
REPORTE X — Turno de [Vendedor] · Desde 09:00 hasta 14:32 de hoy

VENTAS POR TIPO:
  Equipos              $8,500.00    (3 ventas)
  Accesorios             $450.00    (5 ventas)
  Servicios              $180.00    (12 servicios)
  Pagos de crédito     $2,300.00    (4 pagos)
  Anticipos reparación   $600.00    (2 anticipos confirmados)
  Cobros finales reparación $380.00  (1 orden entregada)
─────────────────────────────────────────────
  TOTAL REGISTRADO    $12,410.00

POR MÉTODO DE PAGO:
  Efectivo             $5,880.00
  Payjoy               $3,600.00   ← Requiere cuadre manual con plataforma
  Tarjeta              $2,930.00
─────────────────────────────────────────────

DESCUENTOS APLICADOS:      $200.00   (1 descuento fijo en equipo)
DEVOLUCIONES:                $0.00   (ninguna)
CAJA INICIAL:              $500.00

EFECTIVO ESPERADO:       $6,380.00   ($500 apertura + $5,880 ventas)
```

---

### Reporte Z — Cierre oficial del turno (con conteo ciego)

**Paso 1 — Conteo ciego (el empleado NO ve lo esperado):**
```
CIERRE DE TURNO — Ingresa el efectivo que tienes físicamente

  Billetes $1,000   × [  ] = $______
  Billetes $500     × [  ] = $______
  Billetes $200     × [  ] = $______
  Billetes $100     × [  ] = $______
  Billetes $50      × [  ] = $______
  Billetes $20      × [  ] = $______
  Monedas           [          ] = $______

  TOTAL QUE DECLARO: $______

  [REGISTRAR CIERRE]
```

**Paso 2 — El sistema muestra la diferencia (DESPUÉS del conteo):**
```
RESULTADO DEL CIERRE

  Efectivo que declaraste:    $6,200.00
  Efectivo que debería haber: $6,380.00
  ─────────────────────────────────────
  DIFERENCIA:                   -$180.00  ← FALTANTE

  ⚠️ Hay una diferencia de $180.00. Se notificará al administrador.

  Cuadre Payjoy — total en plataforma:  $______
  Cuadre tarjeta — total del voucher:   $______

  Razón de la diferencia (requerida): [_________________________________]

  [FIRMAR Y CERRAR TURNO]
```

**Paso 3 — Alerta automática si hay descuadre:**
- Push en app al admin y super_admin
- WhatsApp: "⚠️ Descuadre en caja — [Tienda] · [Empleado] declaró $X, esperado $Y. Diferencia: -$Z."
- El cierre queda con estado `cerrado_con_diferencia` — el turno SÍ se puede cerrar, queda marcado para revisión
- **Historial mínimo de cuadres: 1 año**

---

## PARTE 5 — BOLSA VIRTUAL DE REPARACIONES EN CAJA

En la pantalla de sesión activa de caja, el vendedor ve:

```
SESIÓN ACTIVA — Mi turno

  VENTAS POS HOY:                $9,130.00
  PAGOS CRÉDITO:                 $2,300.00
  ANTICIPOS REPARACIÓN:            $600.00
    └ ORD-2026-00412  Samsung A54  $300.00  ✅ confirmado
    └ ORD-2026-00419  iPhone 13    $300.00  ✅ confirmado
  COBROS FINALES REPARACIÓN:       $380.00
    └ ORD-2026-00401  Moto G54     $380.00  ✅ entregado
  SERVICIOS:                       $180.00
  PENDIENTES DE CONFIRMAR ADMIN:     $0.00  ← transferencias sin confirmar

  TOTAL EN CAJA:                $12,590.00
  CAJA INICIAL:                    $500.00
  TOTAL EFECTIVO ESPERADO:       $6,380.00

  [📊 REPORTE X]  [🔒 CERRAR TURNO]
```

---

## PARTE 6 — NOTIFICACIONES EN TIEMPO REAL

| Evento | Técnico | Vendedor | Admin | Super Admin |
|---|---|---|---|---|
| Técnico registra anticipo en efectivo | — | 🔔 Push inmediato | — | — |
| Discrepancia en traspaso anticipo | 🔔 info | — | 🔔 Push + WA urgente | — |
| Vendedor NO confirma en 10 min | — | 🔔 recordatorio | 🔔 alerta | — |
| Pago por transferencia registrado | — | 🔔 info | 🔔 Push + link WA confirmar | — |
| Admin confirma transferencia | 🔔 info | 🔔 info | — | — |
| Admin NO confirma en 30 min | — | 🔔 info | 🔔 recordatorio WA | — |
| Descuento >15% solicitado | — | espera respuesta | 🔔 Push + WA link aprobar | — |
| Admin aprueba/declina descuento | — | 🔔 respuesta en POS | — | — |
| Orden con entrega vencida | — | 🔔 WA para cliente | 🔔 info | — |
| Descuadre al cerrar caja | — | — | 🔔 Push + WA | 🔔 Push + WA |
| Pieza de reparación llega al lote | 🔔 info | — | 🔔 info | — |

---

## PARTE 7 — TABLAS NUEVAS NECESARIAS EN BASE DE DATOS

```sql
-- 1. Servicios sin inventario
CREATE TABLE servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id),
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_base DECIMAL(10,2) NOT NULL,
  precio_fijo BOOLEAN DEFAULT true,       -- false = empleado puede modificar precio
  precio_min DECIMAL(10,2),               -- límite inferior si precio_fijo = false
  precio_max DECIMAL(10,2),               -- límite superior si precio_fijo = false
  categoria VARCHAR(100),  -- 'telefonia', 'papeleria', 'diagnostico', 'otro'
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Límites de autorización por rol y distribuidor (configurables)
CREATE TABLE limites_autorizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id),
  rol VARCHAR(50) NOT NULL,
  descuento_max_sin_aprobacion DECIMAL(5,2) DEFAULT 5.00,   -- % máximo sin pedir nada
  descuento_max_con_razon DECIMAL(5,2) DEFAULT 15.00,       -- % con razón pero sin PIN
  -- más de descuento_max_con_razon → requiere aprobación remota admin
  puede_hacer_void BOOLEAN DEFAULT false,
  puede_hacer_devolucion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Log de autorizaciones especiales
CREATE TABLE log_autorizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id),
  tipo VARCHAR(50) NOT NULL,  -- 'descuento', 'void', 'devolucion', 'apertura_sin_venta'
  empleado_id UUID REFERENCES users(id),
  autorizador_id UUID REFERENCES users(id),
  referencia_id UUID,
  monto_afectado DECIMAL(10,2),
  porcentaje_descuento DECIMAL(5,2),
  monto_descuento DECIMAL(10,2),         -- para descuentos en monto fijo
  razon TEXT NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'declinado'
  respondido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Traspasos de anticipo técnico → vendedor
CREATE TABLE traspasos_anticipo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reparacion_id UUID REFERENCES reparaciones(id),
  tecnico_id UUID REFERENCES users(id),
  vendedor_id UUID REFERENCES users(id),
  monto_registrado DECIMAL(10,2) NOT NULL,   -- lo que el técnico dice que entrega
  monto_confirmado DECIMAL(10,2),            -- lo que el vendedor confirma que recibió
  estado VARCHAR(30) DEFAULT 'pendiente',    -- 'pendiente', 'confirmado', 'discrepancia'
  confirmado_at TIMESTAMPTZ,
  discrepancia DECIMAL(10,2),               -- diferencia si la hay
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Confirmaciones de depósito/transferencia
CREATE TABLE confirmaciones_deposito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reparacion_id UUID REFERENCES reparaciones(id),
  monto DECIMAL(10,2) NOT NULL,
  referencia_bancaria VARCHAR(200),
  registrado_por UUID REFERENCES users(id),
  estado VARCHAR(30) DEFAULT 'pendiente_confirmacion',
  -- 'pendiente_confirmacion', 'confirmado', 'rechazado'
  confirmado_por UUID REFERENCES users(id),
  confirmado_at TIMESTAMPTZ,
  whatsapp_enviado_at TIMESTAMPTZ,
  link_token VARCHAR(200),                  -- token único para el link de WhatsApp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Solicitudes de piezas para reparación (ya existe parcialmente — extender)
-- Agregar campos a reparacion_piezas (ya existente):
--   costo_pieza DECIMAL(10,2)
--   costo_envio DECIMAL(10,2) DEFAULT 0
--   fuente: 'inventario_propio' | 'pedido_externo' | 'cargo_directo'
--   lote_id UUID (FK a lotes de piezas — tabla nueva)
--   precio_fijo: boolean (precio fijo o variable)

-- 7. Lotes de piezas recibidas
CREATE TABLE lotes_piezas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id),
  proveedor VARCHAR(200),
  fecha_pedido DATE,
  fecha_llegada DATE,
  costo_envio_total DECIMAL(10,2) DEFAULT 0,
  estado VARCHAR(30) DEFAULT 'pedido',  -- 'pedido', 'en_camino', 'recibido', 'verificado'
  notas TEXT,
  recibido_por UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Cuadre extendido de caja (columnas JSON en caja_sesiones existente):
-- denominaciones_declaradas JSONB   -- {"1000":2,"500":4,"200":1,...}
-- payjoy_declarado DECIMAL(10,2)
-- tarjeta_declarada DECIMAL(10,2)
-- diferencia_efectivo DECIMAL(10,2)
-- estado_cierre VARCHAR(30)         -- 'cuadrado','con_diferencia','sobrante'
-- razon_diferencia TEXT
```

---

## PARTE 8 — FASES DE IMPLEMENTACIÓN (en orden de impacto)

### FASE 36 — Servicios sin stock en POS *(bajo riesgo, alto valor)*
- Nueva tabla `servicios` con flag `precio_fijo`
- Área "Servicios" en POS: catálogo configurable + crear en momento
- Precio fijo vs variable configurable individualmente por servicio
- Los servicios van a la misma sesión de caja
- Configuración de servicios en `/dashboard/configuracion`

### FASE 37 — Control de traspasos anticipo técnico → vendedor *(antifraud crítico)*
- Tabla `traspasos_anticipo`
- Notificación inmediata al vendedor cuando técnico registra efectivo
- Vendedor confirma monto real recibido (puede diferir)
- Si hay discrepancia → alerta inmediata al admin por todos los canales
- Log de todos los traspasos con estado
- Admin NO recibe el traspaso — el vendedor sí (admin solo supervisa)

### FASE 38 — Confirmación de depósitos/transferencias *(antifraud crítico)*
- Tabla `confirmaciones_deposito`
- Estado "pendiente_confirmacion" hasta que admin apruebe
- Link único en WhatsApp para aprobar/declinar directamente desde celular
- Anticipo entra a caja solo después de confirmación
- Admin puede confirmar desde el sistema o desde el link de WhatsApp

### FASE 39 — Control de descuentos y autorizaciones *(antifraud importante)*
- Tabla `limites_autorizacion` configurable por distribuidor
- Tabla `log_autorizaciones`
- Aprobación remota >15%: push + link WhatsApp al admin
- Admin aprueba/declina desde donde esté — POS espera respuesta en tiempo real
- Soporte para descuento en % y en monto fijo

### FASE 40 — Reporte Z con conteo ciego y Reporte X *(control de turno)*
- Conteo por denominaciones al cerrar turno (empleado no ve el esperado)
- Reporte X: snapshot en cualquier momento
- Reporte Z: diferencia calculada después del conteo ciego
- Alerta de descuadre a admin + WhatsApp
- Cuadre manual de Payjoy y terminal de tarjeta
- Historial mínimo: 1 año

### FASE 41 — Reparaciones dentro del POS *(UX unificado)*
- Área "Reparaciones" en POS
- Buscar orden por folio, cliente, teléfono
- Ver bolsa virtual con resumen completo (anticipos, piezas, costos)
- Registrar anticipo o cobrar saldo final desde POS
- Orden cambia a "entregado" solo cuando saldo = $0

### FASE 42 — Bolsa virtual completa + gestión de piezas *(visibilidad completa)*
- Widget en sesión activa: desglose por fuente
- Anticipos pendientes de confirmar claramente marcados
- Transferencias pendientes de admin claramente marcadas
- Tabla `lotes_piezas` con recepción y verificación
- Vinculación de piezas a órdenes con folio (inventario propio vs pedido vs cargo directo)
- Distribución de costo de envío entre órdenes del lote

---

## DECISIONES APROBADAS POR TRINI ✅

1. ✅ Límites de descuento: configurables por distribuidor + descuentos en monto fijo además de %
2. ✅ Aprobación remota de descuentos: push en app + link directo en WhatsApp — admin aprueba desde donde esté
3. ✅ Discrepancia en traspaso: vendedor declara monto real → sistema genera alerta al admin (no al vendedor ni al técnico entre sí, para evitar colusión)
4. ✅ Servicios con precio variable: flag por servicio individual (`precio_fijo: true/false`) con rangos min/max
5. ✅ Historial de cuadres: 1 año mínimo
6. ✅ Bolsa virtual incluye: anticipos, cobros finales, servicios, piezas (costo + envío), todo desglosado
7. ✅ Pieza de reparación: 3 fuentes posibles (inventario propio, pedido externo con lote, cargo directo)
8. ✅ Orden no puede marcarse "entregado" hasta que saldo = $0 (el sistema lo bloquea)

---

*Documento v2 — Aprobado por Trini 2026-03-17 · Listo para implementación en orden de fases*
