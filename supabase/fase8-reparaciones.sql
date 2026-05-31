-- =====================================================
-- FASE 8: MÓDULO DE REPARACIÓN DE CELULARES - CREDIPHONE
-- =====================================================
-- Descripción: Sistema completo de gestión de órdenes de reparación
-- Incluye: Auto-asignación de técnicos, garantías, tracking, estados
-- =====================================================

-- =====================================================
-- 1. TABLA PRINCIPAL: ordenes_reparacion
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ordenes_reparacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio VARCHAR(20) UNIQUE NOT NULL,

  -- Relaciones
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tecnico_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- Nullable: orden puede crearse sin técnico si el distribuidor no tiene técnicos
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  credito_id UUID REFERENCES public.creditos(id) ON DELETE SET NULL,
  distribuidor_id UUID REFERENCES public.distribuidores(id) ON DELETE SET NULL,  -- Multi-tenant: franquicia dueña de la orden

  -- Información del dispositivo
  marca_dispositivo VARCHAR(100) NOT NULL,
  modelo_dispositivo VARCHAR(100) NOT NULL,
  imei VARCHAR(20),
  numero_serie VARCHAR(50),

  -- Descripción del problema
  problema_reportado TEXT NOT NULL,
  diagnostico_tecnico TEXT,

  -- Estado de la orden (10 estados posibles)
  estado VARCHAR(20) NOT NULL DEFAULT 'recibido' CHECK (
    estado IN (
      'recibido',
      'diagnostico',
      'presupuesto',
      'aprobado',
      'en_reparacion',
      'completado',
      'listo_entrega',
      'entregado',
      'no_reparable',
      'cancelado'
    )
  ),

  -- Costos internos (margen/utilidad del negocio — NUNCA mostrar al cliente como precio)
  costo_reparacion DECIMAL(10, 2) DEFAULT 0,
  costo_partes DECIMAL(10, 2) DEFAULT 0,
  costo_total DECIMAL(10, 2) DEFAULT 0,  -- Actualizado por aplicación (era GENERATED, eliminado para permitir updates)
  partes_reemplazadas JSONB DEFAULT '[]'::jsonb,

  -- Fechas
  fecha_recepcion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_estimada_entrega TIMESTAMP WITH TIME ZONE,
  fecha_completado TIMESTAMP WITH TIME ZONE,
  fecha_entregado TIMESTAMP WITH TIME ZONE,

  -- Notas y detalles
  notas_tecnico TEXT,
  notas_internas TEXT,
  accesorios_entregados TEXT,
  condicion_dispositivo TEXT,

  -- Sistema de garantías
  es_garantia BOOLEAN DEFAULT false,
  orden_original_id UUID REFERENCES public.ordenes_reparacion(id) ON DELETE SET NULL,
  motivo_garantia VARCHAR(20) CHECK (
    motivo_garantia IS NULL OR
    motivo_garantia IN ('garantia_pieza', 'falla_tecnico', 'daño_cliente')
  ),

  -- Aprobaciones
  prioridad VARCHAR(20) DEFAULT 'normal' CHECK (
    prioridad IN ('baja', 'normal', 'alta', 'urgente')
  ),
  requiere_aprobacion BOOLEAN DEFAULT true,
  aprobado_por_cliente BOOLEAN DEFAULT false,
  fecha_aprobacion TIMESTAMP WITH TIME ZONE,

  -- Integración con scoring
  afecta_scoring BOOLEAN DEFAULT false,

  -- Auditoría
  creado_por UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios para documentación
COMMENT ON TABLE public.ordenes_reparacion IS 'Órdenes de servicio de reparación de dispositivos';
COMMENT ON COLUMN public.ordenes_reparacion.folio IS 'Folio único en formato ORD-YYYY-#####';
COMMENT ON COLUMN public.ordenes_reparacion.estado IS 'Estado actual: recibido, diagnostico, presupuesto, aprobado, en_reparacion, completado, listo_entrega, entregado, no_reparable, cancelado';
COMMENT ON COLUMN public.ordenes_reparacion.partes_reemplazadas IS 'Array JSON con partes: [{"parte":"Pantalla","costo":850,"cantidad":1,"proveedor":"Samsung"}]';
COMMENT ON COLUMN public.ordenes_reparacion.es_garantia IS 'Indica si esta orden es un reclamo de garantía';
COMMENT ON COLUMN public.ordenes_reparacion.orden_original_id IS 'Referencia a la orden original si es_garantia=true';

