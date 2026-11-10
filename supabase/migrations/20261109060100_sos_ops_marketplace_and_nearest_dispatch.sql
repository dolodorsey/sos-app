-- S.O.S. management backend + Uber-style nearest-first dispatch (Nov 2026)

-- 1. Nearest-first dispatch -----------------------------------------------------
-- A request goes to the closest qualified Heroes first (waves of 3, 60-second
-- offers, first to accept wins, radius widens automatically). Quality score is
-- now the tie-breaker instead of the primary sort.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.sos_rank_nearby_heroes(double precision,double precision,double precision,text)'::regprocedure) into d;
  if position('order by 9 desc,5 asc' in d) > 0 then
    n := replace(d, 'order by 9 desc,5 asc', 'order by 5 asc,9 desc');
    execute n;
  elsif position('order by 5 asc,9 desc' in d) = 0 then
    raise exception 'sos_rank_nearby_heroes ordering not recognized; nearest-first patch not applied';
  end if;

  select pg_get_functiondef('private.sos_dispatch_one_mission(uuid)'::regprocedure) into d;
  if position('order by ranked.match_score desc,ranked.distance_miles asc' in d) > 0 then
    n := replace(d, 'order by ranked.match_score desc,ranked.distance_miles asc', 'order by ranked.distance_miles asc,ranked.match_score desc');
    execute n;
  elsif position('order by ranked.distance_miles asc,ranked.match_score desc' in d) = 0 then
    raise exception 'sos_dispatch_one_mission ordering not recognized; nearest-first patch not applied';
  end if;

  -- Standby applicants are not review-ready until their packet is in.
  select pg_get_functiondef('public.sos_ops_hero_applications()'::regprocedure) into d;
  if position('status<>''documents_required''' in d) > 0 then
    n := replace(d, 'status<>''documents_required''', 'status not in (''documents_required'',''standby_pending'',''standby'')');
    execute n;
  end if;
end $$;

