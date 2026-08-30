-- S.O.S. Phase 1: auditable provider-contact compliance gate.
-- Public business contact data is not treated as consent. Manual business contact remains separate
-- from automated SMS, autodial, prerecorded voice, and automated-email permissions.

create table if not exists public.sos_recruiting_contact_compliance (
  candidate_id uuid primary key references public.sos_recruiting_candidates(id) on delete cascade,
  review_status text not null default 'pending' check (review_status in ('pending','manual_contact_reviewed','needs_evidence','suppressed','rejected')),
  allowed_manual_channels text[] not null default '{}'::text[],
  automated_channels_blocked text[] not null default array['sms','autodial','prerecorded_voice','automated_email']::text[],
  contact_basis text,
  evidence jsonb not null default '{}'::jsonb,
  evidence_checked_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_origin text not null default 'operator' check (review_origin in ('operator','system_evidence_review')),
  expires_at timestamptz,
  explicit_consent_at timestamptz,
  explicit_consent_scope text[] not null default '{}'::text[],
  automation_allowed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_status <> 'manual_contact_reviewed' or cardinality(allowed_manual_channels) > 0),
  check (not automation_allowed or (explicit_consent_at is not null and cardinality(explicit_consent_scope) > 0))
);

alter table public.sos_recruiting_contact_compliance enable row level security;
revoke all on public.sos_recruiting_contact_compliance from public, anon, authenticated;
grant select, insert, update, delete on public.sos_recruiting_contact_compliance to service_role;

create index if not exists sos_recruiting_contact_compliance_status_idx
  on public.sos_recruiting_contact_compliance(review_status, expires_at);

create or replace view public.sos_provider_contact_compliance_queue
with (security_invoker=true)
as
select
  q.candidate_id,
  q.company_name,
  q.contact_name,
  q.email,
  q.phone,
  q.website,
  q.target_zone,
  q.services_enabled,
  q.final_recruiting_score,
  q.priority_rank as activation_priority_rank,
  q.activation_stage,
  q.stage_age_hours,
  q.stage_sla_hours,
  q.is_overdue as activation_is_overdue,
  q.next_required_action as activation_next_action,
  coalesce(cc.review_status,'pending') as compliance_review_status,
  coalesce(cc.allowed_manual_channels,'{}'::text[]) as allowed_manual_channels,
  coalesce(cc.automated_channels_blocked,array['sms','autodial','prerecorded_voice','automated_email']::text[]) as automated_channels_blocked,
  cc.contact_basis,
  coalesce(cc.evidence,'{}'::jsonb) as compliance_evidence,
  cc.evidence_checked_at,
  cc.reviewed_at,
  cc.review_origin,
  cc.expires_at,
  cc.explicit_consent_at,
  cc.explicit_consent_scope,
  coalesce(cc.automation_allowed,false) as automation_allowed,
  case
    when coalesce(c.do_not_contact,false) then false
    when cc.review_status='manual_contact_reviewed' and (cc.expires_at is null or cc.expires_at > now()) then true
    else false
  end as manual_contact_ready,
  case
    when coalesce(c.do_not_contact,false) then 'Do not contact. Keep suppressed unless an authorized operator clears the DNC condition.'
    when cc.review_status is null or cc.review_status='pending' then 'Verify the business identity, current public business contact source, service fit, and channel-specific requirements. Public contact data is not consent.'
    when cc.review_status='needs_evidence' then 'Collect stronger current business-source evidence before any outreach is initiated.'
    when cc.review_status='manual_contact_reviewed' and cc.expires_at is not null and cc.expires_at <= now() then 'Compliance review expired. Re-verify the public business contact and channel rules before outreach.'
    when cc.review_status='manual_contact_reviewed' then 'Operator may initiate only the specifically approved manual business-contact channel(s). Do not use SMS, autodial, prerecorded voice, or automated email unless separate consent/basis is recorded.'
    when cc.review_status='suppressed' then 'Keep suppressed and do not initiate outreach.'
    when cc.review_status='rejected' then 'Remove from the active acquisition queue; retain audit evidence only.'
    else 'Review compliance status.'
  end as compliance_next_action,
  q.generated_at
