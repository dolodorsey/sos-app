-- S.O.S controlled mission lifecycle
-- Apply after 20260710_marketplace_security_and_dispatch.sql.

begin;

create or replace function public.sos_advance_mission_status(
  p_mission_id uuid,
  p_new_status text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.sos_missions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.sos_missions%rowtype;
  v_hero_id uuid := public.sos_current_hero_id();
  v_status text := lower(trim(p_new_status));
  v_old_status text;
begin
  if auth.uid() is null or v_hero_id is null then
    raise exception 'Authenticated Hero required' using errcode = '42501';
  end if;

  select * into v_mission
  from public.sos_missions
  where id = p_mission_id and hero_id = v_hero_id
  for update;

  if not found then
    raise exception 'Assigned mission not found' using errcode = 'P0002';
  end if;

  v_old_status := v_mission.status;

  if not (
    (v_old_status = 'accepted' and v_status = 'en_route')
    or (v_old_status = 'en_route' and v_status = 'arrived')
    or (v_old_status = 'arrived' and v_status = 'in_progress')
    or (v_old_status = 'in_progress' and v_status = 'completed')
  ) then
    raise exception 'Invalid mission transition: % -> %', v_old_status, v_status;
  end if;

  update public.sos_missions
  set status = v_status,
      en_route_at = case when v_status = 'en_route' then now() else en_route_at end,
      arrived_at = case when v_status = 'arrived' then now() else arrived_at end,
      started_at = case when v_status = 'in_progress' then now() else started_at end,
      completed_at = case when v_status = 'completed' then now() else completed_at end,
      updated_at = now()
  where id = p_mission_id
  returning * into v_mission;

  insert into public.sos_mission_events(
    mission_id, event_type, old_status, new_status, payload, lat, lng, actor
  )
  values (
    p_mission_id,
    'status_changed',
    v_old_status,
    v_status,
    coalesce(p_payload, '{}'::jsonb),
    p_lat,
    p_lng,
    'hero'
  );

  return v_mission;
end;
$$;

create or replace function public.sos_cancel_mission(
  p_mission_id uuid,
  p_reason text
)
returns public.sos_missions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.sos_missions%rowtype;
  v_user_id uuid := public.sos_current_user_id();
  v_hero_id uuid := public.sos_current_hero_id();
  v_actor text;
  v_old_status text;
begin
  if auth.uid() is null or v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(coalesce(trim(p_reason), '')) < 3 then
    raise exception 'Cancellation reason is required';
  end if;

  select * into v_mission
  from public.sos_missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found' using errcode = 'P0002';
  end if;

  if v_mission.citizen_id = v_user_id then
    v_actor := 'citizen';
  elsif v_mission.hero_id = v_hero_id then
    v_actor := 'hero';
  else
    raise exception 'Not authorized for mission' using errcode = '42501';
  end if;

  if v_mission.status in ('completed','canceled') then
    raise exception 'Mission cannot be canceled from status %', v_mission.status;
  end if;

  v_old_status := v_mission.status;

  update public.sos_missions
  set status = 'canceled',
      canceled_at = now(),
      cancel_reason = trim(p_reason),
      updated_at = now()
  where id = p_mission_id
  returning * into v_mission;

  update public.sos_mission_offers
  set status = 'canceled', responded_at = coalesce(responded_at, now())
  where mission_id = p_mission_id and status = 'offered';

  insert into public.sos_mission_events(
    mission_id, event_type, old_status, new_status, payload, actor
  )
  values (
    p_mission_id, 'mission_canceled', v_old_status, 'canceled',
    jsonb_build_object('reason', trim(p_reason), 'canceled_by', v_actor), v_actor
  );

  return v_mission;
end;
$$;

-- Assignment and lifecycle changes now occur through reviewed RPCs.
revoke update on public.sos_missions from anon, authenticated;

revoke all on function public.sos_advance_mission_status(uuid, text, double precision, double precision, jsonb) from public, anon;
revoke all on function public.sos_cancel_mission(uuid, text) from public, anon;
grant execute on function public.sos_advance_mission_status(uuid, text, double precision, double precision, jsonb) to authenticated;
grant execute on function public.sos_cancel_mission(uuid, text) to authenticated;

commit;
