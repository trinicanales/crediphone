-- Reversa de fase92 (K2). Ejecutar solo si hay que deshacer.
select cron.unschedule('kpi-snapshot-diario');
drop function if exists public.kpi_snapshot_dia(date);
drop function if exists public.kpi_resumen_semana(uuid, date);
drop function if exists public.kpi_stock_bajo(uuid);
drop function if exists public.kpi_dinero(uuid, timestamptz, timestamptz);
drop function if exists public.kpi_taller(uuid);
drop view if exists public.v_ordenes_antiguedad;
drop function if exists public.semaforo_orden(text, integer);
drop table if exists public.kpi_snapshots;
-- El job 'notificaciones-hora' estaba roto (función inexistente); NO se restaura.
-- Si se quisiera: select cron.schedule('notificaciones-hora', '0 * * * *', 'SELECT public.generar_notificaciones_automaticas();');
