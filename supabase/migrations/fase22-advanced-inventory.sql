-- ==============================================================================
-- FASE 22: INVENTARIO AVANZADO
-- Fecha: 2026-02-15
-- Descripción: Implementación de Categorías, Proveedores y Mejoras en Productos
-- Alineado con: CREDIPHONE-DOCUMENTO-MAESTRO-FINAL-COMPLETO.md
-- ==============================================================================

-- 1. Crear tabla CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distribuidor_id UUID NOT NULL REFERENCES distribuidores(id),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para Categorias
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation: Categorias" ON categorias
    USING (distribuidor_id = (SELECT distribuidor_id FROM users WHERE id = auth.uid()) OR (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin');

-- 2. Crear tabla PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distribuidor_id UUID NOT NULL REFERENCES distribuidores(id),
    nombre VARCHAR(100) NOT NULL,
    contacto VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    rfc VARCHAR(20),
    direccion TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para Proveedores
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation: Proveedores" ON proveedores
    USING (distribuidor_id = (SELECT distribuidor_id FROM users WHERE id = auth.uid()) OR (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin');


-- 3. Actualizar tabla PRODUCTOS con nuevos campos del Documento Maestro
ALTER TABLE productos 
    ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias(id),
    ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id),
    ADD COLUMN IF NOT EXISTS costo DECIMAL(10,2) DEFAULT 0.00, -- Precio Compra
    ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS stock_maximo INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'accesorio', -- pieza_reparacion, equipo_nuevo, etc.
    ADD COLUMN IF NOT EXISTS es_serializado BOOLEAN DEFAULT false, -- Requiere IMEI/Serie
    ADD COLUMN IF NOT EXISTS ubicacion_fisica VARCHAR(100); -- Estante A1, etc.

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos(tipo);

-- Insertar Categorías por Defecto para el Distribuidor Default (si existe)
DO $$
DECLARE
    default_dist_id UUID;
BEGIN
    SELECT id INTO default_dist_id FROM distribuidores WHERE slug = 'default';
    
    IF default_dist_id IS NOT NULL THEN
        -- Insertar solo si no existen para evitar duplicados en re-runs
        IF NOT EXISTS (SELECT 1 FROM categorias WHERE distribuidor_id = default_dist_id AND nombre = 'Celulares') THEN
            INSERT INTO categorias (distribuidor_id, nombre) VALUES
                (default_dist_id, 'Celulares'),
                (default_dist_id, 'Accesorios'),
                (default_dist_id, 'Cargadores'),
                (default_dist_id, 'Fundas'),
                (default_dist_id, 'Audio / Bocinas'),
                (default_dist_id, 'Refacciones / Piezas'),
                (default_dist_id, 'Micas / Protectores');
        END IF;
    END IF;
END $$;
