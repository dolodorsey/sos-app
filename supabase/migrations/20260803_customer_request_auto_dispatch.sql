-- Customer-side mission intake and truthful automatic Hero offer dispatch.
-- Assignment is never reported until an approved Hero accepts an offer.

create or replace function public.sos_request_customer_mission(
  p_subcategory_id text,
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_pickup_address text,
  p_request_type text default 'now',
  p_notes text default null
)
returns public.sos_missions
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user public.sos_users%rowtype;
  v_service public.sos_subcategories%rowtype;
  v_mission public.sos_missions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_user from public.sos_users where auth_id=auth.uid() and status='active' limit 1;
  if not found then raise exception 'Active S.O.S. customer profile required' using errcode='42501'; end if;
  select * into v_service from public.sos_subcategories where id=p_subcategory_id and coalesce(is_active,true) limit 1;
  if not found then raise exception 'Selected service is unavailable'; end if;
  if p_request_type not in ('now','scheduled','quote') then raise exception 'Invalid request type'; end if;
  if p_pickup_lat is null or p_pickup_lat < -90 or p_pickup_lat > 90 then raise exception 'Valid pickup latitude required'; end if;
  if p_pickup_lng is null or p_pickup_lng < -180 or p_pickup_lng > 180 then raise exception 'Valid pickup longitude required'; end if;
  if coalesce(length(trim(p_pickup_address)),0)<3 then raise exception 'Pickup address required'; end if;

  insert into public.sos_missions(
    citizen_id,category_id,subcategory_id,status,request_type,pickup_lat,pickup_lng,pickup_address,
    estimated_price,client_estimate_amount,requested_service_name,pricing_status,citizen_notes,intake_payload
  ) values (
    v_user.id,v_service.category_id,v_service.id,'requested',p_request_type,p_pickup_lat,p_pickup_lng,
    left(trim(p_pickup_address),500),coalesce(v_service.base_fee,0),coalesce(v_service.base_fee,0),v_service.name,
    case when coalesce(v_service.base_fee,0)>0 then 'starting_estimate' else 'quote_required' end,
    left(nullif(trim(p_notes),''),2000),jsonb_build_object('source','customer_app','service_id',v_service.id,'service_name',v_service.name,'requested_at',now())
  ) returning * into v_mission;

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,lat,lng,actor)
  values(v_mission.id,'status_change',null,'requested',jsonb_build_object('source','customer_app','service_id',v_service.id),p_pickup_lat,p_pickup_lng,'citizen');
  return v_mission;
end;
$function$;

revoke all on function public.sos_request_customer_mission(text,double precision,double precision,text,text,text) from public;
grant execute on function public.sos_request_customer_mission(text,double precision,double precision,text,text,text) to authenticated;

create or replace function public.sos_auto_dispatch_customer_mission(
  p_mission_id uuid,
  p_requester_auth_id uuid,
  p_offer_limit integer default 3,
  p_radius_miles double precision default 15,
  p_expires_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_mission public.sos_missions%rowtype;
  v_candidate record;
  v_offer_id uuid;
  v_offer_ids uuid[]:='{}';
  v_offer_count integer:=0;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'Server role required' using errcode='42501'; end if;
  if p_requester_auth_id is null then raise exception 'Requester identity required'; end if;
  if p_offer_limit not between 1 and 5 then raise exception 'Offer limit must be 1-5'; end if;
  if p_radius_miles<=0 or p_radius_miles>50 then raise exception 'Radius must be greater than 0 and no more than 50 miles'; end if;
  if p_expires_seconds not between 30 and 600 then raise exception 'Offer expiration must be 30-600 seconds'; end if;

  select m.* into v_mission from public.sos_missions m join public.sos_users u on u.id=m.citizen_id
  where m.id=p_mission_id and u.auth_id=p_requester_auth_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.status not in ('requested','matching') or v_mission.hero_id is not null then raise exception 'Mission is not available for dispatch'; end if;
  if v_mission.pickup_lat is null or v_mission.pickup_lng is null or v_mission.subcategory_id is null then raise exception 'Mission requires location and service before dispatch'; end if;

  for v_candidate in select * from public.sos_find_nearby_heroes(v_mission.pickup_lat,v_mission.pickup_lng,p_radius_miles,v_mission.subcategory_id) limit p_offer_limit loop
    v_offer_id:=public.sos_offer_mission_to_hero(p_mission_id,v_candidate.hero_id,v_candidate.eta_minutes,p_expires_seconds,null);
    v_offer_ids:=array_append(v_offer_ids,v_offer_id);v_offer_count:=v_offer_count+1;
  end loop;

  if v_offer_count=0 then
    insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
    values(p_mission_id,'system_note',v_mission.status,v_mission.status,jsonb_build_object('dispatch_result','no_verified_heroes_available','radius_miles',p_radius_miles,'source','automatic_customer_dispatch'),'system');
    return jsonb_build_object('mission_id',p_mission_id,'result','no_verified_heroes_available','offer_count',0,'assignment_confirmed',false);
  end if;

  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'system_note',v_mission.status,'matching',jsonb_build_object('dispatch_result','offers_created','offer_count',v_offer_count,'offer_ids',to_jsonb(v_offer_ids),'radius_miles',p_radius_miles,'source','automatic_customer_dispatch'),'system');
  return jsonb_build_object('mission_id',p_mission_id,'result','offers_created','offer_count',v_offer_count,'offer_ids',to_jsonb(v_offer_ids),'assignment_confirmed',false);
end;
$function$;

revoke all on function public.sos_auto_dispatch_customer_mission(uuid,uuid,integer,double precision,integer) from public;
grant execute on function public.sos_auto_dispatch_customer_mission(uuid,uuid,integer,double precision,integer) to service_role;
