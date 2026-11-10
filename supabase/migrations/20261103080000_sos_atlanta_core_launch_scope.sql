-- S.O.S. Atlanta core launch (Nov 2026)
-- Launch scope: five core roadside services, metro Atlanta only, pay-per-service.
-- Every other subcategory stays visible in the catalog but cannot be booked.
-- Enforced in the database so every client (current web, App Store builds
-- already in the field, legacy routes) gets the same answer.

-- 1. Bookability flag on the catalog -------------------------------------
alter table public.sos_subcategories
  add column if not exists is_bookable boolean not null default false,
  add column if not exists availability_note text;

update public.sos_subcategories
set is_bookable = (id in ('tow','fuel','jump','flat','lockout')),
    availability_note = case
      when id in ('tow','fuel','jump','flat','lockout') then null
      else 'Not available yet'
    end;

comment on column public.sos_subcategories.is_bookable is
  'True only for services customers can request right now. Inactive-for-launch services keep is_active=true so they stay visible as "Not available yet".';

-- 2. Service markets (geofence) -----------------------------------------
create table if not exists public.sos_service_markets (
  id text primary key,
  name text not null,
  min_lat double precision not null,
  max_lat double precision not null,
  min_lng double precision not null,
  max_lng double precision not null,
  is_active boolean not null default true,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  check (min_lat < max_lat and min_lng < max_lng)
);

alter table public.sos_service_markets enable row level security;

drop policy if exists "Public can read S.O.S. service markets" on public.sos_service_markets;
create policy "Public can read S.O.S. service markets"
  on public.sos_service_markets for select
  to anon, authenticated
  using (true);

grant select on public.sos_service_markets to anon, authenticated;

-- Metro Atlanta: roughly Cartersville/Canton/Cumming to the north,
-- Newnan/Griffin/McDonough to the south, Douglasville to Covington east-west.
insert into public.sos_service_markets (id, name, min_lat, max_lat, min_lng, max_lng, is_active, launched_at)
values ('atl', 'Metro Atlanta, GA', 33.30, 34.30, -84.90, -83.80, true, now())
on conflict (id) do update
  set name = excluded.name,
      min_lat = excluded.min_lat, max_lat = excluded.max_lat,
      min_lng = excluded.min_lng, max_lng = excluded.max_lng,
      is_active = excluded.is_active;

create or replace function public.sos_market_for_point(p_lat double precision, p_lng double precision)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select m.id
  from public.sos_service_markets m
  where m.is_active
    and p_lat between m.min_lat and m.max_lat
    and p_lng between m.min_lng and m.max_lng
  order by m.launched_at nulls last
  limit 1;
$$;

grant execute on function public.sos_market_for_point(double precision, double precision) to anon, authenticated;

-- 3. Enforcement on every customer-created mission ----------------------
create or replace function public.sos_enforce_launch_scope()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_service public.sos_subcategories%rowtype;
begin
  -- Service-role / operator paths run without an end-user JWT: not gated.
  if auth.uid() is null then
    return new;
  end if;

  if new.subcategory_id is null then
    raise exception 'Choose a live S.O.S. service: Towing, Fuel Delivery, Jump Start, Flat Tire Help or Lockout.'
      using errcode = 'P0001';
  end if;

  select * into v_service from public.sos_subcategories where id = new.subcategory_id;

  if not found or not coalesce(v_service.is_active, true) or not v_service.is_bookable then
    raise exception '% is not available yet. S.O.S. currently offers Towing, Fuel Delivery, Jump Start, Flat Tire Help and Lockout.',
      coalesce(v_service.name, 'This service')
      using errcode = 'P0001';
  end if;

  if new.pickup_lat is null or new.pickup_lng is null then
    raise exception 'Precise location is required for roadside dispatch.' using errcode = 'P0001';
  end if;

  if public.sos_market_for_point(new.pickup_lat, new.pickup_lng) is null then
    raise exception 'S.O.S. is live in metro Atlanta only right now. We are not dispatching to your location yet.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists sos_missions_enforce_launch_scope on public.sos_missions;
create trigger sos_missions_enforce_launch_scope
  before insert on public.sos_missions
  for each row execute function public.sos_enforce_launch_scope();

-- 4. Shield memberships are paused for v1 (pay-per-service only) --------
do $$
begin
  if to_regclass('public.sos_membership_plans') is not null then
    update public.sos_membership_plans set is_active = false where is_active;
  end if;
end $$;
