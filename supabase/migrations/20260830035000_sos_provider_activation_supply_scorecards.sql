create or replace view public.sos_provider_activation_funnel_scorecard
with (security_invoker = true)
as
with candidate_base as (
  select *
  from public.sos_recruiting_candidates
  where coalesce(is_demo, false) = false
),
application_base as (
  select a.*
  from public.sos_hero_applications a
  join candidate_base c on c.id = a.candidate_id
),
hero_base as (
  select h.*
  from public.sos_heroes h
  where coalesce(h.is_demo, false) = false
),
hero_flags as (
  select h.*,
         (h.verification_status = 'verified'
          and coalesce(h.license_verified,false)
          and coalesce(h.insurance_verified,false)
          and coalesce(h.background_cleared,false)
          and coalesce(h.id_verified,false)) as is_verified,
         (h.stripe_connect_id is not null
          and h.payout_method is not null
          and (h.stripe_requirements_due is null or h.stripe_requirements_due in ('[]'::jsonb,'{}'::jsonb))) as is_payout_ready
  from hero_base h
)
select
  (select count(*) from candidate_base) as prospects,
  (select count(*) from candidate_base where last_outreach_at is not null or outreach_status not in ('not_queued','suppressed')) as contacted,
  (select count(*) from candidate_base where application_id is not null or converted_at is not null) as engaged_or_converted,
  (select count(*) from application_base) as applicants,
  (select count(*) from application_base where credentials_complete_at is not null) as credential_complete,
  (select count(*) from hero_flags) as hero_profiles,
  (select count(*) from hero_flags where is_verified) as verified,
  (select count(*) from hero_flags where is_payout_ready) as payout_ready,
  (select count(*) from hero_flags where coalesce(test_mission_passed,false)) as test_mission_passed,
  (select count(*) from hero_flags where is_verified and is_payout_ready and coalesce(test_mission_passed,false)) as activation_ready,
  (select count(*) from hero_flags where is_verified and is_payout_ready and coalesce(test_mission_passed,false) and coalesce(on_duty,false)) as live_heroes,
  now() as generated_at;

create or replace view public.sos_zone_supply_gap_scorecard
with (security_invoker = true)
as
with real_candidates as (
  select *
  from public.sos_recruiting_candidates
  where coalesce(is_demo,false)=false
),
real_heroes as (
  select h.*,
         (h.verification_status = 'verified'
          and coalesce(h.license_verified,false)
          and coalesce(h.insurance_verified,false)
          and coalesce(h.background_cleared,false)
          and coalesce(h.id_verified,false)) as is_verified,
         (h.stripe_connect_id is not null
          and h.payout_method is not null
          and (h.stripe_requirements_due is null or h.stripe_requirements_due in ('[]'::jsonb,'{}'::jsonb))) as is_payout_ready
  from public.sos_heroes h
  where coalesce(h.is_demo,false)=false
),
candidate_rollup as (
  select target_zone,
         count(*) as prospect_count,
         count(*) filter (where pipeline_stage in ('priority','qualified')) as high_value_prospect_count,
         max(final_recruiting_score) as best_prospect_score
  from real_candidates
  where target_zone is not null
  group by target_zone
),
hero_rollup as (
  select zone,
         count(*) filter (where is_verified) as verified_heroes,
         count(*) filter (where is_verified and is_payout_ready and coalesce(test_mission_passed,false) and coalesce(on_duty,false)) as live_heroes
  from real_heroes
  where zone is not null
  group by zone
)
select z.id as zone_id,
       z.zone_name,
       z.city,
       z.state_code,
       t.launch_priority,
       t.minimum_verified_heroes,
       t.minimum_live_heroes,
       t.peak_minimum_live_heroes,
       coalesce(c.prospect_count,0) as prospect_count,
       coalesce(c.high_value_prospect_count,0) as high_value_prospect_count,
       c.best_prospect_score,
       coalesce(h.verified_heroes,0) as verified_heroes,
       coalesce(h.live_heroes,0) as live_heroes,
       greatest(t.minimum_verified_heroes - coalesce(h.verified_heroes,0),0) as verified_hero_gap,
       greatest(t.minimum_live_heroes - coalesce(h.live_heroes,0),0) as live_hero_gap,
       now() as generated_at
from public.sos_service_zones z
join public.sos_zone_supply_targets t on t.zone_id=z.id and t.is_active=true
left join candidate_rollup c on c.target_zone=z.zone_name
left join hero_rollup h on h.zone=z.zone_name
where z.is_active=true;

revoke all on public.sos_provider_activation_funnel_scorecard from public, anon, authenticated, service_role;
revoke all on public.sos_zone_supply_gap_scorecard from public, anon, authenticated, service_role;
grant select on public.sos_provider_activation_funnel_scorecard to service_role;
grant select on public.sos_zone_supply_gap_scorecard to service_role;

comment on view public.sos_provider_activation_funnel_scorecard is 'Service-role-only S.O.S. provider activation funnel: prospects through live Heroes, excluding demo supply.';
comment on view public.sos_zone_supply_gap_scorecard is 'Service-role-only S.O.S. zone supply scorecard comparing real prospects and activation-ready live Heroes against launch targets.';
