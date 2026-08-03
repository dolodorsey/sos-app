begin;

create or replace function public.sos_dispatch_mission_offers(
  p_mission_id uuid,
  p_operator_auth_id uuid,
  p_offer_limit integer default 3,
  p_radius_miles double precision default 15,
  p_expires_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_mission public.sos_missions%rowtype;
  v_candidate record;
  v_offer_count integer := 0;
  v_offer_ids uuid[] := '{}';
  v_offer_id uuid;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'Server role required' using errcode='42501';
  end if;
  if p_operator_auth_id is null then raise exception 'Operator identity required'; end if;
  if p_offer_limit not between 1 and 5 then raise exception 'Offer limit must be between 1 and 5'; end if;
  if p_radius_miles <= 0 or p_radius_miles > 50 then raise exception 'Radius must be greater than 0 and no more than 50 miles'; end if;
  if p_expires_seconds not between 30 and 600 then raise exception 'Offer expiration must be between 30 and 600 seconds'; end if;

  select * into v_mission
  from public.sos_missions
  where id=p_mission_id
  for update;

  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.status not in ('requested','matching') or v_mission.hero_id is not null then
    raise exception 'Mission is not available for provider offers';
  end if;
  if v_mission.pickup_lat is null or v_mission.pickup_lng is null then
    raise exception 'Mission requires validated pickup coordinates before provider matching';
  end if;
  if v_mission.subcategory_id is null then
    raise exception 'Mission requires a supported service before provider matching';
  end if;

  for v_candidate in
    select *
    from public.sos_find_nearby_heroes(
      v_mission.pickup_lat,
      v_mission.pickup_lng,
      p_radius_miles,
      v_mission.subcategory_id
    )
    limit p_offer_limit
  loop
    v_offer_id := public.sos_offer_mission_to_hero(
      p_mission_id,
      v_candidate.hero_id,
      v_candidate.eta_minutes,
      p_expires_seconds,
      null
    );
    v_offer_ids := array_append(v_offer_ids,v_offer_id);
    v_offer_count := v_offer_count + 1;
  end loop;

  if v_offer_count=0 then
    insert into public.sos_mission_events(
      mission_id,event_type,old_status,new_status,payload,actor
    ) values(
      p_mission_id,'system_note',v_mission.status,v_mission.status,
      jsonb_build_object(
        'dispatch_result','no_verified_heroes_available',
        'radius_miles',p_radius_miles,
        'service',v_mission.subcategory_id,
        'operator_auth_id',p_operator_auth_id
      ),'system'
    );

    return jsonb_build_object(
      'mission_id',p_mission_id,
      'result','no_verified_heroes_available',
      'offer_count',0
    );
  end if;

  insert into public.sos_mission_events(
    mission_id,event_type,old_status,new_status,payload,actor
  ) values(
    p_mission_id,'system_note',v_mission.status,'matching',
    jsonb_build_object(
      'dispatch_result','offers_created',
      'offer_count',v_offer_count,
      'offer_ids',to_jsonb(v_offer_ids),
      'radius_miles',p_radius_miles,
      'operator_auth_id',p_operator_auth_id
    ),'system'
  );

  return jsonb_build_object(
    'mission_id',p_mission_id,
    'result','offers_created',
    'offer_count',v_offer_count,
    'offer_ids',to_jsonb(v_offer_ids),
    'assignment_confirmed',false
  );
end;
$$;

revoke all on function public.sos_dispatch_mission_offers(uuid,uuid,integer,double precision,integer)
from public,anon,authenticated;
grant execute on function public.sos_dispatch_mission_offers(uuid,uuid,integer,double precision,integer)
to service_role,postgres;

comment on function public.sos_dispatch_mission_offers(uuid,uuid,integer,double precision,integer) is
'Server-only provider offer fan-out. It creates expiring offers for nearby verified on-duty Heroes and explicitly does not claim assignment until one Hero accepts.';

commit;
