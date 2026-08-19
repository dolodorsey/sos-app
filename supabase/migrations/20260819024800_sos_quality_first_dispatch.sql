create or replace function public.sos_rank_nearby_heroes(p_lat double precision,p_lng double precision,p_radius_miles double precision default 15,p_subcategory text default null)
returns table(hero_id uuid,user_id uuid,rating numeric,level text,distance_miles double precision,eta_minutes integer,lat double precision,lng double precision,match_score numeric)
language plpgsql set search_path to 'public','private','pg_temp'
as $function$
begin
  if p_lat is null or p_lat < -90 or p_lat > 90 then raise exception 'Invalid latitude'; end if;
  if p_lng is null or p_lng < -180 or p_lng > 180 then raise exception 'Invalid longitude'; end if;
  if p_radius_miles is null or p_radius_miles<=0 or p_radius_miles>50 then raise exception 'Radius must be greater than 0 and no more than 50 miles'; end if;
  return query
  with candidates as (
    select h.*,(public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))/1609.344) dist,
      case when h.last_gps_at>=now()-interval '2 minutes' then 100::numeric when h.last_gps_at>=now()-interval '5 minutes' then 90::numeric else 70::numeric end freshness,
      case when h.level in ('elite','black','captain') then 100::numeric when h.level in ('pro','senior') then 85::numeric else 65::numeric end level_score
    from public.sos_heroes h join public.sos_users u on u.id=h.user_id
    where h.on_duty=true and h.verification_status='verified'
      and h.license_verified=true and h.insurance_verified=true and h.background_cleared=true and h.id_verified=true and h.test_mission_passed=true
      and h.is_demo=false and u.is_demo=false and u.status='active' and u.auth_id is not null and nullif(trim(coalesce(u.phone,'')),'') is not null
      and h.last_lat is not null and h.last_lng is not null and h.last_gps_at>=now()-interval '15 minutes'
      and public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))<=p_radius_miles*1609.344
      and (p_subcategory is null or p_subcategory=any(h.services_enabled))
  )
  select c.id,c.user_id,c.rating,c.level,round(c.dist::numeric,1)::double precision,private.marketplace_road_eta_minutes(c.dist::numeric,now()),c.last_lat,c.last_lng,
    round((c.freshness*0.20 + least(100,greatest(0,coalesce(c.completion_rate,100)))*0.20 + least(100,greatest(0,coalesce(c.on_time_rate,100)))*0.15 + least(100,greatest(0,coalesce(c.rating,5)/5*100))*0.15 + c.level_score*0.10 + case when c.total_missions>=25 then 100 when c.total_missions>=10 then 85 when c.total_missions>=3 then 70 else 55 end*0.15 + greatest(0,100-(c.dist/p_radius_miles)*100)::numeric*0.05),1)
  from candidates c order by 9 desc,5 asc limit 10;
end;
$function$;

create or replace function public.sos_auto_dispatch_customer_mission(p_mission_id uuid,p_requester_auth_id uuid,p_offer_limit integer default 3,p_radius_miles double precision default 15,p_expires_seconds integer default 120)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public'
as $function$
declare v_mission public.sos_missions%rowtype; v_candidate record; v_offer_id uuid; v_offer_ids uuid[]:='{}'; v_offer_count integer:=0;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'Server role required' using errcode='42501'; end if;
  if p_requester_auth_id is null then raise exception 'Requester identity required'; end if;
  if p_offer_limit not between 1 and 5 then raise exception 'Offer limit must be 1-5'; end if;
  if p_radius_miles<=0 or p_radius_miles>50 then raise exception 'Radius must be greater than 0 and no more than 50 miles'; end if;
  if p_expires_seconds not between 30 and 600 then raise exception 'Offer expiration must be 30-600 seconds'; end if;
  select m.* into v_mission from public.sos_missions m join public.sos_users u on u.id=m.citizen_id where m.id=p_mission_id and u.auth_id=p_requester_auth_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.status not in ('requested','matching') or v_mission.hero_id is not null then raise exception 'Mission is not available for dispatch'; end if;
  if v_mission.pickup_lat is null or v_mission.pickup_lng is null or v_mission.subcategory_id is null then raise exception 'Mission requires location and service before dispatch'; end if;
  for v_candidate in select * from public.sos_rank_nearby_heroes(v_mission.pickup_lat,v_mission.pickup_lng,p_radius_miles,v_mission.subcategory_id) limit p_offer_limit loop
    v_offer_id:=public.sos_offer_mission_to_hero(p_mission_id,v_candidate.hero_id,v_candidate.eta_minutes,p_expires_seconds,null);
    update public.sos_mission_offers set score=v_candidate.match_score,distance_miles=v_candidate.distance_miles where id=v_offer_id;
    v_offer_ids:=array_append(v_offer_ids,v_offer_id); v_offer_count:=v_offer_count+1;
  end loop;
  if v_offer_count=0 then return jsonb_build_object('mission_id',p_mission_id,'result','no_verified_heroes_available','offer_count',0,'assignment_confirmed',false); end if;
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor) values(p_mission_id,'system_note',v_mission.status,'matching',jsonb_build_object('dispatch_result','quality_ranked_offers_created','offer_count',v_offer_count,'offer_ids',to_jsonb(v_offer_ids),'radius_miles',p_radius_miles,'source','automatic_customer_dispatch'),'system');
  return jsonb_build_object('mission_id',p_mission_id,'result','quality_ranked_offers_created','offer_count',v_offer_count,'offer_ids',to_jsonb(v_offer_ids),'assignment_confirmed',false);
end;
$function$;

revoke all on function public.sos_auto_dispatch_customer_mission(uuid,uuid,integer,double precision,integer) from public;
grant execute on function public.sos_auto_dispatch_customer_mission(uuid,uuid,integer,double precision,integer) to service_role;
comment on function public.sos_rank_nearby_heroes(double precision,double precision,double precision,text) is 'S.O.S. quality-first dispatch ranking. Verification, safety, service eligibility, live GPS, reliability and experience dominate. Distance is capped at five percent.';
