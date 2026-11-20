-- Additive only: side-of-town coverage + launch-service split for Hero applications.
alter table public.sos_hero_applications
  add column if not exists service_zones text[] not null default '{}'::text[],
  add column if not exists launch_services text[] not null default '{}'::text[],
  add column if not exists additional_services text[] not null default '{}'::text[],
  add column if not exists trade_proof_required boolean not null default false,
  add column if not exists intake_profile jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sos_hero_applications_service_zones_valid') then
    alter table public.sos_hero_applications
      add constraint sos_hero_applications_service_zones_valid
      check (service_zones <@ array['east','south','west','downtown','midtown','buckhead']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sos_hero_applications_launch_services_valid') then
    alter table public.sos_hero_applications
      add constraint sos_hero_applications_launch_services_valid
      check (launch_services <@ array['tow','fuel','jump','flat','lockout']::text[]);
  end if;
end $$;

comment on column public.sos_hero_applications.service_zones is 'Sides of metro Atlanta the applicant will cover.';
comment on column public.sos_hero_applications.launch_services is 'Launch services signed up for: tow, fuel, jump, flat, lockout.';
comment on column public.sos_hero_applications.additional_services is 'Other catalog services the applicant can provide; not dispatched at launch.';
comment on column public.sos_hero_applications.trade_proof_required is 'Tow or lockout selected: business card, business license, or certification required before activation.';

create index if not exists sos_hero_applications_service_zones_idx on public.sos_hero_applications using gin (service_zones);
create index if not exists sos_hero_applications_launch_services_idx on public.sos_hero_applications using gin (launch_services);

comment on column public.sos_hero_applications.intake_profile is 'Business + schedule answers: has_business, business_name/type/years/insured/link, days, times, hours_per_week, start_when, max_miles, languages, heard_from.';

-- Sign-up verification is now driver license + selfie (Tow/Lockout add trade proof, checked at ops review).
-- 'selfie' becomes a supported document type; earlier selfies uploaded as 'other' still count.
create or replace function public.sos_hero_submit_application_document(p_application_id uuid, p_document_type text, p_path text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'private', 'storage'
as $function$
declare a public.sos_hero_applications%rowtype; has_license boolean; has_selfie boolean; required_count int; final_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications where id=p_application_id and source_auth_id=auth.uid() for update;
  if not found then raise exception 'Bound Hero application required' using errcode='42501'; end if;
  if p_document_type not in ('government_id','drivers_license','selfie','insurance','vehicle_registration','business_license','certification','vehicle_photo','equipment_photo','other') then raise exception 'Unsupported document type'; end if;
  if p_path is null or p_path not like 'applications/'||auth.uid()::text||'/'||a.id::text||'/'||p_document_type||'/%' or position('..' in p_path)>0 then raise exception 'Invalid application document path'; end if;
  if not exists(select 1 from storage.objects where bucket_id='marketplace-verification' and name=p_path) then raise exception 'Uploaded credential file not found'; end if;
  insert into public.sos_hero_application_documents(application_id,auth_id,document_type,storage_path) values(a.id,auth.uid(),p_document_type,p_path) on conflict(storage_path) do nothing;
  select bool_or(document_type='drivers_license'), bool_or(document_type in ('selfie','other'))
    into has_license, has_selfie
    from public.sos_hero_application_documents where application_id=a.id and status<>'rejected';
  required_count := (case when coalesce(has_license,false) then 1 else 0 end) + (case when coalesce(has_selfie,false) then 1 else 0 end);
  final_status:=case when required_count=2 then 'waitlisted' else 'documents_required' end;
  update public.sos_hero_applications set status=case when status in ('documents_required','waitlisted') then final_status else status end,credentials_complete_at=case when required_count=2 then coalesce(credentials_complete_at,now()) else null end,updated_at=now() where id=a.id;
  return jsonb_build_object('application_id',a.id,'document_type',p_document_type,'required_uploaded',required_count,'required_total',2,'status',final_status);
end $function$;