-- 2. Conditional approval: driver license + insurance (government ID optional),
--    signed packet required when a packet exists, services stored as dispatch ids.
create or replace function public.sos_ops_review_hero_application(p_application_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare
  a public.sos_hero_applications%rowtype;
  u public.sos_users%rowtype;
  h public.sos_heroes%rowtype;
  c public.sos_recruiting_candidates%rowtype;
  pk public.sos_hero_onboarding_packets%rowtype;
  accepted_required int;
  v_services text[];
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
    where application_id=a.id and status='accepted' and document_type in ('drivers_license','insurance');
    if accepted_required<2 then
      raise exception 'Accept the driver license and insurance before conditional approval';
    end if;
    select * into pk from public.sos_hero_onboarding_packets where application_id=a.id;
    if found then
      if pk.status not in ('submitted','approved') then raise exception 'The onboarding packet is not complete yet'; end if;
      if pk.background_check_status<>'clear' then raise exception 'Record a clear background check before approval'; end if;
    end if;
    if a.source_auth_id is null then raise exception 'Applicant account is not bound'; end if;

    v_services := private.sos_service_ids(a.services_requested);

    select * into u from public.sos_users where auth_id=a.source_auth_id limit 1;
    if not found then
      insert into public.sos_users(auth_id,role,first_name,last_name,phone,email,status,city,state,is_demo,referral_code)
      values(a.source_auth_id,'hero',a.first_name,a.last_name,a.phone,lower(a.email),'active',a.city,a.state,false,lower(substring(md5(a.id::text) from 1 for 8)))
      returning * into u;
    else
      update public.sos_users
      set role=case when role='admin' then role else 'hero' end,first_name=a.first_name,last_name=a.last_name,phone=a.phone,email=lower(a.email),status='active',city=a.city,state=a.state,is_demo=false
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
        u.id,coalesce(private.sos_zone_label(a.service_zone),coalesce(a.city,'')||case when a.state is not null then ', '||a.state else '' end),
        v_services,a.tools_available,a.vehicle_type,a.vehicle_make,a.vehicle_model,a.vehicle_year,
        false,false,false,false,false,'pending',false,false,null
      ) returning * into h;
    elsif h.verification_status<>'verified' then
      update public.sos_heroes set services_enabled=v_services,updated_at=now() where id=h.id returning * into h;
    end if;

    if a.candidate_id is not null then
      select * into c from public.sos_recruiting_candidates where id=a.candidate_id and coalesce(is_demo,false)=false limit 1 for update;
    end if;
    if c.id is null then
      select * into c from public.sos_recruiting_candidates where source_hero_id=h.id and coalesce(is_demo,false)=false limit 1 for update;
    end if;
    if c.id is null then
      insert into public.sos_recruiting_candidates(
        source_hero_id,source_user_id,candidate_source,first_name,last_name,email,phone,target_zone,
        services_enabled,tools_available,vehicle_type,priority_score,pipeline_stage,outreach_status,last_outcome,notes,is_demo
      ) values (
        h.id,u.id,'hero_application',a.first_name,a.last_name,lower(a.email),a.phone,
        coalesce(private.sos_zone_label(a.service_zone),coalesce(a.city,'')||case when a.state is not null then ', '||a.state else '' end),
        v_services,a.tools_available,a.vehicle_type,70,'account_setup','responded','responded',
        'Conditionally approved from Hero onboarding packet. Final verification remains required.',false
      ) returning * into c;
    else
      update public.sos_recruiting_candidates
      set source_user_id=u.id,source_hero_id=h.id,
          first_name=coalesce(nullif(first_name,''),a.first_name),last_name=coalesce(nullif(last_name,''),a.last_name),
          email=coalesce(nullif(email,''),lower(a.email)),phone=coalesce(nullif(phone,''),a.phone),
          pipeline_stage='account_setup',
          pipeline_stage_entered_at=case when pipeline_stage is distinct from 'account_setup' then now() else pipeline_stage_entered_at end,
          outreach_status='responded',last_outcome='responded',next_action_at=now(),
          notes=concat_ws(E'\n',nullif(notes,''),'Conditionally approved from Hero onboarding packet. Recruiting attribution preserved; final verification gates remain required.'),
          updated_at=now()
      where id=c.id
      returning * into c;
    end if;

    update public.sos_hero_applications set source_user_id=u.id,source_hero_id=h.id,candidate_id=c.id where id=a.id;
    update public.sos_hero_onboarding_packets set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
     where application_id=a.id and status='submitted';
  end if;

  update public.sos_hero_applications
  set status=p_decision,operator_note=nullif(trim(coalesce(p_note,'')),''),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=a.id;

  return jsonb_build_object(
    'application_id',a.id,'status',p_decision,'claim_ready',p_decision='conditionally_approved',
    'hero_id',coalesce(h.id,a.source_hero_id),'candidate_id',coalesce(c.id,a.candidate_id),
    'message',case
      when p_decision='conditionally_approved' then 'Conditionally approved. Final identity/background/test-mission/payout launch gates remain required before patrol.'
      when p_decision='needs_information' then 'Applicant needs additional information.'
      when p_decision='reviewing' then 'Application moved to review.'
      else 'Application rejected.' end);
end $$;

-- 3. Operator RPCs ---------------------------------------------------------------
create or replace function public.sos_ops_set_market_go_live(p_market_key text, p_go_live date, p_lead_days integer default 14)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare m public.sos_market_rollouts; v_send jsonb;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  if p_lead_days is null or p_lead_days not between 1 and 60 then raise exception 'Lead time must be 1-60 days'; end if;
  if p_go_live is not null and p_go_live < current_date then raise exception 'Go-live date cannot be in the past'; end if;
  update public.sos_market_rollouts set target_launch_date=p_go_live, packet_lead_days=p_lead_days, updated_at=now()
   where market_key=p_market_key returning * into m;
  if not found then raise exception 'Market not found'; end if;
  if p_go_live is not null and private.sos_packet_window_open(p_market_key) then
    v_send := private.sos_send_onboarding_packets(p_market_key, false, auth.uid());
  end if;
  return jsonb_build_object('market_key',m.market_key,'go_live_date',m.target_launch_date,'packet_lead_days',m.packet_lead_days,
    'packet_send_date',case when m.target_launch_date is not null then m.target_launch_date-m.packet_lead_days end,'send_result',v_send);
