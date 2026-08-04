-- SOS real-time Hero supply controls.
-- A Hero is never counted as live from a static record. Live coverage requires:
-- approved verification, a deliberate shift, and a GPS heartbeat within 15 minutes.

create table if not exists public.sos_hero_shift_sessions (
  id uuid primary key default gen_random_uuid(),
  hero_id uuid not null references public.sos_heroes(id) on delete cascade,
  zone_id uuid references public.sos_service_zones(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason is null or end_reason in (
    'hero_off_duty','stale_location','operator','suspended','shift_complete'
  )),
  start_lat double precision,
  start_lng double precision,
  last_heartbeat_at timestamptz not null default now(),
  last_lat double precision,
  last_lng double precision,
  device_session_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists sos_one_open_shift_per_hero_uidx
on public.sos_hero_shift_sessions(hero_id)
where ended_at is null;

create table if not exists public.sos_hero_verification_checks (
  hero_id uuid not null references public.sos_heroes(id) on delete cascade,
  check_type text not null check (check_type in (
    'identity','background','insurance','license','vehicle','equipment',
    'service_skills','test_mission','payout_account'
  )),
  required boolean not null default true,
  status text not null default 'pending' check (status in (
    'pending','submitted','under_review','passed','failed','waived','expired'
  )),
  evidence_urls text[] not null default '{}',
  expires_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(hero_id,check_type)
);

create table if not exists public.sos_zone_supply_targets (
  zone_id uuid primary key references public.sos_service_zones(id) on delete cascade,
  minimum_verified_heroes integer not null default 3 check (minimum_verified_heroes>=1),
  minimum_live_heroes integer not null default 1 check (minimum_live_heroes>=0),
  peak_minimum_live_heroes integer not null default 2 check (peak_minimum_live_heroes>=0),
  launch_priority smallint not null default 5 check (launch_priority between 1 and 10),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.sos_hero_shift_sessions enable row level security;
alter table public.sos_hero_verification_checks enable row level security;
alter table public.sos_zone_supply_targets enable row level security;
revoke all on public.sos_hero_shift_sessions,public.sos_hero_verification_checks,
  public.sos_zone_supply_targets from anon,authenticated;

drop policy if exists sos_hero_shift_own_read on public.sos_hero_shift_sessions;
create policy sos_hero_shift_own_read on public.sos_hero_shift_sessions
for select to authenticated using (
  hero_id in (
    select h.id
    from public.sos_heroes h
    join public.sos_users u on u.id=h.user_id
    where u.auth_id=auth.uid()
  )
);
grant select on public.sos_hero_shift_sessions to authenticated;

insert into public.sos_hero_verification_checks(hero_id,check_type,required,status)
select h.id,x.check_type,true,
  case x.check_type
    when 'identity' then case when h.id_verified then 'passed' else 'pending' end
    when 'background' then case when h.background_cleared then 'passed' else 'pending' end
    when 'insurance' then case when h.insurance_verified then 'passed' else 'pending' end
    when 'license' then case when h.license_verified then 'passed' else 'pending' end
    when 'test_mission' then case when h.test_mission_passed then 'passed' else 'pending' end
    when 'payout_account' then case when nullif(h.stripe_connect_id,'') is not null then 'submitted' else 'pending' end
    when 'vehicle' then case when nullif(h.vehicle_type,'') is not null then 'submitted' else 'pending' end
    when 'equipment' then case when coalesce(array_length(h.tools_available,1),0)>0 then 'submitted' else 'pending' end
    when 'service_skills' then case when coalesce(array_length(h.services_enabled,1),0)>0 then 'submitted' else 'pending' end
  end
from public.sos_heroes h
cross join (values
  ('identity'),('background'),('insurance'),('license'),('vehicle'),
  ('equipment'),('service_skills'),('test_mission'),('payout_account')
) x(check_type)
on conflict(hero_id,check_type) do update set
  status=excluded.status,
  updated_at=now();

insert into public.sos_zone_supply_targets(
  zone_id,minimum_verified_heroes,minimum_live_heroes,peak_minimum_live_heroes,launch_priority
)
select z.id,
  case when z.zone_name in ('Midtown','Buckhead','Hartsfield-Jackson Airport') then 5 else 3 end,
  case when z.zone_name in ('Midtown','Buckhead','Hartsfield-Jackson Airport') then 2 else 1 end,
  case when z.zone_name in ('Midtown','Buckhead','Hartsfield-Jackson Airport') then 4 else 2 end,
  case when z.zone_name in ('Midtown','Buckhead','Hartsfield-Jackson Airport') then 10 else 7 end
from public.sos_service_zones z
where z.is_active
on conflict(zone_id) do update set
  minimum_verified_heroes=excluded.minimum_verified_heroes,
  minimum_live_heroes=excluded.minimum_live_heroes,
  peak_minimum_live_heroes=excluded.peak_minimum_live_heroes,
  launch_priority=excluded.launch_priority,
  is_active=true,
  updated_at=now();

create or replace function public.sos_set_hero_presence(
  p_on_duty boolean,
  p_lat double precision default null,
  p_lng double precision default null,
  p_zone_id uuid default null,
  p_device_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_hero public.sos_heroes%rowtype;
  v_shift_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select h.* into v_hero
  from public.sos_heroes h
  join public.sos_users u on u.id=h.user_id
  where u.auth_id=auth.uid() and u.status='active'
  for update;

  if not found then
    raise exception 'Active Hero account required' using errcode='42501';
  end if;

  if p_on_duty then
    if p_lat is null or p_lat not between -90 and 90 or
       p_lng is null or p_lng not between -180 and 180 then
      raise exception 'Fresh GPS coordinates are required to go on duty';
    end if;

    if v_hero.verification_status<>'verified'
       or not coalesce(v_hero.id_verified,false)
       or not coalesce(v_hero.background_cleared,false)
       or not coalesce(v_hero.insurance_verified,false)
       or not coalesce(v_hero.license_verified,false)
       or not coalesce(v_hero.test_mission_passed,false) then
      raise exception 'Hero verification is incomplete';
    end if;

    if exists(
      select 1 from public.sos_hero_verification_checks
      where hero_id=v_hero.id and required and status<>'passed'
    ) then
      raise exception 'Hero verification checklist is incomplete';
    end if;

    insert into public.sos_hero_shift_sessions(
      hero_id,zone_id,start_lat,start_lng,last_lat,last_lng,device_session_id
    ) values (
      v_hero.id,p_zone_id,p_lat,p_lng,p_lat,p_lng,left(nullif(p_device_session_id,''),200)
    )
    on conflict(hero_id) where ended_at is null do update set
      zone_id=excluded.zone_id,
      last_heartbeat_at=now(),
      last_lat=excluded.last_lat,
      last_lng=excluded.last_lng,
      device_session_id=coalesce(excluded.device_session_id,public.sos_hero_shift_sessions.device_session_id)
    returning id into v_shift_id;

    update public.sos_heroes
    set on_duty=true,last_lat=p_lat,last_lng=p_lng,last_gps_at=now(),updated_at=now()
    where id=v_hero.id;

    return jsonb_build_object(
      'hero_id',v_hero.id,
      'on_duty',true,
      'shift_id',v_shift_id,
      'presence_expires_at',now()+interval '15 minutes'
    );
  end if;

  update public.sos_hero_shift_sessions
  set ended_at=now(),end_reason='hero_off_duty',last_heartbeat_at=now()
  where hero_id=v_hero.id and ended_at is null;

  update public.sos_heroes set on_duty=false,updated_at=now() where id=v_hero.id;
  return jsonb_build_object('hero_id',v_hero.id,'on_duty',false);
end;$$;

revoke all on function public.sos_set_hero_presence(boolean,double precision,double precision,uuid,text) from public;
grant execute on function public.sos_set_hero_presence(boolean,double precision,double precision,uuid,text) to authenticated;

create or replace function public.sos_expire_stale_presence(p_stale_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  with expired as (
    update public.sos_hero_shift_sessions
    set ended_at=now(),end_reason='stale_location'
    where ended_at is null
      and last_heartbeat_at<now()-make_interval(mins=>greatest(5,p_stale_minutes))
    returning hero_id
  )
  update public.sos_heroes h
  set on_duty=false,updated_at=now()
  where h.id in (select hero_id from expired);

  get diagnostics v_count=row_count;
  return v_count;
end;$$;

revoke all on function public.sos_expire_stale_presence(integer) from public;
grant execute on function public.sos_expire_stale_presence(integer) to service_role;

drop view if exists public.sos_live_coverage;
create view public.sos_live_coverage
with (security_invoker=true)
as
select z.id as zone_id,
       z.zone_name,
       z.city,
       z.state_code,
       t.minimum_verified_heroes,
       t.minimum_live_heroes,
       t.peak_minimum_live_heroes,
       t.launch_priority,
       count(distinct h.id) filter (
         where h.verification_status='verified'
           and h.id_verified
           and h.background_cleared
           and h.insurance_verified
           and h.license_verified
           and h.test_mission_passed
       )::integer as verified_heroes,
       count(distinct h.id) filter (
         where h.on_duty
           and h.last_gps_at>=now()-interval '15 minutes'
           and h.verification_status='verified'
       )::integer as live_heroes,
       max(h.last_gps_at) as freshest_location_at,
       greatest(
         t.minimum_verified_heroes-count(distinct h.id) filter (
           where h.verification_status='verified'
             and h.id_verified
             and h.background_cleared
             and h.insurance_verified
             and h.license_verified
             and h.test_mission_passed
         ),0
       )::integer as verified_gap,
       greatest(
         t.minimum_live_heroes-count(distinct h.id) filter (
           where h.on_duty
             and h.last_gps_at>=now()-interval '15 minutes'
             and h.verification_status='verified'
         ),0
       )::integer as live_gap
from public.sos_service_zones z
join public.sos_zone_supply_targets t on t.zone_id=z.id and t.is_active
left join public.sos_heroes h on lower(coalesce(h.zone,''))=lower(z.zone_name)
where z.is_active
group by z.id,t.minimum_verified_heroes,t.minimum_live_heroes,
  t.peak_minimum_live_heroes,t.launch_priority;

revoke all on public.sos_live_coverage from anon,authenticated;

create index if not exists sos_shift_live_heartbeat_idx
  on public.sos_hero_shift_sessions(last_heartbeat_at) where ended_at is null;
create index if not exists sos_verification_check_status_idx
  on public.sos_hero_verification_checks(status,check_type);
create index if not exists sos_heroes_dispatch_readiness_idx
  on public.sos_heroes(on_duty,last_gps_at,verification_status);
