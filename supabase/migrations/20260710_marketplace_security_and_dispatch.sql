-- S.O.S marketplace security and dispatch foundation
-- Generated 2026-07-10. Review in a Supabase branch before production merge.

begin;

-- ---------------------------------------------------------------------------
-- Identity helpers used by RLS and marketplace RPCs.
-- These are SECURITY INVOKER functions and only resolve the signed-in user.
-- ---------------------------------------------------------------------------
create or replace function public.sos_current_user_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id
  from public.sos_users
  where auth_id = auth.uid()
  limit 1
$$;

create or replace function public.sos_current_hero_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select h.id
  from public.sos_heroes h
  join public.sos_users u on u.id = h.user_id
  where u.auth_id = auth.uid()
  limit 1
$$;

revoke all on function public.sos_current_user_id() from public, anon;
revoke all on function public.sos_current_hero_id() from public, anon;
grant execute on function public.sos_current_user_id() to authenticated;
grant execute on function public.sos_current_hero_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on every marketplace table that was exposed without protection.
-- ---------------------------------------------------------------------------
alter table public.sos_categories enable row level security;
alter table public.sos_subcategories enable row level security;
alter table public.sos_mission_events enable row level security;
alter table public.sos_mission_offers enable row level security;
alter table public.sos_proof_of_service enable row level security;
alter table public.sos_disputes enable row level security;
alter table public.sos_safety_events enable row level security;
alter table public.sos_hero_earnings enable row level security;
alter table public.sos_pricing_rules enable row level security;
alter table public.sos_push_tokens enable row level security;
alter table public.sos_trip_shares enable row level security;
alter table public.sos_fleet_accounts enable row level security;
alter table public.sos_fleet_members enable row level security;
alter table public.sos_partner_shops enable row level security;
alter table public.sos_service_zones enable row level security;
alter table public.sos_hero_tiers enable row level security;
alter table public.sos_hero_certifications enable row level security;
alter table public.sos_hero_equipment enable row level security;
alter table public.sos_hero_availability enable row level security;
alter table public.sos_fleet_vehicles enable row level security;

-- Public, non-sensitive marketplace catalogs.
drop policy if exists "Public read active SOS categories" on public.sos_categories;
create policy "Public read active SOS categories"
on public.sos_categories for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Public read active SOS subcategories" on public.sos_subcategories;
create policy "Public read active SOS subcategories"
on public.sos_subcategories for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Public read active SOS pricing" on public.sos_pricing_rules;
create policy "Public read active SOS pricing"
on public.sos_pricing_rules for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Public read active SOS zones" on public.sos_service_zones;
create policy "Public read active SOS zones"
on public.sos_service_zones for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Public read active SOS partner shops" on public.sos_partner_shops;
create policy "Public read active SOS partner shops"
on public.sos_partner_shops for select
to anon, authenticated
using (coalesce(is_active, true));

drop policy if exists "Authenticated read SOS hero tiers" on public.sos_hero_tiers;
create policy "Authenticated read SOS hero tiers"
on public.sos_hero_tiers for select
to authenticated
using (true);

-- Provider-owned operational records.
drop policy if exists "Heroes manage own SOS equipment" on public.sos_hero_equipment;
create policy "Heroes manage own SOS equipment"
on public.sos_hero_equipment for all
to authenticated
using (hero_id = public.sos_current_hero_id())
with check (hero_id = public.sos_current_hero_id());

drop policy if exists "Heroes manage own SOS availability" on public.sos_hero_availability;
create policy "Heroes manage own SOS availability"
on public.sos_hero_availability for all
to authenticated
using (hero_id = public.sos_current_hero_id())
with check (hero_id = public.sos_current_hero_id());

drop policy if exists "Heroes manage own SOS certifications" on public.sos_hero_certifications;
create policy "Heroes manage own SOS certifications"
on public.sos_hero_certifications for all
to authenticated
using (hero_id = public.sos_current_hero_id())
with check (hero_id = public.sos_current_hero_id());

drop policy if exists "Heroes manage own SOS fleet vehicles" on public.sos_fleet_vehicles;
create policy "Heroes manage own SOS fleet vehicles"
on public.sos_fleet_vehicles for all
to authenticated
using (hero_id = public.sos_current_hero_id())
with check (hero_id = public.sos_current_hero_id());

