-- Aplicada 2026-11-11 (Supabase MCP).
CREATE TABLE IF NOT EXISTS public.alertas_internas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id uuid REFERENCES public.distribuidores(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  severidad text NOT NULL DEFAULT 'info' CHECK (severidad IN ('info','media','alta')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  leida boolean NOT NULL DEFAULT false,
  leida_por uuid REFERENCES public.users(id) ON DELETE SET NULL,
  leida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alertas_internas_pendientes ON public.alertas_internas (distribuidor_id, created_at DESC) WHERE leida = false;
ALTER TABLE public.alertas_internas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_reparacion ADD COLUMN IF NOT EXISTS checklist_apertura jsonb;
ALTER TABLE public.ordenes_reparacion ADD COLUMN IF NOT EXISTS motivo_garantia text;
