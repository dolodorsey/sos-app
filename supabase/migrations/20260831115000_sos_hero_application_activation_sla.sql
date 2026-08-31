-- S.O.S. only: make the canonical Hero application state machine internally consistent
-- and add service-role/operator observability for stalled application conversion.

-- The live status constraint no longer permits `submitted`, but the column default still
-- pointed at that retired state. Any trusted insert that omitted status could therefore fail.
alter table public.sos_hero_applications
  alter column status set default 'documents_required';

alter table public.sos_hero_applications
  add column if not exists status_entered_at timestamptz;

update public.sos_hero_applications
set status_entered_at = coalesce(status_entered_at, updated_at, submitted_at, now())
where status_entered_at is null;

alter table public.sos_hero_applications
  alter column status_entered_at set default now(),
  alter column status_entered_at set not null;

create or replace function private.sos_track_hero_application_status_entered_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'INSERT' then
    new.status_entered_at := coalesce(new.status_entered_at, now());
  elsif new.status is distinct from old.status then
    new.status_entered_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.sos_track_hero_application_status_entered_at() from public, anon, authenticated;
grant execute on function private.sos_track_hero_application_status_entered_at() to service_role;

drop trigger if exists sos_hero_application_status_clock on public.sos_hero_applications;
create trigger sos_hero_application_status_clock
before insert or update of status
on public.sos_hero_applications
for each row
execute function private.sos_track_hero_application_status_entered_at();

create or replace view public.sos_hero_application_activation_command_queue
with (security_invoker = true)
as
with document_rollup as (
  select
    d.application_id,
    count(*) filter (where d.status <> 'rejected')::integer as uploaded_document_count,
    count(*) filter (where d.status = 'accepted')::integer as accepted_document_count,
    count(distinct d.document_type) filter (
      where d.status <> 'rejected'
        and d.document_type in ('government_id','drivers_license','insurance')
    )::integer as required_uploaded_count,
    count(distinct d.document_type) filter (
      where d.status = 'accepted'
        and d.document_type in ('government_id','drivers_license','insurance')
    )::integer as required_accepted_count
  from public.sos_hero_application_documents d
  group by d.application_id
),
base as (
  select
    a.*,
    coalesce(d.uploaded_document_count,0) as uploaded_document_count,
    coalesce(d.accepted_document_count,0) as accepted_document_count,
    coalesce(d.required_uploaded_count,0) as required_uploaded_count,
    coalesce(d.required_accepted_count,0) as required_accepted_count,
    case a.status
      when 'documents_required' then 72
      when 'waitlisted' then 24
      when 'reviewing' then 24
      when 'needs_information' then 72
      when 'conditionally_approved' then 48
      when 'approved' then 48
      else null
    end::integer as stage_sla_hours,
    case a.status
      when 'documents_required' then
        case
          when a.source_auth_id is null then 'Applicant must bind the application to the matching S.O.S. account and upload required credentials.'
          when coalesce(d.required_uploaded_count,0) < 3 then 'Applicant must upload government ID, driver license, and insurance before operator review.'
          else 'Required credentials are uploaded; advance the application into the operator review queue.'
        end
      when 'waitlisted' then 'Operator must review the completed application and its required credentials within SLA.'
      when 'reviewing' then 'Complete credential review and record a decision within SLA.'
      when 'needs_information' then 'Follow up on the requested information and return the application to review when complete.'
      when 'conditionally_approved' then 'Applicant must claim/bind the approved Hero profile so final verification can continue.'
      when 'approved' then 'Move the approved Hero into final verification, payout readiness, and test-mission gating.'
      when 'rejected' then 'Closed: rejected application. Retain audit history; no activation action required.'
      when 'withdrawn' then 'Closed: withdrawn application. Retain audit history; no activation action required.'
      else 'Review application state.'
    end as next_required_action
  from public.sos_hero_applications a
  left join document_rollup d on d.application_id=a.id
)
select
  b.id as application_id,
  b.candidate_id,
  b.source_user_id,
  b.source_hero_id,
  b.source_auth_id,
  b.first_name,
  b.last_name,
  b.email,
  b.phone,
  b.city,
  b.state,
  b.services_requested,
  b.status,
  b.status_entered_at,
  b.submitted_at,
  b.credentials_complete_at,
  b.reviewed_at,
  b.reviewed_by,
  b.uploaded_document_count,
  b.accepted_document_count,
  b.required_uploaded_count,
  b.required_accepted_count,
  (b.source_auth_id is not null) as account_bound,
  (b.candidate_id is not null) as source_attributed,
  b.stage_sla_hours,
  round((extract(epoch from (now()-b.status_entered_at))/3600.0)::numeric,2) as stage_age_hours,
  case
    when b.stage_sla_hours is null then false
    else now() > b.status_entered_at + make_interval(hours=>b.stage_sla_hours)
  end as is_overdue,
  b.next_required_action,
  (
    case when b.status in ('waitlisted','reviewing') then 40
         when b.status='documents_required' then 25
         when b.status='needs_information' then 20
         when b.status in ('conditionally_approved','approved') then 50
         else 0 end
    + case when b.stage_sla_hours is not null
             and now() > b.status_entered_at + make_interval(hours=>b.stage_sla_hours)
           then 50 else 0 end
    + least(floor(extract(epoch from (now()-b.status_entered_at))/3600.0/12)::integer,24)
  )::integer as priority_rank,
  now() as generated_at
from base b;

