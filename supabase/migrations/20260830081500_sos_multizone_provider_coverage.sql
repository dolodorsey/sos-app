-- S.O.S. Phase 1: represent mobile providers across every zone they actually claim to serve.
-- Public-source coverage is intentionally distinct from operator verification and outreach consent.

create table if not exists public.sos_recruiting_candidate_zone_coverage (
  candidate_id uuid not null references public.sos_recruiting_candidates(id) on delete cascade,
  zone_id uuid not null references public.sos_service_zones(id) on delete cascade,
  coverage_type text not null default 'service_area' check (coverage_type in ('primary','office_location','service_area')),
  coverage_status text not null default 'source_claimed' check (coverage_status in ('source_claimed','operator_verified','declined')),
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  source_system text not null,
  source_url text,
  evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (candidate_id, zone_id)
);

alter table public.sos_recruiting_candidate_zone_coverage enable row level security;
revoke all on public.sos_recruiting_candidate_zone_coverage from public, anon, authenticated;
grant select, insert, update, delete on public.sos_recruiting_candidate_zone_coverage to service_role;

insert into public.sos_recruiting_candidate_zone_coverage(
  candidate_id, zone_id, coverage_type, coverage_status, confidence, source_system, evidence
)
select c.id, z.id, 'primary', 'source_claimed', 0.750, 'legacy_target_zone', jsonb_build_object('legacy_target_zone',c.target_zone)
from public.sos_recruiting_candidates c
join public.sos_service_zones z on z.zone_name=c.target_zone
where coalesce(c.is_demo,false)=false and c.target_zone is not null
on conflict(candidate_id,zone_id) do nothing;

-- Current public-source enrichment. Updates are idempotent and no-op when the production prospect UUID is absent.
update public.sos_recruiting_candidates
set website='https://firstplacetowing.com/', zip_code=coalesce(zip_code,'30318'), target_zone=coalesce(target_zone,'West Midtown'), updated_at=now()
where id='1f9060cd-7187-4ab8-9d63-6fa024cb0801';

update public.sos_recruiting_candidates
set website='https://atlroadside.com/', email=coalesce(email,'franksm066@gmail.com'), zip_code=coalesce(zip_code,'30331'), target_zone=coalesce(target_zone,'Hartsfield-Jackson Airport'), updated_at=now()
where id='edcf491d-c757-4f2a-b719-04ff3cecb505';

update public.sos_recruiting_candidates
set website='https://www.rapidemergencyatl.com/', email=coalesce(email,'rapidemergencyatl@gmail.com'), zip_code=coalesce(zip_code,'30080'), target_zone=coalesce(target_zone,'Smyrna / Vinings'), updated_at=now()
where id='91451894-9dda-49f7-840f-9b7df60deb4f';

update public.sos_recruiting_candidates
set website='https://www.mobiletireshoptaitiressolutionllc.com/', updated_at=now()
where id='9ccdf291-9e79-4ba2-846d-044eb8257819';

update public.sos_recruiting_candidates
set website='https://omwroadside.com/', email=coalesce(email,'Info@omwroadside.com'), updated_at=now()
where id='523dccaf-1197-4f16-9fca-1b1b3dbb23cc';

update public.sos_recruiting_candidates
set website='https://locksmithonwheels.us/', email=coalesce(email,'info@locksmithonwheels.us'), updated_at=now()
where id='16546804-54da-4b62-b039-5e15c368c35f';

update public.sos_recruiting_candidates
set website='https://carbatteryamerica.com/', updated_at=now()
where id='19b56e74-b17f-417e-8072-f49242fbbedc';

-- First Place: official site says Atlanta + surrounding cities; 30318 public business address anchors West Midtown.
insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,
       case when z.zone_name='West Midtown' then 'office_location' else 'service_area' end,
       'source_claimed', case when z.zone_name='West Midtown' then 0.980 else 0.850 end,
       'official_website','https://firstplacetowing.com/areas-we-serve/',
       jsonb_build_object('evidence','Official site states Atlanta and surrounding cities; public directory address is 670 Cameron M Alexander Blvd NW, Atlanta 30318.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='1f9060cd-7187-4ab8-9d63-6fa024cb0801' and z.is_active=true
on conflict(candidate_id,zone_id) do update set
  coverage_type=excluded.coverage_type,
  coverage_status=excluded.coverage_status,
  confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence),
  source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

