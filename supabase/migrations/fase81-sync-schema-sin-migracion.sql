-- ============================================================
-- FASE 81 — Sincronización de esquema: columnas sin migración
-- Fecha: 2026-05-26
--
-- Estas columnas existen en producción pero no tenían archivo
-- de migración. Este archivo documenta y reproduce el esquema
-- real, usando IF NOT EXISTS para ser idempotente.
-- ============================================================

-- ── ordenes_reparacion ──────────────────────────────────────

-- Sistema de precios nuevo (precio al cliente, separado de costos internos)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS precio_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_mano_obra NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_piezas NUMERIC DEFAULT 0;

-- Aprobación parcial (cliente aprueba solo parte del presupuesto)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS aprobacion_parcial BOOLEAN DEFAULT false;

-- Notas visibles al cliente (distintas de notas_internas)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS notas_cliente TEXT;

-- Almacenaje y recordatorios (LFPC Art. 63)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS fecha_aviso_recoleccion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobro_almacenaje_inicio TIMESTAMPTZ;

-- Descuento rápido para incentivar recolección antes de almacenaje
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS descuento_rapido_ofrecido BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS descuento_rapido_porcentaje NUMERIC;

-- Piezas cotizadas al crear la orden (JSONB, para tracking y PDF)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS piezas_cotizacion JSONB DEFAULT '[]'::jsonb;

-- Snapshot inmutable de la cotización inicial (nunca se modifica tras creación)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS snapshot_cotizacion_inicial JSONB;

-- Indica que el precio está pendiente de aprobación del cliente
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS precio_pendiente_aprobacion BOOLEAN DEFAULT false;

-- Fecha real de entrega al cliente (distinta de fecha_completado)
ALTER TABLE public.ordenes_reparacion
  ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;

-- ── productos ────────────────────────────────────────────────

-- Modelos compatibles para autosugerencia en cotizaciones de piezas
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS modelos_compatibles TEXT[] DEFAULT '{}'::text[];

-- Índice GIN para búsqueda eficiente por modelo compatible
CREATE INDEX IF NOT EXISTS idx_productos_modelos_compatibles
  ON public.productos USING GIN (modelos_compatibles);

-- Calidad de pieza (original, generica, oem, reacondicionada)
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS calidad TEXT;

-- Stock apartado para reparaciones (reservado, no disponible para venta)
-- stock_disponible = stock - stock_apartado
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS stock_apartado INTEGER DEFAULT 0 NOT NULL;

-- ── pedidos_pieza_reparacion ─────────────────────────────────

-- Calidad de la pieza pedida al proveedor
ALTER TABLE public.pedidos_pieza_reparacion
  ADD COLUMN IF NOT EXISTS calidad TEXT;

-- Proveedor al que se le pidió la pieza
ALTER TABLE public.pedidos_pieza_reparacion
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- Bloqueo colaborativo: un empleado bloquea la tarjeta para completar datos
ALTER TABLE public.pedidos_pieza_reparacion
  ADD COLUMN IF NOT EXISTS bloqueado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bloqueado_at TIMESTAMPTZ;

-- ── configuracion ────────────────────────────────────────────
-- Tarifa de almacenaje diaria (LFPC) — default $30 MXN
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS tarifa_almacenaje_diaria NUMERIC(10,2) DEFAULT 30.00;

-- ── recordatorios_enviados (tabla) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.recordatorios_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_reparacion(id) ON DELETE CASCADE,
  distribuidor_id UUID REFERENCES public.distribuidores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'listo_entrega', 'almacenaje_inicio', 'almacenaje_cargo', etc.
  canal TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email'
  enviado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notas TEXT
);

ALTER TABLE public.recordatorios_enviados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recordatorios_enviados'
      AND policyname = 'recordatorios_distribuidor'
  ) THEN
    CREATE POLICY "recordatorios_distribuidor" ON public.recordatorios_enviados
      FOR ALL USING (
        distribuidor_id = (
          SELECT distribuidor_id FROM public.usuarios WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
