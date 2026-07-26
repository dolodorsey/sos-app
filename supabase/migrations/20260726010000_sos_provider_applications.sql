create table if not exists public.sos_provider_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  phone text not null check (char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 10 and 15),
  company_name text,
  service_types text[] not null default '{}',
  service_area text not null check (char_length(trim(service_area)) between 2 and 160),
  years_experience integer check (years_experience between 0 and 80),
  license_number text,
  insured boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  status text not null default 'new' check (status in ('new','reviewing','approved','declined','waitlist')),
  source text not null default 'sos-app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sos_provider_applications enable row level security;

revoke all on table public.sos_provider_applications from anon, authenticated;
grant insert on table public.sos_provider_applications to anon, authenticated;
grant select, insert, update, delete on table public.sos_provider_applications to service_role;

create index if not exists sos_provider_applications_status_created_idx
  on public.sos_provider_applications (status, created_at desc);
create index if not exists sos_provider_applications_email_idx
  on public.sos_provider_applications (lower(email));

create or replace function public.set_sos_provider_application_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sos_provider_applications_updated_at on public.sos_provider_applications;
create trigger trg_sos_provider_applications_updated_at
before update on public.sos_provider_applications
for each row execute function public.set_sos_provider_application_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sos_provider_applications'
      and policyname = 'Public may submit provider applications'
  ) then
    create policy "Public may submit provider applications"
      on public.sos_provider_applications
      for insert
      to anon, authenticated
      with check (
        status = 'new'
        and source = 'sos-app'
        and coalesce(array_length(service_types, 1), 0) > 0
      );
  end if;
end
$$;
