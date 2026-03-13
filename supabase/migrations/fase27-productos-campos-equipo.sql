-- ==============================================================================
-- FASE 27: CAMPOS DEDICADOS PARA EQUIPOS CELULARES
-- Fecha: Marzo 2026
-- Descripción:
--   Agrega columnas estructuradas a `productos` para almacenar correctamente
--   los datos que llegan del ticket de proveedor WINDCEL:
--   IMEI propio (no en codigo_barras), color, RAM, almacenamiento y folio de remisión.
--
-- Contexto:
--   Anteriormente, el IMEI se guardaba en `codigo_barras` y el color/almacenamiento
--   se metían en `descripcion` como texto libre. Esto imposibilita búsquedas
--   por IMEI, filtros por color, y control real del inventario de equipos.
--
-- Tablas afectadas: productos
-- ==============================================================================

-- 1. IMEI del equipo (para equipos serializados: equipo_nuevo, equipo_usado)
--    UNIQUE pero nullable — solo equipos serializados lo tienen
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS imei TEXT;

-- Índice único parcial: solo valida unicidad cuando imei no es null
--   (permite múltiples productos sin IMEI sin conflicto)
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_imei_unique
  ON productos (imei)
  WHERE imei IS NOT NULL;

-- Índice de búsqueda (para lookup por IMEI)
CREATE INDEX IF NOT EXISTS idx_productos_imei
  ON productos (imei)
  WHERE imei IS NOT NULL;

-- 2. COLOR del equipo — ej: "Negro", "Azul", "Verde"
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS color TEXT;

-- 3. RAM — ej: "4GB", "8GB", "12GB" (puede ser null para accesorios/refacciones)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS ram TEXT;

-- 4. ALMACENAMIENTO — ej: "128GB", "256GB", "512GB"
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS almacenamiento TEXT;

-- 5. FOLIO DE REMISIÓN — referencia al ticket del proveedor
--    Permite agrupar todos los equipos de una misma compra
--    Ejemplo: "WINDCEL-19/11/2025" o "WINDCEL-6066-W-20260210"
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS folio_remision TEXT;

-- Índice para agrupar/buscar por remisión
CREATE INDEX IF NOT EXISTS idx_productos_folio_remision
  ON productos (folio_remision)
  WHERE folio_remision IS NOT NULL;

-- ==============================================================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- ==============================================================================
-- Para equipos ya ingresados: si tienen codigo_barras con 15 dígitos (es un IMEI),
-- migrar ese valor al nuevo campo imei y limpiar codigo_barras si corresponde.
-- NOTA: Solo migra si el campo imei está vacío para no sobrescribir datos nuevos.
-- ==============================================================================

UPDATE productos
SET imei = codigo_barras
WHERE
  imei IS NULL
  AND codigo_barras IS NOT NULL
  AND codigo_barras ~ '^\d{15}$'
  AND tipo IN ('equipo_nuevo', 'equipo_usado');

-- Para los equipos migrados, limpiar el codigo_barras (ya que ahora está en imei)
-- OPCIONAL — comentar esta línea si quieren mantener ambos por compatibilidad:
-- UPDATE productos
-- SET codigo_barras = NULL
-- WHERE imei IS NOT NULL AND codigo_barras = imei;

-- ==============================================================================
-- EXTRAER color/almacenamiento de descripcion (best-effort para datos históricos)
-- Solo aplica a los productos donde la descripción tiene el patrón guardado por
-- el ImportRemisionModal antiguo: "Color · ALMACENAMIENTO · IMEI: xxx"
-- ==============================================================================

-- Extraer almacenamiento de descripcion si sigue el patrón "· XXXgb" o "· XXXGB"
UPDATE productos
SET almacenamiento = (
  regexp_match(descripcion, '(\d+GB)', 'i')
)[1]
WHERE
  almacenamiento IS NULL
  AND descripcion IS NOT NULL
  AND descripcion ~ '\d+GB'
  AND tipo IN ('equipo_nuevo', 'equipo_usado');

-- ==============================================================================
-- COMENTARIO FINAL
-- ==============================================================================
-- Después de aplicar esta migración, el TypeScript en:
--   - src/types/index.ts → agregar imei, color, ram, almacenamiento, folioRemision
--   - src/lib/db/productos.ts → mapear nuevos campos en create/update/mappers
--   - src/lib/utils/marcas-kb.ts → base de conocimiento de marcas (ya creado)
--   - src/components/productos/ImportRemisionModal.tsx → parser reescrito
-- ==============================================================================