drop policy if exists "Heroes read own SOS earnings" on public.sos_hero_earnings;
create policy "Heroes read own SOS earnings"
on public.sos_hero_earnings for select
to authenticated
using (hero_id = public.sos_current_hero_id());

-- Mission participant access.
drop policy if exists "Mission participants read SOS offers" on public.sos_mission_offers;
create policy "Mission participants read SOS offers"
on public.sos_mission_offers for select
to authenticated
using (
  hero_id = public.sos_current_hero_id()
  or exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and m.citizen_id = public.sos_current_user_id()
  )
);

drop policy if exists "Mission participants read SOS events" on public.sos_mission_events;
create policy "Mission participants read SOS events"
on public.sos_mission_events for select
to authenticated
using (
  exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (
        m.citizen_id = public.sos_current_user_id()
        or m.hero_id = public.sos_current_hero_id()
      )
  )
);

drop policy if exists "Mission participants read SOS proof" on public.sos_proof_of_service;
create policy "Mission participants read SOS proof"
on public.sos_proof_of_service for select
to authenticated
using (
  exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (
        m.citizen_id = public.sos_current_user_id()
        or m.hero_id = public.sos_current_hero_id()
      )
  )
);

drop policy if exists "Assigned heroes submit SOS proof" on public.sos_proof_of_service;
create policy "Assigned heroes submit SOS proof"
on public.sos_proof_of_service for insert
to authenticated
with check (
  hero_id = public.sos_current_hero_id()
  and exists (
    select 1 from public.sos_missions m
    where m.id = mission_id and m.hero_id = public.sos_current_hero_id()
  )
);

drop policy if exists "Assigned heroes update SOS proof" on public.sos_proof_of_service;
create policy "Assigned heroes update SOS proof"
on public.sos_proof_of_service for update
to authenticated
using (hero_id = public.sos_current_hero_id())
with check (hero_id = public.sos_current_hero_id());

drop policy if exists "Mission participants read SOS disputes" on public.sos_disputes;
create policy "Mission participants read SOS disputes"
on public.sos_disputes for select
to authenticated
using (
  exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (
        m.citizen_id = public.sos_current_user_id()
        or m.hero_id = public.sos_current_hero_id()
      )
  )
);

drop policy if exists "Mission participants open SOS disputes" on public.sos_disputes;
create policy "Mission participants open SOS disputes"
on public.sos_disputes for insert
to authenticated
with check (
  opened_by = public.sos_current_user_id()
  and exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (
        m.citizen_id = public.sos_current_user_id()
        or m.hero_id = public.sos_current_hero_id()
      )
  )
);

drop policy if exists "Mission participants read SOS safety events" on public.sos_safety_events;
create policy "Mission participants read SOS safety events"
on public.sos_safety_events for select
to authenticated
using (
  triggered_by = public.sos_current_user_id()
  or exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (
        m.citizen_id = public.sos_current_user_id()
        or m.hero_id = public.sos_current_hero_id()
      )
  )
);

drop policy if exists "Users report own SOS safety events" on public.sos_safety_events;
create policy "Users report own SOS safety events"
on public.sos_safety_events for insert
to authenticated
with check (
  triggered_by = public.sos_current_user_id()
  and (
    mission_id is null
    or exists (
      select 1 from public.sos_missions m
      where m.id = mission_id
        and (
          m.citizen_id = public.sos_current_user_id()
          or m.hero_id = public.sos_current_hero_id()
        )
    )
  )
);

-- Device tokens and trip shares contain private data.
drop policy if exists "Users manage own SOS push tokens" on public.sos_push_tokens;
create policy "Users manage own SOS push tokens"
on public.sos_push_tokens for all
to authenticated
using (user_id = public.sos_current_user_id())
with check (user_id = public.sos_current_user_id());

drop policy if exists "Users manage own SOS trip shares" on public.sos_trip_shares;
create policy "Users manage own SOS trip shares"
on public.sos_trip_shares for all
to authenticated
using (shared_by = public.sos_current_user_id())
with check (
  shared_by = public.sos_current_user_id()
  and exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (
        m.citizen_id = public.sos_current_user_id()
        or m.hero_id = public.sos_current_hero_id()
      )
  )
);

-- Fleet account isolation.
drop policy if exists "Fleet owners manage own SOS fleet" on public.sos_fleet_accounts;
create policy "Fleet owners manage own SOS fleet"
on public.sos_fleet_accounts for all
to authenticated
using (owner_id = public.sos_current_user_id())
with check (owner_id = public.sos_current_user_id());

