-- Controlled recruiting wave only.
-- Legacy Hero-shaped records without authenticated accounts are treated as recruiting
-- candidates. No candidate becomes an active Hero, enters coverage, receives missions,
-- or becomes eligible for payouts through this migration.

create table if not exists public.sos_recruiting_candidates (
  id uuid primary key default gen_random_uuid(),
  source_hero_id uuid not null unique references public.sos_heroes(id) on delete cascade,
  source_user_id uuid not null references public.sos_users(id) on delete cascade,
  candidate_source text not null default 'legacy_hero_profile',
  first_name text,
  last_name text,
  email text,
  phone text,
  target_zone text,
  services_enabled text[] not null default '{}',
  tools_available text[] not null default '{}',
  vehicle_type text,
  source_rating numeric(4,2),
  source_review_count integer not null default 0 check (source_review_count>=0),
  priority_score numeric(5,2) not null default 0 check (priority_score between 0 and 100),
  pipeline_stage text not null default 'prospect' check (pipeline_stage in (
    'prospect','qualified','contacted','screening','training','account_setup',
    'test_mission','approved','rejected','withdrawn'
  )),
  outreach_status text not null default 'not_queued' check (outreach_status in (
    'not_queued','queued','in_progress','sent','responded','failed','paused'
  )),
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sos_recruiting_pipeline_idx
  on public.sos_recruiting_candidates(pipeline_stage,outreach_status,next_action_at);
create index if not exists sos_recruiting_zone_priority_idx
  on public.sos_recruiting_candidates(target_zone,priority_score desc,source_review_count desc);

alter table public.sos_recruiting_candidates enable row level security;
revoke all on public.sos_recruiting_candidates from public,anon,authenticated;
grant select,insert,update,delete on public.sos_recruiting_candidates to service_role;

-- The score is intentionally transparent and bounded:
-- rating quality 40%, completed-mission experience 25%, enabled service breadth 20%,
-- and available equipment breadth 15%.
insert into public.sos_recruiting_candidates(
  source_hero_id,source_user_id,candidate_source,first_name,last_name,email,phone,
  target_zone,services_enabled,tools_available,vehicle_type,source_rating,
  source_review_count,priority_score,notes
)
select h.id,u.id,'legacy_hero_profile',u.first_name,u.last_name,u.email,u.phone,
       h.zone,coalesce(h.services_enabled,'{}'::text[]),coalesce(h.tools_available,'{}'::text[]),
       h.vehicle_type,h.rating,coalesce(h.total_missions,0),
       round((
         least(greatest(coalesce(h.rating,0),0),5)/5*40
         + least(greatest(coalesce(h.total_missions,0),0),100)/100.0*25
         + least(coalesce(array_length(h.services_enabled,1),0),8)/8.0*20
         + least(coalesce(array_length(h.tools_available,1),0),6)/6.0*15
       )::numeric,2),
       'Imported from a legacy Hero-shaped profile. Authentication, current verification, training, payout onboarding, test mission and a fresh GPS shift remain mandatory.'
from public.sos_heroes h
join public.sos_users u on u.id=h.user_id
where u.auth_id is null
on conflict(source_hero_id) do update set
  source_user_id=excluded.source_user_id,
  first_name=excluded.first_name,
  last_name=excluded.last_name,
  email=excluded.email,
  phone=excluded.phone,
  target_zone=excluded.target_zone,
  services_enabled=excluded.services_enabled,
  tools_available=excluded.tools_available,
  vehicle_type=excluded.vehicle_type,
  source_rating=excluded.source_rating,
  source_review_count=excluded.source_review_count,
  priority_score=excluded.priority_score,
  updated_at=now();

-- Queue only contactable, geographically assigned candidates with declared services and tools.
with ranked as (
  select c.id,c.target_zone,
         row_number() over(
           partition by c.target_zone
           order by c.priority_score desc,c.source_review_count desc,c.id
         ) rn
  from public.sos_recruiting_candidates c
  where nullif(trim(c.target_zone),'') is not null
    and nullif(trim(c.email),'') is not null
    and nullif(trim(c.phone),'') is not null
    and coalesce(array_length(c.services_enabled,1),0)>0
    and coalesce(array_length(c.tools_available,1),0)>0
), first_wave as (
  select id from ranked where rn<=20
), sequenced as (
  select c.id,row_number() over(order by c.priority_score desc,c.source_review_count desc,c.id) seq
  from public.sos_recruiting_candidates c
  join first_wave f on f.id=c.id
)
update public.sos_recruiting_candidates c
set pipeline_stage='qualified',
    outreach_status='queued',
    next_action_at=now()+(s.seq-1)*interval '12 minutes',
    notes=case
      when coalesce(c.notes,'') like '%First Hero activation wave:%' then c.notes
      else concat_ws(E'\n',nullif(c.notes,''),
        'First Hero activation wave: verification, training, authenticated account, payout onboarding, test mission and live GPS shift still required.')
    end,
    updated_at=now()
from sequenced s
where c.id=s.id and c.pipeline_stage='prospect';

create or replace view public.sos_first_wave_summary
with (security_invoker=true)
as
with readiness as (
  select c.*,
         (u.auth_id is not null) as has_authenticated_account,
         (
           h.verification_status='verified'
           and coalesce(h.id_verified,false)
           and coalesce(h.background_cleared,false)
           and coalesce(h.insurance_verified,false)
           and coalesce(h.license_verified,false)
           and coalesce(h.test_mission_passed,false)
           and not exists (
             select 1 from public.sos_hero_verification_checks vc
             where vc.hero_id=h.id and vc.required and vc.status<>'passed'
           )
         ) as verification_complete,
         (nullif(h.stripe_connect_id,'') is not null) as payout_ready
  from public.sos_recruiting_candidates c
  join public.sos_users u on u.id=c.source_user_id
  join public.sos_heroes h on h.id=c.source_hero_id
  where c.pipeline_stage not in ('rejected','withdrawn')
)
select target_zone,
       count(*)::integer candidates,
       count(*) filter(where outreach_status='queued')::integer queued,
       count(*) filter(where outreach_status in ('sent','responded'))::integer outreach_started,
       count(*) filter(where has_authenticated_account)::integer authenticated_accounts,
       count(*) filter(where verification_complete)::integer verification_complete,
       count(*) filter(where payout_ready)::integer payout_ready,
       count(*) filter(where has_authenticated_account and verification_complete and payout_ready)::integer activation_ready,
       round(avg(priority_score),2) average_priority,
       min(next_action_at) next_action_at
from readiness
group by target_zone;

create or replace view public.sos_recruiting_pipeline_health
with (security_invoker=true)
as
with readiness as (
  select c.*,
         (u.auth_id is not null) as has_authenticated_account,
         (
           h.verification_status='verified'
           and coalesce(h.id_verified,false)
           and coalesce(h.background_cleared,false)
           and coalesce(h.insurance_verified,false)
           and coalesce(h.license_verified,false)
           and coalesce(h.test_mission_passed,false)
           and not exists (
             select 1 from public.sos_hero_verification_checks vc
             where vc.hero_id=h.id and vc.required and vc.status<>'passed'
           )
         ) as verification_complete,
         (nullif(h.stripe_connect_id,'') is not null) as payout_ready
  from public.sos_recruiting_candidates c
  join public.sos_users u on u.id=c.source_user_id
  join public.sos_heroes h on h.id=c.source_hero_id
)
select count(*)::integer total_candidates,
       count(*) filter(where pipeline_stage='qualified')::integer qualified_candidates,
       count(*) filter(where outreach_status='queued')::integer queued_outreach,
       count(*) filter(where nullif(trim(email),'') is null or nullif(trim(phone),'') is null)::integer contact_gaps,
       count(distinct target_zone)::integer zones_covered,
       count(*) filter(where has_authenticated_account)::integer authenticated_accounts,
       count(*) filter(where verification_complete)::integer verification_complete,
       count(*) filter(where payout_ready)::integer payout_ready,
       count(*) filter(where has_authenticated_account and verification_complete and payout_ready)::integer activation_ready,
       round(avg(priority_score),2) average_priority,
       min(next_action_at) next_action_at,
       now() generated_at
from readiness;

revoke all on public.sos_first_wave_summary,public.sos_recruiting_pipeline_health
  from public,anon,authenticated;
grant select on public.sos_first_wave_summary,public.sos_recruiting_pipeline_health
  to service_role;
