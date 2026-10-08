-- S.O.S. provider EARLY INTEREST intake (GitHub issue #103, Phases 2–3).
--
-- Truth model:
--   * public.sos_recruiting_candidates stays the canonical candidate master (no shadow CRM).
--   * Early interest is a SEPARATE truth dimension (sos_provider_early_interest). It never
--     stamps pipeline_stage as qualified/approved and never creates sos_heroes or
--     sos_hero_applications rows.
--   * Every submission writes one append-only receipt (sos_provider_interest_receipts).
--   * Self-reported services -> sos_candidate_service_interests (canonical subcategory ids).
--   * Self-reported zones -> sos_recruiting_candidate_zone_coverage as source_claimed with
--     verified_at NULL. Existing coverage rows are never overwritten.
--   * Test signups (reserved example/test domains) are stored with is_demo/is_test = true and
--     never count as real coverage.
--   * No email/SMS/outreach is sent from here. Opt-ins are recorded for Muse-approved use only.

-- 1. Legacy prospect service labels -> canonical subcategory ids (null = no canonical equivalent).
create table if not exists public.sos_service_label_map (
  legacy_label text primary key,
  subcategory_id text references public.sos_subcategories(id),
  mapping_note text,
  created_at timestamptz not null default now()
);
insert into public.sos_service_label_map(legacy_label, subcategory_id, mapping_note) values
  ('towing','tow',null),('flat_tire','flat',null),('jump_start','jump',null),('lockout','lockout',null),
  ('fuel_delivery','fuel',null),('battery_replace','battery',null),('winch_out','winch',null),
  ('oil_change','oil',null),('fluids','fluids',null),('obd_scan','obd',null),('bulbs','bulb',null),
  ('belt_hose','belt',null),('brake_pads','brakes',null),('windshield_repair','ws_repair',null),
  ('windshield_replace','ws_replace',null),('pdr','dent','paintless dent repair'),('scratch_buff','scratch',null),
  ('express_wash','express',null),('interior_detail','interior',null),('full_detail','full_detail',null),
  ('ceramic','ceramic',null),('odor_removal','odor',null),('fleet_jump_lockout','fleet_jump',null),
  ('fleet_fuel','fleet_fuel',null),('fleet_wash','fleet_wash',null),('fleet_inspection','fleet_inspect',null),
  ('valet_fuel_wash','valet_fuel',null),('pickup_return','pickup_mech',null),('vip_priority','vip',null),
  ('accident_assist',null,'no canonical S.O.S. subcategory'),('ev_charging',null,'no canonical S.O.S. subcategory'),
  ('pretrip',null,'pre-trip inspection; not mapped to fleet_inspect without review'),
  ('ac_recharge',null,'no canonical S.O.S. subcategory'),('weather_rescue',null,'no canonical S.O.S. subcategory')
on conflict (legacy_label) do nothing;
-- Canonical ids map to themselves so mixed arrays resolve cleanly.
insert into public.sos_service_label_map(legacy_label, subcategory_id, mapping_note)
select s.id, s.id, 'canonical' from public.sos_subcategories s
on conflict (legacy_label) do nothing;

-- 2. Early-interest truth dimension, one row per candidate.
create table if not exists public.sos_provider_early_interest (
  candidate_id uuid primary key references public.sos_recruiting_candidates(id) on delete cascade,
  interest_status text not null default 'interested'
    check (interest_status in ('interested','contact_verified','screening','invited_to_apply','not_a_fit','withdrawn')),
  provider_type text not null check (provider_type in ('individual','company','fleet')),
  is_test boolean not null default false,
  first_registered_at timestamptz not null default now(),
  last_registered_at timestamptz not null default now(),
  submission_count integer not null default 1 check (submission_count >= 1),
  latest_receipt_id uuid,
  email_opt_in boolean not null default false,
  email_opt_in_at timestamptz,
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  terms_version text not null,
  privacy_version text not null,
  contact_verified_at timestamptz,
  contact_verification_evidence text check (contact_verification_evidence is null or char_length(contact_verification_evidence) <= 1000),
  assigned_owner text check (assigned_owner is null or char_length(assigned_owner) <= 120),
  muse_outreach_tag text not null default 'none' check (muse_outreach_tag in ('none','tagged_for_muse_review')),
  status_entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sos_provider_early_interest_status_idx on public.sos_provider_early_interest(interest_status, is_test, last_registered_at desc);

-- 3. Append-only receipts.
create table if not exists public.sos_provider_interest_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  idempotency_key uuid not null unique,
  candidate_id uuid not null references public.sos_recruiting_candidates(id) on delete restrict,
  matched_existing boolean not null,
  match_basis text not null check (match_basis in ('new','email','phone','dedupe_key','company_zip')),
  full_name text not null,
  company_name text,
  provider_type text not null check (provider_type in ('individual','company','fleet')),
  email_normalized text,
  phone_normalized text,
  city text not null,
  state_code text not null,
  zip_code text not null,
  subcategory_ids text[] not null,
  zone_ids uuid[] not null,
  service_radius_miles integer check (service_radius_miles is null or service_radius_miles between 1 and 150),
  years_experience integer check (years_experience is null or years_experience between 0 and 80),
  equipment_notes text check (equipment_notes is null or char_length(equipment_notes) <= 1000),
  availability text[] not null default '{}'::text[],
  terms_version text not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null,
  email_opt_in boolean not null,
  sms_opt_in boolean not null,
  consent_snapshot jsonb not null,
  source text not null default 'web_early_interest',
  attribution jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  suppressed_contact boolean not null default false,
  is_test boolean not null default false,
  erased_at timestamptz,
  created_at timestamptz not null default now(),
  check (erased_at is not null or email_normalized is not null or phone_normalized is not null),
  check (cardinality(subcategory_ids) between 1 and 40),
  check (cardinality(zone_ids) between 1 and 10)
);
create index if not exists sos_provider_interest_receipts_candidate_idx on public.sos_provider_interest_receipts(candidate_id, created_at desc);
create index if not exists sos_provider_interest_receipts_created_idx on public.sos_provider_interest_receipts(created_at desc);

create or replace function private.sos_block_receipt_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- The only permitted mutation is a privacy-erasure redaction performed by
  -- public.sos_ops_erase_provider_interest (which sets this transaction-local flag).
  if tg_op = 'UPDATE' and current_setting('sos.receipt_privacy_erasure', true) = 'on'
     and new.id = old.id and new.receipt_number = old.receipt_number and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'S.O.S. provider interest receipts are append-only' using errcode = '42501';
end;
$$;
drop trigger if exists sos_provider_interest_receipts_append_only on public.sos_provider_interest_receipts;
create trigger sos_provider_interest_receipts_append_only before update or delete on public.sos_provider_interest_receipts
  for each row execute function private.sos_block_receipt_mutation();

-- 4. Canonical service interests per candidate.
create table if not exists public.sos_candidate_service_interests (
  candidate_id uuid not null references public.sos_recruiting_candidates(id) on delete cascade,
  subcategory_id text not null references public.sos_subcategories(id),
  source text not null default 'self_reported' check (source in ('self_reported','operator_entered')),
  verification_status text not null default 'self_reported' check (verification_status in ('self_reported','operator_verified','declined')),
  first_receipt_id uuid references public.sos_provider_interest_receipts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (candidate_id, subcategory_id)
);
create index if not exists sos_candidate_service_interests_sub_idx on public.sos_candidate_service_interests(subcategory_id);

-- 5. Audit trail for operator actions on early interest.
create table if not exists public.sos_provider_early_interest_events (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.sos_recruiting_candidates(id) on delete cascade,
  event_type text not null,
  actor text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sos_provider_early_interest_events_candidate_idx on public.sos_provider_early_interest_events(candidate_id, created_at desc);

-- 6. S.O.S.-owned intake throttle (does not touch the shared marketplace limiter).
create table if not exists public.sos_provider_interest_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists sos_provider_interest_rate_limits_idx on public.sos_provider_interest_rate_limits(ip_hash, created_at desc);

-- Lock everything down: no anon/authenticated table access; definer functions only.
alter table public.sos_service_label_map enable row level security;
alter table public.sos_provider_early_interest enable row level security;
alter table public.sos_provider_interest_receipts enable row level security;
alter table public.sos_candidate_service_interests enable row level security;
alter table public.sos_provider_early_interest_events enable row level security;
alter table public.sos_provider_interest_rate_limits enable row level security;
revoke all on public.sos_service_label_map, public.sos_provider_early_interest, public.sos_provider_interest_receipts,
  public.sos_candidate_service_interests, public.sos_provider_early_interest_events, public.sos_provider_interest_rate_limits
  from public, anon, authenticated;

-- 7. The transactional, idempotent registration. service_role only (called by the Edge Function).
create or replace function public.sos_register_provider_interest(p_payload jsonb, p_ip_hash text, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_idem uuid;
  v_existing public.sos_provider_interest_receipts%rowtype;
  v_full_name text := left(btrim(coalesce(p_payload->>'full_name','')), 120);
  v_company text := nullif(left(btrim(coalesce(p_payload->>'company_name','')), 160), '');
  v_type text := lower(btrim(coalesce(p_payload->>'provider_type','')));
  v_email text := nullif(lower(btrim(coalesce(p_payload->>'email',''))), '');
  v_phone_digits text := regexp_replace(coalesce(p_payload->>'phone',''), '\D', '', 'g');
  v_phone text;
  v_city text := left(btrim(coalesce(p_payload->>'city','')), 100);
  v_state text := upper(btrim(coalesce(p_payload->>'state_code','')));
  v_zip text := btrim(coalesce(p_payload->>'zip_code',''));
  v_subs text[];
  v_zones uuid[];
  v_radius integer := nullif(p_payload->>'service_radius_miles','')::integer;
  v_years integer := nullif(p_payload->>'years_experience','')::integer;
  v_equipment text := nullif(left(btrim(coalesce(p_payload->>'equipment_notes','')), 1000), '');
  v_availability text[];
  v_terms_version text := left(btrim(coalesce(p_payload->>'terms_version','')), 40);
  v_privacy_version text := left(btrim(coalesce(p_payload->>'privacy_version','')), 40);
  v_email_opt boolean := coalesce((p_payload->>'email_opt_in')::boolean, false);
  v_sms_opt boolean := coalesce((p_payload->>'sms_opt_in')::boolean, false);
  v_is_test boolean;
  v_company_key text;
  v_cand public.sos_recruiting_candidates%rowtype;
  v_match text := 'new';
  v_receipt_id uuid := gen_random_uuid();
  v_receipt_number text;
  v_first text; v_last text;
  v_count integer;
  v_now timestamptz := now();
  v_sub_names jsonb; v_zone_names jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  begin
    v_idem := (p_payload->>'idempotency_key')::uuid;
  exception when others then v_idem := null;
  end;
  if v_idem is null then raise exception 'VALIDATION:idempotency_key' using errcode = '22023'; end if;

  -- Idempotent replay: return the original receipt, write nothing.
  select * into v_existing from public.sos_provider_interest_receipts where idempotency_key = v_idem;
  if found then
    select coalesce(jsonb_agg(s.name order by s.sort_order), '[]') into v_sub_names from public.sos_subcategories s where s.id = any(v_existing.subcategory_ids);
    select coalesce(jsonb_agg(z.zone_name order by z.zone_name), '[]') into v_zone_names from public.sos_service_zones z where z.id = any(v_existing.zone_ids);
    return jsonb_build_object('ok', true, 'replayed', true, 'receipt_number', v_existing.receipt_number,
      'received_at', v_existing.created_at, 'services', v_sub_names, 'zones', v_zone_names,
      'provider_type', v_existing.provider_type, 'email_opt_in', v_existing.email_opt_in, 'sms_opt_in', v_existing.sms_opt_in);
  end if;

  -- Throttle per network (hashed IP), 10 new submissions / hour.
  if p_ip_hash is null or length(p_ip_hash) < 32 then raise exception 'VALIDATION:source' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sos_provider_interest:' || p_ip_hash, 0));
  delete from public.sos_provider_interest_rate_limits where created_at < v_now - interval '24 hours';
  select count(*) into v_count from public.sos_provider_interest_rate_limits where ip_hash = p_ip_hash and created_at >= v_now - interval '60 minutes';
  if v_count >= 10 then raise exception 'RATE_LIMITED' using errcode = '54000'; end if;
  insert into public.sos_provider_interest_rate_limits(ip_hash) values (p_ip_hash);

  -- Validation.
  if char_length(v_full_name) < 2 or v_full_name !~ '[[:alpha:]]' then raise exception 'VALIDATION:full_name' using errcode = '22023'; end if;
  if v_type not in ('individual','company','fleet') then raise exception 'VALIDATION:provider_type' using errcode = '22023'; end if;
  if v_type in ('company','fleet') and v_company is null then raise exception 'VALIDATION:company_name' using errcode = '22023'; end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$') then raise exception 'VALIDATION:email' using errcode = '22023'; end if;
  if v_phone_digits <> '' then
    if char_length(v_phone_digits) = 10 then v_phone_digits := '1' || v_phone_digits; end if;
    if char_length(v_phone_digits) <> 11 or left(v_phone_digits, 1) <> '1' then raise exception 'VALIDATION:phone' using errcode = '22023'; end if;
    v_phone := '+' || v_phone_digits;
  end if;
  if v_email is null and v_phone is null then raise exception 'VALIDATION:contact' using errcode = '22023'; end if;
  if char_length(v_city) < 2 then raise exception 'VALIDATION:city' using errcode = '22023'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'VALIDATION:state_code' using errcode = '22023'; end if;
  if v_zip !~ '^[0-9]{5}$' then raise exception 'VALIDATION:zip_code' using errcode = '22023'; end if;
  if coalesce((p_payload->>'terms_accepted')::boolean, false) is not true then raise exception 'VALIDATION:terms_accepted' using errcode = '22023'; end if;
  if char_length(v_terms_version) < 4 or char_length(v_privacy_version) < 4 then raise exception 'VALIDATION:consent_version' using errcode = '22023'; end if;
  if v_sms_opt and v_phone is null then raise exception 'VALIDATION:sms_opt_in' using errcode = '22023'; end if;
  if v_email_opt and v_email is null then raise exception 'VALIDATION:email_opt_in' using errcode = '22023'; end if;
  if v_radius is not null and (v_radius < 1 or v_radius > 150) then raise exception 'VALIDATION:service_radius_miles' using errcode = '22023'; end if;
  if v_years is not null and (v_years < 0 or v_years > 80) then raise exception 'VALIDATION:years_experience' using errcode = '22023'; end if;

  select coalesce(array_agg(distinct x), '{}') into v_subs
    from jsonb_array_elements_text(case when jsonb_typeof(p_payload->'subcategory_ids') = 'array' then p_payload->'subcategory_ids' else '[]'::jsonb end) x;
  if cardinality(v_subs) < 1 or cardinality(v_subs) > 40
     or (select count(*) from public.sos_subcategories s where s.id = any(v_subs) and s.is_active) <> cardinality(v_subs) then
    raise exception 'VALIDATION:subcategory_ids' using errcode = '22023';
  end if;
  begin
    select coalesce(array_agg(distinct x::uuid), '{}') into v_zones
      from jsonb_array_elements_text(case when jsonb_typeof(p_payload->'zone_ids') = 'array' then p_payload->'zone_ids' else '[]'::jsonb end) x;
  exception when others then raise exception 'VALIDATION:zone_ids' using errcode = '22023';
  end;
  if cardinality(v_zones) < 1 or cardinality(v_zones) > 10
     or (select count(*) from public.sos_service_zones z where z.id = any(v_zones) and z.is_active) <> cardinality(v_zones) then
    raise exception 'VALIDATION:zone_ids' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct a), '{}') into v_availability
    from jsonb_array_elements_text(case when jsonb_typeof(p_payload->'availability') = 'array' then p_payload->'availability' else '[]'::jsonb end) a
    where a in ('weekdays','weekends','evenings','overnight','on_call');

  v_is_test := coalesce(split_part(v_email, '@', 2), '') in ('example.com','example.org','example.net','sos-qa.test');
  v_company_key := nullif(regexp_replace(lower(coalesce(v_company,'')), '[^a-z0-9]', '', 'g'), '');

  -- Deterministic dedupe against the candidate master (same demo/test partition only).
  perform pg_advisory_xact_lock(hashtextextended('sos_provider_interest_dedupe:' || coalesce(v_email, v_phone), 0));
  if v_email is not null then
    select * into v_cand from public.sos_recruiting_candidates c
      where c.is_demo = v_is_test and lower(btrim(c.email)) = v_email order by c.created_at limit 1 for update;
    if found then v_match := 'email'; end if;
  end if;
  if v_match = 'new' and v_phone is not null then
    select * into v_cand from public.sos_recruiting_candidates c
      where c.is_demo = v_is_test and c.phone is not null
        and (regexp_replace(c.phone, '\D', '', 'g') = v_phone_digits or '1' || regexp_replace(c.phone, '\D', '', 'g') = v_phone_digits)
      order by c.created_at limit 1 for update;
    if found then v_match := 'phone'; end if;
  end if;
  if v_match = 'new' then
    select * into v_cand from public.sos_recruiting_candidates c
      where c.is_demo = v_is_test and c.dedupe_key in ('email:' || coalesce(v_email,'-'), 'phone:' || coalesce(v_phone_digits,'-'))
      order by c.created_at limit 1 for update;
    if found then v_match := 'dedupe_key'; end if;
  end if;
  if v_match = 'new' and v_type in ('company','fleet') and char_length(coalesce(v_company_key,'')) >= 4 then
    select * into v_cand from public.sos_recruiting_candidates c
      where c.is_demo = v_is_test and c.zip_code = v_zip
        and regexp_replace(lower(coalesce(c.company_name,'')), '[^a-z0-9]', '', 'g') = v_company_key
      order by c.created_at limit 1 for update;
    if found then v_match := 'company_zip'; end if;
  end if;

  v_first := split_part(v_full_name, ' ', 1);
  v_last := nullif(btrim(substr(v_full_name, char_length(v_first) + 1)), '');

  if v_match = 'new' then
    insert into public.sos_recruiting_candidates(
      candidate_source, first_name, last_name, email, phone, company_name, city, state_code, zip_code,
      services_enabled, pipeline_stage, outreach_status, is_demo, consent_basis, preferred_channel, dedupe_key, notes)
    values (
      'early_interest_web', v_first, v_last, v_email, v_phone, v_company, v_city, v_state, v_zip,
      v_subs, 'prospect', 'not_queued', v_is_test, 'provider_self_registration_early_interest',
      case when v_email_opt then 'email' when v_sms_opt then 'sms' else null end,
      case when v_email is not null then 'email:' || v_email else 'phone:' || v_phone_digits end,
      'Self-registered early interest via thesuperherosonstandby.com. Not screened, not verified, not an application.')
    returning * into v_cand;
  else
    -- Fill only missing contact/location facts. Never touch stage, outreach, suppression or legacy services.
    update public.sos_recruiting_candidates c set
      first_name = coalesce(c.first_name, v_first),
      last_name = coalesce(c.last_name, v_last),
      email = coalesce(c.email, v_email),
      phone = coalesce(c.phone, v_phone),
      company_name = coalesce(c.company_name, v_company),
      city = coalesce(c.city, v_city),
      state_code = coalesce(c.state_code, v_state),
      zip_code = coalesce(c.zip_code, v_zip),
      updated_at = v_now
    where c.id = v_cand.id
    returning * into v_cand;
  end if;

  v_receipt_number := 'SOS-PI-' || to_char(v_now at time zone 'America/New_York', 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sos_provider_interest_receipts(
    id, receipt_number, idempotency_key, candidate_id, matched_existing, match_basis, full_name, company_name, provider_type,
    email_normalized, phone_normalized, city, state_code, zip_code, subcategory_ids, zone_ids, service_radius_miles,
    years_experience, equipment_notes, availability, terms_version, privacy_version, terms_accepted_at,
    email_opt_in, sms_opt_in, consent_snapshot, source, attribution, ip_hash, user_agent, suppressed_contact, is_test)
  values (
    v_receipt_id, v_receipt_number, v_idem, v_cand.id, v_match <> 'new', v_match, v_full_name, v_company, v_type,
    v_email, v_phone, v_city, v_state, v_zip, v_subs, v_zones, v_radius,
    v_years, v_equipment, v_availability, v_terms_version, v_privacy_version, v_now,
    v_email_opt, v_sms_opt,
    jsonb_build_object('terms_accepted', true, 'terms_version', v_terms_version, 'privacy_version', v_privacy_version,
      'email_opt_in', v_email_opt, 'sms_opt_in', v_sms_opt,
      'email_opt_in_text', nullif(left(coalesce(p_payload->>'email_opt_in_text',''), 600), ''),
      'sms_opt_in_text', nullif(left(coalesce(p_payload->>'sms_opt_in_text',''), 600), ''),
      'captured_at', v_now),
    'web_early_interest',
    coalesce((select jsonb_object_agg(k, left(v, 120)) from jsonb_each_text(case when jsonb_typeof(p_payload->'attribution') = 'object' then p_payload->'attribution' else '{}'::jsonb end) e(k, v)
              where k in ('utm_source','utm_medium','utm_campaign','utm_content','referrer_domain','entry_cta','platform')), '{}'::jsonb),
    p_ip_hash, nullif(left(coalesce(p_user_agent,''), 300), ''), v_cand.do_not_contact, v_is_test);

  insert into public.sos_candidate_service_interests(candidate_id, subcategory_id, source, verification_status, first_receipt_id)
  select v_cand.id, s, 'self_reported', 'self_reported', v_receipt_id from unnest(v_subs) s
  on conflict (candidate_id, subcategory_id) do update set updated_at = v_now;

  insert into public.sos_recruiting_candidate_zone_coverage(candidate_id, zone_id, coverage_type, coverage_status, confidence, source_system, evidence)
  select v_cand.id, z, 'service_area', 'source_claimed', 0.25, 'provider_self_reported_early_interest',
         jsonb_build_object('self_reported', true, 'verified', false, 'receipt_number', v_receipt_number)
  from unnest(v_zones) z
  on conflict (candidate_id, zone_id) do nothing;

  insert into public.sos_provider_early_interest as e(
    candidate_id, provider_type, is_test, latest_receipt_id, email_opt_in, email_opt_in_at, sms_opt_in, sms_opt_in_at,
    terms_version, privacy_version)
  values (v_cand.id, v_type, v_is_test, v_receipt_id, v_email_opt, case when v_email_opt then v_now end,
    v_sms_opt, case when v_sms_opt then v_now end, v_terms_version, v_privacy_version)
  on conflict (candidate_id) do update set
    provider_type = excluded.provider_type,
    last_registered_at = v_now,
    submission_count = e.submission_count + 1,
    latest_receipt_id = excluded.latest_receipt_id,
    email_opt_in = excluded.email_opt_in,
    email_opt_in_at = case when excluded.email_opt_in then coalesce(e.email_opt_in_at, v_now) else null end,
    sms_opt_in = excluded.sms_opt_in,
    sms_opt_in_at = case when excluded.sms_opt_in then coalesce(e.sms_opt_in_at, v_now) else null end,
    terms_version = excluded.terms_version,
    privacy_version = excluded.privacy_version,
    updated_at = v_now;

  insert into public.sos_provider_early_interest_events(candidate_id, event_type, actor, to_status, detail)
  values (v_cand.id, 'early_interest_registered', 'public_web_intake', 'interested',
          jsonb_build_object('receipt_number', v_receipt_number, 'match_basis', v_match, 'services', cardinality(v_subs), 'zones', cardinality(v_zones), 'is_test', v_is_test));

  select coalesce(jsonb_agg(s.name order by s.sort_order), '[]') into v_sub_names from public.sos_subcategories s where s.id = any(v_subs);
  select coalesce(jsonb_agg(z.zone_name order by z.zone_name), '[]') into v_zone_names from public.sos_service_zones z where z.id = any(v_zones);

  -- Identical response shape for new and matched records: never reveal whether a contact already exists.
  return jsonb_build_object('ok', true, 'replayed', false, 'receipt_number', v_receipt_number, 'received_at', v_now,
    'services', v_sub_names, 'zones', v_zone_names, 'provider_type', v_type, 'email_opt_in', v_email_opt, 'sms_opt_in', v_sms_opt);
end;
$$;
revoke all on function public.sos_register_provider_interest(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.sos_register_provider_interest(jsonb, text, text) to service_role;
