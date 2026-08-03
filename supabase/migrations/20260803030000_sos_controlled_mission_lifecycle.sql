begin;

-- Preserve the customer's selected service and separate the untrusted client
-- display estimate from the server-owned mission estimate.
alter table public.sos_missions
  add column if not exists requested_service_name text,
  add column if not exists client_estimate_amount numeric,
  add column if not exists pricing_status text not null default 'manual_review',
  add column if not exists intake_payload jsonb not null default '{}'::jsonb;

alter table public.sos_missions
  drop constraint if exists sos_missions_pricing_status_check;
alter table public.sos_missions
  add constraint sos_missions_pricing_status_check
  check (pricing_status in ('starting_estimate','quote_required','manual_review','confirmed'));

alter table public.sos_missions
  drop constraint if exists sos_missions_client_estimate_nonnegative;
alter table public.sos_missions
  add constraint sos_missions_client_estimate_nonnegative
  check (client_estimate_amount is null or client_estimate_amount >= 0);

create or replace function public.sos_current_user_id()
returns uuid
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select id
  from public.sos_users
  where auth_id = (select auth.uid())
  limit 1
$$;

create or replace function public.sos_current_hero_id()
returns uuid
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select h.id
  from public.sos_heroes h
  join public.sos_users u on u.id = h.user_id
  where u.auth_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.sos_current_user_id() from public, anon;
revoke all on function public.sos_current_hero_id() from public, anon;
grant execute on function public.sos_current_user_id() to authenticated, service_role, postgres;
grant execute on function public.sos_current_hero_id() to authenticated, service_role, postgres;

create or replace function public.sos_prepare_new_mission()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id uuid := public.sos_current_user_id();
  v_sub public.sos_subcategories%rowtype;
  v_is_privileged boolean := current_user in ('postgres','service_role','supabase_admin');
begin
  if not v_is_privileged then
    if (select auth.uid()) is null or v_user_id is null then
      raise exception 'Authenticated S.O.S. customer required' using errcode = '42501';
    end if;
    if new.citizen_id is distinct from v_user_id then
      raise exception 'Mission citizen does not match signed-in customer' using errcode = '42501';
    end if;
  end if;

  new.client_estimate_amount := case
    when new.estimated_price is not null and new.estimated_price >= 0 then new.estimated_price
    else null
  end;

  if new.subcategory_id is not null then
    select * into v_sub
    from public.sos_subcategories
    where id = new.subcategory_id and coalesce(is_active,true)
    limit 1;
  elsif nullif(trim(coalesce(new.requested_service_name,'')),'') is not null then
    select * into v_sub
    from public.sos_subcategories
    where lower(trim(name)) = lower(trim(new.requested_service_name))
      and coalesce(is_active,true)
    order by sort_order nulls last
    limit 1;
  end if;

  if found then
    new.category_id := v_sub.category_id;
    new.subcategory_id := v_sub.id;
    new.requested_service_name := v_sub.name;
    if v_sub.price_model = 'quote_required' or new.request_type = 'quote' then
      new.estimated_price := null;
      new.pricing_status := 'quote_required';
    else
      new.estimated_price := greatest(coalesce(v_sub.base_fee, v_sub.min_fee, 0),0);
      new.pricing_status := 'starting_estimate';
    end if;
    new.intake_payload := coalesce(new.intake_payload,'{}'::jsonb) || jsonb_build_object(
      'pricing_source','sos_subcategories',
      'price_model',v_sub.price_model,
      'eta_disclaimer','Timing is not confirmed until assignment.'
    );
  else
    new.category_id := null;
    new.subcategory_id := null;
    new.estimated_price := null;
    new.pricing_status := 'manual_review';
  end if;

  new.status := 'requested';
  new.hero_id := null;
  new.final_price := null;
  new.surge_multiplier := 1.0;
  new.eta_minutes := null;
  new.matched_at := null;
  new.accepted_at := null;
  new.en_route_at := null;
  new.arrived_at := null;
  new.started_at := null;
  new.completed_at := null;
  new.canceled_at := null;
  new.cancel_reason := null;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.sos_prepare_new_mission() from public, anon, authenticated;
grant execute on function public.sos_prepare_new_mission() to service_role, postgres;

drop trigger if exists trg_sos_prepare_new_mission on public.sos_missions;
create trigger trg_sos_prepare_new_mission
before insert on public.sos_missions
for each row execute function public.sos_prepare_new_mission();

