-- ─── FASE 62: Lotes de Series (IMEIs) ────────────────────────────────────────
-- Permite recibir equipos serializados (por IMEI) en lotes desde un proveedor.
-- Valida duplicados, formato de IMEI, y actualiza stock de productos.

-- Tabla de lotes de series
CREATE TABLE IF NOT EXISTS public.lotes_series (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id  UUID NOT NULL REFERENCES public.distribuidores(id) ON DELETE CASCADE,
  producto_id      UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  folio            TEXT NOT NULL,
  referencia       TEXT,
  proveedor_id     UUID REFERENCES public.proveedores(id) ON DELETE SET NULL,
  total_esperado   INTEGER NOT NULL DEFAULT 0,
  total_recibido   INTEGER NOT NULL DEFAULT 0,
  total_duplicado  INTEGER NOT NULL DEFAULT 0,
  total_invalido   INTEGER NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'borrador'
                     CHECK (estado IN ('borrador','procesado','cancelado')),
  notas            TEXT,
  creado_por       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (distribuidor_id, folio)
);

-- Items del lote: un registro por cada IMEI escaneado
CREATE TABLE IF NOT EXISTS public.lotes_series_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id     UUID NOT NULL REFERENCES public.lotes_series(id) ON DELETE CASCADE,
  imei        TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'valido'
                CHECK (estado IN ('valido','duplicado','invalido')),
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lotes_series_distribuidor ON public.lotes_series(distribuidor_id);
CREATE INDEX IF NOT EXISTS idx_lotes_series_producto ON public.lotes_series(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_series_estado ON public.lotes_series(distribuidor_id, estado);
CREATE INDEX IF NOT EXISTS idx_lotes_series_items_lote ON public.lotes_series_items(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_series_items_imei ON public.lotes_series_items(imei);
CREATE INDEX IF NOT EXISTS idx_lotes_series_items_estado ON public.lotes_series_items(lote_id, estado);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.set_lotes_series_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lotes_series_updated_at ON public.lotes_series;
CREATE TRIGGER trg_lotes_series_updated_at
  BEFORE UPDATE ON public.lotes_series
  FOR EACH ROW EXECUTE FUNCTION public.set_lotes_series_updated_at();

-- RLS
ALTER TABLE public.lotes_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_series_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lotes_series_select" ON public.lotes_series
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "lotes_series_items_select" ON public.lotes_series_items
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.lotes_series IS 'Lotes de recepción de equipos por IMEI desde proveedor (FASE 62)';
COMMENT ON TABLE public.lotes_series_items IS 'IMEIs individuales de cada lote con su estado de validación (FASE 62)';
