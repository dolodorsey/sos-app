begin;

create or replace function public.sos_accept_mission_offer(p_offer_id uuid)
returns public.sos_missions
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_hero_id uuid := public.sos_current_hero_id();
  v_offer public.sos_mission_offers%rowtype;
  v_mission public.sos_missions%rowtype;
  v_old_status text;
  v_price_model text;
  v_base_fee numeric;
begin
  if (select auth.uid()) is null or v_hero_id is null then
    raise exception 'Authenticated Hero required' using errcode='42501';
  end if;
  select * into v_offer from public.sos_mission_offers where id=p_offer_id and hero_id=v_hero_id for update;
  if not found then raise exception 'Offer not found' using errcode='P0002'; end if;
  if v_offer.status<>'pending' then raise exception 'Offer is not pending'; end if;
  if v_offer.expires_at is not null and v_offer.expires_at<=now() then
    update public.sos_mission_offers set status='expired',responded_at=now() where id=p_offer_id;
    raise exception 'Offer expired';
  end if;
  select * into v_mission from public.sos_missions where id=v_offer.mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is not null or v_mission.status not in ('requested','matching') then
    update public.sos_mission_offers set status='expired',responded_at=now() where id=p_offer_id;
    raise exception 'Mission already assigned or unavailable';
  end if;
  select price_model,base_fee into v_price_model,v_base_fee from public.sos_subcategories where id=v_mission.subcategory_id;
  v_old_status:=v_mission.status;
  update public.sos_mission_offers set status='accepted',responded_at=now() where id=p_offer_id;
  update public.sos_mission_offers set status='expired',responded_at=coalesce(responded_at,now()) where mission_id=v_offer.mission_id and id<>p_offer_id and status='pending';
  update public.sos_missions
  set hero_id=v_hero_id,
      status='assigned',
      matched_at=now(),
      accepted_at=now(),
      eta_minutes=v_offer.eta_minutes,
      final_price=case when v_price_model='fixed' and coalesce(v_base_fee,0)>0 then v_base_fee else final_price end,
      pricing_status=case when v_price_model='fixed' and coalesce(v_base_fee,0)>0 then 'confirmed' else pricing_status end,
      updated_at=now()
  where id=v_offer.mission_id
  returning * into v_mission;
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(v_mission.id,'status_change',v_old_status,'assigned',jsonb_build_object('offer_id',p_offer_id,'hero_id',v_hero_id,'pricing_status',v_mission.pricing_status,'final_price',v_mission.final_price),'hero');
  return v_mission;
end
$function$;

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
set search_path to 'public','pg_temp'
as $function$
declare
  v_hero_id uuid:=public.sos_current_hero_id();
  v_mission public.sos_missions%rowtype;
  v_old_status text;
  v_allowed boolean:=false;
  v_payment_status text;
begin
  if (select auth.uid()) is null or v_hero_id is null then raise exception 'Authenticated Hero required' using errcode='42501'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id and hero_id=v_hero_id for update;
  if not found then raise exception 'Assigned mission not found' using errcode='P0002'; end if;
  select payment_status into v_payment_status from public.sos_payments where mission_id=p_mission_id limit 1;
  v_old_status:=v_mission.status;

  if p_new_status='completed' then
    raise exception 'Complete paid missions through the proof-and-capture completion service';
  end if;

  v_allowed:=(v_old_status='assigned' and p_new_status in ('en_route','canceled_by_hero'))
    or (v_old_status='en_route' and p_new_status in ('on_site','canceled_by_hero'))
    or (v_old_status='on_site' and p_new_status in ('working','canceled_by_hero'));
  if not v_allowed then raise exception 'Invalid mission transition: % -> %',v_old_status,p_new_status; end if;

  if p_new_status='en_route' then
    if v_mission.pricing_status<>'confirmed' or v_mission.final_price is null or v_mission.final_price<=0 then
      raise exception 'Final price must be confirmed before starting route';
    end if;
    if coalesce(v_payment_status,'') not in ('authorized','captured','released') then
      raise exception 'Customer payment authorization is required before starting route';
    end if;
  end if;

  if p_new_status='canceled_by_hero' and coalesce(v_payment_status,'') in ('authorized','captured','released') then
    raise exception 'Paid missions require operations-assisted cancellation';
  end if;

  if p_lat is not null and (p_lat < -90 or p_lat > 90) then raise exception 'Invalid latitude'; end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then raise exception 'Invalid longitude'; end if;

  update public.sos_missions
  set status=p_new_status,
      en_route_at=case when p_new_status='en_route' then now() else en_route_at end,
      arrived_at=case when p_new_status='on_site' then now() else arrived_at end,
      started_at=case when p_new_status='working' then now() else started_at end,
      canceled_at=case when p_new_status='canceled_by_hero' then now() else canceled_at end,
      cancel_reason=case when p_new_status='canceled_by_hero' then left(nullif(trim(p_note),''),500) else cancel_reason end,
      updated_at=now()
  where id=p_mission_id
  returning * into v_mission;
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,lat,lng,actor)
  values(p_mission_id,'status_change',v_old_status,p_new_status,jsonb_build_object('note',left(nullif(trim(p_note),''),500)),p_lat,p_lng,'hero');
  return v_mission;
end
$function$;

commit;