-- Remove broad client writes. Customers can create requests and read their own
-- records; every later lifecycle change is made through an audited RPC.
revoke all on public.sos_missions from anon;
revoke update, delete on public.sos_missions from authenticated;
grant select, insert on public.sos_missions to authenticated;

revoke all on public.sos_mission_offers from anon;
revoke insert, update, delete on public.sos_mission_offers from authenticated;
grant select on public.sos_mission_offers to authenticated;

revoke all on public.sos_mission_events from anon;
revoke insert, update, delete on public.sos_mission_events from authenticated;
grant select on public.sos_mission_events to authenticated;

revoke all on public.sos_payments from anon;
revoke insert, update, delete on public.sos_payments from authenticated;
grant select on public.sos_payments to authenticated;

revoke insert, delete on public.sos_heroes from anon, authenticated;
revoke update on public.sos_heroes from anon, authenticated;
grant select on public.sos_heroes to authenticated;
grant update (
  on_duty, zone, last_lat, last_lng, last_gps_at, services_enabled,
  tools_available, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
  vehicle_plate, updated_at
) on public.sos_heroes to authenticated;

-- Replace legacy PUBLIC policies with explicit authenticated participant rules.
drop policy if exists "Citizens create own missions" on public.sos_missions;
drop policy if exists "Citizens see own missions" on public.sos_missions;
drop policy if exists "Citizens update own missions" on public.sos_missions;
drop policy if exists "Heroes see assigned missions" on public.sos_missions;
drop policy if exists "Heroes update assigned missions" on public.sos_missions;
drop policy if exists "Service role full access missions" on public.sos_missions;

create policy "SOS customers create own requested missions"
on public.sos_missions for insert
to authenticated
with check (
  citizen_id = public.sos_current_user_id()
  and status = 'requested'
  and hero_id is null
  and final_price is null
);

create policy "SOS customers read own missions"
on public.sos_missions for select
to authenticated
using (citizen_id = public.sos_current_user_id());

create policy "SOS heroes read assigned missions"
on public.sos_missions for select
to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "sos_offers_hero_read" on public.sos_mission_offers;
drop policy if exists "Mission participants read SOS offers" on public.sos_mission_offers;
create policy "SOS mission participants read offers"
on public.sos_mission_offers for select
to authenticated
using (
  hero_id = public.sos_current_hero_id()
  or exists (
    select 1 from public.sos_missions m
    where m.id = mission_id and m.citizen_id = public.sos_current_user_id()
  )
);

drop policy if exists "Mission participants read SOS events" on public.sos_mission_events;
create policy "SOS mission participants read events"
on public.sos_mission_events for select
to authenticated
using (
  exists (
    select 1 from public.sos_missions m
    where m.id = mission_id
      and (m.citizen_id = public.sos_current_user_id() or m.hero_id = public.sos_current_hero_id())
  )
);

drop policy if exists "Users see own payments" on public.sos_payments;
drop policy if exists "Service role full access payments" on public.sos_payments;
create policy "SOS customers read own payments"
on public.sos_payments for select
to authenticated
using (citizen_id = public.sos_current_user_id());
create policy "SOS heroes read own payments"
on public.sos_payments for select
to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "Heroes read own profile" on public.sos_heroes;
drop policy if exists "Heroes update own profile" on public.sos_heroes;
drop policy if exists "Service role full access heroes" on public.sos_heroes;
create policy "SOS heroes read own profile"
on public.sos_heroes for select
to authenticated
using (id = public.sos_current_hero_id());
create policy "SOS heroes update safe own fields"
on public.sos_heroes for update
to authenticated
using (id = public.sos_current_hero_id())
with check (id = public.sos_current_hero_id());

create unique index if not exists sos_mission_offers_mission_hero_uidx
on public.sos_mission_offers(mission_id,hero_id);
create index if not exists sos_missions_citizen_status_created_idx
on public.sos_missions(citizen_id,status,created_at desc);
create index if not exists sos_missions_hero_status_created_idx
on public.sos_missions(hero_id,status,created_at desc)
where hero_id is not null;
create index if not exists sos_mission_events_mission_created_idx
on public.sos_mission_events(mission_id,created_at);

create or replace function public.sos_cancel_own_mission(
  p_mission_id uuid,
  p_reason text default null
)
returns public.sos_missions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id uuid := public.sos_current_user_id();
  v_mission public.sos_missions%rowtype;
