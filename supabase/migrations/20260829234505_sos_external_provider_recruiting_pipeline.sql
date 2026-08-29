alter table public.sos_recruiting_candidates
  alter column source_hero_id drop not null,
  alter column source_user_id drop not null;

alter table public.sos_recruiting_candidates
  add column if not exists dedupe_key text;

alter table public.sos_recruiting_candidates
  drop constraint if exists sos_recruiting_candidates_pipeline_stage_check,
  add constraint sos_recruiting_candidates_pipeline_stage_check
  check (pipeline_stage = any (array[
    'prospect','priority','qualified','nurture','contacted','screening','training',
    'account_setup','test_mission','approved','rejected','withdrawn','suppressed'
  ]::text[]));

alter table public.sos_recruiting_candidates
  drop constraint if exists sos_recruiting_candidates_outreach_status_check,
  add constraint sos_recruiting_candidates_outreach_status_check
  check (outreach_status = any (array[
    'not_queued','ready','queued','in_progress','sent','responded','failed','paused','suppressed'
  ]::text[]));

create unique index if not exists sos_recruiting_candidates_real_dedupe_key_uidx
  on public.sos_recruiting_candidates(dedupe_key)
  where is_demo=false and dedupe_key is not null;

create or replace function public.sos_score_recruiting_candidate(p_candidate_id uuid)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c public.sos_recruiting_candidates%rowtype;
  contact_score numeric := 0;
  service_score numeric := 0;
  zone_score numeric := 0;
  rep_score numeric := 0;
  total numeric := 0;
begin
  select * into c from public.sos_recruiting_candidates where id=p_candidate_id for update;
  if not found then raise exception 'candidate not found'; end if;

  contact_score := least(100,
      (case when nullif(trim(c.phone),'') is not null then 45 else 0 end) +
      (case when nullif(trim(c.email),'') is not null then 35 else 0 end) +
      (case when nullif(trim(c.website),'') is not null then 10 else 0 end) +
      (case when nullif(trim(c.company_name),'') is not null then 10 else 0 end));

  service_score := least(100,
      coalesce(array_length(c.services_enabled,1),0) * 18 +
      coalesce(array_length(c.tools_available,1),0) * 8);

  zone_score := case
      when c.target_zone in ('Midtown','Buckhead','Hartsfield-Jackson Airport') then 100
      when c.target_zone is not null then 70
      when upper(coalesce(c.state_code,''))='GA' then 50
      else 20 end;

  rep_score := least(100,
      coalesce(c.source_rating,0) / 5.0 * 70 +
      least(coalesce(c.source_review_count,0),100) / 100.0 * 30);

  total := round((contact_score*0.25 + service_score*0.35 + zone_score*0.25 + rep_score*0.15)::numeric,2);

  update public.sos_recruiting_candidates
  set contactability_score=round(contact_score,2),
      service_fit_score=round(service_score,2),
      zone_fit_score=round(zone_score,2),
      reputation_score=round(rep_score,2),
      priority_score=total,
      final_recruiting_score=total,
      pipeline_stage=case
        when do_not_contact then 'suppressed'
        when total>=75 then 'priority'
        when total>=55 then 'qualified'
        else 'nurture'
      end,
      outreach_status=case
        when do_not_contact then 'suppressed'
        when outreach_status='not_queued'
             and consent_basis in ('explicit_opt_in','inbound_application','existing_business_relationship','contractual_partner')
          then 'ready'
        else outreach_status
      end,
      next_action_at=case
        when do_not_contact then null
        else next_action_at
      end,
      updated_at=now()
  where id=p_candidate_id;

  return total;
end
$$;

revoke all on function public.sos_score_recruiting_candidate(uuid) from public, anon, authenticated;
grant execute on function public.sos_score_recruiting_candidate(uuid) to service_role;

