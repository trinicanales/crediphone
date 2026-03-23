-- ─── FASE 61: Kits / Bundles ─────────────────────────────────────────────────
-- Un kit es un bundle de productos que se vende como unidad en el POS.
-- Precio fijo, agrupa varios productos con sus cantidades.

-- Tabla principal de kits
CREATE TABLE IF NOT EXISTS public.kits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id  UUID NOT NULL REFERENCES public.distribuidores(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  precio           NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  imagen           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items que componen cada kit (qué productos y en qué cantidad)
CREATE TABLE IF NOT EXISTS public.kits_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id      UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad    INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  UNIQUE (kit_id, producto_id)
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_kits_distribuidor ON public.kits(distribuidor_id);
CREATE INDEX IF NOT EXISTS idx_kits_activo ON public.kits(distribuidor_id, activo);
CREATE INDEX IF NOT EXISTS idx_kits_items_kit ON public.kits_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_kits_items_producto ON public.kits_items(producto_id);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.set_kits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kits_updated_at ON public.kits;
CREATE TRIGGER trg_kits_updated_at
  BEFORE UPDATE ON public.kits
  FOR EACH ROW EXECUTE FUNCTION public.set_kits_updated_at();

-- RLS: habilitar (las queries del backend usan service_role que bypasea RLS)
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits_items ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (lectura autenticada, escritura solo service_role)
CREATE POLICY "kits_select" ON public.kits
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "kits_items_select" ON public.kits_items
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.kits IS 'Bundles/kits de productos que se venden como una unidad en el POS (FASE 61)';
COMMENT ON TABLE public.kits_items IS 'Componentes (productos + cantidad) de cada kit (FASE 61)';