from public.sos_provider_activation_command_queue_v2 q
join public.sos_recruiting_candidates c on c.id=q.candidate_id
left join public.sos_recruiting_contact_compliance cc on cc.candidate_id=q.candidate_id;

revoke all on public.sos_provider_contact_compliance_queue from public, anon, authenticated;
grant select on public.sos_provider_contact_compliance_queue to service_role;

create or replace function public.sos_ops_provider_contact_compliance_queue(p_limit integer default 100)
returns setof public.sos_provider_contact_compliance_queue
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;

  return query
  select q.*
  from public.sos_provider_contact_compliance_queue q
  order by
    case q.compliance_review_status
      when 'pending' then 0
      when 'needs_evidence' then 1
      when 'manual_contact_reviewed' then 2
      when 'suppressed' then 3
      when 'rejected' then 4
      else 5
    end,
    q.activation_is_overdue desc,
    q.activation_priority_rank desc,
    q.stage_age_hours desc
  limit greatest(1,least(coalesce(p_limit,100),500));
end;
$$;

revoke all on function public.sos_ops_provider_contact_compliance_queue(integer) from public, anon;
grant execute on function public.sos_ops_provider_contact_compliance_queue(integer) to authenticated, service_role;

create or replace function public.sos_ops_review_provider_contact_compliance(
  p_candidate_id uuid,
  p_review_status text,
  p_allowed_manual_channels text[] default '{}'::text[],
  p_contact_basis text default null,
  p_evidence jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_channels text[] := coalesce(p_allowed_manual_channels,'{}'::text[]);
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;

  if p_review_status not in ('pending','manual_contact_reviewed','needs_evidence','suppressed','rejected') then
    raise exception 'Invalid review status' using errcode='22023';
  end if;

  if exists (
    select 1 from unnest(v_channels) ch
    where ch not in ('manual_call','manual_email','manual_form')
  ) then
    raise exception 'Only explicitly manual business-contact channels may be approved by this review function' using errcode='22023';
  end if;

  if p_review_status='manual_contact_reviewed' and cardinality(v_channels)=0 then
    raise exception 'At least one manual channel is required' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.sos_recruiting_candidates c
    where c.id=p_candidate_id and coalesce(c.is_demo,false)=false
  ) then
    raise exception 'Real provider candidate not found' using errcode='P0002';
  end if;

  insert into public.sos_recruiting_contact_compliance(
    candidate_id, review_status, allowed_manual_channels, automated_channels_blocked,
    contact_basis, evidence, evidence_checked_at, reviewed_at, reviewed_by, review_origin,
    expires_at, automation_allowed, notes, updated_at
  ) values (
    p_candidate_id, p_review_status, v_channels,
    array['sms','autodial','prerecorded_voice','automated_email']::text[],
    p_contact_basis, coalesce(p_evidence,'{}'::jsonb), v_now, v_now, auth.uid(), 'operator',
    p_expires_at, false, p_notes, v_now
  )
  on conflict(candidate_id) do update set
    review_status=excluded.review_status,
    allowed_manual_channels=excluded.allowed_manual_channels,
    automated_channels_blocked=excluded.automated_channels_blocked,
    contact_basis=excluded.contact_basis,
    evidence=excluded.evidence,
    evidence_checked_at=excluded.evidence_checked_at,
    reviewed_at=excluded.reviewed_at,
    reviewed_by=excluded.reviewed_by,
    review_origin=excluded.review_origin,
    expires_at=excluded.expires_at,
    automation_allowed=false,
    notes=excluded.notes,
    updated_at=v_now;

  return jsonb_build_object(
    'ok',true,
    'candidate_id',p_candidate_id,
    'review_status',p_review_status,
    'allowed_manual_channels',v_channels,
    'automation_allowed',false,
    'reviewed_at',v_now
  );
end;
$$;

revoke all on function public.sos_ops_review_provider_contact_compliance(uuid,text,text[],text,jsonb,timestamptz,text) from public, anon;
grant execute on function public.sos_ops_review_provider_contact_compliance(uuid,text,text[],text,jsonb,timestamptz,text) to authenticated, service_role;
