-- =====================================================
-- FASE 21 Part 2: Tenant Isolation for Inventory
-- =====================================================

DO $$
DECLARE
  default_dist_id UUID;
BEGIN
  -- Get default distributor ID
  SELECT id INTO default_dist_id FROM distribuidores WHERE slug = 'default';
  
  -- If not found (should not happen if part 1 ran), create it or fail
  IF default_dist_id IS NULL THEN
    RAISE EXCEPTION 'Default distributor not found. Run Phase 21 Part 1 first.';
  END IF;

  -- 1. UBICACIONES_INVENTARIO
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ubicaciones_inventario') THEN
    ALTER TABLE ubicaciones_inventario 
    ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

    UPDATE ubicaciones_inventario 
    SET distribuidor_id = default_dist_id
    WHERE distribuidor_id IS NULL;

    ALTER TABLE ubicaciones_inventario 
    ALTER COLUMN distribuidor_id SET NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_ubicaciones_distribuidor ON ubicaciones_inventario(distribuidor_id);
  END IF;

  -- 2. VERIFICACIONES_INVENTARIO
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'verificaciones_inventario') THEN
    ALTER TABLE verificaciones_inventario 
    ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

    UPDATE verificaciones_inventario 
    SET distribuidor_id = default_dist_id
    WHERE distribuidor_id IS NULL;

    ALTER TABLE verificaciones_inventario 
    ALTER COLUMN distribuidor_id SET NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_verificaciones_distribuidor ON verificaciones_inventario(distribuidor_id);
  END IF;

  -- 3. VERIFICACIONES_ITEMS
  -- (Optional: Items belong to Verification, so implicitly isolated, but good for direct queries)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'verificaciones_items') THEN
    ALTER TABLE verificaciones_items 
    ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

    UPDATE verificaciones_items 
    SET distribuidor_id = default_dist_id
    WHERE distribuidor_id IS NULL;

    ALTER TABLE verificaciones_items 
    ALTER COLUMN distribuidor_id SET NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_verificaciones_items_distribuidor ON verificaciones_items(distribuidor_id);
  END IF;

  -- 4. ALERTAS_PRODUCTOS_NUEVOS
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'alertas_productos_nuevos') THEN
    ALTER TABLE alertas_productos_nuevos 
    ADD COLUMN IF NOT EXISTS distribuidor_id UUID REFERENCES distribuidores(id);

    UPDATE alertas_productos_nuevos 
    SET distribuidor_id = default_dist_id
    WHERE distribuidor_id IS NULL;

    ALTER TABLE alertas_productos_nuevos 
    ALTER COLUMN distribuidor_id SET NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_alertas_distribuidor ON alertas_productos_nuevos(distribuidor_id);
  END IF;

END $$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- UBICACIONES
ALTER TABLE ubicaciones_inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation: Ubicaciones" ON ubicaciones_inventario;
CREATE POLICY "Tenant Isolation: Ubicaciones" ON ubicaciones_inventario
FOR ALL TO authenticated
USING (
  distribuidor_id = (SELECT distribuidor_id FROM users WHERE id = auth.uid()) OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- VERIFICACIONES
ALTER TABLE verificaciones_inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation: Verificaciones" ON verificaciones_inventario;
CREATE POLICY "Tenant Isolation: Verificaciones" ON verificaciones_inventario
FOR ALL TO authenticated
USING (
  distribuidor_id = (SELECT distribuidor_id FROM users WHERE id = auth.uid()) OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- VERIFICACIONES ITEMS
ALTER TABLE verificaciones_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation: Verificaciones Items" ON verificaciones_items;
CREATE POLICY "Tenant Isolation: Verificaciones Items" ON verificaciones_items
FOR ALL TO authenticated
USING (
  distribuidor_id = (SELECT distribuidor_id FROM users WHERE id = auth.uid()) OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);

-- ALERTAS
ALTER TABLE alertas_productos_nuevos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation: Alertas" ON alertas_productos_nuevos;
CREATE POLICY "Tenant Isolation: Alertas" ON alertas_productos_nuevos
FOR ALL TO authenticated
USING (
  distribuidor_id = (SELECT distribuidor_id FROM users WHERE id = auth.uid()) OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'
);
