-- ══════════════════════════════════════════════════════════════════════════════
-- FASE 29 — Fix tabla anticipos_reparacion
-- Problemas resueltos:
--   1. Renombrar created_by → se mantiene created_by, agregar recibido_por como alias
--   2. Ampliar CHECK tipo_pago para incluir 'mixto'
--   3. Agregar columnas faltantes: desglose_mixto, referencia_pago, estado
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Agregar columnas faltantes (si no existen)
ALTER TABLE public.anticipos_reparacion
  ADD COLUMN IF NOT EXISTS desglose_mixto   JSONB,
  ADD COLUMN IF NOT EXISTS referencia_pago  TEXT,
  ADD COLUMN IF NOT EXISTS estado           VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aplicado', 'devuelto')),
  ADD COLUMN IF NOT EXISTS recibido_por     UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Eliminar y recrear el CHECK constraint de tipo_pago para incluir 'mixto'
ALTER TABLE public.anticipos_reparacion
  DROP CONSTRAINT IF EXISTS anticipos_reparacion_tipo_pago_check;

ALTER TABLE public.anticipos_reparacion
  ADD CONSTRAINT anticipos_reparacion_tipo_pago_check
    CHECK (tipo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'cheque', 'mixto'));

-- 3. Índice para la nueva columna recibido_por
CREATE INDEX IF NOT EXISTS idx_anticipos_recibido_por ON public.anticipos_reparacion(recibido_por);
