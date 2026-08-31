-- S.O.S. only: fix manual-contact outcome persistence and preserve prospect -> Hero application attribution.
-- This migration does not authorize outreach or change any provider's real-world contact/application status.

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
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_now timestamptz := now();
  v_event_channel text;
  v_event_type text;
  v_outreach_status text;
  v_pipeline_stage text;
  v_last_outcome text;
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
  -- sos_recruiting_candidates.last_outcome is intentionally a normalized lifecycle value.
  -- Preserve the exact human disposition in sos_recruiting_outreach_events.outcome.
  v_last_outcome := case
    when p_outcome in ('connected_interested','connected_follow_up','application_started','not_interested') then 'responded'
    when p_outcome='do_not_contact' then 'opted_out'
    when p_outcome='invalid_contact' then 'invalid_contact'
    else 'not_reached'
  end;

  select pipeline_stage into v_pipeline_stage
  from public.sos_recruiting_candidates
  where id=p_candidate_id
  for update;

  if p_outcome in ('connected_interested','connected_follow_up','application_started')
     and v_pipeline_stage in ('prospect','priority','qualified','nurture') then
    v_pipeline_stage := 'contacted';
  elsif p_outcome='do_not_contact' then
    v_pipeline_stage := 'suppressed';
  end if;

  insert into public.sos_recruiting_outreach_events(
    candidate_id, channel, sequence_step, event_type, outcome, occurred_at, metadata
  ) values (
    p_candidate_id, v_event_channel, 0, v_event_type, p_outcome, v_now,
    jsonb_build_object(
      'mode','manual_operator',
      'operator_id',auth.uid(),
      'approved_channel',p_channel,
      'note',nullif(left(trim(coalesce(p_note,'')),1000),'')
    )
  );

  update public.sos_recruiting_candidates
  set pipeline_stage=v_pipeline_stage,
      outreach_status=v_outreach_status,
      attempt_count=attempt_count+1,
      last_outreach_at=v_now,
      last_outcome=v_last_outcome,
      next_action_at=p_next_action_at,
      do_not_contact=case when p_outcome='do_not_contact' then true else do_not_contact end,
      notes=case
        when nullif(trim(coalesce(p_note,'')),'') is null then notes
        else concat_ws(E'\n',nullif(notes,''),left(trim(p_note),1000))
      end,
      updated_at=v_now
  where id=p_candidate_id;

  return jsonb_build_object(
    'ok',true,
    'candidate_id',p_candidate_id,
    'channel',p_channel,
    'outcome',p_outcome,
    'normalized_last_outcome',v_last_outcome,
    'pipeline_stage',v_pipeline_stage,
    'outreach_status',v_outreach_status,
    'next_action_at',p_next_action_at,
    'recorded_at',v_now
  );
end;
$function$;

comment on function public.sos_ops_record_manual_provider_contact(uuid,text,text,text,timestamptz)
is 'Operator-only manual provider contact recorder. Exact dispositions are stored in outreach events; candidate.last_outcome remains normalized to its constrained lifecycle vocabulary.';

