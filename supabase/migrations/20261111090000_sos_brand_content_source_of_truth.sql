-- S.O.S. brand content source of truth (GitHub issue #119, SUPERHEROS handoff 2026-11-11).
--
-- Reuses the existing authority stack instead of creating a parallel marketing DB:
--   * sos_authority_sources / sos_authority_outreach  -> third-party targets and pitches (unchanged)
--   * sos_trademark_clearance                         -> trademark research (unchanged)
--   * sos_search_index_submissions                    -> IndexNow / engine submission receipts (unchanged)
-- Adds only what did not exist:
--   * sos_brand_content              -> definitions, taglines, wiki articles, boilerplate,
--                                       video packages, creative asset references, app store copy
--   * sos_brand_content_revisions    -> automatic, append-only revision history
--   * sos_brand_content_destinations -> where each record is published + verified index status
--
-- Access: internal only, exactly like the authority tables. anon/authenticated are denied;
-- trusted server paths (service_role, including the Muse/ops bridge) read and write.

create table if not exists public.sos_brand_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  kind text not null check (kind in ('definition','tagline','wiki_article','boilerplate','video_package','creative_asset','app_store_copy')),
  title text not null,
  body jsonb not null default '{}'::jsonb,
  canonical_url text,
  status text not null default 'draft' check (status in ('draft','in_review','approved','published','retired')),
  version integer not null default 1,
  owner text not null default 'claude' check (owner in ('claude','chatgpt','muse','founder','ops')),
  source_repo_path text,
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_brand_content_published_needs_approval check (status not in ('approved','published') or approved_by is not null),
  constraint sos_brand_content_published_at check (status <> 'published' or published_at is not null)
);

create table if not exists public.sos_brand_content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.sos_brand_content(id) on delete cascade,
  version integer not null,
  title text not null,
  body jsonb not null,
  status text not null,
  changed_by text,
  created_at timestamptz not null default now(),
  unique (content_id, version)
);

create table if not exists public.sos_brand_content_destinations (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.sos_brand_content(id) on delete cascade,
  destination text not null check (destination in ('website','ios_app','android_app','app_store','google_play','instagram','tiktok','youtube','ghl_email','ghl_sms','push','press_kit','urban_dictionary','other')),
  destination_url text not null default '',
  status text not null default 'planned' check (status in ('planned','pending_approval','live','submitted','rejected','retired')),
  evidence_url text,
  verified_at timestamptz,
  google_index_status text not null default 'unknown' check (google_index_status in ('unknown','submitted','indexed','not_indexed','excluded')),
  bing_index_status text not null default 'unknown' check (bing_index_status in ('unknown','submitted','indexed','not_indexed','excluded')),
  index_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, destination, destination_url),
  constraint sos_brand_content_destinations_live_needs_evidence check (status <> 'live' or verified_at is not null)
);

create index if not exists sos_brand_content_kind_status_idx on public.sos_brand_content (kind, status);
create index if not exists sos_brand_content_revisions_content_idx on public.sos_brand_content_revisions (content_id);
create index if not exists sos_brand_content_destinations_content_idx on public.sos_brand_content_destinations (content_id);

-- Spelling guard: the plural brand term is SUPERHEROS. Rejects the conventional plural in
-- brand content unless the record documents why (e.g. a verbatim third-party quotation).
create or replace function public.sos_brand_content_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (coalesce(new.title, '') || ' ' || coalesce(new.body::text, '')) ~* 'superheroes'
     and coalesce(new.body ->> 'spelling_exception_reason', '') = '' then
    raise exception 'S.O.S. brand content must use SUPERHEROS (record %). Set body.spelling_exception_reason only for verbatim third-party text.', new.content_key
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' then
    if new.title is distinct from old.title or new.body is distinct from old.body or new.status is distinct from old.status then
      new.version := old.version + 1;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.sos_brand_content_capture_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.sos_brand_content_revisions (content_id, version, title, body, status, changed_by)
    values (new.id, new.version, new.title, new.body, new.status, new.updated_by)
    on conflict (content_id, version) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.sos_brand_content_destinations_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sos_brand_content_guard on public.sos_brand_content;