create or replace view public.sos_recruiting_pipeline_health
with (security_invoker=true)
as
with readiness as (
  select
    c.*,
    (u.auth_id is not null) as has_authenticated_account,
    (
      h.id is not null
      and h.verification_status='verified'
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
    (h.id is not null and nullif(h.stripe_connect_id,'') is not null) as payout_ready
  from public.sos_recruiting_candidates c
  left join public.sos_users u on u.id=c.source_user_id and coalesce(u.is_demo,false)=false
  left join public.sos_heroes h on h.id=c.source_hero_id and coalesce(h.is_demo,false)=false
  where coalesce(c.is_demo,false)=false
)
select
  count(*)::integer as total_candidates,
  count(*) filter (where pipeline_stage in ('priority','qualified'))::integer as qualified_candidates,
  count(*) filter (where outreach_status in ('ready','queued','in_progress'))::integer as queued_outreach,
  count(*) filter (where nullif(trim(email),'') is null and nullif(trim(phone),'') is null)::integer as contact_gaps,
  count(distinct target_zone)::integer as zones_covered,
  count(*) filter (where has_authenticated_account)::integer as authenticated_accounts,
  count(*) filter (where verification_complete)::integer as verification_complete,
  count(*) filter (where payout_ready)::integer as payout_ready,
  count(*) filter (where has_authenticated_account and verification_complete and payout_ready)::integer as activation_ready,
  round(avg(priority_score),2) as average_priority,
  min(next_action_at) as next_action_at,
  now() as generated_at
from readiness;

revoke all on public.sos_recruiting_pipeline_health from public, anon, authenticated;
grant select on public.sos_recruiting_pipeline_health to service_role;

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
declare v_row public.sos_recruiting_candidates%rowtype;
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
  update public.sos_recruiting_candidates
     set pipeline_stage=p_pipeline_stage,
         outreach_status=p_outreach_status,
         notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),
         next_action_at=p_next_action_at,
         updated_at=now()
   where id=p_candidate_id
   returning * into v_row;
  if not found then raise exception 'Candidate not found' using errcode='P0002'; end if;
  return v_row;
end
$$;

