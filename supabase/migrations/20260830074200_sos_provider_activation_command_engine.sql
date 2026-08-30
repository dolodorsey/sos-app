alter table public.sos_recruiting_candidates
  add column if not exists pipeline_stage_entered_at timestamptz,
  add column if not exists outreach_status_entered_at timestamptz;

update public.sos_recruiting_candidates
set pipeline_stage_entered_at = coalesce(pipeline_stage_entered_at, created_at),
    outreach_status_entered_at = coalesce(outreach_status_entered_at, created_at)
where pipeline_stage_entered_at is null
   or outreach_status_entered_at is null;

alter table public.sos_recruiting_candidates
  alter column pipeline_stage_entered_at set default now(),
  alter column outreach_status_entered_at set default now();

create or replace function private.sos_track_recruiting_stage_timestamps()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'INSERT' then
    new.pipeline_stage_entered_at := coalesce(new.pipeline_stage_entered_at, now());
    new.outreach_status_entered_at := coalesce(new.outreach_status_entered_at, now());
  else
    if new.pipeline_stage is distinct from old.pipeline_stage then
      new.pipeline_stage_entered_at := now();
    end if;
    if new.outreach_status is distinct from old.outreach_status then
      new.outreach_status_entered_at := now();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.sos_track_recruiting_stage_timestamps() from public, anon, authenticated;
grant execute on function private.sos_track_recruiting_stage_timestamps() to service_role;

drop trigger if exists sos_recruiting_candidates_stage_timestamps on public.sos_recruiting_candidates;
create trigger sos_recruiting_candidates_stage_timestamps
before insert or update of pipeline_stage, outreach_status
on public.sos_recruiting_candidates
for each row
execute function private.sos_track_recruiting_stage_timestamps();

