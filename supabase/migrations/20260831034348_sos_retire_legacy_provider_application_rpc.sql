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
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'Server role required' using errcode = '42501';
  end if;

  raise exception 'Legacy S.O.S. provider intake is retired. Use /hero/apply and submit-sos-hero-application.'
    using errcode = '55000';
end;
$$;

revoke all on function public.sos_submit_provider_application(text,text,text,text,text[],text,integer,text,boolean,text) from public, anon, authenticated;
grant execute on function public.sos_submit_provider_application(text,text,text,text,text[],text,integer,text,boolean,text) to service_role;

comment on function public.sos_submit_provider_application(text,text,text,text,text[],text,integer,text,boolean,text)
is 'Retired legacy S.O.S. provider-intake RPC. Canonical provider onboarding is /hero/apply via submit-sos-hero-application.';

comment on table public.sos_provider_applications
is 'Retired legacy S.O.S. provider-interest table retained for audit/history. New provider onboarding must use the canonical Hero application funnel.';