-- All Around Atlanta: official site states all Atlanta metro; Camp Creek public business address anchors airport zone.
insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,
       case when z.zone_name='Hartsfield-Jackson Airport' then 'office_location' else 'service_area' end,
       'source_claimed', case when z.zone_name='Hartsfield-Jackson Airport' then 0.980 else 0.900 end,
       'official_website','https://atlroadside.com/about',
       jsonb_build_object('evidence','Official site states all Atlanta metro / Fulton, DeKalb, Cobb, Gwinnett and more; public directory lists 4687 Camp Creek Pkwy, Atlanta 30331.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='edcf491d-c757-4f2a-b719-04ff3cecb505' and z.is_active=true
on conflict(candidate_id,zone_id) do update set
  coverage_type=excluded.coverage_type,
  coverage_status=excluded.coverage_status,
  confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence),
  source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

-- Rapid Emergency: official site covers the Metro Atlanta counties containing all current launch zones.
insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,
       case when z.zone_name='Smyrna / Vinings' then 'office_location' else 'service_area' end,
       'source_claimed', case when z.zone_name='Smyrna / Vinings' then 0.980 else 0.900 end,
       'official_website','https://www.rapidemergencyatl.com/',
       jsonb_build_object('evidence','Official site states service across Clayton, Cobb, DeKalb, Douglas, Fulton, Gwinnett and Rockdale counties; corporate office is in Cobb County.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='91451894-9dda-49f7-840f-9b7df60deb4f' and z.is_active=true
on conflict(candidate_id,zone_id) do update set
  coverage_type=excluded.coverage_type,
  coverage_status=excluded.coverage_status,
  confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence),
  source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

-- Car Battery America explicitly names Cobb, Fulton, Intown Atlanta and DeKalb, including these launch markets.
insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,'service_area','source_claimed',0.950,'official_website','https://carbatteryamerica.com/',
       jsonb_build_object('evidence','Official site explicitly lists Cobb, Fulton, Intown Atlanta and DeKalb coverage, including Smyrna/Vinings, Sandy Springs, Buckhead, Midtown, Downtown, Decatur and Dunwoody.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='19b56e74-b17f-417e-8072-f49242fbbedc'
  and z.zone_name in ('Buckhead','Decatur','Downtown / Centennial','East Atlanta / Kirkwood','Midtown','Perimeter / Dunwoody','Sandy Springs','Smyrna / Vinings','West Midtown')
on conflict(candidate_id,zone_id) do update set
  coverage_status=excluded.coverage_status,
  confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence),
  source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

-- Locksmith on Wheels explicitly markets Atlanta, Buckhead, Decatur, Dunwoody, Sandy Springs, Smyrna and intown Atlanta.
insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,'service_area','source_claimed',0.950,'official_website','https://locksmithonwheels.us/',
       jsonb_build_object('evidence','Official site explicitly lists Atlanta, Buckhead, Decatur, Dunwoody, Sandy Springs and Smyrna and states coverage throughout intown Atlanta and first-ring suburbs.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='16546804-54da-4b62-b039-5e15c368c35f'
  and z.zone_name in ('Buckhead','Decatur','Downtown / Centennial','Midtown','Perimeter / Dunwoody','Sandy Springs','Smyrna / Vinings','West Midtown')
on conflict(candidate_id,zone_id) do update set
  coverage_status=excluded.coverage_status,
  confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence),
  source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

-- These two mobile operators advertise Atlanta/Georgia-wide coverage; keep it lower-confidence until ops verification.
insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,'service_area','source_claimed',0.700,'official_website','https://www.mobiletireshoptaitiressolutionllc.com/',
       jsonb_build_object('evidence','Official site states mobile tire and roadside services in the Atlanta area.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='9ccdf291-9e79-4ba2-846d-044eb8257819' and z.is_active=true
on conflict(candidate_id,zone_id) do update set coverage_status=excluded.coverage_status, confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence), source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

insert into public.sos_recruiting_candidate_zone_coverage(candidate_id,zone_id,coverage_type,coverage_status,confidence,source_system,source_url,evidence)
select c.id,z.id,'service_area','source_claimed',0.700,'official_website','https://omwroadside.com/',
       jsonb_build_object('evidence','Official site states roadside and mobile tire coverage throughout Georgia; coverage remains source-claimed and requires operator verification.','retrieved_on','2026-08-30')