create or replace view public.sos_provider_activation_command_queue
with (security_invoker = true)
as
with candidate_base as (
  select c.*
  from public.sos_recruiting_candidates c
  where coalesce(c.is_demo,false)=false
),
activation as (
  select
    c.*,
    a.id as resolved_application_id,
    a.status as application_status,
    a.submitted_at,
    a.credentials_complete_at,
    a.updated_at as application_updated_at,
    h.id as resolved_hero_id,
    h.verification_status,
    h.license_verified,
    h.insurance_verified,
    h.background_cleared,
    h.id_verified,
    h.stripe_connect_id,
    h.payout_method,
    h.stripe_requirements_due,
    h.test_mission_passed,
    h.on_duty,
    h.updated_at as hero_updated_at,
    (
      h.id is not null
      and h.verification_status='verified'
      and coalesce(h.license_verified,false)
      and coalesce(h.insurance_verified,false)
      and coalesce(h.background_cleared,false)
      and coalesce(h.id_verified,false)
      and not exists (
        select 1 from public.sos_hero_verification_checks vc
        where vc.hero_id=h.id and vc.required and vc.status<>'passed'
      )
    ) as is_verified,
    (
      h.id is not null
      and nullif(h.stripe_connect_id,'') is not null
      and nullif(h.payout_method,'') is not null
      and (h.stripe_requirements_due is null or h.stripe_requirements_due in ('[]'::jsonb,'{}'::jsonb))
    ) as is_payout_ready
  from candidate_base c
  left join lateral (
    select a1.*
    from public.sos_hero_applications a1
    where a1.id=c.application_id or a1.candidate_id=c.id
    order by a1.submitted_at desc
    limit 1
  ) a on true
  left join lateral (
    select h1.*
    from public.sos_heroes h1
    where coalesce(h1.is_demo,false)=false
      and (h1.id=c.source_hero_id or h1.id=a.source_hero_id)
    order by h1.updated_at desc nulls last
    limit 1
  ) h on true
),
staged as (
  select a.*,
    case
      when resolved_hero_id is not null and is_verified and is_payout_ready and coalesce(test_mission_passed,false) and coalesce(on_duty,false) then 'live'
      when resolved_hero_id is not null and is_verified and is_payout_ready and coalesce(test_mission_passed,false) then 'activation_ready'
      when resolved_hero_id is not null and is_verified and is_payout_ready then 'test_mission'
      when resolved_hero_id is not null and is_verified then 'payout_setup'
      when resolved_hero_id is not null then 'verification'
      when resolved_application_id is not null and application_status='conditionally_approved' then 'account_claim'
      when resolved_application_id is not null and credentials_complete_at is not null then 'credentials_review'
      when resolved_application_id is not null then 'credential_upload'
      when outreach_status='responded' or pipeline_stage in ('contacted','screening','training','account_setup','test_mission','approved') then 'application_conversion'
      when outreach_status in ('ready','queued','in_progress','sent','failed','paused') then 'outreach_followup'
      when consent_basis='public_business_listing_review_required' and outreach_status='not_queued' then 'compliance_review'
      else 'prospect_qualification'
    end as activation_stage
  from activation a
),
scored as (
  select s.*,
    case activation_stage
      when 'live' then null
      when 'activation_ready' then 24
      when 'test_mission' then 48
      when 'payout_setup' then 24
      when 'verification' then 48
      when 'account_claim' then 24
      when 'credentials_review' then 24
      when 'credential_upload' then 72
      when 'application_conversion' then 48
      when 'outreach_followup' then 72
      when 'compliance_review' then 24
      else 24
    end::integer as stage_sla_hours,
    case activation_stage
      when 'live' then hero_updated_at
      when 'activation_ready' then coalesce(hero_updated_at, updated_at)
      when 'test_mission' then coalesce(hero_updated_at, updated_at)
      when 'payout_setup' then coalesce(hero_updated_at, updated_at)
      when 'verification' then coalesce(hero_updated_at, updated_at)
      when 'account_claim' then coalesce(application_updated_at, updated_at)
      when 'credentials_review' then coalesce(credentials_complete_at, application_updated_at, updated_at)
      when 'credential_upload' then coalesce(submitted_at, application_updated_at, updated_at)
      when 'application_conversion' then coalesce(last_outreach_at, pipeline_stage_entered_at, updated_at)
      when 'outreach_followup' then coalesce(last_outreach_at, outreach_status_entered_at, updated_at)
      when 'compliance_review' then coalesce(outreach_status_entered_at, created_at)
      else coalesce(pipeline_stage_entered_at, created_at)
    end as stage_entered_at,
    case activation_stage
      when 'live' then 'Maintain availability, quality, credentials, and payout health.'
      when 'activation_ready' then 'Complete go-live readiness check and place the verified Hero into launch coverage.'
      when 'test_mission' then 'Schedule and pass a controlled test mission before live dispatch.'
      when 'payout_setup' then 'Finish Stripe Connect payout setup and clear outstanding payout requirements.'
      when 'verification' then 'Complete required identity, license, insurance, background, and operational verification.'
      when 'account_claim' then 'Have the conditionally approved applicant claim the Hero profile and continue final onboarding.'
      when 'credentials_review' then 'Review submitted credentials and move the applicant to a decision within SLA.'
      when 'credential_upload' then 'Drive completion of required credential uploads; do not activate before verification.'
      when 'application_conversion' then 'Convert the engaged prospect into a secure S.O.S. Hero application.'
      when 'outreach_followup' then 'Complete the compliant follow-up sequence and capture outcome / next action.'
      when 'compliance_review' then 'Review public-source provenance and document a lawful outreach basis before any outreach is queued.'
      else 'Qualify service fit, zone fit, contactability, provenance, and owner assignment.'
    end as next_required_action
  from staged s
)
select
  s.id as candidate_id,
  s.company_name,
  nullif(trim(concat_ws(' ',s.first_name,s.last_name)),'') as contact_name,
  s.email,
  s.phone,
  s.website,
  s.city,
  s.state_code,
  s.target_zone,
  s.services_enabled,
  s.final_recruiting_score,
  s.pipeline_stage,
  s.outreach_status,
  s.consent_basis,
  s.assigned_owner,
  s.activation_stage,
  s.stage_entered_at,
  s.stage_sla_hours,
  round((extract(epoch from (now()-s.stage_entered_at))/3600.0)::numeric,2) as stage_age_hours,
  case when s.stage_sla_hours is null then false else now() > s.stage_entered_at + make_interval(hours=>s.stage_sla_hours) end as is_overdue,
  s.next_required_action,
  s.next_action_at,
  coalesce(z.verified_hero_gap,0) as zone_verified_gap,
  coalesce(z.live_hero_gap,0) as zone_live_gap,
  (
    coalesce(s.final_recruiting_score,0)
    + least(coalesce(z.verified_hero_gap,0)*8,40)
    + least(coalesce(z.live_hero_gap,0)*12,36)
    + case when s.activation_stage in ('verification','payout_setup','test_mission','activation_ready') then 25 else 0 end
    + case when s.activation_stage in ('credentials_review','account_claim') then 15 else 0 end
    + case when s.stage_sla_hours is not null and now() > s.stage_entered_at + make_interval(hours=>s.stage_sla_hours) then 30 else 0 end
  )::numeric as priority_rank,
  s.resolved_application_id as application_id,
  s.resolved_hero_id as hero_id,
  now() as generated_at
from scored s
left join public.sos_zone_supply_gap_scorecard z on z.zone_name=s.target_zone;

create or replace view public.sos_provider_activation_sla_watch
with (security_invoker = true)
as
select *
from public.sos_provider_activation_command_queue
where is_overdue=true
  and activation_stage <> 'live';

revoke all on public.sos_provider_activation_command_queue from public, anon, authenticated, service_role;
revoke all on public.sos_provider_activation_sla_watch from public, anon, authenticated, service_role;
grant select on public.sos_provider_activation_command_queue to service_role;
grant select on public.sos_provider_activation_sla_watch to service_role;

