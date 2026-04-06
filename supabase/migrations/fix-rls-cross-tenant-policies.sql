-- ============================================================
-- MIGRACIÓN: fix-rls-cross-tenant-policies
-- Corrige 17 políticas RLS con acceso cross-tenant o anónimo
-- Aplicada: 2026-04-06
-- Bug: RLS-001 (ya tenían RLS habilitado, pero políticas mal diseñadas)
-- ============================================================

-- ============================================================
-- FASE A: Acceso anónimo — tablas críticas
-- ============================================================

-- 1. tracking_tokens: remover acceso anónimo, agregar distribuidor isolation
DROP POLICY IF EXISTS "Tracking tokens públicos" ON public.tracking_tokens;
CREATE POLICY "tracking_tokens_distribuidor" ON public.tracking_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_reparacion o
      WHERE o.id = tracking_tokens.orden_id
        AND (o.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 2. scoring_clientes: remover acceso anónimo/público, agregar distribuidor isolation
DROP POLICY IF EXISTS "Scoring acceso público" ON public.scoring_clientes;
CREATE POLICY "scoring_distribuidor_isolation" ON public.scoring_clientes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = scoring_clientes.cliente_id
        AND (c.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 3. historial_scoring: remover acceso anónimo/público, agregar distribuidor isolation
DROP POLICY IF EXISTS "Historial scoring acceso público" ON public.historial_scoring;
CREATE POLICY "historial_scoring_distribuidor_isolation" ON public.historial_scoring
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = historial_scoring.cliente_id
        AND (c.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- ============================================================
-- FASE B: Cross-tenant para usuarios autenticados
-- ============================================================

-- 4. ordenes_reparacion: reemplazar SELECT true + ALL sin distribuidor
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver órdenes" ON public.ordenes_reparacion;
DROP POLICY IF EXISTS "Solo admins/técnicos pueden modificar órdenes" ON public.ordenes_reparacion;
CREATE POLICY "ordenes_select_distribuidor" ON public.ordenes_reparacion
  FOR SELECT TO authenticated
  USING (distribuidor_id = get_user_distribuidor_id() OR is_super_admin());
CREATE POLICY "ordenes_modify_roles_distribuidor" ON public.ordenes_reparacion
  FOR ALL TO authenticated
  USING (
    (distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'tecnico', 'recepcion', 'super_admin')
    )
  );

-- 5. clientes: eliminar políticas genéricas (Tenant Isolation ALL ya cubre todo)
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear clientes" ON public.clientes;

-- 6. creditos: eliminar overrides que anulan el tenant isolation
DROP POLICY IF EXISTS "Usuarios pueden ver créditos relacionados" ON public.creditos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar créditos" ON public.creditos;
DROP POLICY IF EXISTS "Vendedores pueden crear créditos" ON public.creditos;

-- 7. productos: eliminar acceso público que anula tenant isolation
DROP POLICY IF EXISTS "Todos pueden ver productos" ON public.productos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar productos" ON public.productos;

-- 8. notificaciones: reemplazar 4 políticas genéricas con distribuidor isolation
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear notificaciones" ON public.notificaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar notificaciones" ON public.notificaciones;
CREATE POLICY "notificaciones_distribuidor_isolation" ON public.notificaciones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = notificaciones.cliente_id
        AND (c.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 9. anticipos_reparacion: reemplazar SELECT genérico con distribuidor isolation
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver anticipos" ON public.anticipos_reparacion;
CREATE POLICY "anticipos_select_distribuidor" ON public.anticipos_reparacion
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_reparacion o
      WHERE o.id = anticipos_reparacion.orden_id
        AND (o.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 10. historial_estado_orden: reemplazar SELECT genérico con distribuidor isolation
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver historial de estado" ON public.historial_estado_orden;
CREATE POLICY "historial_estado_distribuidor" ON public.historial_estado_orden
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_reparacion o
      WHERE o.id = historial_estado_orden.orden_id
        AND (o.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 11. imagenes_reparacion: reemplazar SELECT genérico con distribuidor isolation
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver imagenes" ON public.imagenes_reparacion;
CREATE POLICY "imagenes_select_distribuidor" ON public.imagenes_reparacion
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_reparacion o
      WHERE o.id = imagenes_reparacion.orden_id
        AND (o.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 12. referencias_laborales: reemplazar 4 políticas genéricas con distribuidor isolation
DROP POLICY IF EXISTS "Referencias laborales visibles para autenticados" ON public.referencias_laborales;
DROP POLICY IF EXISTS "Crear referencias laborales autenticados" ON public.referencias_laborales;
DROP POLICY IF EXISTS "Actualizar referencias laborales autenticados" ON public.referencias_laborales;
DROP POLICY IF EXISTS "Eliminar referencias laborales autenticados" ON public.referencias_laborales;
CREATE POLICY "referencias_laborales_distribuidor" ON public.referencias_laborales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = referencias_laborales.cliente_id
        AND (c.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 13. referencias_personales: mismo fix
DROP POLICY IF EXISTS "Referencias personales visibles para autenticados" ON public.referencias_personales;
DROP POLICY IF EXISTS "Crear referencias personales autenticados" ON public.referencias_personales;
DROP POLICY IF EXISTS "Actualizar referencias personales autenticados" ON public.referencias_personales;
DROP POLICY IF EXISTS "Eliminar referencias personales autenticados" ON public.referencias_personales;
CREATE POLICY "referencias_personales_distribuidor" ON public.referencias_personales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = referencias_personales.cliente_id
        AND (c.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 14. sesiones_fotos_qr: mantener anon (validación QR sin login), fijar authenticated ALL
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar sesiones QR" ON public.sesiones_fotos_qr;
CREATE POLICY "sesiones_qr_distribuidor" ON public.sesiones_fotos_qr
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_reparacion o
      WHERE o.id = sesiones_fotos_qr.orden_id
        AND (o.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 15. garantias_reparacion: reemplazar SELECT genérico con distribuidor isolation
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver garantías" ON public.garantias_reparacion;
CREATE POLICY "garantias_select_distribuidor" ON public.garantias_reparacion
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes_reparacion o
      WHERE o.id = garantias_reparacion.orden_id
        AND (o.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 16. movimientos_ubicacion: reemplazar SELECT true con distribuidor isolation vía productos
DROP POLICY IF EXISTS "movimientos_select_all" ON public.movimientos_ubicacion;
CREATE POLICY "movimientos_select_distribuidor" ON public.movimientos_ubicacion
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.id = movimientos_ubicacion.producto_id
        AND (p.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );

-- 17. notificacion_preferencias: reemplazar políticas genéricas con distribuidor isolation
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver preferencias" ON public.notificacion_preferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar preferencias" ON public.notificacion_preferencias;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear preferencias" ON public.notificacion_preferencias;
CREATE POLICY "notif_preferencias_distribuidor" ON public.notificacion_preferencias
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = notificacion_preferencias.cliente_id
        AND (c.distribuidor_id = get_user_distribuidor_id() OR is_super_admin())
    )
  );