-- =====================================================
-- 2. TABLA: garantias_reparacion
-- =====================================================

CREATE TABLE IF NOT EXISTS public.garantias_reparacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_reparacion(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,

  -- Tipo de garantía
  tipo_garantia VARCHAR(20) NOT NULL CHECK (
    tipo_garantia IN ('garantia_pieza', 'falla_tecnico', 'daño_cliente')
  ),

  -- Período de garantía
  dias_garantia INTEGER DEFAULT 30,
  fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_vencimiento TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Estado de la garantía
  estado VARCHAR(20) DEFAULT 'activa' CHECK (
    estado IN ('activa', 'usada', 'vencida', 'cancelada')
  ),

  -- Tracking de reclamo
  orden_garantia_id UUID REFERENCES public.ordenes_reparacion(id) ON DELETE SET NULL,
  fecha_reclamo TIMESTAMP WITH TIME ZONE,
  motivo_reclamo TEXT,

  -- Costos
  aplica_costo BOOLEAN DEFAULT false,

  -- Notas
  notas TEXT,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.garantias_reparacion IS 'Sistema de garantías para reparaciones completadas';
COMMENT ON COLUMN public.garantias_reparacion.tipo_garantia IS 'garantia_pieza: defecto de pieza, falla_tecnico: error del técnico, daño_cliente: daño causado por cliente';
COMMENT ON COLUMN public.garantias_reparacion.aplica_costo IS 'false si es garantía válida (sin costo), true si es daño del cliente (con costo)';

-- =====================================================
-- 3. TABLA: historial_estado_orden (Auditoría)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.historial_estado_orden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_reparacion(id) ON DELETE CASCADE,

  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20) NOT NULL,

  usuario_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  comentario TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.historial_estado_orden IS 'Registro de auditoría de todos los cambios de estado en órdenes';

-- =====================================================
-- 4. TABLA: tracking_tokens (Para tracking público)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES public.ordenes_reparacion(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  accesos INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.tracking_tokens IS 'Tokens únicos para tracking público de órdenes sin autenticación';
COMMENT ON COLUMN public.tracking_tokens.token IS 'Token aleatorio de 64 caracteres para acceso público';
COMMENT ON COLUMN public.tracking_tokens.accesos IS 'Contador de veces que se ha accedido al tracking';

-- =====================================================
-- 5. ÍNDICES PARA RENDIMIENTO
-- =====================================================

-- Búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente ON public.ordenes_reparacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_tecnico ON public.ordenes_reparacion(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON public.ordenes_reparacion(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_folio ON public.ordenes_reparacion(folio);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_recepcion ON public.ordenes_reparacion(fecha_recepcion DESC);

-- Índice compuesto para filtrar órdenes activas por técnico (usado en balanceo)
CREATE INDEX IF NOT EXISTS idx_ordenes_tecnico_activas
ON public.ordenes_reparacion(tecnico_id, estado)
WHERE estado NOT IN ('entregado', 'cancelado', 'no_reparable');

-- Índice para garantías
CREATE INDEX IF NOT EXISTS idx_garantias_orden ON public.garantias_reparacion(orden_id);
CREATE INDEX IF NOT EXISTS idx_garantias_estado ON public.garantias_reparacion(estado);
CREATE INDEX IF NOT EXISTS idx_garantias_vencimiento ON public.garantias_reparacion(fecha_vencimiento);

-- Índice para historial
CREATE INDEX IF NOT EXISTS idx_historial_orden ON public.historial_estado_orden(orden_id, created_at DESC);

-- Índice para tracking tokens
CREATE INDEX IF NOT EXISTS idx_tracking_token ON public.tracking_tokens(token);

-- =====================================================
-- 6. FUNCIÓN: Generar Folio Único
-- =====================================================

CREATE OR REPLACE FUNCTION generar_folio_orden()
RETURNS TEXT AS $$
DECLARE
  año_actual TEXT;
  siguiente_numero INTEGER;
  folio TEXT;
BEGIN
  año_actual := TO_CHAR(NOW(), 'YYYY');

  -- Obtener el siguiente número secuencial para el año actual
  SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 10) AS INTEGER)), 0) + 1
  INTO siguiente_numero
  FROM public.ordenes_reparacion
  WHERE folio LIKE 'ORD-' || año_actual || '-%';

  -- Generar folio en formato ORD-2026-00001
  folio := 'ORD-' || año_actual || '-' || LPAD(siguiente_numero::TEXT, 5, '0');

  RETURN folio;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION generar_folio_orden IS 'Genera folio único en formato ORD-YYYY-##### con secuencia anual';