from public.sos_recruiting_candidates c
cross join public.sos_service_zones z
where c.id='523dccaf-1197-4f16-9fca-1b1b3dbb23cc' and z.is_active=true
on conflict(candidate_id,zone_id) do update set coverage_status=excluded.coverage_status, confidence=greatest(public.sos_recruiting_candidate_zone_coverage.confidence,excluded.confidence), source_system=excluded.source_system, source_url=excluded.source_url, evidence=excluded.evidence, updated_at=now();

create or replace view public.sos_recruiting_candidate_zone_summary
with (security_invoker=true)
as
select c.id as candidate_id,
       c.company_name,
       count(zc.zone_id) filter (where zc.coverage_status <> 'declined') as covered_zone_count,
       array_agg(z.zone_name order by z.zone_name) filter (where zc.coverage_status <> 'declined') as covered_zones,
       count(zc.zone_id) filter (where zc.coverage_status='operator_verified') as operator_verified_zone_count,
       max(zc.updated_at) as coverage_updated_at
from public.sos_recruiting_candidates c
left join public.sos_recruiting_candidate_zone_coverage zc on zc.candidate_id=c.id
left join public.sos_service_zones z on z.id=zc.zone_id
where coalesce(c.is_demo,false)=false
group by c.id,c.company_name;

revoke all on public.sos_recruiting_candidate_zone_summary from public, anon, authenticated;
grant select on public.sos_recruiting_candidate_zone_summary to service_role;

create or replace view public.sos_zone_supply_gap_scorecard
with (security_invoker=true)
as
with real_candidates as (
  select * from public.sos_recruiting_candidates where coalesce(is_demo,false)=false
), real_heroes as (
  select h.*,
         (h.verification_status='verified' and coalesce(h.license_verified,false) and coalesce(h.insurance_verified,false) and coalesce(h.background_cleared,false) and coalesce(h.id_verified,false)) as is_verified,
         (h.stripe_connect_id is not null and h.payout_method is not null and (h.stripe_requirements_due is null or h.stripe_requirements_due in ('[]'::jsonb,'{}'::jsonb))) as is_payout_ready
  from public.sos_heroes h where coalesce(h.is_demo,false)=false
), candidate_zone as (
  select distinct c.id as candidate_id, z.zone_name, c.pipeline_stage, c.final_recruiting_score
  from real_candidates c
  join public.sos_recruiting_candidate_zone_coverage zc on zc.candidate_id=c.id
  join public.sos_service_zones z on z.id=zc.zone_id
  where zc.coverage_status in ('source_claimed','operator_verified') and zc.confidence >= 0.650
  union
  select distinct c.id, c.target_zone, c.pipeline_stage, c.final_recruiting_score
  from real_candidates c
  where c.target_zone is not null
    and not exists (
      select 1 from public.sos_recruiting_candidate_zone_coverage zc
      where zc.candidate_id=c.id and zc.coverage_status in ('source_claimed','operator_verified') and zc.confidence >= 0.650
    )
), candidate_rollup as (
  select zone_name,
         count(distinct candidate_id) as prospect_count,
         count(distinct candidate_id) filter (where pipeline_stage in ('priority','qualified')) as high_value_prospect_count,
         max(final_recruiting_score) as best_prospect_score
  from candidate_zone group by zone_name
), hero_rollup as (
  select zone,
         count(*) filter (where is_verified) as verified_heroes,
         count(*) filter (where is_verified and is_payout_ready and coalesce(test_mission_passed,false) and coalesce(on_duty,false)) as live_heroes
  from real_heroes where zone is not null group by zone
)
select z.id as zone_id,
       z.zone_name,
       z.city,
       z.state_code,
       t.launch_priority,
       t.minimum_verified_heroes,
       t.minimum_live_heroes,
       t.peak_minimum_live_heroes,
       coalesce(c.prospect_count,0::bigint) as prospect_count,
       coalesce(c.high_value_prospect_count,0::bigint) as high_value_prospect_count,
       c.best_prospect_score,
       coalesce(h.verified_heroes,0::bigint) as verified_heroes,
       coalesce(h.live_heroes,0::bigint) as live_heroes,
       greatest(t.minimum_verified_heroes-coalesce(h.verified_heroes,0::bigint),0::bigint) as verified_hero_gap,
       greatest(t.minimum_live_heroes-coalesce(h.live_heroes,0::bigint),0::bigint) as live_hero_gap,
       now() as generated_at
from public.sos_service_zones z
join public.sos_zone_supply_targets t on t.zone_id=z.id and t.is_active=true
left join candidate_rollup c on c.zone_name=z.zone_name
left join hero_rollup h on h.zone=z.zone_name
where z.is_active=true;