begin
  if (select auth.uid()) is null or v_user_id is null then
    raise exception 'Authenticated customer required' using errcode = '42501';
  end if;

  select * into v_mission from public.sos_missions
  where id = p_mission_id and citizen_id = v_user_id
  for update;
  if not found then raise exception 'Mission not found' using errcode = 'P0002'; end if;
  if v_mission.status not in ('requested','matching') then
    raise exception 'Mission can no longer be self-canceled from status %',v_mission.status;
  end if;

  update public.sos_missions
  set status='canceled_by_citizen', canceled_at=now(),
      cancel_reason=nullif(trim(p_reason),''), updated_at=now()
  where id=p_mission_id
  returning * into v_mission;

  update public.sos_mission_offers
  set status='canceled', responded_at=coalesce(responded_at,now())
  where mission_id=p_mission_id and status='pending';

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'status_change',v_mission.status,'canceled_by_citizen',jsonb_build_object('reason',p_reason),'citizen');

  return v_mission;
end;
$$;

create or replace function public.sos_accept_mission_offer(p_offer_id uuid)
returns public.sos_missions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hero_id uuid := public.sos_current_hero_id();
  v_offer public.sos_mission_offers%rowtype;
  v_mission public.sos_missions%rowtype;
  v_old_status text;
begin
  if (select auth.uid()) is null or v_hero_id is null then
    raise exception 'Authenticated Hero required' using errcode = '42501';
  end if;

  select * into v_offer from public.sos_mission_offers
  where id=p_offer_id and hero_id=v_hero_id
  for update;
  if not found then raise exception 'Offer not found' using errcode='P0002'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is not pending'; end if;
  if v_offer.expires_at is not null and v_offer.expires_at <= now() then
    update public.sos_mission_offers set status='expired',responded_at=now() where id=p_offer_id;
    raise exception 'Offer expired';
  end if;

  select * into v_mission from public.sos_missions where id=v_offer.mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is not null or v_mission.status not in ('requested','matching') then
    update public.sos_mission_offers set status='expired',responded_at=now() where id=p_offer_id;
    raise exception 'Mission already assigned or unavailable';
  end if;

  v_old_status := v_mission.status;
  update public.sos_mission_offers set status='accepted',responded_at=now() where id=p_offer_id;
  update public.sos_mission_offers
  set status='expired',responded_at=coalesce(responded_at,now())
  where mission_id=v_offer.mission_id and id<>p_offer_id and status='pending';

  update public.sos_missions
  set hero_id=v_hero_id,status='assigned',matched_at=now(),accepted_at=now(),
      eta_minutes=v_offer.eta_minutes,updated_at=now()
  where id=v_offer.mission_id
  returning * into v_mission;

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(v_mission.id,'status_change',v_old_status,'assigned',jsonb_build_object('offer_id',p_offer_id,'hero_id',v_hero_id),'hero');

  return v_mission;
end;
$$;

create or replace function public.sos_decline_mission_offer(
  p_offer_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hero_id uuid := public.sos_current_hero_id();
  v_count integer;
begin
  if (select auth.uid()) is null or v_hero_id is null then
    raise exception 'Authenticated Hero required' using errcode='42501';
  end if;
  update public.sos_mission_offers
  set status='declined',responded_at=now(),decline_reason=nullif(trim(p_reason),'')
  where id=p_offer_id and hero_id=v_hero_id and status='pending';
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;

create or replace function public.sos_transition_assigned_mission(
  p_mission_id uuid,
  p_new_status text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_note text default null
)
returns public.sos_missions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hero_id uuid := public.sos_current_hero_id();
  v_mission public.sos_missions%rowtype;
  v_allowed boolean := false;
begin
  if (select auth.uid()) is null or v_hero_id is null then
    raise exception 'Authenticated Hero required' using errcode='42501';
  end if;

  select * into v_mission from public.sos_missions
  where id=p_mission_id and hero_id=v_hero_id
  for update;
  if not found then raise exception 'Assigned mission not found' using errcode='P0002'; end if;

  v_allowed :=
    (v_mission.status='assigned' and p_new_status in ('en_route','canceled_by_hero')) or
    (v_mission.status='en_route' and p_new_status in ('on_site','canceled_by_hero')) or
    (v_mission.status='on_site' and p_new_status in ('working','canceled_by_hero')) or
    (v_mission.status='working' and p_new_status in ('completed','canceled_by_hero'));
  if not v_allowed then
    raise exception 'Invalid mission transition: % -> %',v_mission.status,p_new_status;
  end if;

  update public.sos_missions
  set status=p_new_status,
      en_route_at=case when p_new_status='en_route' then now() else en_route_at end,
      arrived_at=case when p_new_status='on_site' then now() else arrived_at end,
      started_at=case when p_new_status='working' then now() else started_at end,
      completed_at=case when p_new_status='completed' then now() else completed_at end,
      canceled_at=case when p_new_status='canceled_by_hero' then now() else canceled_at end,
      cancel_reason=case when p_new_status='canceled_by_hero' then nullif(trim(p_note),'') else cancel_reason end,
      updated_at=now()
  where id=p_mission_id
  returning * into v_mission;

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,lat,lng,actor)
  values(p_mission_id,'status_change',case
    when p_new_status='en_route' then 'assigned'
    when p_new_status='on_site' then 'en_route'
    when p_new_status='working' then 'on_site'
    when p_new_status='completed' then 'working'
    else null
  end,p_new_status,jsonb_build_object('note',nullif(trim(p_note),'')),p_lat,p_lng,'hero');

  return v_mission;
