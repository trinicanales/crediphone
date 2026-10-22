-- fase92: KPIs en la base de datos (K2). ADITIVA: no modifica tablas existentes.
-- Rollback: supabase/migrations/fase92-kpis-sql-ROLLBACK.sql
-- Acceso: solo service_role (la app usa createAdminClient). Nada para anon/authenticated.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Semáforo por estado (umbrales aprobados por Trini 2026-10-20: 7 / 5 / 3 días)
--    listo_entrega sin recoger: 7 · presupuesto sin respuesta: 3 · resto sin movimiento: 5
--    rojo = alcanzó el umbral; ámbar = a partir de la mitad del umbral; verde = antes.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.semaforo_orden(p_estado text, p_dias integer)
returns text
language sql
immutable
as $f$
  select case
    when p_dias >= (case p_estado when 'listo_entrega' then 7 when 'presupuesto' then 3 else 5 end) then 'rojo'
    when p_dias >= ceil((case p_estado when 'listo_entrega' then 7 when 'presupuesto' then 3 else 5 end) / 2.0) then 'ambar'
    else 'verde'
  end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vista de antigüedad de órdenes activas (días en el estado actual y totales)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_ordenes_antiguedad
with (security_invoker = true) as
select
  o.id,
  o.folio,
  o.distribuidor_id,
  o.estado,
  o.fecha_recepcion,
  greatest(0, floor(extract(epoch from (now() - coalesce(h.ultimo_cambio, o.fecha_recepcion))) / 86400))::int as dias_en_estado,
  greatest(0, floor(extract(epoch from (now() - o.fecha_recepcion)) / 86400))::int as dias_totales,
  public.semaforo_orden(
    o.estado,
    greatest(0, floor(extract(epoch from (now() - coalesce(h.ultimo_cambio, o.fecha_recepcion))) / 86400))::int
  ) as semaforo
