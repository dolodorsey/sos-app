-- S.O.S. Phase 1: enforce provider-contact compliance at the execution boundary.
-- Public business contact data is discovery evidence only; automation must have explicit consent.

create or replace function private.sos_recruiting_automation_allowed(p_candidate_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.sos_recruiting_candidates c
    join public.sos_recruiting_contact_compliance cc on cc.candidate_id=c.id
    where c.id=p_candidate_id
      and coalesce(c.is_demo,false)=false
      and coalesce(c.do_not_contact,false)=false
      and cc.review_status='manual_contact_reviewed'
      and cc.automation_allowed=true
      and cc.explicit_consent_at is not null
      and cardinality(coalesce(cc.explicit_consent_scope,'{}'::text[])) > 0
      and (cc.expires_at is null or cc.expires_at > now())
  );
$$;

revoke all on function private.sos_recruiting_automation_allowed(uuid) from public, anon, authenticated;
grant execute on function private.sos_recruiting_automation_allowed(uuid) to service_role;

create or replace function public.sos_claim_recruiting_outreach(p_worker_id text default 'sos-recruiting-worker')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_candidate public.sos_recruiting_candidates%rowtype;
begin
  select c.* into v_candidate
  from public.sos_recruiting_candidates c
  where c.pipeline_stage='qualified'
    and c.outreach_status='queued'
    and c.next_action_at<=now()
    and c.attempt_count<3
    and coalesce(c.is_demo,false)=false
    and coalesce(c.do_not_contact,false)=false
    and private.sos_recruiting_automation_allowed(c.id)
  order by c.priority_score desc,c.source_review_count desc,c.next_action_at,c.id
  for update of c skip locked
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
$$;

revoke all on function public.sos_claim_recruiting_outreach(text) from public, anon, authenticated;
grant execute on function public.sos_claim_recruiting_outreach(text) to service_role;

create or replace function public.sos_ops_update_candidate(
  p_candidate_id uuid,
  p_pipeline_stage text,
  p_outreach_status text,
  p_notes text default null,
  p_next_action_at timestamptz default null
)
returns public.sos_recruiting_candidates
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row public.sos_recruiting_candidates%rowtype;
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;

  if p_pipeline_stage not in ('prospect','priority','qualified','nurture','contacted','screening','training','account_setup','test_mission','approved','rejected','withdrawn','suppressed') then
    raise exception 'Invalid pipeline stage';
  end if;

  if p_outreach_status not in ('not_queued','ready','queued','in_progress','sent','responded','failed','paused','suppressed') then
    raise exception 'Invalid outreach status';
  end if;

  if p_outreach_status in ('queued','in_progress')
     and not private.sos_recruiting_automation_allowed(p_candidate_id) then
    raise exception 'Automated outreach is blocked until explicit consent and an active compliance review are recorded' using errcode='42501';
  end if;

  update public.sos_recruiting_candidates
     set pipeline_stage=p_pipeline_stage,
         outreach_status=p_outreach_status,
         notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),
         next_action_at=p_next_action_at,
         updated_at=now()
   where id=p_candidate_id
     and coalesce(is_demo,false)=false
   returning * into v_row;

  if not found then raise exception 'Real provider candidate not found' using errcode='P0002'; end if;
  return v_row;
end;
$$;

