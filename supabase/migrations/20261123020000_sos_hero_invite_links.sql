-- Personal Hero onboarding links (sosatl.com/<CODE>).
-- A caller sends one link per prospect. The link opens the Hero application
-- pre-filled from the prospect record, saves progress to the server as the
-- person types, and reopens exactly where they left off — on any device.
-- Nothing here approves, activates or dispatches anyone: the link only carries
-- a draft until the person submits through the normal application.

create table if not exists public.sos_hero_invites (
  code text primary key check (code ~ '^[A-Z2-9]{8}$'),
  candidate_id uuid references public.sos_recruiting_candidates(id) on delete set null,
  created_by text,
  prefill jsonb not null default '{}'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  draft_step int not null default 0 check (draft_step between 0 and 10),
  status text not null default 'sent' check (status in ('sent','opened','in_progress','submitted')),
  open_count int not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  last_saved_at timestamptz,
  application_id uuid references public.sos_hero_applications(id) on delete set null,
  receipt jsonb,
  submitted_at timestamptz,
  expires_at timestamptz not null default now() + interval '120 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sos_hero_invites_one_per_candidate on public.sos_hero_invites(candidate_id) where candidate_id is not null;
create index if not exists sos_hero_invites_status_idx on public.sos_hero_invites(status);
alter table public.sos_hero_invites enable row level security;
revoke all on public.sos_hero_invites from anon, authenticated;

-- 8 characters from an alphabet without look-alikes (no 0/O/1/I/L), from crypto-random bytes.
create or replace function private.sos_invite_code()
returns text language plpgsql volatile set search_path = pg_catalog, extensions as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(8); out text := ''; i int;
begin
  for i in 0..7 loop out := out || substr(alphabet, (get_byte(b, i) % 31) + 1, 1); end loop;
  return out;
end $$;

-- What the form is pre-filled with, from the prospect record.
create or replace function private.sos_invite_prefill(p_candidate_id uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'firstName', nullif(trim(c.first_name), ''),
    'lastName', nullif(trim(c.last_name), ''),
    'email', nullif(lower(trim(c.email)), ''),
    'phone', nullif(trim(c.phone), ''),
    'city', nullif(trim(c.city), ''),
    'state', coalesce(nullif(trim(c.state_code), ''), 'GA'),
    'hasBusiness', case when nullif(trim(c.company_name), '') is not null then 'yes' end,
    'businessName', nullif(trim(c.company_name), ''),
    'businessLink', nullif(trim(c.website), ''),
    'zones', case c.target_zone
      when 'Downtown / Centennial' then '["downtown"]'::jsonb
      when 'Midtown' then '["midtown"]'::jsonb
      when 'West Midtown' then '["midtown"]'::jsonb
      when 'Buckhead' then '["buckhead"]'::jsonb
      when 'Sandy Springs' then '["buckhead"]'::jsonb
      when 'Perimeter / Dunwoody' then '["buckhead"]'::jsonb
      when 'Decatur' then '["east"]'::jsonb
      when 'East Atlanta / Kirkwood' then '["east"]'::jsonb
      when 'Hartsfield-Jackson Airport' then '["south"]'::jsonb
      when 'Smyrna / Vinings' then '["west"]'::jsonb
    end,
    'launch', (select jsonb_agg(distinct m) from unnest(coalesce(c.services_enabled, '{}'::text[])) s
               cross join lateral (select case s when 'towing' then 'tow' when 'fuel_delivery' then 'fuel' when 'jump_start' then 'jump'
                                                 when 'flat_tire' then 'flat' when 'lockout' then 'lockout' end m) x where m is not null)
  ))
  from public.sos_recruiting_candidates c where c.id = p_candidate_id
$$;

-- Ops / board: get (or make) the one link for a prospect. Service role only.
create or replace function public.sos_ops_hero_invite_for_candidate(p_candidate_id uuid, p_created_by text default null)
returns text language plpgsql security definer set search_path = public, private as $$
declare v_code text; i int := 0;
begin
  select code into v_code from public.sos_hero_invites where candidate_id = p_candidate_id;
  if v_code is not null then return v_code; end if;
  loop
    i := i + 1;
    begin
      insert into public.sos_hero_invites (code, candidate_id, created_by, prefill)
      values (private.sos_invite_code(), p_candidate_id, p_created_by, coalesce(private.sos_invite_prefill(p_candidate_id), '{}'::jsonb))
      returning code into v_code;
      return v_code;
    exception when unique_violation then
      select code into v_code from public.sos_hero_invites where candidate_id = p_candidate_id;
      if v_code is not null then return v_code; end if;
      if i > 5 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.sos_ops_hero_invite_for_candidate(uuid, text) from public, anon, authenticated;

