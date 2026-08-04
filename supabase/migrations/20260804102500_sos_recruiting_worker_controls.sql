-- Internal worker controls for the SOS recruiting pipeline.
-- No contact is sent by the database. These functions only claim and record internal work.

alter table public.sos_recruiting_candidates
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_outreach_at timestamptz,
  add column if not exists last_outcome text;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.sos_recruiting_candidates'::regclass
      and conname='sos_recruiting_attempt_count_check'
  ) then
    alter table public.sos_recruiting_candidates
      add constraint sos_recruiting_attempt_count_check check (attempt_count>=0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.sos_recruiting_candidates'::regclass
      and conname='sos_recruiting_last_outcome_check'
  ) then
    alter table public.sos_recruiting_candidates
      add constraint sos_recruiting_last_outcome_check check (
        last_outcome is null or last_outcome in (
          'sent','responded','failed','paused','not_reached','invalid_contact','opted_out'
        )
      );
  end if;
end
$block$;

create index if not exists sos_recruiting_claim_idx
  on public.sos_recruiting_candidates(next_action_at,priority_score desc)
  where outreach_status='queued';

create or replace function public.sos_claim_recruiting_outreach(
  p_worker_id text default 'sos-recruiting-worker'
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_candidate public.sos_recruiting_candidates%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role'
     and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select * into v_candidate
  from public.sos_recruiting_candidates
  where pipeline_stage='qualified'
    and outreach_status='queued'
    and next_action_at<=now()
    and attempt_count<3
  order by priority_score desc,source_review_count desc,next_action_at,id
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.sos_recruiting_candidates
  set outreach_status='in_progress',
      locked_at=now(),
      locked_by=left(coalesce(nullif(trim(p_worker_id),''),'sos-recruiting-worker'),120),
      attempt_count=attempt_count+1,
      updated_at=now()
  where id=v_candidate.id
  returning * into v_candidate;

  return jsonb_build_object(
    'candidate_id',v_candidate.id,
    'first_name',v_candidate.first_name,
    'last_name',v_candidate.last_name,
    'email',v_candidate.email,
    'phone',v_candidate.phone,
    'target_zone',v_candidate.target_zone,
    'priority_score',v_candidate.priority_score,
    'services_enabled',v_candidate.services_enabled,
    'tools_available',v_candidate.tools_available,
    'attempt_count',v_candidate.attempt_count,
    'locked_by',v_candidate.locked_by
  );
end;
$function$;

create or replace function public.sos_complete_recruiting_outreach(
  p_candidate_id uuid,
  p_outcome text,
  p_note text default null,
  p_next_action_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_candidate public.sos_recruiting_candidates%rowtype;
  v_status text;
begin
  if coalesce(auth.role(),'')<>'service_role'
     and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  if p_outcome not in (
    'sent','responded','failed','paused','not_reached','invalid_contact','opted_out'
  ) then
    raise exception 'Unsupported outreach outcome';
  end if;

  v_status:=case
    when p_outcome='responded' then 'responded'
    when p_outcome='sent' then 'sent'
    when p_outcome='paused' then 'paused'
    when p_outcome in ('invalid_contact','opted_out') then 'failed'
    when p_outcome in ('failed','not_reached') and p_next_action_at is not null then 'queued'
    else 'failed'
  end;

  update public.sos_recruiting_candidates
  set outreach_status=v_status,
      last_outcome=p_outcome,
      last_outreach_at=now(),
      next_action_at=case when v_status='queued' then p_next_action_at else next_action_at end,
      locked_at=null,
      locked_by=null,
      notes=case
        when nullif(trim(p_note),'') is null then notes
        else concat_ws(E'\n',nullif(notes,''),left(trim(p_note),1000))
      end,
      updated_at=now()
  where id=p_candidate_id and outreach_status='in_progress'
  returning * into v_candidate;

  if not found then
    raise exception 'In-progress recruiting candidate not found';
  end if;

  return jsonb_build_object(
    'candidate_id',v_candidate.id,
    'outreach_status',v_candidate.outreach_status,
    'last_outcome',v_candidate.last_outcome,
    'attempt_count',v_candidate.attempt_count,
    'next_action_at',v_candidate.next_action_at
  );
end;
$function$;

create or replace function public.sos_release_stale_recruiting_locks(
  p_stale_minutes integer default 30
)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_count integer;
begin
  if coalesce(auth.role(),'')<>'service_role'
     and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  with released as (
    update public.sos_recruiting_candidates
    set outreach_status=case when attempt_count<3 then 'queued' else 'failed' end,
        next_action_at=case when attempt_count<3 then now()+interval '15 minutes' else next_action_at end,
        last_outcome=case when attempt_count<3 then 'not_reached' else 'failed' end,
        locked_at=null,
        locked_by=null,
        updated_at=now()
    where outreach_status='in_progress'
      and locked_at<now()-make_interval(mins=>greatest(5,p_stale_minutes))
    returning id
  )
  select count(*) into v_count from released;

  return coalesce(v_count,0);
end;
$function$;

revoke all on function public.sos_claim_recruiting_outreach(text) from public,anon,authenticated;
revoke all on function public.sos_complete_recruiting_outreach(uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.sos_release_stale_recruiting_locks(integer) from public,anon,authenticated;
grant execute on function public.sos_claim_recruiting_outreach(text) to service_role;
grant execute on function public.sos_complete_recruiting_outreach(uuid,text,text,timestamptz) to service_role;
grant execute on function public.sos_release_stale_recruiting_locks(integer) to service_role;
