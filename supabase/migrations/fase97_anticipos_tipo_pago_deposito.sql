-- Aplicada 2026-11-11 (Supabase MCP). La pantalla ofrece "Deposito bancario" y el CHECK no lo admitia.
ALTER TABLE public.anticipos_reparacion DROP CONSTRAINT IF EXISTS anticipos_reparacion_tipo_pago_check;
ALTER TABLE public.anticipos_reparacion ADD CONSTRAINT anticipos_reparacion_tipo_pago_check
  CHECK (tipo_pago::text = ANY (ARRAY['efectivo','tarjeta','transferencia','deposito','cheque','mixto']::text[]));
