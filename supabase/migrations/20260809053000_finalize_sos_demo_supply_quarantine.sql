alter table public.sos_heroes add column if not exists is_demo boolean not null default false;

update public.sos_users
set is_demo=true,updated_at=now()
where lower(coalesce(email,'')) like '%@sos-demo.atl';

update public.sos_heroes h
set is_demo=coalesce(u.is_demo,false)
from public.sos_users u
where u.id=h.user_id and h.is_demo is distinct from coalesce(u.is_demo,false);

update public.sos_recruiting_candidates c
set is_demo=true,outreach_status=case when outreach_status='paused' then outreach_status else 'paused' end,updated_at=now()
where c.source_user_id in (select id from public.sos_users where is_demo=true)
   or c.source_hero_id in (select id from public.sos_heroes where is_demo=true)
   or lower(coalesce(c.email,'')) like '%@sos-demo.atl';

create index if not exists sos_heroes_real_dispatch_idx
on public.sos_heroes(id) where is_demo=false and verification_status='verified';

create or replace function public.sos_rank_nearby_heroes(p_lat double precision, p_lng double precision, p_radius_miles double precision default 15, p_subcategory text default null)
returns table(hero_id uuid, user_id uuid, rating numeric, level text, distance_miles double precision, eta_minutes integer, lat double precision, lng double precision, match_score numeric)
language plpgsql
set search_path='public','pg_temp'
as $$
begin
  if p_lat is null or p_lat < -90 or p_lat > 90 then raise exception 'Invalid latitude'; end if;
  if p_lng is null or p_lng < -180 or p_lng > 180 then raise exception 'Invalid longitude'; end if;
  if p_radius_miles is null or p_radius_miles<=0 or p_radius_miles>50 then raise exception 'Radius must be greater than 0 and no more than 50 miles'; end if;
  return query
  with candidates as (
    select h.*,
      (public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))/1609.344) as dist,
      case when h.last_gps_at>=now()-interval '2 minutes' then 100::numeric when h.last_gps_at>=now()-interval '5 minutes' then 90::numeric else 70::numeric end freshness,
      case when h.level in ('elite','black','captain') then 100::numeric when h.level in ('pro','senior') then 85::numeric else 65::numeric end level_score
    from public.sos_heroes h
    join public.sos_users u on u.id=h.user_id
    where h.on_duty=true and h.verification_status='verified'
      and h.is_demo=false and u.is_demo=false
      and u.status='active' and u.auth_id is not null
      and h.last_lat is not null and h.last_lng is not null and h.last_gps_at>=now()-interval '15 minutes'
      and public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))<=p_radius_miles*1609.344
      and (p_subcategory is null or p_subcategory=any(h.services_enabled))
  )
  select c.id,c.user_id,c.rating,c.level,round(c.dist::numeric,1)::double precision,
         greatest(3,ceil(c.dist*3)::integer),c.last_lat,c.last_lng,
         round((greatest(0,100-(c.dist/p_radius_miles)*100)::numeric*0.45
          + least(100,greatest(0,coalesce(c.rating,5)/5*100))*0.25
          + least(100,greatest(0,coalesce(c.completion_rate,100)))*0.10
          + least(100,greatest(0,coalesce(c.on_time_rate,100)))*0.10
          + c.freshness*0.05+c.level_score*0.05),1)
  from candidates c
  order by 9 desc,5 asc
  limit 10;
end;
$$;

create or replace function public.sos_offer_mission_to_hero(p_mission_id uuid, p_hero_id uuid, p_eta_minutes integer default null, p_expires_seconds integer default 90, p_payout_amount numeric default null)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_mission public.sos_missions%rowtype; v_offer_id uuid; v_platform_fee numeric:=20;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'Server role required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.sos_heroes h
    join public.sos_users u on u.id=h.user_id
    where h.id=p_hero_id and h.verification_status='verified' and coalesce(h.on_duty,false)
      and h.is_demo=false and u.is_demo=false
      and u.status='active' and u.auth_id is not null
  ) then raise exception 'Hero is not verified, authenticated, real, and on duty'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is not null or v_mission.status not in ('requested','matching') then raise exception 'Mission is not available for an offer'; end if;
  select coalesce(pr.platform_fee_percent,20) into v_platform_fee from public.sos_pricing_rules pr where coalesce(pr.is_active,true) and (pr.subcategory_id=v_mission.subcategory_id or pr.subcategory_id is null) and (pr.category_id=v_mission.category_id or pr.category_id is null) order by (pr.subcategory_id is not null) desc,(pr.category_id is not null) desc limit 1;
  update public.sos_missions set status='matching',updated_at=now() where id=p_mission_id;
  insert into public.sos_mission_offers(mission_id,hero_id,eta_minutes,payout_amount,status,offered_at,expires_at)
  values(p_mission_id,p_hero_id,case when p_eta_minutes between 1 and 240 then p_eta_minutes else null end,coalesce(p_payout_amount,round(coalesce(v_mission.estimated_price,0)*(1-coalesce(v_platform_fee,20)/100),2)),'pending',now(),now()+make_interval(secs=>greatest(30,least(p_expires_seconds,600))))
  on conflict(mission_id,hero_id) do update set eta_minutes=excluded.eta_minutes,payout_amount=excluded.payout_amount,status='pending',offered_at=excluded.offered_at,expires_at=excluded.expires_at,responded_at=null,decline_reason=null
  returning id into v_offer_id;
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor) values(p_mission_id,'system_note',v_mission.status,'matching',jsonb_build_object('offer_id',v_offer_id,'hero_id',p_hero_id),'system');
  return v_offer_id;