-- Applicant: open the link. Returns pre-fill + saved progress, or the application receipt once submitted.
create or replace function public.sos_hero_invite_open(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.sos_hero_invites%rowtype; k text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if length(k) <> 8 then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  update public.sos_hero_invites
     set open_count = open_count + 1, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now(),
         status = case when status = 'sent' then 'opened' else status end, updated_at = now()
   where code = k and expires_at > now()
  returning * into v;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'status', v.status, 'prefill', v.prefill, 'draft', v.draft, 'step', v.draft_step,
                            'saved_at', v.last_saved_at, 'receipt', case when v.status = 'submitted' then v.receipt end);
end $$;

-- Applicant: save progress to the link.
create or replace function public.sos_hero_invite_save(p_code text, p_draft jsonb, p_step int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_at timestamptz;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' or pg_column_size(p_draft) > 16384 then
    raise exception 'Draft is not valid' using errcode = '22023';
  end if;
  update public.sos_hero_invites
     set draft = p_draft, draft_step = greatest(0, least(coalesce(p_step, 0), 10)), last_saved_at = now(),
         status = case when status in ('sent','opened') then 'in_progress' else status end, updated_at = now()
   where code = k and expires_at > now() and status <> 'submitted'
  returning last_saved_at into v_at;
  if v_at is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'saved_at', v_at);
end $$;

-- Applicant: after the normal application is submitted, tie it to the link.
-- Proven with the application's private tracking token, same check the status lookup uses.
create or replace function public.sos_hero_invite_complete(p_code text, p_application_id uuid, p_tracking_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare k text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); a public.sos_hero_applications%rowtype; v public.sos_hero_invites%rowtype;
begin
  if coalesce(length(p_tracking_token), 0) < 30 then return jsonb_build_object('ok', false); end if;
  select * into a from public.sos_hero_applications
   where id = p_application_id and status_token_hash = encode(extensions.digest(p_tracking_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('ok', false); end if;
  update public.sos_hero_invites
     set status = 'submitted', application_id = a.id, submitted_at = coalesce(submitted_at, now()), updated_at = now(),
         receipt = jsonb_build_object('application_id', a.id, 'tracking_token', p_tracking_token, 'email', a.email)
   where code = k and status <> 'submitted'
  returning * into v;
  if not found then return jsonb_build_object('ok', false); end if;
  if v.candidate_id is not null then
    update public.sos_hero_applications set candidate_id = v.candidate_id where id = a.id and candidate_id is null;
    update public.sos_recruiting_candidates set application_id = a.id, updated_at = now() where id = v.candidate_id and application_id is null;
  end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.sos_hero_invite_open(text) to anon, authenticated;
grant execute on function public.sos_hero_invite_save(text, jsonb, int) to anon, authenticated;
grant execute on function public.sos_hero_invite_complete(text, uuid, text) to anon, authenticated;

-- Standard: every real prospect gets a link the moment it's added.
create or replace function private.sos_candidate_auto_invite()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if not coalesce(new.is_demo, false) and not coalesce(new.do_not_contact, false) then
    perform public.sos_ops_hero_invite_for_candidate(new.id, 'auto');
  end if;
  return new;
end $$;
drop trigger if exists sos_candidates_auto_invite on public.sos_recruiting_candidates;
create trigger sos_candidates_auto_invite after insert on public.sos_recruiting_candidates
  for each row execute function private.sos_candidate_auto_invite();

-- Callers' view: one row per prospect with the link to send.
create or replace view public.sos_hero_invite_links with (security_invoker = true) as
  select i.code, 'https://sosatl.com/' || i.code as link, i.status, i.open_count, i.last_opened_at, i.last_saved_at, i.submitted_at,
         i.application_id, c.id as candidate_id, coalesce(nullif(c.company_name, ''), trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))) as prospect,
         c.phone, c.target_zone, c.pipeline_stage
  from public.sos_hero_invites i left join public.sos_recruiting_candidates c on c.id = i.candidate_id;
revoke all on public.sos_hero_invite_links from anon, authenticated;

-- Backfill: a link for every real prospect who can be contacted.
select public.sos_ops_hero_invite_for_candidate(c.id, 'backfill')
from public.sos_recruiting_candidates c
where not coalesce(c.is_demo, false) and not coalesce(c.do_not_contact, false);
