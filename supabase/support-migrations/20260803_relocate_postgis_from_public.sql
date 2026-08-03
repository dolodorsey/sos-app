-- SUPPORT-ONLY MIGRATION — DO NOT APPLY THROUGH NORMAL SUPABASE MIGRATIONS.
--
-- Supabase Support must execute this file with supabase_admin privileges.
-- The project migration role cannot alter public.spatial_ref_sys because it is
-- owned by the PostGIS extension owner. The whole operation is transactional.

begin;

create schema if not exists extensions;

do $$
declare
  v_version text;
begin
  if current_user <> 'supabase_admin' then
    raise exception 'Support-only migration: current_user must be supabase_admin, got %', current_user;
  end if;

  select extversion into strict v_version
  from pg_extension
  where extname = 'postgis';

  if (select extnamespace::regnamespace::text from pg_extension where extname='postgis') = 'extensions' then
    raise notice 'PostGIS is already installed in extensions; no relocation required.';
    return;
  end if;

  update pg_extension
  set extrelocatable = true
  where extname = 'postgis';

  alter extension postgis set schema extensions;

  execute format('alter extension postgis update to %I', v_version || 'next');
  alter extension postgis update;

  update pg_extension
  set extrelocatable = false
  where extname = 'postgis';
end
$$;

grant usage on schema extensions to anon, authenticated, service_role;

-- SOS explicitly schema-qualified PostGIS functions as public.*. Recreate the
-- one application function that depends on those names inside this same
-- transaction, using the new extension schema.
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
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
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
    h.id,
    h.user_id,
    u.first_name,
    u.last_name,
    h.rating,
    h.level,
    round((
      extensions.st_distancesphere(
        extensions.st_makepoint(h.last_lng, h.last_lat),
        extensions.st_makepoint(p_lng, p_lat)
      ) / 1609.34
    )::numeric, 1)::double precision,
    ceil((
      extensions.st_distancesphere(
        extensions.st_makepoint(h.last_lng, h.last_lat),
        extensions.st_makepoint(p_lng, p_lat)
      ) / 1609.34
    ) * 3)::integer,
    h.last_lat,
    h.last_lng
  from public.sos_heroes h
  join public.sos_users u on u.id = h.user_id
  where h.on_duty = true
    and h.verification_status = 'verified'
    and u.status = 'active'
    and u.auth_id is not null
    and h.last_lat is not null
    and h.last_lng is not null
    and h.last_gps_at >= now() - interval '15 minutes'
    and extensions.st_distancesphere(
      extensions.st_makepoint(h.last_lng, h.last_lat),
      extensions.st_makepoint(p_lng, p_lat)
    ) <= p_radius_miles * 1609.34
    and (p_subcategory is null or p_subcategory = any(h.services_enabled))
  order by distance_miles asc
  limit 10;
end;
$function$;

do $$
begin
  if (select extnamespace::regnamespace::text from pg_extension where extname='postgis') <> 'extensions' then
    raise exception 'PostGIS relocation validation failed';
  end if;

  perform extensions.st_transform(
    extensions.st_setsrid(extensions.st_makepoint(-84.388, 33.749), 4326),
    3857
  );

  perform count(*)
  from public.sos_find_nearby_heroes(33.749, -84.388, 15, null);
end
$$;

commit;
