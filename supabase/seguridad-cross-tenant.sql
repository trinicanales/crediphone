-- =====================================================
-- SEGURIDAD: Auditoría Cross-Tenant — Técnicos, Vendedores y Empleados
-- Aplicado: 2026-05-30
-- =====================================================
-- Brechas identificadas y corregidas:
-- 1. obtener_tecnico_disponible() — asignaba técnicos de cualquier distribuidor
-- 2. obtener_carga_tecnicos() — no filtraba técnicos por distribuidor
-- 3. GET /api/empleados/vendedores — retornaba vendedores de todos los distribuidores
-- 4. GET/PUT/DELETE /api/empleados/[id] — sin validación de propiedad cross-tenant
-- 5. POST /api/reparaciones/[id]/asignar-tecnico — consultaba tabla inexistente (empleados)
-- =====================================================

-- =====================================================
-- FIX 1: obtener_tecnico_disponible con filtro de distribuidor
-- =====================================================
-- Antes: sin parámetros, asignaba técnicos globalmente
-- Ahora: acepta p_distribuidor_id, retorna NULL si no hay técnico local
-- NULL es manejado en TypeScript: orden queda sin técnico asignado (no excepción)

DROP FUNCTION IF EXISTS obtener_tecnico_disponible();
DROP FUNCTION IF EXISTS obtener_tecnico_disponible(uuid);

CREATE OR REPLACE FUNCTION public.obtener_tecnico_disponible(p_distribuidor_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  tecnico_id_resultado UUID;
  total_tecnicos INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tecnicos
  FROM public.users
  WHERE role = 'tecnico' AND activo = true
    AND (p_distribuidor_id IS NULL OR distribuidor_id = p_distribuidor_id);

  IF total_tecnicos = 0 THEN
    RETURN NULL;  -- Sin técnico disponible, la orden queda sin asignar
  END IF;

  IF total_tecnicos = 1 THEN
    SELECT id INTO tecnico_id_resultado
    FROM public.users
    WHERE role = 'tecnico' AND activo = true
      AND (p_distribuidor_id IS NULL OR distribuidor_id = p_distribuidor_id)
    LIMIT 1;
    RETURN tecnico_id_resultado;
  END IF;

  -- Round-robin: técnico con menos carga, solo del mismo distribuidor
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

COMMENT ON FUNCTION obtener_tecnico_disponible IS 'Asigna técnico del mismo distribuidor por round-robin. Retorna NULL si no hay técnico disponible en esa franquicia.';

-- =====================================================
-- FIX 2: obtener_carga_tecnicos con filtro de distribuidor
-- =====================================================
-- Antes: retornaba técnicos globales (o versión buggy que usaba tabla "empleados" inexistente)
-- Ahora: filtra por distribuidor usando u.distribuidor_id directamente
-- NOTA: NO existe tabla public.empleados — los empleados están en public.users

DROP FUNCTION IF EXISTS obtener_carga_tecnicos();
DROP FUNCTION IF EXISTS obtener_carga_tecnicos(uuid);

CREATE OR REPLACE FUNCTION public.obtener_carga_tecnicos(p_distribuidor_id UUID DEFAULT NULL)
RETURNS TABLE(
  tecnico_id UUID,
  nombre_tecnico TEXT,
  ordenes_activas BIGINT,
  ordenes_recibidas BIGINT,
  ordenes_diagnostico BIGINT,
  ordenes_en_reparacion BIGINT,
  ordenes_completadas_hoy BIGINT
)
LANGUAGE plpgsql STABLE AS $$
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
$$;

COMMENT ON FUNCTION obtener_carga_tecnicos IS 'Retorna carga de técnicos filtrada por distribuidor. Usa public.users (no existe tabla empleados).';

-- =====================================================
-- NOTA: Fixes en capa TypeScript (API Routes)
-- =====================================================
-- Los siguientes fixes son en código TypeScript (no SQL):
--
-- Fix 3 — src/app/api/empleados/vendedores/route.ts:
--   Antes: getEmpleadosPorRol("vendedor")  ← retornaba todos los distribuidores
--   Ahora: getEmpleadosPorRol("vendedor", distribuidorId)
--
-- Fix 4 — src/app/api/empleados/[id]/route.ts (GET, PUT, DELETE):
--   Agregado: ownership check contra users.distribuidor_id antes de operar
--   Si el empleado no pertenece al distribuidor del admin → 404
--
-- Fix 5 — src/app/api/reparaciones/[id]/asignar-tecnico/route.ts:
--   Bug: .from("empleados").eq("user_id", body.tecnicoId)  ← tabla no existe
--   Fix: .from("users").eq("id", body.tecnicoId)  ← correcto
--
-- Fix en src/lib/db/reparaciones.ts:
--   Antes: supabase.rpc("obtener_tecnico_disponible")
--   Ahora: supabase.rpc("obtener_tecnico_disponible", { p_distribuidor_id: distribuidorId || null })