end;
$$;

create or replace function public.sos_offer_mission_to_hero(
  p_mission_id uuid,
  p_hero_id uuid,
  p_eta_minutes integer default null,
  p_expires_seconds integer default 90,
  p_payout_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_mission public.sos_missions%rowtype;
  v_offer_id uuid;
  v_platform_fee numeric := 20;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'Server role required' using errcode='42501';
  end if;
  if not exists(select 1 from public.sos_heroes h where h.id=p_hero_id and h.verification_status='verified' and coalesce(h.on_duty,false)) then
    raise exception 'Hero is not verified and on duty';
  end if;

  select * into v_mission from public.sos_missions where id=p_mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is not null or v_mission.status not in ('requested','matching') then
    raise exception 'Mission is not available for an offer';
  end if;

  select coalesce(pr.platform_fee_percent,20) into v_platform_fee
  from public.sos_pricing_rules pr
  where coalesce(pr.is_active,true)
    and (pr.subcategory_id=v_mission.subcategory_id or pr.subcategory_id is null)
    and (pr.category_id=v_mission.category_id or pr.category_id is null)
  order by (pr.subcategory_id is not null) desc,(pr.category_id is not null) desc
  limit 1;

  update public.sos_missions set status='matching',updated_at=now() where id=p_mission_id;
  insert into public.sos_mission_offers(
    mission_id,hero_id,eta_minutes,payout_amount,status,offered_at,expires_at
  ) values(
    p_mission_id,p_hero_id,
    case when p_eta_minutes between 1 and 240 then p_eta_minutes else null end,
    coalesce(p_payout_amount,round(coalesce(v_mission.estimated_price,0)*(1-coalesce(v_platform_fee,20)/100),2)),
    'pending',now(),now()+make_interval(secs=>greatest(30,least(p_expires_seconds,600)))
  )
  on conflict(mission_id,hero_id) do update
  set eta_minutes=excluded.eta_minutes,payout_amount=excluded.payout_amount,
      status='pending',offered_at=excluded.offered_at,expires_at=excluded.expires_at,
      responded_at=null,decline_reason=null
  returning id into v_offer_id;

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'system_note',v_mission.status,'matching',jsonb_build_object('offer_id',v_offer_id,'hero_id',p_hero_id),'system');
  return v_offer_id;
end;
$$;

revoke all on function public.sos_cancel_own_mission(uuid,text) from public,anon;
revoke all on function public.sos_accept_mission_offer(uuid) from public,anon;
revoke all on function public.sos_decline_mission_offer(uuid,text) from public,anon;
revoke all on function public.sos_transition_assigned_mission(uuid,text,double precision,double precision,text) from public,anon;
revoke all on function public.sos_offer_mission_to_hero(uuid,uuid,integer,integer,numeric) from public,anon,authenticated;

grant execute on function public.sos_cancel_own_mission(uuid,text) to authenticated;
grant execute on function public.sos_accept_mission_offer(uuid) to authenticated;
grant execute on function public.sos_decline_mission_offer(uuid,text) to authenticated;
grant execute on function public.sos_transition_assigned_mission(uuid,text,double precision,double precision,text) to authenticated;
grant execute on function public.sos_offer_mission_to_hero(uuid,uuid,integer,integer,numeric) to service_role,postgres;

comment on function public.sos_offer_mission_to_hero(uuid,uuid,integer,integer,numeric) is
'Server-only offer creation. Creating an offer does not claim acceptance; assignment occurs only through sos_accept_mission_offer.';

commit;
