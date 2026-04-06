-- DB-002: servicios.distribuidor_id debería ser NOT NULL
-- Verificado: 0 filas con NULL antes de aplicar (2026-04-06)
ALTER TABLE public.servicios ALTER COLUMN distribuidor_id SET NOT NULL;