-- =====================================================
-- 7. FUNCIÓN: Auto-asignación de Técnico (Round-Robin)
-- =====================================================
-- ACTUALIZADO: Acepta p_distribuidor_id para filtrar por franquicia.
-- Retorna NULL (no lanza excepción) si no hay técnicos en ese distribuidor.
-- La capa TypeScript maneja null → orden sin técnico asignado.

CREATE OR REPLACE FUNCTION obtener_tecnico_disponible(p_distribuidor_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  tecnico_id_resultado UUID;
  total_tecnicos INTEGER;
BEGIN
  -- Contar técnicos activos del mismo distribuidor
  SELECT COUNT(*) INTO total_tecnicos
  FROM public.users
  WHERE role = 'tecnico' AND activo = true
    AND (p_distribuidor_id IS NULL OR distribuidor_id = p_distribuidor_id);

  -- Sin técnicos disponibles → retornar NULL (orden queda sin técnico)
  IF total_tecnicos = 0 THEN
    RETURN NULL;
  END IF;

  -- Si hay solo 1 técnico, asignar directamente
  IF total_tecnicos = 1 THEN
    SELECT id INTO tecnico_id_resultado
    FROM public.users
    WHERE role = 'tecnico' AND activo = true
      AND (p_distribuidor_id IS NULL OR distribuidor_id = p_distribuidor_id)
    LIMIT 1;
    RETURN tecnico_id_resultado;
  END IF;

  -- Múltiples técnicos: round-robin por carga (técnico con menos órdenes activas)
  SELECT u.id INTO tecnico_id_resultado
  FROM public.users u
  LEFT JOIN (
    SELECT tecnico_id, COUNT(*) as ordenes_activas
    FROM public.ordenes_reparacion
    WHERE estado NOT IN ('entregado', 'cancelado', 'no_reparable')
    GROUP BY tecnico_id
  ) o ON u.id = o.tecnico_id
  WHERE u.role = 'tecnico' AND u.activo = true
    AND (p_distribuidor_id IS NULL OR u.distribuidor_id = p_distribuidor_id)
  ORDER BY COALESCE(o.ordenes_activas, 0) ASC, u.created_at ASC
  LIMIT 1;

  RETURN tecnico_id_resultado;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION obtener_tecnico_disponible IS 'Asigna técnico del mismo distribuidor: round-robin por carga. Retorna NULL si no hay técnico disponible.';

-- =====================================================
-- 8. FUNCIÓN: Reasignar Técnico
-- =====================================================

CREATE OR REPLACE FUNCTION reasignar_tecnico(
  orden_uuid UUID,
  nuevo_tecnico_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar que el nuevo técnico es válido
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = nuevo_tecnico_uuid AND role = 'tecnico' AND activo = true
  ) THEN
    RAISE EXCEPTION 'El técnico especificado no es válido o no está activo';
  END IF;

  -- Actualizar técnico asignado
  UPDATE public.ordenes_reparacion
  SET tecnico_id = nuevo_tecnico_uuid, updated_at = NOW()
  WHERE id = orden_uuid;

  RETURN true;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION reasignar_tecnico IS 'Reasigna una orden a un técnico diferente con validación';

-- =====================================================
-- 9. FUNCIÓN: Estadísticas de Carga por Técnico
-- =====================================================
-- ACTUALIZADO: Acepta p_distribuidor_id para filtrar técnicos y órdenes por franquicia.
-- Usa u.distribuidor_id directamente — NO existe tabla public.empleados.

CREATE OR REPLACE FUNCTION obtener_carga_tecnicos(p_distribuidor_id UUID DEFAULT NULL)
RETURNS TABLE (
  tecnico_id UUID,
  nombre_tecnico TEXT,
  ordenes_activas BIGINT,
  ordenes_recibidas BIGINT,
  ordenes_diagnostico BIGINT,
  ordenes_en_reparacion BIGINT,
  ordenes_completadas_hoy BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    COUNT(CASE WHEN o.estado NOT IN ('entregado', 'cancelado', 'no_reparable') THEN 1 END) AS ordenes_activas,
    COUNT(CASE WHEN o.estado = 'recibido' THEN 1 END) AS ordenes_recibidas,
    COUNT(CASE WHEN o.estado = 'diagnostico' THEN 1 END) AS ordenes_diagnostico,
    COUNT(CASE WHEN o.estado = 'en_reparacion' THEN 1 END) AS ordenes_en_reparacion,
    COUNT(CASE WHEN o.estado = 'completado' AND DATE(o.fecha_completado) = CURRENT_DATE THEN 1 END) AS ordenes_completadas_hoy
  FROM public.users u
  LEFT JOIN public.ordenes_reparacion o ON u.id = o.tecnico_id
    AND (p_distribuidor_id IS NULL OR o.distribuidor_id = p_distribuidor_id)
  WHERE u.role = 'tecnico'
    AND u.activo = true
    AND (p_distribuidor_id IS NULL OR u.distribuidor_id = p_distribuidor_id)
  GROUP BY u.id, u.name
  ORDER BY ordenes_activas ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obtener_carga_tecnicos IS 'Retorna estadísticas de carga por técnico. Filtrable por distribuidor. Sin tabla empleados.';

-- =====================================================
-- 10. TRIGGER: Actualizar updated_at automáticamente
-- =====================================================

-- Función helper para updated_at (si no existe ya)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para tablas
CREATE TRIGGER update_ordenes_reparacion_updated_at
  BEFORE UPDATE ON public.ordenes_reparacion
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_garantias_reparacion_updated_at
  BEFORE UPDATE ON public.garantias_reparacion
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. TRIGGER: Registrar cambios de estado (Auditoría)
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_cambio_estado_orden()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si el estado cambió
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.historial_estado_orden (
      orden_id,
      estado_anterior,
      estado_nuevo,
      usuario_id,
      comentario
    ) VALUES (
      NEW.id,
      OLD.estado,
      NEW.estado,
      NEW.tecnico_id,
      'Cambio automático de estado'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cambio_estado_orden
  AFTER UPDATE ON public.ordenes_reparacion
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_estado_orden();

COMMENT ON FUNCTION registrar_cambio_estado_orden IS 'Registra automáticamente todos los cambios de estado en historial';

-- =====================================================
-- 12. TRIGGER: Generar token de tracking automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION generar_tracking_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generar token único de 64 caracteres al crear orden
  INSERT INTO public.tracking_tokens (orden_id, token, expires_at)
  VALUES (
    NEW.id,
    encode(gen_random_bytes(32), 'hex'),
    NOW() + INTERVAL '90 days'  -- Expira 90 días después
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generar_tracking_token
  AFTER INSERT ON public.ordenes_reparacion
  FOR EACH ROW
  EXECUTE FUNCTION generar_tracking_token();

COMMENT ON FUNCTION generar_tracking_token IS 'Genera token único para tracking público al crear orden';

-- =====================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en las tablas
ALTER TABLE public.ordenes_reparacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garantias_reparacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_estado_orden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_tokens ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA ordenes_reparacion

-- Todos pueden ver órdenes (autenticados)
CREATE POLICY "Usuarios autenticados pueden ver órdenes"
  ON public.ordenes_reparacion FOR SELECT
  USING (auth.role() = 'authenticated');

-- CUALQUIER usuario autenticado puede crear órdenes
CREATE POLICY "Usuarios autenticados pueden crear órdenes"
  ON public.ordenes_reparacion FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admin puede actualizar todas, técnico solo las suyas
CREATE POLICY "Actualizar órdenes según rol"
  ON public.ordenes_reparacion FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR (u.role = 'tecnico' AND ordenes_reparacion.tecnico_id = u.id)
          OR (u.role = 'vendedor' AND ordenes_reparacion.creado_por = u.id)
        )
    )
  );

-- Solo admin puede eliminar (soft delete)
CREATE POLICY "Solo admin puede eliminar órdenes"
  ON public.ordenes_reparacion FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- POLÍTICAS PARA garantias_reparacion

CREATE POLICY "Usuarios autenticados pueden ver garantías"
  ON public.garantias_reparacion FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin y técnicos pueden crear garantías"
  ON public.garantias_reparacion FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'tecnico', 'vendedor')
    )
  );

