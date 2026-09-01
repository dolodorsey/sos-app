create table if not exists public.sos_crm_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ghl_contact_id text unique,
  onboarding_stage text not null default 'account_created',
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','error','disabled')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sos_crm_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','processed','error')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists sos_crm_outbox_pending_idx on public.sos_crm_outbox(status,available_at,created_at);
alter table public.sos_crm_links enable row level security;
alter table public.sos_crm_outbox enable row level security;

create or replace function public.sos_queue_crm_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'app','') <> 'sos' then return new; end if;
  insert into public.sos_crm_links(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.sos_crm_outbox(user_id,event_type,payload)
  values(new.id,'user.signup',jsonb_build_object('app','sos','user_id',new.id));
  return new;
exception when others then
  raise warning 'sos_queue_crm_on_signup failed for %: % [%]',new.id,sqlerrm,sqlstate;
  return new;
end;
$$;
revoke all on function public.sos_queue_crm_on_signup() from public,anon,authenticated;

drop trigger if exists sos_crm_on_auth_user_created on auth.users;
create trigger sos_crm_on_auth_user_created after insert on auth.users
for each row execute function public.sos_queue_crm_on_signup();

insert into public.sos_crm_links(user_id)
select distinct s.auth_id from public.sos_users s join auth.users u on u.id=s.auth_id
where s.auth_id is not null on conflict(user_id) do nothing;

insert into public.sos_crm_outbox(user_id,event_type,payload)
select l.user_id,'user.backfill',jsonb_build_object('app','sos','user_id',l.user_id)
from public.sos_crm_links l
where not exists (
  select 1 from public.sos_crm_outbox o
  where o.user_id=l.user_id and o.event_type in ('user.signup','user.backfill')
);