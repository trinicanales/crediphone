-- Migración: Agregar cargo_cancelacion a ordenes_reparacion
-- Monto mínimo que se retiene si el cliente cancela antes de instalar piezas.
-- Configurable al crear la orden. Default: $100 MXN.

ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS cargo_cancelacion NUMERIC(10,2) NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.ordenes_reparacion.cargo_cancelacion
  IS 'Monto en MXN retenido al cliente si cancela el servicio. Configurable al crear la orden. Default $100.';
