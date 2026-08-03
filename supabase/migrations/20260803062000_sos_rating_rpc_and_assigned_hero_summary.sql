begin;

-- Ratings are created through a controlled RPC so the client never chooses the
-- counterpart user id. The server derives the counterpart from the completed
-- mission and the signed-in participant.
drop policy if exists "SOS participants rate completed counterpart" on public.sos_ratings;
revoke insert on public.sos_ratings from authenticated;
drop function if exists private.sos_can_rate_counterpart(uuid,uuid);

create or replace function public.sos_rate_completed_mission(
  p_mission_id uuid,
  p_rating integer,
  p_review_text text default null,
  p_tags text[] default null,
  p_is_public boolean default true
)
returns public.sos_ratings
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $$
declare
  v_user_id uuid := private.sos_current_user_id();
  v_hero_id uuid := private.sos_current_hero_id();
  v_mission public.sos_missions%rowtype;
  v_assigned_hero_user_id uuid;
  v_counterpart_user_id uuid;
  v_rating public.sos_ratings%rowtype;
begin
  if (select auth.uid()) is null or v_user_id is null then
    raise exception 'Authenticated S.O.S. participant required' using errcode='42501';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select m.*, h.user_id
  into v_mission, v_assigned_hero_user_id
  from public.sos_missions m
  left join public.sos_heroes h on h.id=m.hero_id
  where m.id=p_mission_id
  for share of m;

  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.status <> 'completed' then raise exception 'Only completed missions can be rated'; end if;

  if v_mission.citizen_id=v_user_id then
    if v_assigned_hero_user_id is null then raise exception 'Completed mission has no assigned Hero'; end if;
    v_counterpart_user_id:=v_assigned_hero_user_id;
  elsif v_hero_id is not null and v_mission.hero_id=v_hero_id then
    v_counterpart_user_id:=v_mission.citizen_id;
  else
    raise exception 'Signed-in user is not a participant in this mission' using errcode='42501';
  end if;

  insert into public.sos_ratings(
    mission_id,rated_by,rated_user,rating,review_text,tags,is_public
  ) values(
    p_mission_id,v_user_id,v_counterpart_user_id,p_rating,
    left(nullif(trim(p_review_text),''),1500),p_tags,coalesce(p_is_public,true)
  )
  returning * into v_rating;

  return v_rating;
exception when unique_violation then
  raise exception 'This mission has already been rated by the signed-in user';
end;
$$;

revoke all on function public.sos_rate_completed_mission(uuid,integer,text,text[],boolean)
from public,anon;
grant execute on function public.sos_rate_completed_mission(uuid,integer,text,text[],boolean)
to authenticated;

-- Customers may retrieve a safe assigned-provider summary after a real mission
-- assignment. This intentionally omits provider GPS, email, phone, and payout.
create or replace function public.sos_get_assigned_hero_summary(p_mission_id uuid)
returns table(
  hero_id uuid,
  display_name text,
  avatar_url text,
  rating numeric,
  hero_level text,
  total_missions integer,
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_plate text,
  mission_status text
)
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $$
declare
  v_user_id uuid := private.sos_current_user_id();
  v_current_hero_id uuid := private.sos_current_hero_id();
begin
  if (select auth.uid()) is null or v_user_id is null then
    raise exception 'Authenticated S.O.S. participant required' using errcode='42501';
  end if;

  return query
  select
    h.id,
    trim(concat(coalesce(u.first_name,'Hero'),' ',case when nullif(u.last_name,'') is not null then left(u.last_name,1)||'.' else '' end)),
    u.avatar_url,
    h.rating,
    h.level,
    h.total_missions,
    h.vehicle_type,
    h.vehicle_make,
    h.vehicle_model,
    h.vehicle_year,
    h.vehicle_plate,
    m.status
  from public.sos_missions m
  join public.sos_heroes h on h.id=m.hero_id
  join public.sos_users u on u.id=h.user_id
  where m.id=p_mission_id
    and m.hero_id is not null
    and (m.citizen_id=v_user_id or m.hero_id=v_current_hero_id)
  limit 1;
end;
$$;

revoke all on function public.sos_get_assigned_hero_summary(uuid) from public,anon;
grant execute on function public.sos_get_assigned_hero_summary(uuid) to authenticated;

commit;
