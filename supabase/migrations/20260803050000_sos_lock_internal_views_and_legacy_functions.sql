begin;

-- These views contain operational, identity, location, and financial data.
-- Keep them available to server-side operations only and make their execution
-- context explicit so future grants cannot silently bypass underlying RLS.
create or replace view public.sos_v_live_ops
with (security_invoker = true)
as
select
  m.id as mission_id,
  m.status,
  m.subcategory_id,
  sc.name as service_name,
  m.pickup_address,
  m.estimated_price,
  m.surge_multiplier,
  (u_c.first_name || ' ' || u_c.last_name) as citizen_name,
  (u_h.first_name || ' ' || u_h.last_name) as hero_name,
  h.rating as hero_rating,
  m.eta_minutes,
  m.created_at,
  extract(epoch from now() - m.created_at) / 60::numeric as minutes_since_created
from public.sos_missions m
left join public.sos_users u_c on m.citizen_id = u_c.id
left join public.sos_heroes h on m.hero_id = h.id
left join public.sos_users u_h on h.user_id = u_h.id
left join public.sos_subcategories sc on m.subcategory_id = sc.id
where m.status <> all(array[
  'completed'::text,
  'canceled_by_citizen'::text,
  'canceled_by_hero'::text,
  'canceled_by_system'::text
])
order by m.created_at desc;

create or replace view public.sos_v_hero_leaderboard
with (security_invoker = true)
as
select
  h.id as hero_id,
  (u.first_name || ' ' || u.last_name) as name,
  h.level,
  h.rating,
  h.total_missions,
  h.completion_rate,
  h.on_time_rate,
  h.badges,
  h.zone,
  h.on_duty
from public.sos_heroes h
join public.sos_users u on h.user_id = u.id
where h.verification_status = 'verified'
order by h.rating desc, h.total_missions desc;

create or replace view public.sos_v_daily_stats
with (security_invoker = true)
as
select
  date(m.created_at) as day,
  count(*) as total_missions,
  count(*) filter (where m.status = 'completed') as completed,
  count(*) filter (where m.status like 'canceled%') as canceled,
  count(*) filter (where m.status = 'disputed') as disputed,
  round(avg(extract(epoch from m.accepted_at - m.created_at) / 60::numeric), 1) as avg_time_to_accept_min,
  round(avg(extract(epoch from m.arrived_at - m.en_route_at) / 60::numeric), 1) as avg_time_to_arrive_min,
  round(avg(m.final_price), 2) as avg_price,
  round(sum(m.final_price), 2) as total_gmv
from public.sos_missions m
where m.created_at >= now() - interval '30 days'
group by date(m.created_at)
order by date(m.created_at) desc;

revoke all on public.sos_v_live_ops from public, anon, authenticated;
revoke all on public.sos_v_hero_leaderboard from public, anon, authenticated;
revoke all on public.sos_v_daily_stats from public, anon, authenticated;
grant select on public.sos_v_live_ops to service_role, postgres;
grant select on public.sos_v_hero_leaderboard to service_role, postgres;
grant select on public.sos_v_daily_stats to service_role, postgres;

create or replace function public.sos_update_timestamp()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.sos_update_hero_rating()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hero_id uuid;
begin
  select h.id into v_hero_id
  from public.sos_heroes h
  where h.user_id = new.rated_user
  limit 1;

  if v_hero_id is null then
    return new;
  end if;

  update public.sos_heroes h
  set rating = coalesce((
        select round(avg(r.rating)::numeric, 1)
        from public.sos_ratings r
        where r.rated_user = new.rated_user
      ), h.rating),
      total_missions = (
        select count(*)
        from public.sos_missions m
        where m.hero_id = v_hero_id
          and m.status = 'completed'
      ),
      updated_at = now()
  where h.id = v_hero_id;

  return new;
end;
$$;

create or replace function public.sos_find_nearby_heroes(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision default 15,
  p_subcategory text default null
)
returns table(
  hero_id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  rating numeric,
  level text,
  distance_miles double precision,
  eta_minutes integer,
  lat double precision,
  lng double precision
)
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_lat is null or p_lat < -90 or p_lat > 90 then
    raise exception 'Invalid latitude';
  end if;
  if p_lng is null or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid longitude';
  end if;
  if p_radius_miles is null or p_radius_miles <= 0 or p_radius_miles > 50 then
    raise exception 'Radius must be greater than 0 and no more than 50 miles';
  end if;

  return query
  select
    h.id as hero_id,
    h.user_id,
    u.first_name,
    u.last_name,
    h.rating,
    h.level,
    round((public.st_distancesphere(
      public.st_makepoint(h.last_lng, h.last_lat),
      public.st_makepoint(p_lng, p_lat)
    ) / 1609.34)::numeric, 1)::double precision as distance_miles,
    ceil((public.st_distancesphere(
      public.st_makepoint(h.last_lng, h.last_lat),
      public.st_makepoint(p_lng, p_lat)
    ) / 1609.34) * 3)::integer as eta_minutes,
    h.last_lat as lat,
    h.last_lng as lng
  from public.sos_heroes h
  join public.sos_users u on h.user_id = u.id
  where h.on_duty = true
    and h.verification_status = 'verified'
    and u.status = 'active'
    and h.last_lat is not null
    and h.last_lng is not null
    and h.last_gps_at >= now() - interval '15 minutes'
    and public.st_distancesphere(
      public.st_makepoint(h.last_lng, h.last_lat),
      public.st_makepoint(p_lng, p_lat)
    ) <= p_radius_miles * 1609.34
    and (p_subcategory is null or p_subcategory = any(h.services_enabled))
  order by distance_miles asc
  limit 10;
end;
$$;

-- Trigger functions do not need to be callable as public RPCs.
revoke all on function public.sos_update_timestamp() from public, anon, authenticated;
revoke all on function public.sos_update_hero_rating() from public, anon, authenticated;
grant execute on function public.sos_update_timestamp() to service_role, postgres;
grant execute on function public.sos_update_hero_rating() to service_role, postgres;

-- Exact provider coordinates remain server-only.
revoke all on function public.sos_find_nearby_heroes(double precision,double precision,double precision,text)
from public, anon, authenticated;
grant execute on function public.sos_find_nearby_heroes(double precision,double precision,double precision,text)
to service_role, postgres;

-- Remove direct browser access to PostGIS metadata and privileged estimator
-- helpers while leaving server-side geospatial operations intact.
revoke all on table public.spatial_ref_sys from public, anon, authenticated;
grant select on table public.spatial_ref_sys to service_role, postgres;
revoke execute on function public.st_estimatedextent(text,text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.st_estimatedextent(text,text) to service_role, postgres;
grant execute on function public.st_estimatedextent(text,text,text) to service_role, postgres;
grant execute on function public.st_estimatedextent(text,text,text,boolean) to service_role, postgres;

commit;
