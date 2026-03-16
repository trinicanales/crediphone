-- FASE 34: Agregar estado "esperando_piezas" a ordenes_reparacion
-- Este estado permite pausar la reparación mientras llegan piezas de proveedor

-- 1. Primero eliminamos el constraint existente
ALTER TABLE public.ordenes_reparacion
  DROP CONSTRAINT IF EXISTS ordenes_reparacion_estado_check;

-- 2. Re-creamos con el nuevo estado incluido
ALTER TABLE public.ordenes_reparacion
  ADD CONSTRAINT ordenes_reparacion_estado_check CHECK (
    estado IN (
      'recibido',
      'diagnostico',
      'esperando_piezas',
      'presupuesto',
      'aprobado',
      'en_reparacion',
      'completado',
      'listo_entrega',
      'entregado',
      'no_reparable',
      'cancelado'
    )
  );

-- 3. Actualizar comentario
COMMENT ON COLUMN public.ordenes_reparacion.estado IS
  'Estado actual: recibido, diagnostico, esperando_piezas, presupuesto, aprobado, en_reparacion, completado, listo_entrega, entregado, no_reparable, cancelado';