end $$;

create or replace function public.sos_ops_send_onboarding_packets(p_market_key text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  return private.sos_send_onboarding_packets(p_market_key, true, auth.uid());
end $$;

create or replace function public.sos_ops_publish_consent_document(p_consent_type text, p_version text, p_title text, p_body text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare d public.sos_hero_consent_documents;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  if position('DRAFT' in upper(coalesce(p_body,''))) = 1 then raise exception 'Remove the DRAFT marker once the attorney-approved text is in'; end if;
  insert into public.sos_hero_consent_documents(consent_type,version,title,body,approved_for_use,published_at,published_by)
  values (p_consent_type,trim(p_version),trim(p_title),p_body,true,now(),auth.uid())
  on conflict (consent_type,version) do update
    set title=excluded.title, body=excluded.body, approved_for_use=true, published_at=now(), published_by=auth.uid()
    where public.sos_hero_consent_documents.approved_for_use=false
  returning * into d;
  if d.id is null then raise exception 'That version is already published and signed text cannot change. Publish a new version.'; end if;
  return jsonb_build_object('consent_type',d.consent_type,'version',d.version,'published_at',d.published_at,'all_ready',private.sos_consent_documents_ready());
end $$;

create or replace function public.sos_ops_review_onboarding_packet(p_packet_id uuid, p_decision text, p_note text default null,
                                                                   p_background_status text default null, p_background_reference text default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare p public.sos_hero_onboarding_packets; v_result jsonb;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  if p_decision not in ('background_update','needs_changes','approve') then raise exception 'Invalid packet decision'; end if;
  select * into p from public.sos_hero_onboarding_packets where id=p_packet_id for update;
  if not found then raise exception 'Packet not found'; end if;
  if p_background_status is not null then
    if p_background_status not in ('not_started','authorized','in_progress','clear','consider','not_cleared') then raise exception 'Invalid background check status'; end if;
    update public.sos_hero_onboarding_packets
       set background_check_status=p_background_status,
           background_check_reference=coalesce(nullif(trim(coalesce(p_background_reference,'')),''),background_check_reference),
           background_checked_at=case when p_background_status in ('clear','consider','not_cleared') then now() else background_checked_at end,
           updated_at=now()
     where id=p.id returning * into p;
  end if;
  if p_decision='needs_changes' then
    update public.sos_hero_onboarding_packets set status='needs_changes',operator_note=nullif(trim(coalesce(p_note,'')),''),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
     where id=p.id returning * into p;
    v_result := public.sos_ops_review_hero_application(p.application_id,'needs_information',p_note);
  elsif p_decision='approve' then
    v_result := public.sos_ops_review_hero_application(p.application_id,'conditionally_approved',p_note);
    select * into p from public.sos_hero_onboarding_packets where id=p.id;
  end if;
  return jsonb_build_object('packet_id',p.id,'status',p.status,'background_check_status',p.background_check_status,'application',v_result);
end $$;

create or replace function public.sos_ops_launch_overview(p_market_key text default 'atlanta-ga-2026')
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public','private' as $$
declare m public.sos_market_rollouts; v jsonb;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  select * into m from public.sos_market_rollouts where market_key=p_market_key;
  with apps as (
    select a.*, p.id packet_id, p.status packet_status, p.sent_at packet_sent_at, p.submitted_at packet_submitted_at,
           p.background_check_status, p.background_check_reference, p.operator_note packet_note,
           h.verification_status hero_verification, h.on_duty,
           private.sos_service_ids(a.services_requested) service_ids
    from public.sos_hero_applications a
    left join public.sos_hero_onboarding_packets p on p.application_id=a.id
    left join public.sos_heroes h on h.id=a.source_hero_id
    where a.market_key=p_market_key
  ), live as (select * from apps where status not in ('rejected','withdrawn'))
  select jsonb_build_object(
    'market',jsonb_build_object('key',p_market_key,'city',m.city,'state',m.state,'status',m.status,'go_live_date',m.target_launch_date,
      'packet_lead_days',m.packet_lead_days,
      'packet_send_date',case when m.target_launch_date is not null then m.target_launch_date-m.packet_lead_days end,
      'target_verified_heroes',m.target_verified_heroes),
    'legal_documents',(select coalesce(jsonb_agg(jsonb_build_object('consent_type',t.type,
        'approved_version',(private.sos_current_consent_document(t.type)).version,
        'ready',(private.sos_current_consent_document(t.type)).id is not null)),'[]'::jsonb)
      from unnest(array['background_check_disclosure','background_check_authorization','independent_contractor_agreement']) t(type)),
    'legal_ready',private.sos_consent_documents_ready(),
    'counts',jsonb_build_object(
      'standby_pending',(select count(*) from live where status='standby_pending'),
      'standby',(select count(*) from live where status='standby'),
      'packets_sent',(select count(*) from live where packet_id is not null),
      'packets_submitted',(select count(*) from live where packet_status in ('submitted','approved')),
      'background_clear',(select count(*) from live where background_check_status='clear'),
      'in_review',(select count(*) from live where status in ('reviewing','needs_information')),
      'approved',(select count(*) from live where status in ('conditionally_approved','approved')),
      'verified',(select count(*) from live where hero_verification='verified')),
    'by_zone',(select coalesce(jsonb_object_agg(z.zone,(select count(*) from live where service_zone=z.zone)),'{}'::jsonb)
      from unnest(array['east','south','west','downtown','midtown','buckhead']) z(zone)),
    'by_service',(select coalesce(jsonb_object_agg(s.id,jsonb_build_object('name',s.name,
        'roster',(select count(*) from live where s.id=any(service_ids)),
        'verified',(select count(*) from live where s.id=any(service_ids) and hero_verification='verified'))),'{}'::jsonb)
      from public.sos_subcategories s where s.id in ('tow','fuel','jump','flat','lockout')),
    'roster',(select coalesce(jsonb_agg(jsonb_build_object(
        'application_id',x.id,'name',x.first_name||' '||x.last_name,'email',x.email,'phone',x.phone,'status',x.status,
        'service_zone',x.service_zone,'availability',x.availability,'services',x.service_ids,
        'vehicle',nullif(trim(concat_ws(' ',x.vehicle_year::text,x.vehicle_make,x.vehicle_model,case when x.vehicle_type is not null then '('||x.vehicle_type||')' end)),''),
        'submitted_at',x.submitted_at,'standby_at',x.standby_at,'account_secured',x.source_auth_id is not null,
        'packet_id',x.packet_id,'packet_status',x.packet_status,'packet_sent_at',x.packet_sent_at,'packet_submitted_at',x.packet_submitted_at,
        'packet_items',case when x.packet_id is not null then private.sos_packet_items(x.id) end,
        'background_check_status',x.background_check_status,'background_check_reference',x.background_check_reference,
        'packet_note',x.packet_note,'hero_verification',x.hero_verification) order by x.submitted_at desc),'[]'::jsonb) from apps x)
  ) into v;
  return v;
end $$;

create or replace function public.sos_ops_marketplace_live()
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public','private' as $$
declare v jsonb;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  with missions as (
    select m.*, cu.first_name||' '||coalesce(left(cu.last_name,1)||'.','') customer_name, cu.phone customer_phone,
           hu.first_name||' '||coalesce(left(hu.last_name,1)||'.','') hero_name
    from public.sos_missions m
    join public.sos_users cu on cu.id=m.citizen_id and coalesce(cu.is_demo,false)=false
    left join public.sos_heroes h on h.id=m.hero_id
    left join public.sos_users hu on hu.id=h.user_id
  )
  select jsonb_build_object(
    'generated_at',now(),
    'counts',jsonb_build_object(
      'customers',(select count(*) from public.sos_users where role='citizen' and coalesce(is_demo,false)=false and deleted_at is null),
      'customers_new_7d',(select count(*) from public.sos_users where role='citizen' and coalesce(is_demo,false)=false and deleted_at is null and created_at>=now()-interval '7 days'),
      'heroes_verified',(select count(*) from public.sos_heroes h join public.sos_users u on u.id=h.user_id where h.verification_status='verified' and not h.is_demo and not coalesce(u.is_demo,false)),
      'heroes_on_duty',(select count(*) from public.sos_heroes h join public.sos_users u on u.id=h.user_id where h.on_duty and not h.is_demo and not coalesce(u.is_demo,false) and h.last_gps_at>=now()-interval '15 minutes'),
      'heroes_standby',(select count(*) from public.sos_hero_applications where status='standby'),
      'missions_open',(select count(*) from missions where status in ('requested','matching','assigned','en_route','on_site','working')),
      'missions_unmatched',(select count(*) from missions where hero_id is null and status in ('requested','matching')),
      'missions_today',(select count(*) from missions where created_at>=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'),
      'completed_today',(select count(*) from missions where status='completed' and completed_at>=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'),
      'offers_pending',(select count(*) from public.sos_mission_offers where status='pending' and coalesce(expires_at,now()+interval '1 second')>now())),
    'missions',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',x.id,'status',x.status,'service',coalesce(x.requested_service_name,x.subcategory_id),'address',x.pickup_address,
        'customer',x.customer_name,'customer_phone',x.customer_phone,'hero',x.hero_name,'created_at',x.created_at,
        'accepted_at',x.accepted_at,'completed_at',x.completed_at,'eta_minutes',x.eta_minutes,
        'price',coalesce(x.final_price,x.estimated_price),'radius_miles',x.dispatch_radius_miles,'dispatch_attempts',x.dispatch_attempts,
        'offers',(select jsonb_build_object('total',count(*),'pending',count(*) filter (where o.status='pending'),
                   'declined',count(*) filter (where o.status='declined'),'expired',count(*) filter (where o.status='expired'),
                   'nearest_miles',min(o.distance_miles))
                  from public.sos_mission_offers o where o.mission_id=x.id)
      ) order by case when x.status in ('requested','matching') then 0 when x.status in ('assigned','en_route','on_site','working') then 1 else 2 end, x.created_at desc),'[]'::jsonb)
      from (select * from missions order by created_at desc limit 100) x),
    'heroes_on_duty',(select coalesce(jsonb_agg(jsonb_build_object('hero_id',h.id,'name',u.first_name||' '||coalesce(left(u.last_name,1)||'.',''),
        'zone',h.zone,'services',h.services_enabled,'last_gps_at',h.last_gps_at,'rating',h.rating) order by h.last_gps_at desc),'[]'::jsonb)
      from public.sos_heroes h join public.sos_users u on u.id=h.user_id
      where h.on_duty and not h.is_demo and not coalesce(u.is_demo,false))
  ) into v;
  return v;
end $$;

revoke all on function public.sos_ops_set_market_go_live(text,date,integer) from public, anon;
revoke all on function public.sos_ops_send_onboarding_packets(text) from public, anon;
revoke all on function public.sos_ops_publish_consent_document(text,text,text,text) from public, anon;
revoke all on function public.sos_ops_review_onboarding_packet(uuid,text,text,text,text) from public, anon;
revoke all on function public.sos_ops_launch_overview(text) from public, anon;
revoke all on function public.sos_ops_marketplace_live() from public, anon;
grant execute on function public.sos_ops_set_market_go_live(text,date,integer) to authenticated;
grant execute on function public.sos_ops_send_onboarding_packets(text) to authenticated;
grant execute on function public.sos_ops_publish_consent_document(text,text,text,text) to authenticated;
grant execute on function public.sos_ops_review_onboarding_packet(uuid,text,text,text,text) to authenticated;
grant execute on function public.sos_ops_launch_overview(text) to authenticated;
grant execute on function public.sos_ops_marketplace_live() to authenticated;
