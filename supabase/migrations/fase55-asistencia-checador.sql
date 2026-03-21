-- FASE 55: Control de Asistencia / Reloj Checador
-- Tabla de sesiones de turno por empleado
-- Patrón análogo a caja_sesiones: apertura con fecha_entrada, cierre con fecha_salida

CREATE TABLE IF NOT EXISTS asistencia_sesiones (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id  UUID        REFERENCES distribuidores(id) ON DELETE CASCADE,
  usuario_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_nombre   TEXT,                              -- snapshot del nombre al momento de entrada
  fecha_entrada    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_salida     TIMESTAMPTZ,                       -- NULL = turno activo
  duracion_minutos INT GENERATED ALWAYS AS (
    CASE
      WHEN fecha_salida IS NOT NULL
      THEN EXTRACT(EPOCH FROM (fecha_salida - fecha_entrada))::INT / 60
      ELSE NULL
    END
  ) STORED,
  notas_entrada    TEXT,
  notas_salida     TEXT,
  estado           TEXT        NOT NULL DEFAULT 'activo'
                               CHECK (estado IN ('activo', 'cerrado')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_asistencia_distribuidor
  ON asistencia_sesiones(distribuidor_id);

CREATE INDEX IF NOT EXISTS idx_asistencia_usuario
  ON asistencia_sesiones(usuario_id);

-- Índice parcial: solo sesiones activas (el más consultado — "¿quién está aquí ahora?")
CREATE INDEX IF NOT EXISTS idx_asistencia_estado_activo
  ON asistencia_sesiones(estado)
  WHERE estado = 'activo';

-- Índice para historial paginado por fecha
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha_entrada
  ON asistencia_sesiones(fecha_entrada DESC);

-- Índice compuesto para "sesión activa de un usuario" (usada en checkin/checkout)
CREATE INDEX IF NOT EXISTS idx_asistencia_usuario_estado
  ON asistencia_sesiones(usuario_id, estado)
  WHERE estado = 'activo';

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_asistencia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_asistencia_updated_at
  BEFORE UPDATE ON asistencia_sesiones
  FOR EACH ROW EXECUTE FUNCTION update_asistencia_updated_at();