create table if not exists private.sos_provider_activation_alert_state (
  candidate_id uuid not null,
  activation_stage text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_alerted_at timestamptz,
  last_alert_id uuid,
  resolved_at timestamptz,
  occurrences bigint not null default 1,
  primary key(candidate_id, activation_stage)
);

alter table private.sos_provider_activation_alert_state enable row level security;
revoke all on table private.sos_provider_activation_alert_state from public, anon, authenticated;
grant select, insert, update, delete on table private.sos_provider_activation_alert_state to service_role;

create or replace function private.sos_sync_provider_activation_alerts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v record;
  v_state private.sos_provider_activation_alert_state%rowtype;
  v_alert_id uuid;
  v_current integer := 0;
  v_new_alerts integer := 0;
  v_resolved integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('sos_provider_activation_alert_sync',0)) then
    return jsonb_build_object('status','skipped_overlap','current_overdue',0,'new_alerts',0,'resolved',0);
  end if;

  for v in select * from public.sos_provider_activation_sla_watch
  loop
    v_current := v_current + 1;
    select * into v_state
    from private.sos_provider_activation_alert_state s
    where s.candidate_id=v.candidate_id and s.activation_stage=v.activation_stage
    for update;

    if not found or v_state.resolved_at is not null then
      insert into public.marketplace_operator_alerts(product_key,alert_type,entity_id,title,body,metadata)
      values(
        'sos','provider_activation_sla',v.candidate_id,
        case when not found then 'S.O.S. provider activation SLA overdue' else 'S.O.S. provider activation SLA reopened' end,
        left(coalesce(v.company_name,'Provider prospect') || ' · ' || replace(v.activation_stage,'_',' ') || ' · ' || coalesce(v.next_required_action,''),1000),
        jsonb_build_object(
          'candidate_id',v.candidate_id,
          'company_name',v.company_name,
          'zone',v.target_zone,
          'activation_stage',v.activation_stage,
          'stage_age_hours',v.stage_age_hours,
          'stage_sla_hours',v.stage_sla_hours,
          'priority_rank',v.priority_rank,
          'next_required_action',v.next_required_action,
          'zone_verified_gap',v.zone_verified_gap,
          'zone_live_gap',v.zone_live_gap,
          'detected_at',now()
        )
      ) returning id into v_alert_id;

      insert into private.sos_provider_activation_alert_state(
        candidate_id,activation_stage,first_seen_at,last_seen_at,last_alerted_at,last_alert_id,resolved_at,occurrences
      ) values(
        v.candidate_id,v.activation_stage,now(),now(),now(),v_alert_id,null,1
      )
      on conflict(candidate_id,activation_stage) do update
        set last_seen_at=excluded.last_seen_at,
            last_alerted_at=excluded.last_alerted_at,
            last_alert_id=excluded.last_alert_id,
            resolved_at=null,
            occurrences=private.sos_provider_activation_alert_state.occurrences+1;
      v_new_alerts := v_new_alerts + 1;
    else
      update private.sos_provider_activation_alert_state
      set last_seen_at=now(), occurrences=occurrences+1
      where candidate_id=v.candidate_id and activation_stage=v.activation_stage;
    end if;
  end loop;

  update private.sos_provider_activation_alert_state s
  set resolved_at=now()
  where s.resolved_at is null
    and not exists(
      select 1 from public.sos_provider_activation_sla_watch w
      where w.candidate_id=s.candidate_id and w.activation_stage=s.activation_stage
    );
  get diagnostics v_resolved=row_count;

  return jsonb_build_object('status','ok','current_overdue',v_current,'new_alerts',v_new_alerts,'resolved',v_resolved);
end;
$$;

revoke all on function private.sos_sync_provider_activation_alerts() from public, anon, authenticated;
grant execute on function private.sos_sync_provider_activation_alerts() to service_role;

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
  select * from public.sos_provider_activation_command_queue
  order by is_overdue desc, priority_rank desc, stage_age_hours desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;
$$;

revoke all on function public.sos_ops_provider_activation_queue(integer) from public, anon;
grant execute on function public.sos_ops_provider_activation_queue(integer) to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname='sos-provider-activation-alerts';

select cron.schedule(
  'sos-provider-activation-alerts',
  '*/15 * * * *',
  'select private.sos_sync_provider_activation_alerts();'
);

comment on view public.sos_provider_activation_command_queue is 'Service-role-only S.O.S. provider activation command queue with stage SLA, next action, zone gap, and priority ranking.';
comment on view public.sos_provider_activation_sla_watch is 'Service-role-only S.O.S. activation SLA exceptions feeding operator alerts.';
comment on function public.sos_ops_provider_activation_queue(integer) is 'Marketplace-operator-only RPC for the prioritized S.O.S. provider activation queue.';
