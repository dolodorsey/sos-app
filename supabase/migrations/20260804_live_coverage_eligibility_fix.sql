-- Count only Heroes who can actually start a live shift.
-- Legacy verified flags alone are not enough: a real authenticated account and
-- a completely passed verification checklist are required.

drop view if exists public.sos_live_coverage;
create view public.sos_live_coverage
with (security_invoker=true)
as
with eligible_heroes as (
  select h.*
  from public.sos_heroes h
  join public.sos_users u on u.id=h.user_id
  where h.verification_status='verified'
    and h.id_verified
    and h.background_cleared
    and h.insurance_verified
    and h.license_verified
    and h.test_mission_passed
    and u.status='active'
    and u.auth_id is not null
    and not exists (
      select 1
      from public.sos_hero_verification_checks c
      where c.hero_id=h.id
        and c.required
        and c.status<>'passed'
    )
)
select z.id as zone_id,
       z.zone_name,
       z.city,
       z.state_code,
       t.minimum_verified_heroes,
       t.minimum_live_heroes,
       t.peak_minimum_live_heroes,
       t.launch_priority,
       count(distinct h.id)::integer as verified_heroes,
       count(distinct h.id) filter (
         where h.on_duty and h.last_gps_at>=now()-interval '15 minutes'
       )::integer as live_heroes,
       max(h.last_gps_at) as freshest_location_at,
       greatest(t.minimum_verified_heroes-count(distinct h.id),0)::integer as verified_gap,
       greatest(
         t.minimum_live_heroes-count(distinct h.id) filter (
           where h.on_duty and h.last_gps_at>=now()-interval '15 minutes'
         ),0
       )::integer as live_gap
from public.sos_service_zones z
join public.sos_zone_supply_targets t on t.zone_id=z.id and t.is_active
left join eligible_heroes h on lower(coalesce(h.zone,''))=lower(z.zone_name)
where z.is_active
group by z.id,t.minimum_verified_heroes,t.minimum_live_heroes,
  t.peak_minimum_live_heroes,t.launch_priority;

revoke all on public.sos_live_coverage from anon,authenticated;
