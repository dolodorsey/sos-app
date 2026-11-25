-- S.O.S. — one service vocabulary for dispatch (Nov 25, 2026).
-- Bug: Hero applications store services by display name ("Jump Start"), legacy Hero
-- profiles use long codes ("jump_start"), and customers order by service id ("jump").
-- Dispatch ranking and public coverage compared ids, the supply guard compared names,
-- so an approved Hero was never offered a Jump Start, Tow, Flat Tire or Fuel rescue.
-- Fix: every Hero service is stored as the sos_subcategories id, and every check uses it.

create or replace function public.sos_service_key(p_value text)
returns text
language sql
stable
set search_path to 'pg_catalog','public'
as $$
  select coalesce(
    (select s.id from public.sos_subcategories s where s.id = lower(trim(p_value)) limit 1),
    (select s.id from public.sos_subcategories s where lower(s.name) = lower(trim(p_value)) limit 1),
    (select v from (values
      ('towing','tow'),('tow_truck','tow'),('flat_tire','flat'),('tire_change','flat'),('flat_tire_help','flat'),
      ('jump_start','jump'),('battery_jump','jump'),('jumpstart','jump'),('fuel_delivery','fuel'),('gas_delivery','fuel'),
      ('vehicle_lockout','lockout'),('battery_replace','battery'),('winch_out','winch'),('oil_change','oil'),
      ('obd_scan','obd'),('bulbs','bulb'),('belt_hose','belt'),('brake_pads','brakes'),
      ('windshield_repair','ws_repair'),('windshield_replace','ws_replace'),('pdr','dent'),('scratch_buff','scratch'),
      ('express_wash','express'),('interior_detail','interior'),('odor_removal','odor'),
      ('fleet_jump_lockout','fleet_jump'),('fleet_inspection','fleet_inspect'),('valet_fuel_wash','valet_fuel'),
      ('pickup_return','pickup_mech'),('vip_priority','vip')
    ) a(k,v) where a.k = lower(regexp_replace(trim(p_value),'[^a-zA-Z0-9]+','_','g')) limit 1)
  );
$$;
grant execute on function public.sos_service_key(text) to anon, authenticated, service_role;

create or replace function private.sos_normalize_hero_services()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.services_enabled is not null then
    new.services_enabled := array(
      select distinct coalesce(public.sos_service_key(s), s)
      from unnest(new.services_enabled) s
      where nullif(trim(s),'') is not null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sos_heroes_normalize_services on public.sos_heroes;
create trigger sos_heroes_normalize_services
before insert or update of services_enabled on public.sos_heroes
for each row execute function private.sos_normalize_hero_services();

-- Backfill every existing Hero profile.
update public.sos_heroes set services_enabled = services_enabled where services_enabled is not null;

-- Supply guard: compare the ordered service id, not the display name.
create or replace function private.sos_customer_request_supply_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog','public','private'
as $function$
declare v_citizen_id uuid;
begin
 if auth.uid() is null then return new; end if;
 select id into v_citizen_id from public.sos_users where auth_id=auth.uid() and role='citizen' and status='active' and coalesce(is_demo,false)=false limit 1;
 if v_citizen_id is null or new.citizen_id is distinct from v_citizen_id then return new; end if;
 if not exists(
   select 1 from public.sos_heroes h
   join public.sos_users u on u.id=h.user_id
   where coalesce(h.is_demo,false)=false and coalesce(u.is_demo,false)=false
     and u.auth_id is not null and u.status='active' and h.verification_status='verified'
     and (
       coalesce(array_length(h.services_enabled,1),0)=0
       or new.subcategory_id = any(h.services_enabled)
     )
 ) then
   raise exception 'S.O.S. verified Hero coverage is not active for this service yet. No mission was created.' using errcode='P0001';
 end if;
 return new;
end;$function$;