create trigger sos_brand_content_guard before insert or update on public.sos_brand_content
  for each row execute function public.sos_brand_content_guard();

drop trigger if exists sos_brand_content_capture_revision on public.sos_brand_content;
create trigger sos_brand_content_capture_revision after insert or update on public.sos_brand_content
  for each row execute function public.sos_brand_content_capture_revision();

drop trigger if exists sos_brand_content_destinations_touch on public.sos_brand_content_destinations;
create trigger sos_brand_content_destinations_touch before update on public.sos_brand_content_destinations
  for each row execute function public.sos_brand_content_destinations_touch();

-- Internal only, matching sos_authority_* and sos_search_index_submissions.
alter table public.sos_brand_content enable row level security;
alter table public.sos_brand_content_revisions enable row level security;
alter table public.sos_brand_content_destinations enable row level security;

revoke all on public.sos_brand_content, public.sos_brand_content_revisions, public.sos_brand_content_destinations from anon, authenticated, public;
grant all on public.sos_brand_content, public.sos_brand_content_revisions, public.sos_brand_content_destinations to service_role;
revoke all on function public.sos_brand_content_guard(), public.sos_brand_content_capture_revision(), public.sos_brand_content_destinations_touch() from public, anon, authenticated;

drop policy if exists sos_brand_content_private on public.sos_brand_content;
create policy sos_brand_content_private on public.sos_brand_content as permissive for all to anon, authenticated using (false) with check (false);
drop policy if exists sos_brand_content_revisions_private on public.sos_brand_content_revisions;
create policy sos_brand_content_revisions_private on public.sos_brand_content_revisions as permissive for all to anon, authenticated using (false) with check (false);
drop policy if exists sos_brand_content_destinations_private on public.sos_brand_content_destinations;
create policy sos_brand_content_destinations_private on public.sos_brand_content_destinations as permissive for all to anon, authenticated using (false) with check (false);

-- One read surface for Muse / ops (service_role): each record with its live destinations
-- and the latest IndexNow/engine submission receipt for its canonical URL.
create or replace view public.sos_brand_content_status_v with (security_invoker = true) as
select
  c.content_key, c.kind, c.title, c.status, c.version, c.owner, c.canonical_url,
  c.approved_by, c.approved_at, c.published_at, c.updated_at,
  coalesce(d.destinations, '[]'::jsonb) as destinations,
  s.engine as last_submission_engine, s.accepted as last_submission_accepted,
  s.http_status as last_submission_http_status, s.submitted_at as last_submitted_at
from public.sos_brand_content c
left join lateral (
  select jsonb_agg(jsonb_build_object('destination', x.destination, 'url', x.destination_url, 'status', x.status,
    'verified_at', x.verified_at, 'google_index_status', x.google_index_status, 'bing_index_status', x.bing_index_status,
    'index_checked_at', x.index_checked_at) order by x.destination) as destinations
  from public.sos_brand_content_destinations x where x.content_id = c.id
) d on true
left join lateral (
  select * from public.sos_search_index_submissions i
  where i.submitted_url = c.canonical_url order by i.submitted_at desc limit 1
) s on true;

revoke all on public.sos_brand_content_status_v from anon, authenticated, public;
grant select on public.sos_brand_content_status_v to service_role;

comment on table public.sos_brand_content is 'S.O.S. brand content source of truth: definitions, taglines, wiki articles, boilerplate, video packages, creative asset references. Mirrors src/content/sosLexicon.js. Plural brand term is SUPERHEROS (enforced by trigger).';
comment on table public.sos_brand_content_destinations is 'Where each S.O.S. brand content record is published, with evidence and separate submitted vs indexed status per engine. Submission receipts live in sos_search_index_submissions.';
comment on view public.sos_brand_content_status_v is 'Muse/ops read surface (service_role): brand content + destinations + latest index submission receipt.';