create or replace view public.sos_hero_application_sla_watch
with (security_invoker = true)
as
select *
from public.sos_hero_application_activation_command_queue
where is_overdue=true
  and status not in ('rejected','withdrawn');

revoke all on public.sos_hero_application_activation_command_queue from public, anon, authenticated, service_role;
revoke all on public.sos_hero_application_sla_watch from public, anon, authenticated, service_role;
grant select on public.sos_hero_application_activation_command_queue to service_role;
grant select on public.sos_hero_application_sla_watch to service_role;

create table if not exists private.sos_hero_application_alert_state (
  application_id uuid not null,
  application_status text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_alerted_at timestamptz,
  last_alert_id uuid,
  resolved_at timestamptz,
  occurrences bigint not null default 1,
  primary key(application_id, application_status)
);

alter table private.sos_hero_application_alert_state enable row level security;
revoke all on table private.sos_hero_application_alert_state from public, anon, authenticated;
grant select, insert, update, delete on table private.sos_hero_application_alert_state to service_role;

create or replace function private.sos_sync_hero_application_sla_alerts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v record;
  v_state private.sos_hero_application_alert_state%rowtype;
  v_alert_id uuid;
  v_current integer := 0;
  v_new_alerts integer := 0;
  v_resolved integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('sos_hero_application_sla_alert_sync',0)) then
    return jsonb_build_object('status','skipped_overlap','current_overdue',0,'new_alerts',0,'resolved',0);
  end if;

  for v in select * from public.sos_hero_application_sla_watch
  loop
    v_current := v_current + 1;
    select * into v_state
    from private.sos_hero_application_alert_state s
    where s.application_id=v.application_id and s.application_status=v.status
    for update;

    if not found or v_state.resolved_at is not null then
      insert into public.marketplace_operator_alerts(product_key,alert_type,entity_id,title,body,metadata)
      values(
        'sos',
        'hero_application_sla',
        v.application_id,
        case when not found then 'S.O.S. Hero application SLA overdue' else 'S.O.S. Hero application SLA reopened' end,
        left(coalesce(v.first_name,'') || ' ' || coalesce(v.last_name,'') || ' · ' || replace(v.status,'_',' ') || ' · ' || coalesce(v.next_required_action,''),1000),
        jsonb_build_object(
          'application_id',v.application_id,
          'candidate_id',v.candidate_id,
          'status',v.status,
          'stage_age_hours',v.stage_age_hours,
          'stage_sla_hours',v.stage_sla_hours,
          'priority_rank',v.priority_rank,
          'required_uploaded_count',v.required_uploaded_count,
          'required_accepted_count',v.required_accepted_count,
          'account_bound',v.account_bound,
          'source_attributed',v.source_attributed,
          'next_required_action',v.next_required_action,
          'detected_at',now()
        )
      ) returning id into v_alert_id;

      insert into private.sos_hero_application_alert_state(
        application_id,application_status,first_seen_at,last_seen_at,last_alerted_at,last_alert_id,resolved_at,occurrences
      ) values(
        v.application_id,v.status,now(),now(),now(),v_alert_id,null,1
      )
      on conflict(application_id,application_status) do update
        set last_seen_at=excluded.last_seen_at,
            last_alerted_at=excluded.last_alerted_at,
            last_alert_id=excluded.last_alert_id,
            resolved_at=null,
            occurrences=private.sos_hero_application_alert_state.occurrences+1;
      v_new_alerts := v_new_alerts + 1;
    else
      update private.sos_hero_application_alert_state
      set last_seen_at=now(),occurrences=occurrences+1
      where application_id=v.application_id and application_status=v.status;
    end if;
  end loop;

  update private.sos_hero_application_alert_state s
  set resolved_at=now()
  where s.resolved_at is null
    and not exists(
      select 1 from public.sos_hero_application_sla_watch w
      where w.application_id=s.application_id and w.status=s.application_status
    );
  get diagnostics v_resolved=row_count;

  return jsonb_build_object('status','ok','current_overdue',v_current,'new_alerts',v_new_alerts,'resolved',v_resolved);
end;
$$;

revoke all on function private.sos_sync_hero_application_sla_alerts() from public, anon, authenticated;
grant execute on function private.sos_sync_hero_application_sla_alerts() to service_role;

create or replace function public.sos_ops_hero_application_activation_queue(p_limit integer default 100)
returns setof public.sos_hero_application_activation_command_queue
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;

  return query
  select *
  from public.sos_hero_application_activation_command_queue
  order by is_overdue desc, priority_rank desc, stage_age_hours desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;
$$;

revoke all on function public.sos_ops_hero_application_activation_queue(integer) from public, anon;
grant execute on function public.sos_ops_hero_application_activation_queue(integer) to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname='sos-hero-application-sla-alerts';

select cron.schedule(
  'sos-hero-application-sla-alerts',
  '*/15 * * * *',
  'select private.sos_sync_hero_application_sla_alerts();'
);

comment on column public.sos_hero_applications.status_entered_at is
'S.O.S.-only stage clock for application conversion SLA and stalled-stage alerting.';
comment on view public.sos_hero_application_activation_command_queue is
'Service-role-only S.O.S. Hero application command queue covering organic and recruited applicants, including credential progress, stage SLA, attribution, and next required action.';
comment on view public.sos_hero_application_sla_watch is
'Service-role-only S.O.S. Hero application SLA exception feed used for operator escalation.';
comment on function public.sos_ops_hero_application_activation_queue(integer) is
'Marketplace-operator-only S.O.S. Hero application activation queue. Direct underlying views remain client-inaccessible.';