create or replace function public.sos_link_hero_application_candidate(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  a public.sos_hero_applications%rowtype;
  v_candidate_id uuid;
  v_match_basis text;
  v_top_count integer := 0;
  v_best_score integer := 0;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select * into a
  from public.sos_hero_applications
  where id=p_application_id
  for update;

  if not found then
    raise exception 'Hero application not found' using errcode='P0002';
  end if;

  if a.candidate_id is not null then
    return jsonb_build_object('linked',true,'candidate_id',a.candidate_id,'match_basis','existing');
  end if;

  with eligible as (
    select
      c.id,
      (case when nullif(lower(trim(c.email)),'') = nullif(lower(trim(a.email)),'') then 2 else 0 end
       + case when length(regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')) >= 7
                    and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') = regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')
              then 1 else 0 end) as score,
      concat_ws('+',
        case when nullif(lower(trim(c.email)),'') = nullif(lower(trim(a.email)),'') then 'email' end,
        case when length(regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')) >= 7
                  and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') = regexp_replace(coalesce(a.phone,''),'[^0-9]','','g')
             then 'phone' end
      ) as basis
    from public.sos_recruiting_candidates c
    where coalesce(c.is_demo,false)=false
      and coalesce(c.do_not_contact,false)=false
      and c.pipeline_stage='contacted'
      and c.outreach_status='responded'
      and exists (
        select 1
        from public.sos_recruiting_outreach_events e
        where e.candidate_id=c.id
          and e.outcome in ('connected_interested','connected_follow_up','application_started')
      )
  ), scored as (
    select * from eligible where score > 0
  ), best as (
    select coalesce(max(score),0) as best_score from scored
  ), top_matches as (
    select s.* from scored s cross join best b where s.score=b.best_score
  )
  select count(*)::integer, min(id::text)::uuid, max(basis), coalesce(max(score),0)
    into v_top_count, v_candidate_id, v_match_basis, v_best_score
  from top_matches;

  if v_top_count <> 1 or v_candidate_id is null then
    return jsonb_build_object(
      'linked',false,
      'candidate_id',null,
      'reason',case when v_top_count > 1 then 'ambiguous_contact_match' else 'no_eligible_contact_match' end,
      'match_count',v_top_count,
      'best_score',v_best_score
    );
  end if;

  update public.sos_hero_applications
  set candidate_id=v_candidate_id,
      updated_at=now()
  where id=a.id;

  update public.sos_recruiting_candidates
  set pipeline_stage='screening',
      pipeline_stage_entered_at=case when pipeline_stage is distinct from 'screening' then now() else pipeline_stage_entered_at end,
      next_action_at=now(),
      notes=concat_ws(E'\n',nullif(notes,''),'Canonical Hero application submitted and attributed from an exact, previously-positive manual-contact match.'),
      updated_at=now()
  where id=v_candidate_id;

  return jsonb_build_object(
    'linked',true,
    'candidate_id',v_candidate_id,
    'match_basis',v_match_basis,
    'match_score',v_best_score
  );
end;
$function$;

revoke all on function public.sos_link_hero_application_candidate(uuid) from public, anon, authenticated;
grant execute on function public.sos_link_hero_application_candidate(uuid) to service_role;
comment on function public.sos_link_hero_application_candidate(uuid)
is 'Service-role-only attribution bridge. Links a canonical Hero application to exactly one real prospect only after a recorded positive manual interaction and an exact email/phone match; ambiguous matches fail closed.';

create or replace function public.sos_ops_review_hero_application(
  p_application_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  a public.sos_hero_applications%rowtype;
  u public.sos_users%rowtype;
  h public.sos_heroes%rowtype;
  c public.sos_recruiting_candidates%rowtype;
  accepted_required int;
begin
  if not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode='42501';
  end if;
  if p_decision not in ('reviewing','needs_information','conditionally_approved','rejected') then
    raise exception 'Invalid review decision';
  end if;

  select * into a from public.sos_hero_applications where id=p_application_id for update;
  if not found then raise exception 'Hero application not found'; end if;
  if a.status in ('rejected','withdrawn') and p_decision<>'rejected' then
    raise exception 'Closed application cannot be reopened here';
  end if;

  if p_decision='conditionally_approved' then
    select count(distinct document_type) into accepted_required
    from public.sos_hero_application_documents
    where application_id=a.id
      and status='accepted'
      and document_type in ('government_id','drivers_license','insurance');
    if accepted_required<3 then
      raise exception 'Accept government ID, driver license, and insurance before conditional approval';
    end if;
    if a.source_auth_id is null then raise exception 'Applicant account is not bound'; end if;

    select * into u from public.sos_users where auth_id=a.source_auth_id limit 1;
    if not found then
      insert into public.sos_users(auth_id,role,first_name,last_name,phone,email,status,city,state,is_demo,referral_code)
      values(a.source_auth_id,'hero',a.first_name,a.last_name,a.phone,lower(a.email),'active',a.city,a.state,false,lower(substring(md5(a.id::text) from 1 for 8)))
      returning * into u;
    else
      update public.sos_users
      set role='hero',first_name=a.first_name,last_name=a.last_name,phone=a.phone,email=lower(a.email),status='active',city=a.city,state=a.state,is_demo=false
      where id=u.id
      returning * into u;
    end if;

    select * into h from public.sos_heroes where user_id=u.id limit 1;
    if not found then
      insert into public.sos_heroes(
        user_id,zone,services_enabled,tools_available,vehicle_type,vehicle_make,vehicle_model,vehicle_year,
        license_verified,insurance_verified,background_cleared,id_verified,test_mission_passed,
        verification_status,on_duty,is_demo,payout_method
      ) values (
        u.id,coalesce(a.city,'')||case when a.state is not null then ', '||a.state else '' end,
        a.services_requested,a.tools_available,a.vehicle_type,a.vehicle_make,a.vehicle_model,a.vehicle_year,
        false,false,false,false,false,'pending',false,false,null
      ) returning * into h;
    end if;

    -- Preserve attribution to an existing real recruiting prospect before falling back to Hero/profile matching.
    if a.candidate_id is not null then
      select * into c
      from public.sos_recruiting_candidates
      where id=a.candidate_id and coalesce(is_demo,false)=false
      limit 1
      for update;
    end if;

    if c.id is null then
      select * into c
      from public.sos_recruiting_candidates
      where source_hero_id=h.id and coalesce(is_demo,false)=false
      limit 1
      for update;
    end if;

    if c.id is null then
      insert into public.sos_recruiting_candidates(
        source_hero_id,source_user_id,candidate_source,first_name,last_name,email,phone,target_zone,
        services_enabled,tools_available,vehicle_type,priority_score,pipeline_stage,outreach_status,last_outcome,notes,is_demo
      ) values (
        h.id,u.id,'hero_application',a.first_name,a.last_name,lower(a.email),a.phone,
        coalesce(a.city,'')||case when a.state is not null then ', '||a.state else '' end,
        a.services_requested,a.tools_available,a.vehicle_type,70,'account_setup','responded','responded',
        'Conditionally approved from Hero waitlist. Final 9/9 verification remains required.',false
      ) returning * into c;
    else
      update public.sos_recruiting_candidates
      set source_user_id=u.id,
          source_hero_id=h.id,
          first_name=coalesce(nullif(first_name,''),a.first_name),
          last_name=coalesce(nullif(last_name,''),a.last_name),
          email=coalesce(nullif(email,''),lower(a.email)),
          phone=coalesce(nullif(phone,''),a.phone),
          pipeline_stage='account_setup',
          pipeline_stage_entered_at=case when pipeline_stage is distinct from 'account_setup' then now() else pipeline_stage_entered_at end,
          outreach_status='responded',
          last_outcome='responded',
          next_action_at=now(),
          notes=concat_ws(E'\n',nullif(notes,''),'Conditionally approved from canonical Hero application. Existing recruiting attribution preserved; final verification gates remain required.'),
          updated_at=now()
      where id=c.id
      returning * into c;
    end if;

    update public.sos_hero_applications
    set source_user_id=u.id,source_hero_id=h.id,candidate_id=c.id
    where id=a.id;
  end if;

  update public.sos_hero_applications
  set status=p_decision,
      operator_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_at=now(),
      reviewed_by=auth.uid(),
      updated_at=now()
  where id=a.id;

  return jsonb_build_object(
    'application_id',a.id,
    'status',p_decision,
    'claim_ready',p_decision='conditionally_approved',
    'hero_id',coalesce(h.id,a.source_hero_id),
    'candidate_id',coalesce(c.id,a.candidate_id),
    'message',case
      when p_decision='conditionally_approved' then 'Conditionally approved. Final identity/background/test-mission/payout launch gates remain required before patrol.'
      when p_decision='needs_information' then 'Applicant needs additional information.'
      when p_decision='reviewing' then 'Application moved to review.'
      else 'Application rejected.'
    end
  );
end;
$function$;

comment on function public.sos_ops_review_hero_application(uuid,text,text)
is 'Marketplace-operator Hero application review. Reuses a pre-attributed real recruiting candidate instead of creating a duplicate candidate at conditional approval.';