revoke all on public.sos_zone_supply_gap_scorecard from public, anon, authenticated;
grant select on public.sos_zone_supply_gap_scorecard to service_role;

create or replace view public.sos_recruiting_candidate_zone_gap
with (security_invoker=true)
as
select c.id as candidate_id,
       max(s.verified_hero_gap) as max_verified_hero_gap,
       max(s.live_hero_gap) as max_live_hero_gap,
       count(distinct zc.zone_id) filter (
         where zc.coverage_status in ('source_claimed','operator_verified') and zc.confidence >= 0.650
       ) as covered_zone_count
from public.sos_recruiting_candidates c
left join public.sos_recruiting_candidate_zone_coverage zc
  on zc.candidate_id=c.id
 and zc.coverage_status in ('source_claimed','operator_verified')
 and zc.confidence >= 0.650
left join public.sos_zone_supply_gap_scorecard s on s.zone_id=zc.zone_id
where coalesce(c.is_demo,false)=false
group by c.id;

revoke all on public.sos_recruiting_candidate_zone_gap from public, anon, authenticated;
grant select on public.sos_recruiting_candidate_zone_gap to service_role;

create or replace view public.sos_provider_activation_command_queue_v2
with (security_invoker=true)
as
select q.candidate_id,
       q.company_name,
       q.contact_name,
       q.email,
       q.phone,
       q.website,
       q.city,
       q.state_code,
       q.target_zone,
       q.services_enabled,
       q.final_recruiting_score,
       q.pipeline_stage,
       q.outreach_status,
       q.consent_basis,
       q.assigned_owner,
       q.activation_stage,
       q.stage_entered_at,
       q.stage_sla_hours,
       q.stage_age_hours,
       q.is_overdue,
       q.next_required_action,
       q.next_action_at,
       coalesce(g.max_verified_hero_gap,q.zone_verified_gap,0::bigint)::bigint as zone_verified_gap,
       coalesce(g.max_live_hero_gap,q.zone_live_gap,0::bigint)::bigint as zone_live_gap,
       (q.priority_rank
        - least(coalesce(q.zone_verified_gap,0::bigint)*8,40::bigint)::numeric
        - least(coalesce(q.zone_live_gap,0::bigint)*12,36::bigint)::numeric
        + least(coalesce(g.max_verified_hero_gap,q.zone_verified_gap,0::bigint)*8,40::bigint)::numeric
        + least(coalesce(g.max_live_hero_gap,q.zone_live_gap,0::bigint)*12,36::bigint)::numeric) as priority_rank,
       q.application_id,
       q.hero_id,
       now() as generated_at
from public.sos_provider_activation_command_queue q
left join public.sos_recruiting_candidate_zone_gap g on g.candidate_id=q.candidate_id;

revoke all on public.sos_provider_activation_command_queue_v2 from public, anon, authenticated;
grant select on public.sos_provider_activation_command_queue_v2 to service_role;

create or replace view public.sos_provider_activation_sla_watch
with (security_invoker=true)
as
select candidate_id,company_name,contact_name,email,phone,website,city,state_code,target_zone,services_enabled,
       final_recruiting_score,pipeline_stage,outreach_status,consent_basis,assigned_owner,activation_stage,
       stage_entered_at,stage_sla_hours,stage_age_hours,is_overdue,next_required_action,next_action_at,
       zone_verified_gap,zone_live_gap,priority_rank,application_id,hero_id,generated_at
from public.sos_provider_activation_command_queue_v2
where is_overdue=true and activation_stage <> 'live';

revoke all on public.sos_provider_activation_sla_watch from public, anon, authenticated;
grant select on public.sos_provider_activation_sla_watch to service_role;

create or replace function public.sos_ops_provider_activation_queue(p_limit integer default 100)
returns setof public.sos_provider_activation_command_queue
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;
  return query
  select v2.* from public.sos_provider_activation_command_queue_v2 v2
  order by v2.is_overdue desc, v2.priority_rank desc, v2.stage_age_hours desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;
$$;

revoke all on function public.sos_ops_provider_activation_queue(integer) from public, anon;
grant execute on function public.sos_ops_provider_activation_queue(integer) to authenticated;

comment on table public.sos_recruiting_candidate_zone_coverage is 'S.O.S.-only many-to-many provider prospect service coverage. source_claimed coverage is not verification, availability, or outreach consent.';
comment on view public.sos_provider_activation_command_queue_v2 is 'S.O.S. activation queue ranked against the largest shortage among every source-claimed/operator-verified zone the prospect can cover.';
