-- =====================================================
-- FASE 21: Sistema Multi-Distribuidor (Sub-distribuidoras)
-- =====================================================
-- Objetivo: Transformar el sistema Single-Tenant a Multi-Tenant
-- 1. Crear tabla 'distribuidores'
-- 2. Migrar datos existentes a un distribuidor "Default"
-- 3. Aislar datos mediante 'distribuidor_id' en todas las tablas
-- 4. Actualizar RLS Policies para seguridad
-- =====================================================

-- 1. Crear tabla 'distribuidores'
CREATE TABLE IF NOT EXISTS distribuidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- Identificador único para URLs o lógica interna
  logo_url TEXT,
  activo BOOLEAN DEFAULT true,
  configuracion JSONB DEFAULT '{}'::jsonb, -- Configuración específica override
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insertar Distribuidor Default (si no existe)
-- Usamos DO block para evitar duplicados si se corre múltiples veces
DO $$
DECLARE
  default_dist_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM distribuidores WHERE slug = 'default') THEN
    INSERT INTO distribuidores (nombre, slug, activo)
    VALUES ('CREDIPHONE Principal', 'default', true)
    RETURNING id INTO default_dist_id;
  ELSE
    SELECT id INTO default_dist_id FROM distribuidores WHERE slug = 'default';
  END IF;

  -- =====================================================
  -- 3. Funciones Helper para migrar tablas
  -- =====================================================
  
  -- Función para agregar columna distribuidor_id y migrar datos
  -- Argumentos: tabla, default_id
  -- NOTA: Se hace bloque por bloque porque PL/pgSQL no permite DDL dinámico complejo fácilmente en una función simple
  -- Procedemos tabla por tabla manualmente para mayor control y seguridad
END $$;

-- Capturar el ID del default para usarlo en las migraciones
-- (En SQL puro no podemos usar variables entre bloques fácilmente, así que usaremos una subquery constante)

-- =====================================================
-- 4. Migración de Tablas (Agregar distribuidor_id)
-- =====================================================

-- 4.1 USERS (Empleados)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE users 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE users 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_distribuidor ON users(distribuidor_id);

-- 4.2 CLIENTES
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE clientes 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE clientes 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_distribuidor ON clientes(distribuidor_id);

-- 4.3 PRODUCTOS (Inventario)
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE productos 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE productos 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_productos_distribuidor ON productos(distribuidor_id);

-- 4.4 CREDITOS
ALTER TABLE creditos 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE creditos 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE creditos 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creditos_distribuidor ON creditos(distribuidor_id);

-- 4.5 PAGOS
ALTER TABLE pagos 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE pagos 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE pagos 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_distribuidor ON pagos(distribuidor_id);

-- 4.6 CAJA_SESIONES
ALTER TABLE caja_sesiones 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE caja_sesiones 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE caja_sesiones 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caja_sesiones_distribuidor ON caja_sesiones(distribuidor_id);

-- 4.7 VENTAS
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE ventas 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE ventas 
ALTER COLUMN distribuidor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_distribuidor ON ventas(distribuidor_id);

-- 4.8 REPARACIONES
-- Verificamos si existe la tabla reparaciones antes de alterar
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reparaciones') THEN
    ALTER TABLE reparaciones 
    ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

    UPDATE reparaciones 
    SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
    WHERE distribuidor_id IS NULL;

    ALTER TABLE reparaciones 
    ALTER COLUMN distribuidor_id SET NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_reparaciones_distribuidor ON reparaciones(distribuidor_id);
  END IF;
END $$;

-- 4.9 CONFIGURACION
-- La tabla configuracion es especial, era singleton. Ahora debe ser única por distribuidor.
ALTER TABLE configuracion 
ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

UPDATE configuracion 
SET distribuidor_id = (SELECT id FROM distribuidores WHERE slug = 'default')
WHERE distribuidor_id IS NULL;

ALTER TABLE configuracion 
ALTER COLUMN distribuidor_id SET NOT NULL;

-- Eliminar restricción singleton si existía (probablemente por código o índice único sin columnas)
-- Crear restricción única por distribuidor_id
ALTER TABLE configuracion
ADD CONSTRAINT unq_configuracion_distribuidor UNIQUE (distribuidor_id);


-- =====================================================
-- 5. Actualizar RLS Policies (Row Level Security)
-- =====================================================
-- NOTA: Esto es un ejemplo base. En producción se requiere una función helper 
-- "get_current_user_distribuidor_id()" para performance y seguridad.

-- Habilitar RLS en tabla distribuidores
ALTER TABLE distribuidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin ve todo" ON distribuidores
FOR ALL
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

CREATE POLICY "Usuarios ven su propio distribuidor" ON distribuidores
FOR SELECT
TO authenticated
USING (
  id = (SELECT distribuidor_id FROM users WHERE id = auth.uid())
);

-- Lógica standard de RLS para tablas tenant
-- "Usuario ve filas donde distribuidor_id coincide con SU distribuidor_id"

-- Función auxiliar para obtener el ID del distribuidor del usuario actual
CREATE OR REPLACE FUNCTION get_my_distribuidor_id()
RETURNS UUID AS $$
  SELECT distribuidor_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Aplicar a CLIENTES (Ejemplo, replicar para otras tablas)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver clientes" ON clientes;
CREATE POLICY "Tenant Isolation: Clientes" ON clientes
FOR ALL
TO authenticated
USING (
  distribuidor_id = get_my_distribuidor_id() OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- Aplicar a PRODUCTOS
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver productos" ON productos;
CREATE POLICY "Tenant Isolation: Productos" ON productos
FOR ALL
TO authenticated
USING (
  distribuidor_id = get_my_distribuidor_id() OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- Aplicar a CREDITOS
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver creditos" ON creditos;
CREATE POLICY "Tenant Isolation: Creditos" ON creditos
FOR ALL
TO authenticated
USING (
  distribuidor_id = get_my_distribuidor_id() OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- Aplicar a VENTAS
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver ventas" ON ventas;
CREATE POLICY "Tenant Isolation: Ventas" ON ventas
FOR ALL
TO authenticated
USING (
  distribuidor_id = get_my_distribuidor_id() OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- Aplicar a CAJA_SESIONES
DROP POLICY IF EXISTS "Usuarios ven sus propias sesiones de caja" ON caja_sesiones;
CREATE POLICY "Tenant Isolation: Caja Sesiones" ON caja_sesiones
FOR ALL
TO authenticated
USING (
  distribuidor_id = get_my_distribuidor_id() OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- Aplicar a USERS (Empleados)
-- Un usuario solo debe ver empleados de su mismo distribuidor
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver otros usuarios" ON users;
CREATE POLICY "Tenant Isolation: Users" ON users
FOR SELECT
TO authenticated
USING (
  distribuidor_id = get_my_distribuidor_id() OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- =====================================================
-- 6. Trigger para Auto-Asignar Distribuidor (Opcional pero recomendado)
-- =====================================================
-- Al insertar, si no viene distribuidor_id, se asigna el del usuario creador (si aplica)
-- Por ahora lo dejamos manual desde el backend para mayor control.

-- Fin de migración
