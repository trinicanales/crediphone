-- Aplicada 2026-11-11 (Supabase MCP). El codigo escribia pagos.detalle_pago y la columna no existia: todo pago fallaba.
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS detalle_pago jsonb;
