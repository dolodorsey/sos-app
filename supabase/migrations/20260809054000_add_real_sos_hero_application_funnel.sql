create table if not exists public.sos_hero_applications (
  id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null, email text not null, phone text not null,
  city text, state text, services_requested text[] not null default '{}'::text[], tools_available text[] not null default '{}'::text[],
  vehicle_type text, vehicle_make text, vehicle_model text, vehicle_year integer, years_experience integer not null default 0, experience_summary text,
  license_attested boolean not null default false, insurance_attested boolean not null default false, background_consent boolean not null default false, terms_accepted boolean not null default false,
  status text not null default 'submitted' check(status in ('submitted','reviewing','approved','rejected','withdrawn')), operator_note text, reviewed_at timestamptz, reviewed_by uuid,
  source_user_id uuid references public.sos_users(id) on delete set null, source_hero_id uuid references public.sos_heroes(id) on delete set null, candidate_id uuid references public.sos_recruiting_candidates(id) on delete set null,
  submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(char_length(first_name) between 1 and 80), check(char_length(last_name) between 1 and 80), check(char_length(email) between 3 and 254), check(char_length(phone) between 7 and 40), check(years_experience between 0 and 80),
  check(vehicle_year is null or vehicle_year between 1900 and extract(year from current_date)::int + 2), check(experience_summary is null or char_length(experience_summary)<=3000), check(operator_note is null or char_length(operator_note)<=3000)
);
create index if not exists sos_hero_applications_status_idx on public.sos_hero_applications(status,submitted_at desc);
create unique index if not exists sos_hero_applications_open_email_uq on public.sos_hero_applications(lower(email)) where status in ('submitted','reviewing','approved');
alter table public.sos_hero_applications enable row level security;
revoke all on public.sos_hero_applications from anon,authenticated;

create or replace function public.sos_ops_hero_applications()
returns setof public.sos_hero_applications language sql security definer set search_path='pg_catalog','public','private' as $$
  select a.* from public.sos_hero_applications a where private.is_marketplace_operator(auth.uid()) order by case a.status when 'submitted' then 0 when 'reviewing' then 1 else 2 end,a.submitted_at asc
$$;
revoke all on function public.sos_ops_hero_applications() from public,anon; grant execute on function public.sos_ops_hero_applications() to authenticated;

create or replace function public.sos_ops_review_hero_application(p_application_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare a public.sos_hero_applications%rowtype; u public.sos_users%rowtype; h public.sos_heroes%rowtype; c public.sos_recruiting_candidates%rowtype;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  if p_decision not in ('reviewing','approved','rejected') then raise exception 'Invalid review decision'; end if;
  select * into a from public.sos_hero_applications where id=p_application_id for update; if not found then raise exception 'Hero application not found'; end if;
  if a.status in ('rejected','withdrawn') and p_decision<>'rejected' then raise exception 'Closed application cannot be reopened here'; end if;
  if p_decision='approved' then
    if not (a.license_attested and a.insurance_attested and a.background_consent and a.terms_accepted) then raise exception 'Required applicant attestations are incomplete'; end if;
    if a.source_user_id is null then
      insert into public.sos_users(role,first_name,last_name,phone,email,status,city,state,is_demo,referral_code) values('hero',a.first_name,a.last_name,a.phone,lower(a.email),'active',a.city,a.state,false,lower(substring(md5(a.id::text) from 1 for 8))) returning * into u;
      insert into public.sos_heroes(user_id,zone,services_enabled,tools_available,vehicle_type,vehicle_make,vehicle_model,vehicle_year,license_verified,insurance_verified,background_cleared,id_verified,test_mission_passed,verification_status,on_duty,is_demo,payout_method) values(u.id,coalesce(a.city,'')||case when a.state is not null then ', '||a.state else '' end,a.services_requested,a.tools_available,a.vehicle_type,a.vehicle_make,a.vehicle_model,a.vehicle_year,false,false,false,false,false,'pending',false,false,null) returning * into h;
      insert into public.sos_recruiting_candidates(source_hero_id,source_user_id,candidate_source,first_name,last_name,email,phone,target_zone,services_enabled,tools_available,vehicle_type,priority_score,pipeline_stage,outreach_status,last_outcome,notes,is_demo) values(h.id,u.id,'hero_application',a.first_name,a.last_name,lower(a.email),a.phone,coalesce(a.city,'')||case when a.state is not null then ', '||a.state else '' end,a.services_requested,a.tools_available,a.vehicle_type,70,'account_setup','responded','responded','Approved from real Hero application. Verification checks remain required.',false) returning * into c;
      update public.sos_hero_applications set source_user_id=u.id,source_hero_id=h.id,candidate_id=c.id where id=a.id;
    else select * into h from public.sos_heroes where id=a.source_hero_id; select * into c from public.sos_recruiting_candidates where id=a.candidate_id; end if;
  end if;
  update public.sos_hero_applications set status=p_decision,operator_note=nullif(trim(coalesce(p_note,'')),''),reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=a.id;
  return jsonb_build_object('application_id',a.id,'status',p_decision,'claim_ready',p_decision='approved','hero_id',coalesce(h.id,a.source_hero_id),'candidate_id',coalesce(c.id,a.candidate_id),'verification_status',case when p_decision='approved' then coalesce(h.verification_status,'pending') else null end,'message',case when p_decision='approved' then 'Approved for account claim. Identity, license, insurance, background, test mission, and payout readiness are still required before patrol.' when p_decision='reviewing' then 'Application moved to review.' else 'Application rejected.' end);
end;$$;
revoke all on function public.sos_ops_review_hero_application(uuid,text,text) from public,anon; grant execute on function public.sos_ops_review_hero_application(uuid,text,text) to authenticated;