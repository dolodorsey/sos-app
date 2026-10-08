-- S.O.S. pre-launch marketplace gate (GitHub issue #103, Phase 4).
--
-- Founder directive 2026-10-08: the public marketplace stays CLOSED while S.O.S.
-- recruits provider coverage. The operational customer + Hero apps are preserved
-- intact, but no public flow may create missions, offers, payments, memberships,
-- Hero profiles, on-duty presence, or full Hero applications.
--
-- Enforcement is row-owner based, in BEFORE triggers, so it holds for every path:
-- PostgREST direct writes, SECURITY DEFINER RPCs, and Edge Functions running as
-- service_role. Only authenticated marketplace operators and explicitly granted
-- internal QA testers (private.sos_prelaunch_access) pass while pre-launch is on.
-- Grants are checked on auth.users ids — never on profile metadata, query params or
-- client booleans. Client-editable profile metadata is never consulted.
--
-- Reopen path:  update private.sos_prelaunch_state set prelaunch_enabled=false ...
-- Rollback:     supabase/rollbacks/20261008030000_sos_prelaunch_marketplace_gate.rollback.sql

create table if not exists private.sos_prelaunch_state (
  id boolean primary key default true check (id),
  prelaunch_enabled boolean not null default true,
  reason text not null,
  changed_by text not null,
  changed_at timestamptz not null default now()
);
insert into private.sos_prelaunch_state(id, prelaunch_enabled, reason, changed_by)
values (true, true, 'Founder directive 2026-10-08: recruit provider coverage before opening the public marketplace (issue #103).', 'migration:20261008030000')
on conflict (id) do nothing;

create table if not exists private.sos_prelaunch_access (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  access_role text not null check (access_role in ('qa_tester','qa_operator')),
  granted_by text not null check (char_length(granted_by) between 2 and 200),
  note text check (note is null or char_length(note) <= 1000),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists private.sos_prelaunch_application_invites (
  email_normalized text primary key check (email_normalized = lower(trim(email_normalized)) and char_length(email_normalized) between 3 and 254),
  invited_by text not null,
  note text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.sos_prelaunch_denials (
  id bigint generated always as identity primary key,
  table_name text not null,
  operation text not null,
  owner_auth_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sos_prelaunch_denials_created_idx on private.sos_prelaunch_denials(created_at desc);

alter table private.sos_prelaunch_state enable row level security;
alter table private.sos_prelaunch_access enable row level security;
alter table private.sos_prelaunch_application_invites enable row level security;
alter table private.sos_prelaunch_denials enable row level security;
revoke all on private.sos_prelaunch_state, private.sos_prelaunch_access, private.sos_prelaunch_application_invites, private.sos_prelaunch_denials from public, anon, authenticated;

create or replace function private.sos_prelaunch_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.prelaunch_enabled from private.sos_prelaunch_state s where s.id), true)
$$;

create or replace function private.sos_prelaunch_access_role(p_auth_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_auth_id is null then null
    when private.is_marketplace_operator(p_auth_id) then 'operator'
    else (select a.access_role from private.sos_prelaunch_access a
          where a.auth_id = p_auth_id and a.is_active and (a.expires_at is null or a.expires_at > now()))
  end
$$;

create or replace function private.sos_prelaunch_allows(p_auth_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (not private.sos_prelaunch_enabled()) or private.sos_prelaunch_access_role(p_auth_id) is not null
$$;

revoke all on function private.sos_prelaunch_enabled() from public, anon, authenticated;
revoke all on function private.sos_prelaunch_access_role(uuid) from public, anon, authenticated;
revoke all on function private.sos_prelaunch_allows(uuid) from public, anon, authenticated;

-- One guard for every protected S.O.S. table. Owner resolution is per table.
create or replace function private.sos_prelaunch_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_check boolean := true;
  v_email text;
begin
  if not private.sos_prelaunch_enabled() then
    return new;
  end if;

  if tg_table_name = 'sos_missions' then
    select u.auth_id into v_owner from public.sos_users u where u.id = new.citizen_id;
  elsif tg_table_name = 'sos_payments' then
    select u.auth_id into v_owner from public.sos_users u where u.id = new.citizen_id;
  elsif tg_table_name = 'sos_subscriptions' then
    select u.auth_id into v_owner from public.sos_users u where u.id = new.user_id;
  elsif tg_table_name = 'sos_mission_offers' then
    -- Expiry/decline/cancel maintenance stays allowed; only creating offers or accepting them is gated.
    if tg_op = 'UPDATE' then
      v_check := new.status = 'accepted' and old.status is distinct from 'accepted';
    end if;
    select u.auth_id into v_owner from public.sos_heroes h join public.sos_users u on u.id = h.user_id where h.id = new.hero_id;
  elsif tg_table_name = 'sos_heroes' then
    -- Going ON duty is provider activation (it makes a Hero dispatchable). A pending, off-duty
    -- profile created from an operator-approved invited application is not dispatchable and stays
    -- allowed so verification can proceed before launch. Going OFF duty is always allowed.
    if tg_op = 'UPDATE' then
      v_check := coalesce(new.on_duty, false) and not coalesce(old.on_duty, false);
    else
      v_check := coalesce(new.on_duty, false);
    end if;
    select u.auth_id into v_owner from public.sos_users u where u.id = new.user_id;
  elsif tg_table_name = 'sos_hero_shift_sessions' then
    select u.auth_id into v_owner from public.sos_heroes h join public.sos_users u on u.id = h.user_id where h.id = new.hero_id;
  elsif tg_table_name = 'sos_hero_applications' then
    -- Full credentialed Hero applications are invitation-only during pre-launch.
    v_email := lower(trim(new.email));
    if exists (select 1 from private.sos_prelaunch_application_invites i
               where i.email_normalized = v_email and (i.expires_at is null or i.expires_at > now())) then
      update private.sos_prelaunch_application_invites set used_at = coalesce(used_at, now()) where email_normalized = v_email;
      return new;
    end if;
    insert into private.sos_prelaunch_denials(table_name, operation, owner_auth_id, detail)
      values (tg_table_name, tg_op, null, jsonb_build_object('reason', 'full_application_not_invited'));
    raise exception 'SOS_PRELAUNCH: Full Hero applications are invitation-only before launch. Register early interest at /become-a-hero.'
      using errcode = '42501';
  else
    raise exception 'SOS_PRELAUNCH: guard attached to unexpected table %', tg_table_name;
  end if;

  if not v_check then
    return new;
  end if;
  if private.sos_prelaunch_allows(v_owner) then
    return new;
  end if;

  insert into private.sos_prelaunch_denials(table_name, operation, owner_auth_id, detail)
    values (tg_table_name, tg_op, v_owner, jsonb_build_object('reason', 'marketplace_closed_prelaunch'));
  raise exception 'SOS_PRELAUNCH: S.O.S. is pre-launch and not accepting service requests, dispatch, payments or provider activation yet.'
    using errcode = '42501';
end;
$$;
revoke all on function private.sos_prelaunch_guard() from public, anon, authenticated;

drop trigger if exists sos_prelaunch_guard on public.sos_missions;
create trigger sos_prelaunch_guard before insert on public.sos_missions
  for each row execute function private.sos_prelaunch_guard();
drop trigger if exists sos_prelaunch_guard on public.sos_payments;
create trigger sos_prelaunch_guard before insert on public.sos_payments
  for each row execute function private.sos_prelaunch_guard();
drop trigger if exists sos_prelaunch_guard on public.sos_subscriptions;
create trigger sos_prelaunch_guard before insert on public.sos_subscriptions
  for each row execute function private.sos_prelaunch_guard();
drop trigger if exists sos_prelaunch_guard on public.sos_mission_offers;
create trigger sos_prelaunch_guard before insert or update of status on public.sos_mission_offers
  for each row execute function private.sos_prelaunch_guard();
drop trigger if exists sos_prelaunch_guard on public.sos_heroes;
create trigger sos_prelaunch_guard before insert or update of on_duty on public.sos_heroes
  for each row execute function private.sos_prelaunch_guard();
drop trigger if exists sos_prelaunch_guard on public.sos_hero_shift_sessions;
create trigger sos_prelaunch_guard before insert on public.sos_hero_shift_sessions
  for each row execute function private.sos_prelaunch_guard();
drop trigger if exists sos_prelaunch_guard on public.sos_hero_applications;
create trigger sos_prelaunch_guard before insert on public.sos_hero_applications
  for each row execute function private.sos_prelaunch_guard();

-- Public, non-sensitive marketplace state for the web/native gate.
create or replace function public.sos_prelaunch_public_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'product', 'sos',
    'prelaunch', private.sos_prelaunch_enabled(),
    'marketplace', case when private.sos_prelaunch_enabled() then 'closed' else 'open' end,
    'message', case when private.sos_prelaunch_enabled()
      then 'S.O.S. is pre-launch and not accepting service requests yet. Providers can register early interest.'
      else 'S.O.S. marketplace is open.' end)
$$;
revoke all on function public.sos_prelaunch_public_state() from public;
grant execute on function public.sos_prelaunch_public_state() to anon, authenticated;

-- Caller's own internal access, resolved from the verified JWT subject (auth.uid()).
create or replace function public.sos_prelaunch_access_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'prelaunch', private.sos_prelaunch_enabled(),
    'allowed', private.sos_prelaunch_allows(auth.uid()),
    'access_role', private.sos_prelaunch_access_role(auth.uid()))
$$;
revoke all on function public.sos_prelaunch_access_status() from public, anon;
grant execute on function public.sos_prelaunch_access_status() to authenticated;
