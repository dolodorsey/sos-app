begin;

alter table public.sos_provider_applications
  drop constraint if exists sos_provider_applications_status_check;
alter table public.sos_provider_applications
  add constraint sos_provider_applications_status_check
  check (status in ('new','reviewing','approved','rejected','withdrawn'));

alter table public.sos_provider_applications
  drop constraint if exists sos_provider_applications_source_check;
alter table public.sos_provider_applications
  add constraint sos_provider_applications_source_check
  check (source in ('sos-app','operations','referral'));

alter table public.sos_provider_applications
  drop constraint if exists sos_provider_applications_field_lengths;
alter table public.sos_provider_applications
  add constraint sos_provider_applications_field_lengths
  check (
    char_length(full_name) between 2 and 120
    and char_length(email) between 5 and 254
    and char_length(phone) between 10 and 20
    and (company_name is null or char_length(company_name) <= 160)
    and char_length(service_area) between 2 and 160
    and (license_number is null or char_length(license_number) <= 120)
    and (notes is null or char_length(notes) <= 2000)
    and coalesce(array_length(service_types,1),0) between 1 and 8
    and char_length(array_to_string(service_types,',')) <= 500
    and (years_experience is null or years_experience between 0 and 80)
  );

create index if not exists sos_provider_applications_email_created_idx
on public.sos_provider_applications(lower(email),created_at desc);
create index if not exists sos_provider_applications_phone_created_idx
on public.sos_provider_applications(regexp_replace(phone,'\D','','g'),created_at desc);

create or replace function public.sos_submit_provider_application(
  p_full_name text,
  p_email text,
  p_phone text,
  p_company_name text,
  p_service_types text[],
  p_service_area text,
  p_years_experience integer,
  p_license_number text,
  p_insured boolean,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_email text := lower(trim(p_email));
  v_phone text := regexp_replace(coalesce(p_phone,''),'\D','','g');
  v_services text[];
  v_existing_id uuid;
  v_id uuid;
  v_allowed constant text[] := array[
    'Towing','Flat Tire Help','Jump Start','Fuel Delivery',
    'Vehicle Lockout','Mobile Maintenance','Car Wash / Detailing','Fleet Services'
  ];
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'Server role required' using errcode='42501';
  end if;

  if char_length(trim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Invalid full name'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email)>254 then raise exception 'Invalid email'; end if;
  if char_length(v_phone) not between 10 and 15 then raise exception 'Invalid phone'; end if;
  if char_length(trim(coalesce(p_service_area,''))) not between 2 and 160 then raise exception 'Invalid service area'; end if;
  if p_years_experience is not null and p_years_experience not between 0 and 80 then raise exception 'Invalid experience'; end if;

  select array_agg(service order by service)
  into v_services
  from (
    select distinct trim(value) as service
    from unnest(coalesce(p_service_types,'{}'::text[])) as value
    where trim(value)=any(v_allowed)
  ) allowed;

  if coalesce(array_length(v_services,1),0) < 1 then raise exception 'Select at least one supported service'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email||':'||v_phone,0));

  select id into v_existing_id
  from public.sos_provider_applications
  where (lower(email)=v_email or regexp_replace(phone,'\D','','g')=v_phone)
    and status in ('new','reviewing','approved')
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('accepted',true,'duplicate',true,'application_id',v_existing_id);
  end if;

  insert into public.sos_provider_applications(
    full_name,email,phone,company_name,service_types,service_area,
    years_experience,license_number,insured,notes,status,source
  ) values(
    left(trim(p_full_name),120),v_email,v_phone,
    left(nullif(trim(p_company_name),''),160),v_services,left(trim(p_service_area),160),
    p_years_experience,left(nullif(trim(p_license_number),''),120),coalesce(p_insured,false),
    left(nullif(trim(p_notes),''),2000),'new','sos-app'
  ) returning id into v_id;

  return jsonb_build_object('accepted',true,'duplicate',false,'application_id',v_id);
end;
$$;

revoke all on public.sos_provider_applications from public,anon,authenticated;
grant all on public.sos_provider_applications to service_role,postgres;

drop policy if exists "Public may submit provider applications" on public.sos_provider_applications;

revoke all on function public.sos_submit_provider_application(text,text,text,text,text[],text,integer,text,boolean,text)
from public,anon,authenticated;
grant execute on function public.sos_submit_provider_application(text,text,text,text,text[],text,integer,text,boolean,text)
to service_role,postgres;

comment on function public.sos_submit_provider_application(text,text,text,text,text[],text,integer,text,boolean,text) is
'Server-only validated provider intake with duplicate suppression. Public clients submit through the submit-provider-application Edge Function.';

commit;