from public.ordenes_reparacion o
left join lateral (
  select max(x.created_at) as ultimo_cambio
  from public.historial_estado_orden x
  where x.orden_id = o.id and x.estado_nuevo = o.estado
) h on true
where o.estado in ('recibido','diagnostico','esperando_piezas','presupuesto','aprobado','en_reparacion','completado','listo_entrega');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. kpi_taller(p_dist): órdenes por estado con semáforo, piezas y anticipos sin aplicar
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.kpi_taller(p_dist uuid default null)
returns jsonb
language sql
stable
as $f$
  select jsonb_build_object(
    'por_estado', coalesce((
      select jsonb_object_agg(estado, jsonb_build_object(
        'total', n, 'verde', verdes, 'ambar', ambares, 'rojo', rojos, 'max_dias', max_dias))
      from (
        select estado,
               count(*) as n,
               count(*) filter (where semaforo = 'verde') as verdes,
               count(*) filter (where semaforo = 'ambar') as ambares,
               count(*) filter (where semaforo = 'rojo')  as rojos,
               max(dias_en_estado) as max_dias
        from public.v_ordenes_antiguedad
        where p_dist is null or distribuidor_id = p_dist
        group by estado
      ) t
    ), '{}'::jsonb),
    'activas', (select count(*) from public.v_ordenes_antiguedad where p_dist is null or distribuidor_id = p_dist),
    'piezas', jsonb_build_object(
      'por_pedir', (select count(*) from public.pedidos_pieza_reparacion p
                    join public.v_ordenes_antiguedad a on a.id = p.orden_id
                    where p.estado = 'pendiente' and (p_dist is null or a.distribuidor_id = p_dist)),
      'en_camino', (select count(*) from public.pedidos_pieza_reparacion p
                    join public.v_ordenes_antiguedad a on a.id = p.orden_id
                    where p.estado = 'en_camino' and (p_dist is null or a.distribuidor_id = p_dist)),
      'atrasadas', (select count(*) from public.pedidos_pieza_reparacion p
                    join public.v_ordenes_antiguedad a on a.id = p.orden_id
                    where p.estado in ('pendiente','en_camino')
                      and p.fecha_estimada_llegada is not null and p.fecha_estimada_llegada < now()
                      and (p_dist is null or a.distribuidor_id = p_dist))
    ),
    'anticipos_sin_aplicar_en_cerradas', (
      select jsonb_build_object('cantidad', count(*), 'monto', coalesce(sum(a.monto), 0))
      from public.anticipos_reparacion a
      join public.ordenes_reparacion o on o.id = a.orden_id
      where a.estado = 'pendiente' and o.estado in ('entregado','cancelado','no_reparable')
        and (p_dist is null or o.distribuidor_id = p_dist)
    )
  )
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. kpi_dinero(p_dist, desde, hasta): dinero real que entró/salió en el rango
--    (anticipos + cobros de reparación + ventas POS completadas + pagos − devoluciones)
--    y servicios entregados (precio total). caja_movimientos casi nunca trae distribuidor_id
--    y no tiene FK a la sesión: se filtra por las sesiones de caja de la sucursal.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.kpi_dinero(p_dist uuid, p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language sql
stable
as $f$
  with mov as (
    select m.tipo, m.monto
    from public.caja_movimientos m
    where m.created_at >= p_desde and m.created_at < p_hasta
      and m.tipo in ('entrada_anticipo','cobro_reparacion','devolucion_anticipo')
      and (p_dist is null
           or m.distribuidor_id = p_dist
           or m.sesion_id in (select s.id from public.caja_sesiones s where s.distribuidor_id = p_dist))
  ),
  v as (
    select coalesce(sum(total), 0) as total, count(*) as n
    from public.ventas
    where estado = 'completada' and fecha_venta >= p_desde and fecha_venta < p_hasta
      and (p_dist is null or distribuidor_id = p_dist)
  ),
  pg as (
    select coalesce(sum(monto), 0) as total
    from public.pagos
    where fecha_pago >= p_desde and fecha_pago < p_hasta
      and (p_dist is null or distribuidor_id = p_dist)
  ),
  ent as (
    select coalesce(sum(coalesce(nullif(precio_total, 0), costo_total, 0)), 0) as total, count(*) as n
    from public.ordenes_reparacion
    where estado = 'entregado' and fecha_entregado >= p_desde and fecha_entregado < p_hasta
      and (p_dist is null or distribuidor_id = p_dist)
  )
  select jsonb_build_object(
    'anticipos',     coalesce((select sum(monto) from mov where tipo = 'entrada_anticipo'), 0),
    'cobros',        coalesce((select sum(monto) from mov where tipo = 'cobro_reparacion'), 0),
    'devoluciones',  coalesce((select sum(monto) from mov where tipo = 'devolucion_anticipo'), 0),
    'ventas_pos',    (select total from v),
    'ventas_n',      (select n from v),
    'pagos',         (select total from pg),
    'dinero_neto',   coalesce((select sum(monto) from mov where tipo in ('entrada_anticipo','cobro_reparacion')), 0)
                     - coalesce((select sum(monto) from mov where tipo = 'devolucion_anticipo'), 0)
                     + (select total from v) + (select total from pg),
    'entregado',     (select total from ent),
    'entregadas_n',  (select n from ent)
  )
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. kpi_stock_bajo(p_dist): productos activos en o bajo el mínimo (mínimo por defecto 1) y negativos
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.kpi_stock_bajo(p_dist uuid default null)
returns jsonb
language sql
stable
as $f$
  select jsonb_build_object(
    'bajo_o_agotado', count(*) filter (where stock <= case when coalesce(stock_minimo, 0) > 0 then stock_minimo else 1 end),
    'agotados',       count(*) filter (where stock = 0),
    'negativos',      count(*) filter (where stock < 0)
  )
  from public.productos
  where activo and (p_dist is null or distribuidor_id = p_dist)
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. kpi_resumen_semana(p_dist, p_fin): 7 días (hora de México) que terminan en p_fin, inclusive
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.kpi_resumen_semana(p_dist uuid default null, p_fin date default null)
returns jsonb
language sql
stable
as $f$
  with r as (
    select
      (coalesce(p_fin, (now() at time zone 'America/Mexico_City')::date) - 6)::timestamp at time zone 'America/Mexico_City' as desde,
      (coalesce(p_fin, (now() at time zone 'America/Mexico_City')::date) + 1)::timestamp at time zone 'America/Mexico_City' as hasta,
      coalesce(p_fin, (now() at time zone 'America/Mexico_City')::date) as fin
  ),
  ent as (
    select o.*
    from public.ordenes_reparacion o, r
    where o.estado = 'entregado' and o.fecha_entregado >= r.desde and o.fecha_entregado < r.hasta
      and (p_dist is null or o.distribuidor_id = p_dist)
  ),
  apr as (
    select count(*) filter (where o.aprobado_por_cliente) as aprobadas,
           count(*) filter (where o.aprobado_por_cliente or o.estado = 'cancelado') as con_decision
    from public.ordenes_reparacion o, r
    where o.requiere_aprobacion and o.fecha_recepcion >= r.desde and o.fecha_recepcion < r.hasta
      and (p_dist is null or o.distribuidor_id = p_dist)
  )
  select jsonb_build_object(
    'desde', (select (desde at time zone 'America/Mexico_City')::date from r),
    'hasta', (select fin from r),
    'recibidas', (select count(*) from public.ordenes_reparacion o, r
                  where o.fecha_recepcion >= r.desde and o.fecha_recepcion < r.hasta
                    and (p_dist is null or o.distribuidor_id = p_dist)),
    'entregadas', (select count(*) from ent),
    'canceladas', (select count(*) from public.ordenes_reparacion o, r
                   where o.estado = 'cancelado' and o.updated_at >= r.desde and o.updated_at < r.hasta
                     and (p_dist is null or o.distribuidor_id = p_dist)),
    'dinero', public.kpi_dinero(p_dist, (select desde from r), (select hasta from r)),
    'ticket_promedio', coalesce((select round(avg(coalesce(nullif(precio_total, 0), costo_total, 0))::numeric, 2) from ent), 0),
    'ciclo_promedio_dias', coalesce((select round(avg(extract(epoch from (fecha_entregado - fecha_recepcion)) / 86400)::numeric, 1)
                                     from ent where fecha_recepcion is not null), 0),
    'aprobacion_presupuestos_pct', (select case when con_decision > 0 then round(100.0 * aprobadas / con_decision, 1) end from apr)
  )
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Registro diario de KPIs (tendencias sin recalcular)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  distribuidor_id uuid not null,
  datos jsonb not null,
  created_at timestamptz not null default now(),
  unique (fecha, distribuidor_id)
);
alter table public.kpi_snapshots enable row level security;
-- Sin políticas: solo service_role.

