-- S.O.S. — test accounts never touch real rescues (Nov 25, 2026).
-- Dolo set drdorseyassistant@gmail.com as the test Hero and thedoctordorsey@gmail.com as the
-- test customer. A test Hero is marked verified without real documents, so:
--   * dispatch only pairs test Heroes with test customers, and real Heroes with real customers;
--   * a real customer's request is never accepted on the strength of a test Hero;
--   * public coverage already ignores test accounts.
-- A test account is an auth user with app_metadata.test_account or enterprise_test_account = true.

create or replace function private.sos_is_test_auth(p_auth_id uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog','auth'
as $$ select coalesce((select coalesce((raw_app_meta_data->>'test_account')::boolean,false) or coalesce((raw_app_meta_data->>'enterprise_test_account')::boolean,false) from auth.users where id=p_auth_id),false) $$;

create or replace function private.sos_test_match(p_citizen_id uuid, p_hero_id uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog','public','private'
as $$
  select private.sos_is_test_auth((select auth_id from public.sos_users where id=p_citizen_id))
       = private.sos_is_test_auth((select u.auth_id from public.sos_heroes h join public.sos_users u on u.id=h.user_id where h.id=p_hero_id));
$$;
revoke all on function private.sos_is_test_auth(uuid) from public, anon, authenticated;
revoke all on function private.sos_test_match(uuid,uuid) from public, anon, authenticated;

do $mig$
declare d text; n text;
begin
  -- Automatic customer dispatch and operator dispatch.
  foreach n in array array['public.sos_auto_dispatch_customer_mission(uuid,uuid,integer,double precision,integer)','public.sos_dispatch_mission_offers(uuid,uuid,integer,double precision,integer)'] loop
    d := pg_get_functiondef(n::regprocedure);
    if position('sos_test_match' in d) = 0 then
      if position('public.sos_rank_nearby_heroes(v_mission.pickup_lat,v_mission.pickup_lng,p_radius_miles,v_mission.subcategory_id) limit p_offer_limit' in d) = 0 then raise exception 'dispatch call site changed in %', n; end if;
      d := replace(d,'public.sos_rank_nearby_heroes(v_mission.pickup_lat,v_mission.pickup_lng,p_radius_miles,v_mission.subcategory_id) limit p_offer_limit',
                     'public.sos_rank_nearby_heroes(v_mission.pickup_lat,v_mission.pickup_lng,p_radius_miles,v_mission.subcategory_id) ranked_hero where private.sos_test_match(v_mission.citizen_id, ranked_hero.hero_id) limit p_offer_limit');
      execute d;
    end if;
  end loop;
  -- Every-minute dispatch waves.
  d := pg_get_functiondef('private.sos_dispatch_one_mission(uuid)'::regprocedure);
  if position('sos_test_match' in d) = 0 then
    if position('where not exists(select 1 from public.sos_mission_offers old where old.mission_id=m.id and old.hero_id=ranked.hero_id)' in d) = 0 then raise exception 'dispatch wave call site changed'; end if;
    d := replace(d,'where not exists(select 1 from public.sos_mission_offers old where old.mission_id=m.id and old.hero_id=ranked.hero_id)',
                   'where not exists(select 1 from public.sos_mission_offers old where old.mission_id=m.id and old.hero_id=ranked.hero_id) and private.sos_test_match(m.citizen_id, ranked.hero_id)');
    execute d;
  end if;
  -- Any single offer, including ones an operator makes by hand.
  d := pg_get_functiondef('public.sos_offer_mission_to_hero(uuid,uuid,integer,integer,numeric)'::regprocedure);
  if position('sos_test_match' in d) = 0 then
    if position('  if v_mission.hero_id is not null or v_mission.status not in (''requested'',''matching'') then' in d) = 0 then raise exception 'offer call site changed'; end if;
    d := replace(d,'  if v_mission.hero_id is not null or v_mission.status not in (''requested'',''matching'') then',
                   '  if not private.sos_test_match(v_mission.citizen_id, p_hero_id) then raise exception ''Test Heroes only serve test customers, and real Heroes only serve real customers''; end if;'||chr(10)||'  if v_mission.hero_id is not null or v_mission.status not in (''requested'',''matching'') then');
    execute d;
  end if;
end $mig$;

-- Supply guard: a request counts only Heroes of the same kind (test or real) as the customer.
create or replace function private.sos_customer_request_supply_guard()
 returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $function$
declare v_citizen_id uuid; v_test boolean;
begin
 if auth.uid() is null then return new; end if;
 select id into v_citizen_id from public.sos_users where auth_id=auth.uid() and role='citizen' and status='active' and coalesce(is_demo,false)=false limit 1;
 if v_citizen_id is null or new.citizen_id is distinct from v_citizen_id then return new; end if;
 v_test := private.sos_is_test_auth(auth.uid());
 if not exists(
   select 1 from public.sos_heroes h
   join public.sos_users u on u.id=h.user_id
   where coalesce(h.is_demo,false)=false and coalesce(u.is_demo,false)=false
     and u.auth_id is not null and u.status='active' and h.verification_status='verified'
     and private.sos_is_test_auth(u.auth_id) = v_test
     and (coalesce(array_length(h.services_enabled,1),0)=0 or new.subcategory_id = any(h.services_enabled))
 ) then
   raise exception 'S.O.S. verified Hero coverage is not active for this service yet. No mission was created.' using errcode='P0001';
 end if;
 return new;
end;$function$;

-- Public coverage: a test Hero must not make a service disappear from the list. Every active
-- service is always listed; only real, fully verified, payout-ready Heroes are counted.
create or replace function public.sos_public_service_coverage()
 returns table(service_id text, service_name text, has_verified_supply boolean, verified_supply_count bigint)
 language sql stable security definer set search_path to 'pg_catalog','public','auth','private'
as $function$
  select s.id, s.name, (count(h.id) > 0), count(h.id)::bigint
  from public.sos_subcategories s
  left join public.sos_heroes h
    on s.id = any(h.services_enabled)
   and coalesce(h.is_demo,false) = false
   and h.verification_status = 'verified'
   and coalesce(h.id_verified,false) and coalesce(h.background_cleared,false)
   and coalesce(h.license_verified,false) and coalesce(h.insurance_verified,false)
   and coalesce(h.test_mission_passed,false)
   and ((h.stripe_connect_api_version = 'v2' and h.stripe_transfer_status = 'active')
        or exists(select 1 from public.sos_hero_payout_profiles pp where pp.hero_id=h.id and pp.payout_preference='mailed_check' and pp.tax_form_status='received'))
   and exists(select 1 from public.sos_users u where u.id=h.user_id and coalesce(u.is_demo,false)=false and u.status='active' and u.auth_id is not null
              and not private.sos_is_test_auth(u.auth_id))
  where s.is_active
  group by s.id, s.name;
$function$;