create or replace function private.sos_ingest_public_provider_prospect(
  p_source_system text,
  p_source_record_key text,
  p_source_url text,
  p_company_name text,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_city text default 'Atlanta',
  p_state_code text default 'GA',
  p_zip_code text default null,
  p_target_zone text default null,
  p_services_enabled text[] default '{}'::text[],
  p_tools_available text[] default '{}'::text[],
  p_source_rating numeric default null,
  p_source_review_count integer default 0,
  p_provenance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_candidate_id uuid;
  v_created boolean := false;
  v_score numeric;
  v_phone_digits text;
  v_web_norm text;
  v_dedupe text;
  v_source_key text;
begin
  if coalesce(auth.role(),'') <> 'service_role'
     and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_source_system,'')),'') is null then raise exception 'source system required'; end if;
  if nullif(trim(coalesce(p_company_name,'')),'') is null then raise exception 'company name required'; end if;

  v_phone_digits := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  v_web_norm := lower(regexp_replace(regexp_replace(coalesce(p_website,''),'^https?://','','i'),'^www\\.','','i'));
  v_web_norm := regexp_replace(v_web_norm,'/+$','','g');

  v_dedupe := case
    when length(v_phone_digits)>=10 then 'phone:'||v_phone_digits
    when nullif(v_web_norm,'') is not null then 'web:'||v_web_norm
    else 'company:'||lower(regexp_replace(trim(p_company_name),'\\s+',' ','g'))||'|'||lower(coalesce(trim(p_city),''))||'|'||upper(coalesce(trim(p_state_code),''))
  end;
  v_source_key := coalesce(nullif(trim(p_source_record_key),''),v_dedupe);

  perform pg_advisory_xact_lock(hashtextextended('sos-prospect:'||v_dedupe,0));

  select id into v_candidate_id
    from public.sos_recruiting_candidates
   where is_demo=false and dedupe_key=v_dedupe
   for update;

  if not found then
    insert into public.sos_recruiting_candidates(
      source_hero_id,source_user_id,candidate_source,company_name,phone,email,website,city,state_code,zip_code,
      target_zone,services_enabled,tools_available,source_rating,source_review_count,pipeline_stage,outreach_status,
      consent_basis,preferred_channel,is_demo,dedupe_key,notes
    ) values (
      null,null,'public_directory',left(trim(p_company_name),240),nullif(trim(p_phone),''),nullif(lower(trim(p_email)),''),
      nullif(trim(p_website),''),nullif(trim(p_city),''),upper(nullif(trim(p_state_code),'')),nullif(trim(p_zip_code),''),
      nullif(trim(p_target_zone),''),coalesce(p_services_enabled,'{}'::text[]),coalesce(p_tools_available,'{}'::text[]),
      p_source_rating,greatest(coalesce(p_source_review_count,0),0),'prospect','not_queued',
      'public_business_listing_review_required','manual',false,v_dedupe,
      'Public business prospect. Outreach requires operator/compliance review before queueing.'
    ) returning id into v_candidate_id;
    v_created := true;
  else
    update public.sos_recruiting_candidates
       set company_name=coalesce(nullif(company_name,''),left(trim(p_company_name),240)),
           phone=coalesce(nullif(phone,''),nullif(trim(p_phone),'')),
           email=coalesce(nullif(email,''),nullif(lower(trim(p_email)),'')),
           website=coalesce(nullif(website,''),nullif(trim(p_website),'')),
           city=coalesce(nullif(city,''),nullif(trim(p_city),'')),
           state_code=coalesce(nullif(state_code,''),upper(nullif(trim(p_state_code),''))),
           zip_code=coalesce(nullif(zip_code,''),nullif(trim(p_zip_code),'')),
           target_zone=coalesce(nullif(target_zone,''),nullif(trim(p_target_zone),'')),
           services_enabled=(select coalesce(array_agg(distinct x),'{}'::text[]) from unnest(coalesce(services_enabled,'{}'::text[])||coalesce(p_services_enabled,'{}'::text[])) x),
           tools_available=(select coalesce(array_agg(distinct x),'{}'::text[]) from unnest(coalesce(tools_available,'{}'::text[])||coalesce(p_tools_available,'{}'::text[])) x),
           source_rating=greatest(coalesce(source_rating,0),coalesce(p_source_rating,0)),
           source_review_count=greatest(source_review_count,greatest(coalesce(p_source_review_count,0),0)),
           updated_at=now()
     where id=v_candidate_id;
  end if;

  insert into public.sos_recruiting_source_records(
    candidate_id,source_system,source_record_key,source_url,raw_category,raw_city,raw_state,import_batch,provenance
  ) values (
    v_candidate_id,left(trim(p_source_system),120),left(v_source_key,240),nullif(trim(p_source_url),''),
    case when coalesce(array_length(p_services_enabled,1),0)>0 then array_to_string(p_services_enabled,',') else null end,
    nullif(trim(p_city),''),upper(nullif(trim(p_state_code),'')),'enterprise_upgrade_loop',coalesce(p_provenance,'{}'::jsonb)
  )
  on conflict(source_system,source_record_key) do update
     set candidate_id=excluded.candidate_id,
         source_url=coalesce(excluded.source_url,public.sos_recruiting_source_records.source_url),
         raw_category=coalesce(excluded.raw_category,public.sos_recruiting_source_records.raw_category),
         raw_city=coalesce(excluded.raw_city,public.sos_recruiting_source_records.raw_city),
         raw_state=coalesce(excluded.raw_state,public.sos_recruiting_source_records.raw_state),
         imported_at=now(),
         import_batch=excluded.import_batch,
         provenance=public.sos_recruiting_source_records.provenance||excluded.provenance;

  v_score := public.sos_score_recruiting_candidate(v_candidate_id);

  return jsonb_build_object('candidate_id',v_candidate_id,'created',v_created,'dedupe_key',v_dedupe,'score',v_score);
end
$$;

revoke all on function private.sos_ingest_public_provider_prospect(text,text,text,text,text,text,text,text,text,text,text,text[],text[],numeric,integer,jsonb) from public, anon, authenticated;
grant execute on function private.sos_ingest_public_provider_prospect(text,text,text,text,text,text,text,text,text,text,text,text[],text[],numeric,integer,jsonb) to service_role;