end;
$$;

create or replace function public.sos_claim_qualified_hero_profile()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','auth'
as $$
declare
  v_auth uuid:=auth.uid(); v_email text; v_current public.sos_users%rowtype; v_candidate public.sos_recruiting_candidates%rowtype; v_target public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_has_activity boolean:=false;
begin
  if v_auth is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select email into v_email from auth.users where id=v_auth;
  if coalesce(v_email,'')='' then raise exception 'Verified email is required'; end if;
  if lower(v_email) like '%@sos-demo.atl' then raise exception 'Demo Hero profiles cannot be claimed' using errcode='42501'; end if;
  select c.* into v_candidate
  from public.sos_recruiting_candidates c
  join public.sos_users u on u.id=c.source_user_id
  join public.sos_heroes h on h.id=c.source_hero_id and h.user_id=u.id
  where lower(coalesce(c.email,u.email,''))=lower(v_email)
    and c.is_demo=false and u.is_demo=false and h.is_demo=false
    and c.pipeline_stage in ('qualified','contacted','screening','training','account_setup','test_mission','approved')
  order by c.priority_score desc,c.created_at limit 1 for update of c;
  if not found then raise exception 'No qualified real S.O.S. Hero candidate matches this email' using errcode='42501'; end if;
  select * into v_target from public.sos_users where id=v_candidate.source_user_id and is_demo=false for update;
  if not found then raise exception 'Real Hero user record is unavailable' using errcode='42501'; end if;
  if v_target.auth_id is not null and v_target.auth_id<>v_auth then raise exception 'This Hero profile is already claimed' using errcode='42501'; end if;
  select * into v_hero from public.sos_heroes where id=v_candidate.source_hero_id and user_id=v_target.id and is_demo=false for update;
  if not found then raise exception 'Hero candidate record is incomplete or quarantined'; end if;
  select * into v_current from public.sos_users where auth_id=v_auth limit 1 for update;
  if found and v_current.id<>v_target.id then
    select exists(select 1 from public.sos_missions where citizen_id=v_current.id)
        or exists(select 1 from public.sos_payments where citizen_id=v_current.id)
        or exists(select 1 from public.sos_subscriptions where user_id=v_current.id)
        or exists(select 1 from public.sos_vehicles where user_id=v_current.id)
        or exists(select 1 from public.sos_support_tickets where user_id=v_current.id)
        or exists(select 1 from public.sos_disputes where opened_by=v_current.id)
    into v_has_activity;
    if v_has_activity then raise exception 'This authenticated account already has citizen activity. Contact S.O.S. operations to merge it safely.' using errcode='40900'; end if;
    update public.sos_users set auth_id=null,status='deactivated',updated_at=now() where id=v_current.id;
  end if;
  update public.sos_users set auth_id=v_auth,email=v_email,role='hero',status='active',updated_at=now() where id=v_target.id and is_demo=false;
  update public.sos_recruiting_candidates set pipeline_stage=case when pipeline_stage='approved' then 'approved' else 'account_setup' end,outreach_status='responded',last_outcome='responded',last_attempt_at=now(),updated_at=now() where id=v_candidate.id and is_demo=false;
  return jsonb_build_object('claimed',true,'hero_id',v_hero.id,'verification_status',v_hero.verification_status,'dispatch_eligible',v_hero.verification_status='verified','message',case when v_hero.verification_status='verified' then 'Hero profile claimed. Complete payout setup and go on duty when ready.' else 'Hero profile claimed. Verification is still pending before dispatch can activate.' end);
end;
$$;

revoke all on function public.sos_offer_mission_to_hero(uuid,uuid,integer,integer,numeric) from public,anon,authenticated;
grant execute on function public.sos_claim_qualified_hero_profile() to authenticated;
revoke execute on function public.sos_claim_qualified_hero_profile() from public,anon;
