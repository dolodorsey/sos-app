begin;

alter function public.sos_current_user_id() security definer;
alter function public.sos_current_hero_id() security definer;

revoke all on function public.sos_current_user_id() from public,anon;
revoke all on function public.sos_current_hero_id() from public,anon;
grant execute on function public.sos_current_user_id() to authenticated,service_role,postgres;
grant execute on function public.sos_current_hero_id() to authenticated,service_role,postgres;

alter table public.sos_missions
  drop constraint if exists sos_missions_requested_service_length;
alter table public.sos_missions
  add constraint sos_missions_requested_service_length
  check (requested_service_name is null or char_length(requested_service_name) <= 120);

alter table public.sos_missions
  drop constraint if exists sos_missions_address_length;
alter table public.sos_missions
  add constraint sos_missions_address_length
  check (
    (pickup_address is null or char_length(pickup_address) <= 500)
    and (dropoff_address is null or char_length(dropoff_address) <= 500)
  );

alter table public.sos_missions
  drop constraint if exists sos_missions_notes_length;
alter table public.sos_missions
  add constraint sos_missions_notes_length
  check (citizen_notes is null or char_length(citizen_notes) <= 2000);

alter table public.sos_missions
  drop constraint if exists sos_missions_intake_payload_size;
alter table public.sos_missions
  add constraint sos_missions_intake_payload_size
  check (pg_column_size(intake_payload) <= 16384);

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
  v_old_status text;
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

  v_old_status := v_mission.status;
  update public.sos_missions
  set status='canceled_by_citizen', canceled_at=now(),
      cancel_reason=left(nullif(trim(p_reason),''),500), updated_at=now()
  where id=p_mission_id
  returning * into v_mission;

  update public.sos_mission_offers
  set status='canceled', responded_at=coalesce(responded_at,now())
  where mission_id=p_mission_id and status='pending';

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'status_change',v_old_status,'canceled_by_citizen',jsonb_build_object('reason',left(nullif(trim(p_reason),''),500)),'citizen');

  return v_mission;
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
  v_old_status text;
  v_allowed boolean := false;
begin
  if (select auth.uid()) is null or v_hero_id is null then
    raise exception 'Authenticated Hero required' using errcode='42501';
  end if;

  select * into v_mission from public.sos_missions
  where id=p_mission_id and hero_id=v_hero_id
  for update;
  if not found then raise exception 'Assigned mission not found' using errcode='P0002'; end if;

  v_old_status := v_mission.status;
  v_allowed :=
    (v_old_status='assigned' and p_new_status in ('en_route','canceled_by_hero')) or
    (v_old_status='en_route' and p_new_status in ('on_site','canceled_by_hero')) or
    (v_old_status='on_site' and p_new_status in ('working','canceled_by_hero')) or
    (v_old_status='working' and p_new_status in ('completed','canceled_by_hero'));
  if not v_allowed then
    raise exception 'Invalid mission transition: % -> %',v_old_status,p_new_status;
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'Invalid latitude';
  end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'Invalid longitude';
  end if;

  update public.sos_missions
  set status=p_new_status,
      en_route_at=case when p_new_status='en_route' then now() else en_route_at end,
      arrived_at=case when p_new_status='on_site' then now() else arrived_at end,
      started_at=case when p_new_status='working' then now() else started_at end,
      completed_at=case when p_new_status='completed' then now() else completed_at end,
      canceled_at=case when p_new_status='canceled_by_hero' then now() else canceled_at end,
      cancel_reason=case when p_new_status='canceled_by_hero' then left(nullif(trim(p_note),''),500) else cancel_reason end,
      updated_at=now()
  where id=p_mission_id
  returning * into v_mission;

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,lat,lng,actor)
  values(p_mission_id,'status_change',v_old_status,p_new_status,
    jsonb_build_object('note',left(nullif(trim(p_note),''),500)),p_lat,p_lng,'hero');

  return v_mission;
end;
$$;

revoke all on function public.sos_cancel_own_mission(uuid,text) from public,anon;
revoke all on function public.sos_transition_assigned_mission(uuid,text,double precision,double precision,text) from public,anon;
grant execute on function public.sos_cancel_own_mission(uuid,text) to authenticated;
grant execute on function public.sos_transition_assigned_mission(uuid,text,double precision,double precision,text) to authenticated;

commit;
