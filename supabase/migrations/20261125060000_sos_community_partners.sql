-- S.O.S. community partners: referral partners and after-hours post-up locations.
-- Referral partner: an organization that recommends S.O.S. when its people need roadside help.
-- Post-up location: a partner's lot where Heroes can stage after the business closes.
--   Signed post-up locations may also be listed on Apple Maps as S.O.S. locations, which
--   needs real S.O.S. presence there: a sign, the S.O.S. phone number and posted staging hours.

create table if not exists public.sos_community_partners (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  category text not null,
  roles text[] not null default array['referral']::text[],
  side_of_town text,
  zone_name text,
  address text,
  city text,
  state_code text default 'GA',
  zip_code text,
  phone text,
  email text,
  website text,
  contact_person text,
  contact_role text,
  google_place_id text,
  lat numeric,
  lng numeric,
  closes_at text,
  has_large_lot boolean,
  status text not null default 'prospect',
  owner text,
  next_step text,
  next_step_at timestamptz,
  apple_maps_status text not null default 'not_started',
  founder_note text,
  notes text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_community_partners_roles_check check (roles <@ array['referral','post_up']::text[] and cardinality(roles) > 0),
  constraint sos_community_partners_side_check check (side_of_town is null or side_of_town in ('North','South','East','West','Central')),
  constraint sos_community_partners_status_check check (status in ('prospect','research_contact','contacted','interested','agreement_sent','signed','live','declined','paused')),
  constraint sos_community_partners_apple_check check (apple_maps_status in ('not_started','not_eligible','sign_installed','submitted','live','rejected'))
);

create unique index if not exists sos_community_partners_place_uidx
  on public.sos_community_partners (google_place_id) where google_place_id is not null;
create unique index if not exists sos_community_partners_name_city_uidx
  on public.sos_community_partners (lower(partner_name), lower(coalesce(city,'')), lower(coalesce(address,'')));
create index if not exists sos_community_partners_category_idx on public.sos_community_partners (category, side_of_town, status);

alter table public.sos_community_partners enable row level security;
revoke all on public.sos_community_partners from anon, authenticated;

create or replace function private.sos_community_partners_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists sos_community_partners_touch on public.sos_community_partners;
create trigger sos_community_partners_touch before update on public.sos_community_partners
  for each row execute function private.sos_community_partners_touch();

comment on table public.sos_community_partners is
  'S.O.S. referral partners and after-hours post-up locations, by side of town. Service-role access only.';