revoke all on function public.sos_ops_update_candidate(uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.sos_ops_update_candidate(uuid,text,text,text,timestamptz) to authenticated, service_role;

create or replace function public.sos_ops_record_manual_provider_contact(
  p_candidate_id uuid,
  p_channel text,
  p_outcome text,
  p_note text default null,
  p_next_action_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_now timestamptz := now();
  v_event_channel text;
  v_event_type text;
  v_outreach_status text;
  v_pipeline_stage text;
  v_allowed text[];
  v_dnc boolean;
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;

  if p_channel not in ('manual_call','manual_email','manual_form') then
    raise exception 'Unsupported manual contact channel' using errcode='22023';
  end if;

  if p_outcome not in ('not_reached','voicemail','connected_interested','connected_follow_up','application_started','not_interested','invalid_contact','do_not_contact') then
    raise exception 'Unsupported manual contact outcome' using errcode='22023';
  end if;

  select cc.allowed_manual_channels, coalesce(c.do_not_contact,false)
    into v_allowed, v_dnc
  from public.sos_recruiting_candidates c
  join public.sos_recruiting_contact_compliance cc on cc.candidate_id=c.id
  where c.id=p_candidate_id
    and coalesce(c.is_demo,false)=false
    and cc.review_status='manual_contact_reviewed'
    and (cc.expires_at is null or cc.expires_at > v_now);

  if not found then
    raise exception 'Active manual-contact compliance review required' using errcode='42501';
  end if;

  if v_dnc then
    raise exception 'Provider is marked do-not-contact' using errcode='42501';
  end if;

  if not (p_channel = any(coalesce(v_allowed,'{}'::text[]))) then
    raise exception 'Manual contact channel is not approved for this provider' using errcode='42501';
  end if;

  v_event_channel := case p_channel when 'manual_call' then 'call' when 'manual_email' then 'email' else 'manual' end;
  v_event_type := case
    when p_outcome='voicemail' then 'voicemail'
    when p_outcome in ('connected_interested','connected_follow_up','application_started','not_interested') then 'connected'
    when p_outcome='do_not_contact' then 'opted_out'
    when p_outcome='invalid_contact' then 'failed'
    else 'called'
  end;
  v_outreach_status := case
    when p_outcome in ('connected_interested','connected_follow_up','application_started') then 'responded'
    when p_outcome='do_not_contact' then 'suppressed'
    when p_outcome in ('not_interested','invalid_contact') then 'failed'
    else 'sent'
  end;

  select pipeline_stage into v_pipeline_stage from public.sos_recruiting_candidates where id=p_candidate_id for update;
  if p_outcome in ('connected_interested','connected_follow_up','application_started') and v_pipeline_stage in ('prospect','priority','qualified','nurture') then
    v_pipeline_stage := 'contacted';
  elsif p_outcome='do_not_contact' then
    v_pipeline_stage := 'suppressed';
  end if;

  insert into public.sos_recruiting_outreach_events(
    candidate_id, channel, sequence_step, event_type, outcome, occurred_at, metadata
  ) values (
    p_candidate_id, v_event_channel, 0, v_event_type, p_outcome, v_now,
    jsonb_build_object('mode','manual_operator','operator_id',auth.uid(),'approved_channel',p_channel,'note',nullif(left(trim(coalesce(p_note,'')),1000),''))
  );

  update public.sos_recruiting_candidates
  set pipeline_stage=v_pipeline_stage,
      outreach_status=v_outreach_status,
      attempt_count=attempt_count+1,
      last_outreach_at=v_now,
      last_outcome=p_outcome,
      next_action_at=p_next_action_at,
      do_not_contact=case when p_outcome='do_not_contact' then true else do_not_contact end,
      notes=case when nullif(trim(coalesce(p_note,'')),'') is null then notes else concat_ws(E'\n',nullif(notes,''),left(trim(p_note),1000)) end,
      updated_at=v_now
  where id=p_candidate_id;

  return jsonb_build_object(
    'ok',true,
    'candidate_id',p_candidate_id,
    'channel',p_channel,
    'outcome',p_outcome,
    'pipeline_stage',v_pipeline_stage,
    'outreach_status',v_outreach_status,
    'next_action_at',p_next_action_at,
    'recorded_at',v_now
  );
end;
$$;

revoke all on function public.sos_ops_record_manual_provider_contact(uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.sos_ops_record_manual_provider_contact(uuid,text,text,text,timestamptz) to authenticated, service_role;