create or replace function public.kpi_snapshot_dia(p_fecha date default null)
returns integer
language plpgsql
as $f$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Mexico_City')::date);
  v_desde timestamptz := v_fecha::timestamp at time zone 'America/Mexico_City';
  v_hasta timestamptz := (v_fecha + 1)::timestamp at time zone 'America/Mexico_City';
  d record;
  n integer := 0;
begin
  for d in select id from public.distribuidores loop
    insert into public.kpi_snapshots (fecha, distribuidor_id, datos)
    values (
      v_fecha, d.id,
      jsonb_build_object(
        'taller', public.kpi_taller(d.id),
        'dinero', public.kpi_dinero(d.id, v_desde, v_hasta),
        'stock', public.kpi_stock_bajo(d.id),
        'recibidas', (select count(*) from public.ordenes_reparacion o
                      where o.distribuidor_id = d.id and o.fecha_recepcion >= v_desde and o.fecha_recepcion < v_hasta),
        'entregadas', (select count(*) from public.ordenes_reparacion o
                       where o.distribuidor_id = d.id and o.estado = 'entregado'
                         and o.fecha_entregado >= v_desde and o.fecha_entregado < v_hasta)
      )
    )
    on conflict (fecha, distribuidor_id) do update set datos = excluded.datos, created_at = now();
    n := n + 1;
  end loop;
  return n;
end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Permisos: solo service_role
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.semaforo_orden(text, integer) from public, anon, authenticated;
revoke all on function public.kpi_taller(uuid) from public, anon, authenticated;
revoke all on function public.kpi_dinero(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.kpi_stock_bajo(uuid) from public, anon, authenticated;
revoke all on function public.kpi_resumen_semana(uuid, date) from public, anon, authenticated;
revoke all on function public.kpi_snapshot_dia(date) from public, anon, authenticated;
revoke all on public.v_ordenes_antiguedad from public, anon, authenticated;
revoke all on public.kpi_snapshots from public, anon, authenticated;
grant execute on function public.semaforo_orden(text, integer) to service_role;
grant execute on function public.kpi_taller(uuid) to service_role;
grant execute on function public.kpi_dinero(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.kpi_stock_bajo(uuid) to service_role;
grant execute on function public.kpi_resumen_semana(uuid, date) to service_role;
grant execute on function public.kpi_snapshot_dia(date) to service_role;
grant select on public.v_ordenes_antiguedad to service_role;
grant select, insert, update, delete on public.kpi_snapshots to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Cron: snapshot diario a las 23:55 hora de México (05:55 UTC) y retiro del job roto
--    (notificaciones-hora llamaba a public.generar_notificaciones_automaticas(), que ya no existe:
--    fallaba cada hora, 6,641 fallos registrados).
-- ─────────────────────────────────────────────────────────────────────────────
select cron.unschedule('notificaciones-hora');
select cron.schedule('kpi-snapshot-diario', '55 5 * * *', $c$ select public.kpi_snapshot_dia(); $c$);

-- fase92b (aplicada aparte): fijar search_path en las funciones nuevas
alter function public.semaforo_orden(text, integer) set search_path = public, pg_temp;
alter function public.kpi_taller(uuid) set search_path = public, pg_temp;
alter function public.kpi_dinero(uuid, timestamptz, timestamptz) set search_path = public, pg_temp;
alter function public.kpi_stock_bajo(uuid) set search_path = public, pg_temp;
alter function public.kpi_resumen_semana(uuid, date) set search_path = public, pg_temp;
alter function public.kpi_snapshot_dia(date) set search_path = public, pg_temp;