CREATE POLICY "Admin y técnicos pueden actualizar garantías"
  ON public.garantias_reparacion FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'tecnico')
    )
  );

-- POLÍTICAS PARA historial_estado_orden

CREATE POLICY "Usuarios autenticados pueden ver historial"
  ON public.historial_estado_orden FOR SELECT
  USING (auth.role() = 'authenticated');

-- El historial solo se inserta via trigger, no manualmente
CREATE POLICY "Sistema puede insertar historial"
  ON public.historial_estado_orden FOR INSERT
  WITH CHECK (true);

-- POLÍTICAS PARA tracking_tokens (público para leer)

-- Permitir acceso público a tokens para tracking
CREATE POLICY "Público puede ver tokens"
  ON public.tracking_tokens FOR SELECT
  USING (true);

-- Solo el sistema puede crear tokens (via trigger)
CREATE POLICY "Sistema puede crear tokens"
  ON public.tracking_tokens FOR INSERT
  WITH CHECK (true);

-- Solo el sistema puede actualizar accesos
CREATE POLICY "Sistema puede actualizar tokens"
  ON public.tracking_tokens FOR UPDATE
  USING (true);

-- =====================================================
-- 14. FUNCIÓN: Actualizar scoring post-reparación
-- =====================================================

CREATE OR REPLACE FUNCTION actualizar_scoring_post_reparacion()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la orden fue entregada exitosamente y está configurada para afectar scoring
  IF NEW.estado = 'entregado' AND OLD.estado != 'entregado' AND NEW.afecta_scoring THEN
    -- Nota: Esta función asume que existe una tabla de scoring
    -- Se implementará completamente cuando se desarrolle el módulo de scoring
    -- Por ahora solo dejamos el placeholder

    -- PLACEHOLDER: incrementar_score_cliente(cliente_id, puntos, motivo)
    -- Cuando se implemente scoring, descomentar:
    -- PERFORM incrementar_score_cliente(
    --   NEW.cliente_id,
    --   5,
    --   'Servicio de reparación completado exitosamente - Folio: ' || NEW.folio
    -- );

    NULL; -- Placeholder
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_scoring_reparacion
  AFTER UPDATE ON public.ordenes_reparacion
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_scoring_post_reparacion();

COMMENT ON FUNCTION actualizar_scoring_post_reparacion IS 'Actualiza score del cliente al completar servicio (placeholder para integración futura)';

-- =====================================================
-- FIN DE MIGRACIÓN - FASE 8
-- =====================================================

-- Verificar creación de tablas
DO $$
BEGIN
  RAISE NOTICE 'Migración Fase 8 completada exitosamente';
  RAISE NOTICE 'Tablas creadas: ordenes_reparacion, garantias_reparacion, historial_estado_orden, tracking_tokens';
  RAISE NOTICE 'Funciones creadas: generar_folio_orden, obtener_tecnico_disponible, reasignar_tecnico, obtener_carga_tecnicos';
  RAISE NOTICE 'Sistema de auto-asignación de técnicos: ACTIVO';
  RAISE NOTICE 'Sistema de tracking público: ACTIVO';
END $$;
