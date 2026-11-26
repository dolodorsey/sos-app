-- S.O.S. — Gwinnett and Sandy Springs become their own areas providers can pick (Nov 26, 2026, Dolo).
-- Area ids: east, south, west, gwinnett, sandy_springs, downtown, midtown, buckhead.

alter table public.sos_hero_applications drop constraint if exists sos_hero_applications_service_zones_valid;
alter table public.sos_hero_applications add constraint sos_hero_applications_service_zones_valid
  check (service_zones <@ array['east','south','west','gwinnett','sandy_springs','downtown','midtown','buckhead']::text[]);

-- Dispatch and coverage zone for Gwinnett (Sandy Springs already has one).
insert into public.sos_service_zones(city,state,state_code,zone_name,zone_type,center_lat,center_lng,radius_miles,is_active,avg_response_min,hero_count,surge_multiplier,tax_rate_percent,surge_enabled)
select 'Atlanta','Georgia','GA','Gwinnett','suburban',33.9562,-83.9880,12,true,30,0,1.00,6.00,true
where not exists (select 1 from public.sos_service_zones where zone_name='Gwinnett');

-- Hero invite links: Sandy Springs and Perimeter / Dunwoody prospects pre-select Sandy Springs; Gwinnett gets its own.
do $mig$
declare d text;
begin
  d := pg_get_functiondef('private.sos_invite_prefill(uuid)'::regprocedure);
  if position('"sandy_springs"' in d) = 0 then
    if position('when ''Sandy Springs'' then ''["buckhead"]''::jsonb' in d) = 0 then raise exception 'invite prefill mapping changed'; end if;
    d := replace(d,'when ''Sandy Springs'' then ''["buckhead"]''::jsonb','when ''Sandy Springs'' then ''["sandy_springs"]''::jsonb');
    d := replace(d,'when ''Perimeter / Dunwoody'' then ''["buckhead"]''::jsonb','when ''Perimeter / Dunwoody'' then ''["sandy_springs"]''::jsonb'||chr(10)||'      when ''Gwinnett'' then ''["gwinnett"]''::jsonb');
    execute d;
  end if;
end $mig$;
