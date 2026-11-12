# A — Reparaciones (investigado directo en código y BD, 2026-11-11)
> Nada tomado de documentos anteriores. Niveles: **A** reproducido en BD · **B** dato real en BD · **D** solo lectura de código/grafo.
> Agente de reparaciones fue detenido sin entregar; esta parte la hice yo con el grafo (`D-grafo-codigo.md`/`grafo.json`) y consultas a Supabase.

## 1. Pantallas y quién monta qué (D, con grep de `<Componente`)
| Componente | Lo montan |
|---|---|
| `OrdenDrawer` (el detalle completo) | Órdenes, Panel técnico, Dashboard ejecutivo, POS (panel de reparaciones) → **4 entradas al mismo detalle** |
| `OrdenCard` + `StepperReparacion` | Órdenes, Panel técnico, Bolsa virtual (POS). El stepper solo vive dentro de OrdenCard |
| `ModalCambiarEstado` | Órdenes, Panel técnico, OrdenDrawer |
| `/dashboard/reparaciones/[id]` (página de detalle) | Es **otro detalle distinto**: no usa OrdenDrawer; usa `TimelineOrden` + `OrdenDetailHeader`. |
| Seguimiento cliente | `/reparacion/[folio]` → `/tracking/[token]`, con `BarraProgresoReparacion` y `TimelineEstados` (propios del cliente) |

## 2. Espejos confirmados (D)
1. **Órdenes vs Panel técnico**: importan las mismas APIs de orden (≈45), mismas tarjetas, mismo modal de estado y mismo drawer. La diferencia real es el filtro (`tecnico_id`) y los KPIs. Son una pantalla con dos filtros.
2. **Detalle `[id]` vs OrdenDrawer**: el drawer llama a APIs que `[id]` no (diagnósticos, tomar, asignar-técnico, pedidos-pieza, solicitudes-precio, versiones-pdf, revertir-estado, renotificar, comunicaciones, garantía, historial-precios). Es una versión reducida: quien entra por ahí no puede hacer todo.
3. **Estados**: la regla vive en `src/lib/reparaciones/estados.ts` (8 archivos la importan), pero `DashboardEjecutivo.tsx` define su **propio** mapa de etiquetas/colores y agrupaciones (líneas 130, 290, 558). 22 archivos mencionan `esperando_piezas`; no todos son mapas, queda por revisar uno a uno.
4. **Tabla de órdenes recientes** (`TablaOrdenesRecientes`) y OrdenCard son dos formas de mostrar una orden con su propio formato.

## 3. Base de datos (A/B)
- Estados permitidos por la BD (CHECK): recibido, diagnostico, esperando_piezas, presupuesto, aprobado, en_reparacion, completado, listo_entrega, entregado, no_reparable, cancelado. **Coincide** con el historial (los 11 aparecen en `historial_estado_orden`).
- Órdenes reales hoy (B): recibido 77 · entregado 59 · listo_entrega 57 · cancelado 17 · completado 6 · en_reparacion 2 · aprobado 2 · no_reparable 1 · presupuesto 1 = **222**. 134 están "vivas" y 77 de ellas en "recibido" (no se están moviendo de estado).
- Triggers en `ordenes_reparacion`: solo `trigger_historial_estado_orden` (sin usuario) y `updated_at`.
- Columnas de dinero que conviven: `costo_reparacion`, `costo_partes`, `costo_total` (generada), `precio_total`, `precio_mano_obra`, `precio_piezas`, `precio_pendiente_aprobacion`. Dos conjuntos (costo vs precio) para lo mismo → riesgo de leer el equivocado.
- Cliente: la orden guarda `cliente_id`; **no** existen `cliente_nombre`, `cliente_telefono` ni `tecnico_nombre` (A: consulta a information_schema) → rompen cron de recordatorios y almacenaje (ver C-4).

## 4. Pendiente de verificar en reparaciones (no afirmado)
- Cuáles de los 22 archivos con estados tienen mapa propio (revisión archivo por archivo).
- Si `/dashboard/reparaciones/[id]` sigue enlazado desde algún lugar (para decidir si se puede apuntar al drawer).
- Por qué 77 órdenes están en "recibido": datos reales (ventas capturadas como órdenes, según lo que tú dijiste) o flujo trabado.

## 5. Cómo unificar (propuesta, sin implementar)
1. Un solo "Centro de órdenes": Órdenes + Panel técnico como **vistas** de la misma pantalla (filtro Mis órdenes / Todas).
2. Todo acceso al detalle abre `OrdenDrawer`; la página `[id]` queda como enlace directo que abre el mismo drawer.
3. Un solo componente de estado (badge + stepper) alimentado por `estados.ts`; Dashboard ejecutivo deja de tener su mapa propio.
4. Decidir cuál juego de columnas es la verdad del dinero (`precio_*` vs `costo_*`).
