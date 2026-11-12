-- Aplicada 2026-11-11 (Supabase MCP). La vista expone sueldo y comision de TODAS las tiendas; el codigo no la usa.
REVOKE ALL ON public.empleados_activos FROM anon, authenticated;
-- La funcion solo la llama el servidor con service_role.
REVOKE EXECUTE ON FUNCTION public.calcular_comision_vendedor(uuid, date, date) FROM PUBLIC, anon, authenticated;