drop policy if exists "Fleet members read own SOS membership" on public.sos_fleet_members;
create policy "Fleet members read own SOS membership"
on public.sos_fleet_members for select
to authenticated
using (
  user_id = public.sos_current_user_id()
  or exists (
    select 1 from public.sos_fleet_accounts f
    where f.id = fleet_id and f.owner_id = public.sos_current_user_id()
  )
);

drop policy if exists "Fleet owners manage SOS members" on public.sos_fleet_members;
create policy "Fleet owners manage SOS members"
on public.sos_fleet_members for all
to authenticated
using (
  exists (
    select 1 from public.sos_fleet_accounts f
    where f.id = fleet_id and f.owner_id = public.sos_current_user_id()
  )
)
with check (
  exists (
    select 1 from public.sos_fleet_accounts f
    where f.id = fleet_id and f.owner_id = public.sos_current_user_id()
  )
);

-- Direct client writes to assignment tables are forbidden. Assignment happens
-- through the atomic RPCs below.
revoke insert, update, delete on public.sos_mission_offers from anon, authenticated;
revoke insert, update, delete on public.sos_mission_events from anon, authenticated;

create unique index if not exists sos_mission_offers_mission_hero_uidx
  on public.sos_mission_offers (mission_id, hero_id);
create index if not exists sos_mission_offers_hero_status_idx
  on public.sos_mission_offers (hero_id, status, expires_at);
create index if not exists sos_missions_dispatch_idx
  on public.sos_missions (status, subcategory_id, created_at);

-- ---------------------------------------------------------------------------
-- Atomic offer acceptance. The mission row is locked before assignment so two
-- heroes cannot accept the same roadside mission.
-- ---------------------------------------------------------------------------
create or replace function public.sos_accept_mission_offer(p_offer_id uuid)
returns setof public.sos_missions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.sos_mission_offers%rowtype;
  v_mission public.sos_missions%rowtype;
  v_hero_id uuid := public.sos_current_hero_id();
begin
  if auth.uid() is null or v_hero_id is null then
    raise exception 'Authenticated hero required' using errcode = '42501';
  end if;

  select * into v_offer
  from public.sos_mission_offers
  where id = p_offer_id
  for update;

  if not found or v_offer.hero_id <> v_hero_id then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  if v_offer.status <> 'offered' then
    raise exception 'Offer is no longer available';
  end if;

  if v_offer.expires_at is not null and v_offer.expires_at <= now() then
    update public.sos_mission_offers
      set status = 'expired', responded_at = now()
      where id = p_offer_id;
    raise exception 'Offer expired';
  end if;

  select * into v_mission
  from public.sos_missions
  where id = v_offer.mission_id
  for update;

  if v_mission.hero_id is not null
     or v_mission.status not in ('requested', 'matching') then
    update public.sos_mission_offers
      set status = 'expired', responded_at = now()
      where id = p_offer_id;
    raise exception 'Mission already assigned';
  end if;

  update public.sos_mission_offers
    set status = 'accepted', responded_at = now()
    where id = p_offer_id;

  update public.sos_mission_offers
    set status = 'expired', responded_at = coalesce(responded_at, now())
    where mission_id = v_offer.mission_id
      and id <> p_offer_id
      and status = 'offered';

  update public.sos_missions
    set hero_id = v_hero_id,
        status = 'accepted',
        matched_at = coalesce(matched_at, now()),
        accepted_at = now(),
        eta_minutes = v_offer.eta_minutes,
        updated_at = now()
    where id = v_offer.mission_id;

  insert into public.sos_mission_events
    (mission_id, event_type, old_status, new_status, payload, actor)
  values
    (v_offer.mission_id, 'offer_accepted', v_mission.status, 'accepted',
     jsonb_build_object('offer_id', p_offer_id, 'hero_id', v_hero_id),
     'hero');

  return query
  select * from public.sos_missions where id = v_offer.mission_id;
end;
$$;

create or replace function public.sos_decline_mission_offer(
  p_offer_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hero_id uuid := public.sos_current_hero_id();
  v_updated integer;
begin
  if auth.uid() is null or v_hero_id is null then
    raise exception 'Authenticated hero required' using errcode = '42501';
  end if;

  update public.sos_mission_offers
    set status = 'declined',
        responded_at = now(),
        decline_reason = nullif(trim(p_reason), '')
    where id = p_offer_id
      and hero_id = v_hero_id
      and status = 'offered';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.sos_dispatch_mission(
  p_mission_id uuid,
  p_radius_miles double precision default 15,
  p_offer_ttl_seconds integer default 45
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.sos_missions%rowtype;
  v_count integer := 0;
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_mission
  from public.sos_missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found' using errcode = 'P0002';
  end if;

  if auth.role() <> 'service_role'
     and v_mission.citizen_id <> public.sos_current_user_id() then
    raise exception 'Not authorized for mission' using errcode = '42501';
  end if;

  if v_mission.hero_id is not null
     or v_mission.status not in ('requested', 'matching') then
    raise exception 'Mission cannot be dispatched from status %', v_mission.status;
  end if;

  update public.sos_missions
    set status = 'matching', updated_at = now()
    where id = p_mission_id;

  insert into public.sos_mission_offers
    (mission_id, hero_id, score, distance_miles, eta_minutes,
     payout_amount, status, offered_at, expires_at)
  select
    p_mission_id,
    candidate.hero_id,
    greatest(0, 100 - (candidate.distance_miles * 2) + (coalesce(candidate.rating, 0) * 5)),
    candidate.distance_miles,
    candidate.eta_minutes,
    round(coalesce(v_mission.estimated_price, 0) * 0.75, 2),
    'offered',
    now(),
    now() + make_interval(secs => greatest(15, least(p_offer_ttl_seconds, 180)))
  from public.sos_find_nearby_heroes(
    v_mission.pickup_lat,
    v_mission.pickup_lng,
    greatest(1, least(p_radius_miles, 50)),
    v_mission.subcategory_id
  ) candidate
  on conflict (mission_id, hero_id) do update
    set score = excluded.score,
        distance_miles = excluded.distance_miles,
        eta_minutes = excluded.eta_minutes,
        payout_amount = excluded.payout_amount,
        status = 'offered',
        offered_at = excluded.offered_at,
        expires_at = excluded.expires_at,
        responded_at = null,
        decline_reason = null;

  get diagnostics v_count = row_count;

  insert into public.sos_mission_events
    (mission_id, event_type, old_status, new_status, payload, actor)
  values
    (p_mission_id, 'dispatch_started', v_mission.status, 'matching',
     jsonb_build_object('offers_created', v_count, 'radius_miles', p_radius_miles),
     case when auth.role() = 'service_role' then 'system' else 'citizen' end);

  return v_count;
end;
$$;

revoke all on function public.sos_accept_mission_offer(uuid) from public, anon;
revoke all on function public.sos_decline_mission_offer(uuid, text) from public, anon;
revoke all on function public.sos_dispatch_mission(uuid, double precision, integer) from public, anon;
grant execute on function public.sos_accept_mission_offer(uuid) to authenticated;
grant execute on function public.sos_decline_mission_offer(uuid, text) to authenticated;
grant execute on function public.sos_dispatch_mission(uuid, double precision, integer) to authenticated;

-- Do not expose raw nearby-provider locations or trigger functions as RPCs.
revoke all on function public.sos_find_nearby_heroes(double precision, double precision, double precision, text)
  from public, anon, authenticated;
revoke all on function public.sos_handle_new_user() from public, anon, authenticated;

alter function public.sos_find_nearby_heroes(double precision, double precision, double precision, text)
  set search_path = public;
alter function public.sos_update_hero_rating() set search_path = public;
alter function public.sos_update_timestamp() set search_path = public;

-- Keep auth signup behavior, but stop auto-confirming email from a database trigger.
create or replace function public.sos_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sos_users (auth_id, email, role, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'citizen'),
    lower(substring(md5(new.id::text) from 1 for 8))
  );
  return new;
exception when others then
  raise warning 'sos_handle_new_user failed for %: % [%]', new.email, sqlerrm, sqlstate;
  return new;
end;
$$;
revoke all on function public.sos_handle_new_user() from public, anon, authenticated;

-- Operational views must never inherit the creator's privileges for API users.
alter view public.sos_v_live_ops set (security_invoker = true);
alter view public.sos_v_hero_leaderboard set (security_invoker = true);
alter view public.sos_v_daily_stats set (security_invoker = true);
revoke all on public.sos_v_live_ops from anon, authenticated;
revoke all on public.sos_v_hero_leaderboard from anon, authenticated;
revoke all on public.sos_v_daily_stats from anon, authenticated;

commit;
