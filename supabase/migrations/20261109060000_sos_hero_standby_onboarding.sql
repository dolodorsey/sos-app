-- S.O.S. provider side, phase 1 + phase 2 (Nov 2026)
--
-- Phase 1  "Standby Hero": a provider fills out a simple profile (who they are,
--          services, zone, availability, vehicle) and secures an account. The
--          moment the account is secured they are an ACTIVE standby Hero:
--          sos_users(role=hero) + sos_heroes(verification_status=pending) exist,
--          they can sign in to the Hero side, and operations sees them on the
--          launch roster. They are NOT dispatchable: dispatch, presence and
--          on-duty gates still require full verification (unchanged).
--
-- Phase 2  "Full onboarding packet": goes out automatically N days (default 14)
--          before the market's customer go-live date
--          (sos_market_rollouts.target_launch_date). The packet collects the
--          documents and signed consents S.O.S. needs to hold providers legally
--          accountable: driver license, insurance, vehicle registration, headshot,
--          background-check disclosure + authorization, independent contractor
--          agreement. A completed packet moves the application to review; ops
--          records the background-check result and approves, which feeds the
--          existing conditional-approval → verification → test mission → payout
--          pipeline.

-- 1. Application: new statuses + standby profile fields ------------------------
alter table public.sos_hero_applications drop constraint if exists sos_hero_applications_status_check_v2;
alter table public.sos_hero_applications drop constraint if exists sos_hero_applications_status_check_v3;
alter table public.sos_hero_applications add constraint sos_hero_applications_status_check_v3 check (status = any (array[
  'standby_pending','standby',
  'documents_required','waitlisted','reviewing','needs_information','conditionally_approved','approved','rejected','withdrawn'
]));

alter table public.sos_hero_applications
  add column if not exists market_key text not null default 'atlanta-ga-2026',
  add column if not exists service_zone text,
  add column if not exists availability text[] not null default '{}',
  add column if not exists standby_at timestamptz;

alter table public.sos_hero_applications drop constraint if exists sos_hero_applications_service_zone_check;
alter table public.sos_hero_applications add constraint sos_hero_applications_service_zone_check
  check (service_zone is null or service_zone = any (array['east','south','west','downtown','midtown','buckhead']));

alter table public.sos_hero_applications drop constraint if exists sos_hero_applications_availability_check;
alter table public.sos_hero_applications add constraint sos_hero_applications_availability_check
  check (availability <@ array['weekday_days','weekday_evenings','overnight','weekends']::text[]);

create index if not exists sos_hero_applications_market_status_idx on public.sos_hero_applications(market_key, status);

-- Headshot joins the credential vault (customers see who is coming).
alter table public.sos_hero_application_documents drop constraint if exists sos_hero_application_documents_document_type_check;
alter table public.sos_hero_application_documents add constraint sos_hero_application_documents_document_type_check
  check (document_type = any (array['government_id','drivers_license','insurance','vehicle_registration','business_license','certification','vehicle_photo','equipment_photo','headshot','other']));

-- 2. Market go-live + packet lead time ---------------------------------------
alter table public.sos_market_rollouts
  add column if not exists packet_lead_days integer not null default 14;
alter table public.sos_market_rollouts drop constraint if exists sos_market_rollouts_packet_lead_days_check;
alter table public.sos_market_rollouts add constraint sos_market_rollouts_packet_lead_days_check check (packet_lead_days between 1 and 60);
comment on column public.sos_market_rollouts.target_launch_date is 'Customer go-live date for the market. The full Hero onboarding packet goes out packet_lead_days before it.';

-- 3. Legal documents providers sign -------------------------------------------
create table if not exists public.sos_hero_consent_documents (
  id uuid primary key default gen_random_uuid(),
  consent_type text not null check (consent_type in ('background_check_disclosure','background_check_authorization','independent_contractor_agreement')),
  version text not null check (char_length(version) between 1 and 40),
  title text not null check (char_length(title) between 3 and 200),
  body text not null check (char_length(body) between 20 and 60000),
  approved_for_use boolean not null default false,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz not null default now(),
  unique (consent_type, version)
);
alter table public.sos_hero_consent_documents enable row level security;
comment on table public.sos_hero_consent_documents is 'Versioned legal text providers sign in the onboarding packet. Packets do not send until every required type has an attorney-approved version (approved_for_use).';

insert into public.sos_hero_consent_documents (consent_type, version, title, body, approved_for_use)
values
 ('background_check_disclosure','draft-2026-11','Background Check Disclosure',
  'DRAFT — replace with attorney-approved text before use. S.O.S. (Superheros On Standby) may obtain a consumer report and/or investigative consumer report about you from a consumer reporting agency for purposes of evaluating you for work as an independent service provider. The report may include criminal history, motor vehicle records, identity verification and sex offender registry searches.', false),
 ('background_check_authorization','draft-2026-11','Background Check Authorization',
  'DRAFT — replace with attorney-approved text before use. I authorize S.O.S. and its consumer reporting agency to obtain the reports described in the Background Check Disclosure, now and, where allowed by law, throughout my time as an S.O.S. service provider.', false),
 ('independent_contractor_agreement','draft-2026-11','S.O.S. Hero Independent Contractor Agreement',
  'DRAFT — replace with attorney-approved text before use. I am an independent contractor, not an employee. I am responsible for my licenses, insurance, vehicle, equipment and taxes. I will perform services safely, lawfully and professionally, follow S.O.S. service standards, and I am accountable for the work I accept through the S.O.S. platform.', false)
on conflict (consent_type, version) do nothing;

-- 4. Signed consents — append-only legal record --------------------------------
create table if not exists public.sos_hero_consents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.sos_hero_applications(id) on delete restrict,
  auth_id uuid not null,
  consent_type text not null,
  document_version text not null,
  signed_name text not null check (char_length(signed_name) between 3 and 160),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  signed_at timestamptz not null default now(),
  unique (application_id, consent_type, document_version),
  foreign key (consent_type, document_version) references public.sos_hero_consent_documents(consent_type, version)
);
alter table public.sos_hero_consents enable row level security;

create or replace function private.sos_block_consent_mutation()
returns trigger language plpgsql set search_path to 'pg_catalog' as $$
begin
  raise exception 'Signed consents are a permanent legal record and cannot be changed or deleted';
end $$;
drop trigger if exists sos_hero_consents_append_only on public.sos_hero_consents;
create trigger sos_hero_consents_append_only before update or delete on public.sos_hero_consents
  for each row execute function private.sos_block_consent_mutation();

-- 5. Onboarding packets --------------------------------------------------------
create table if not exists public.sos_hero_onboarding_packets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.sos_hero_applications(id) on delete cascade,
  market_key text not null,
  status text not null default 'sent' check (status in ('sent','in_progress','submitted','needs_changes','approved')),
  go_live_date date,
  due_date date,
  send_reason text not null check (send_reason in ('automatic_lead_window','operator_early_send','joined_after_window')),
  sent_by uuid,
  sent_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  operator_note text check (operator_note is null or char_length(operator_note) <= 3000),
  background_check_status text not null default 'not_started'
    check (background_check_status in ('not_started','authorized','in_progress','clear','consider','not_cleared')),
  background_check_reference text check (background_check_reference is null or char_length(background_check_reference) <= 200),
  background_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sos_hero_onboarding_packets enable row level security;
create index if not exists sos_hero_onboarding_packets_status_idx on public.sos_hero_onboarding_packets(market_key, status);

-- 6. Helpers -------------------------------------------------------------------
-- Applications store service names; dispatch matches subcategory ids.
create or replace function private.sos_service_ids(p_services text[])
returns text[] language sql stable security definer set search_path to 'pg_catalog','public' as $$
  select coalesce(array_agg(distinct s.id order by s.id), '{}'::text[])
  from public.sos_subcategories s
  where s.id = any(coalesce(p_services,'{}'))
     or lower(s.name) = any(select lower(x) from unnest(coalesce(p_services,'{}')) x);
$$;

create or replace function private.sos_zone_label(p_zone text)
returns text language sql immutable set search_path to 'pg_catalog' as $$
  select case p_zone when 'east' then 'East Atlanta' when 'south' then 'South Atlanta' when 'west' then 'West Atlanta'
    when 'downtown' then 'Downtown Atlanta' when 'midtown' then 'Midtown Atlanta' when 'buckhead' then 'Buckhead' else null end;
$$;

create or replace function private.sos_current_consent_document(p_type text)
returns public.sos_hero_consent_documents language sql stable security definer set search_path to 'pg_catalog','public' as $$
  select d.* from public.sos_hero_consent_documents d
  where d.consent_type = p_type and d.approved_for_use
  order by d.published_at desc nulls last, d.created_at desc limit 1;
$$;

create or replace function private.sos_consent_documents_ready()
returns boolean language sql stable security definer set search_path to 'pg_catalog','public','private' as $$
  select not exists (
    select 1 from unnest(array['background_check_disclosure','background_check_authorization','independent_contractor_agreement']) t(type)
    where (private.sos_current_consent_document(t.type)).id is null
  );
$$;

create or replace function private.sos_packet_window_open(p_market_key text)
returns boolean language sql stable security definer set search_path to 'pg_catalog','public' as $$
  select exists (
    select 1 from public.sos_market_rollouts m
    where m.market_key = p_market_key and m.target_launch_date is not null
      and current_date >= m.target_launch_date - m.packet_lead_days
  );
$$;

-- Packet checklist: 4 documents + 3 signatures.
create or replace function private.sos_packet_items(p_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public','private' as $$
declare v_items jsonb := '[]'::jsonb; d record; c record; v_doc_status text; v_current public.sos_hero_consent_documents;
begin
  for d in select * from (values
      ('drivers_license','Driver license (front and back)'),
      ('insurance','Proof of auto / commercial insurance'),
      ('vehicle_registration','Vehicle registration'),
      ('headshot','Clear headshot photo (shown to customers)')) as x(type,label)
  loop
    select case
             when bool_or(status='accepted') then 'accepted'
             when bool_or(status='submitted') then 'submitted'
             when bool_or(status='rejected') then 'rejected'
             else 'missing' end
      into v_doc_status
    from public.sos_hero_application_documents where application_id = p_application_id and document_type = d.type;
    v_items := v_items || jsonb_build_object('key',d.type,'kind','document','label',d.label,
      'status',coalesce(v_doc_status,'missing'),'done',coalesce(v_doc_status,'missing') in ('submitted','accepted'));
  end loop;
  for c in select * from (values
      ('background_check_disclosure','Acknowledge the background check disclosure'),
      ('background_check_authorization','Authorize the background check'),
      ('independent_contractor_agreement','Sign the S.O.S. Hero independent contractor agreement')) as x(type,label)
  loop
    v_current := private.sos_current_consent_document(c.type);
    v_items := v_items || jsonb_build_object('key',c.type,'kind','consent','label',c.label,
      'version',v_current.version,
      'done', v_current.id is not null and exists(select 1 from public.sos_hero_consents s
                where s.application_id = p_application_id and s.consent_type = c.type and s.document_version = v_current.version),
      'status', case when v_current.id is null then 'unavailable'
                     when exists(select 1 from public.sos_hero_consents s where s.application_id = p_application_id
                                 and s.consent_type = c.type and s.document_version = v_current.version) then 'signed'
                     else 'missing' end);
  end loop;
  return v_items;
end $$;

-- Recompute packet + application status after any upload or signature.
create or replace function private.sos_refresh_packet(p_application_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare p public.sos_hero_onboarding_packets; v_items jsonb; v_done int; v_total int;
begin
  select * into p from public.sos_hero_onboarding_packets where application_id = p_application_id for update;
  if not found then return null; end if;
  v_items := private.sos_packet_items(p_application_id);
  select count(*) filter (where (i->>'done')::boolean), count(*) into v_done, v_total from jsonb_array_elements(v_items) i;
  if p.status in ('sent','in_progress','needs_changes') then
    if v_done = v_total then
      update public.sos_hero_onboarding_packets
         set status='submitted', submitted_at=now(),
             background_check_status = case when background_check_status='not_started' then 'authorized' else background_check_status end,
             updated_at=now()
       where id = p.id;
      update public.sos_hero_applications set status='reviewing', updated_at=now()
       where id = p_application_id and status in ('standby','needs_information');
    elsif v_done > 0 and p.status = 'sent' then
      update public.sos_hero_onboarding_packets set status='in_progress', updated_at=now() where id = p.id;
    end if;
  end if;
  return jsonb_build_object('packet_id',p.id,'done',v_done,'total',v_total);
end $$;

-- Issue one packet (idempotent).
create or replace function private.sos_issue_onboarding_packet(p_application_id uuid, p_reason text, p_operator uuid default null)
returns uuid language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare a public.sos_hero_applications; m public.sos_market_rollouts; v_id uuid;
begin
  select * into a from public.sos_hero_applications where id = p_application_id;
  if not found or a.status <> 'standby' then return null; end if;
  select * into m from public.sos_market_rollouts where market_key = a.market_key;
  insert into public.sos_hero_onboarding_packets(application_id, market_key, go_live_date, due_date, send_reason, sent_by)
  values (a.id, a.market_key, m.target_launch_date, case when m.target_launch_date is not null then m.target_launch_date - 3 end, p_reason, p_operator)
  on conflict (application_id) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;
  insert into public.sos_hero_application_notifications(application_id, auth_id, status, title, body)
  values (a.id, a.source_auth_id, 'packet_sent', 'Your full S.O.S. onboarding packet is ready',
          'Upload your driver license, insurance, vehicle registration and headshot, then sign the background check and contractor documents'
          || case when m.target_launch_date is not null then ' before ' || to_char(m.target_launch_date - 3, 'Mon DD') else '' end
          || '. Only Heroes with a cleared packet receive jobs at launch.');
  if a.source_user_id is not null then
    insert into public.sos_crm_outbox(user_id, event_type, payload)
    values (a.source_user_id, 'hero.onboarding_packet_sent',
            jsonb_build_object('app','sos','application_id',a.id,'packet_id',v_id,'market_key',a.market_key,'go_live_date',m.target_launch_date));
  end if;
  return v_id;
end $$;

-- Daily job + manual send. p_force skips the date window (operator early send).
create or replace function private.sos_send_onboarding_packets(p_market_key text default null, p_force boolean default false, p_operator uuid default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare m record; a record; v_sent int := 0; v_markets jsonb := '[]'::jsonb; v_market_sent int;
begin
  for m in select * from public.sos_market_rollouts where p_market_key is null or market_key = p_market_key loop
    if not p_force and not private.sos_packet_window_open(m.market_key) then
      v_markets := v_markets || jsonb_build_object('market_key',m.market_key,'result',
        case when m.target_launch_date is null then 'go_live_date_not_set' else 'window_not_open' end,
        'packet_send_date', m.target_launch_date - m.packet_lead_days);
      continue;
    end if;
    if not private.sos_consent_documents_ready() then
      v_markets := v_markets || jsonb_build_object('market_key',m.market_key,'result','blocked_legal_documents_not_approved');
      continue;
    end if;
    v_market_sent := 0;
    for a in select id from public.sos_hero_applications
             where market_key = m.market_key and status = 'standby'
               and not exists (select 1 from public.sos_hero_onboarding_packets p where p.application_id = sos_hero_applications.id)
    loop
      if private.sos_issue_onboarding_packet(a.id, case when p_force then 'operator_early_send' else 'automatic_lead_window' end, p_operator) is not null then
        v_market_sent := v_market_sent + 1;
      end if;
    end loop;
    v_sent := v_sent + v_market_sent;
    v_markets := v_markets || jsonb_build_object('market_key',m.market_key,'result','sent','packets_sent',v_market_sent);
  end loop;
  return jsonb_build_object('packets_sent',v_sent,'markets',v_markets,'ran_at',now());
end $$;

-- 7. Activate a standby Hero ---------------------------------------------------
create or replace function private.sos_activate_standby_hero(p_application_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare a public.sos_hero_applications; u public.sos_users; h public.sos_heroes; v_services text[]; v_packet uuid;
begin
  select * into a from public.sos_hero_applications where id = p_application_id for update;
  if not found then raise exception 'Hero application not found' using errcode='P0002'; end if;
  if a.status not in ('standby_pending','standby') then
    return jsonb_build_object('activated',false,'status',a.status);
  end if;
  if a.source_auth_id is null then raise exception 'Secure the application with an account first' using errcode='42501'; end if;

  v_services := private.sos_service_ids(a.services_requested);

  select * into u from public.sos_users where auth_id = a.source_auth_id limit 1 for update;
  if not found then
    insert into public.sos_users(auth_id, role, first_name, last_name, phone, email, status, city, state, is_demo, referral_code)
    values (a.source_auth_id, 'hero', a.first_name, a.last_name, a.phone, lower(a.email), 'active', a.city, a.state, false,
            lower(substring(md5(a.id::text) from 1 for 8)))
    returning * into u;
  else
    if u.status in ('suspended','deactivated') then
      raise exception 'This S.O.S. account is not active. Contact S.O.S. operations.' using errcode='42501';
    end if;
    update public.sos_users
       set role = case when role = 'admin' then role else 'hero' end,
           first_name = a.first_name, last_name = a.last_name, phone = a.phone, email = lower(a.email),
           status = 'active', city = coalesce(a.city, city), state = coalesce(a.state, state), is_demo = false, updated_at = now()
     where id = u.id returning * into u;
  end if;

  select * into h from public.sos_heroes where user_id = u.id limit 1 for update;
  if not found then
    insert into public.sos_heroes(user_id, zone, services_enabled, tools_available, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
                                  license_verified, insurance_verified, background_cleared, id_verified, test_mission_passed,
                                  verification_status, on_duty, is_demo, payout_method)
    values (u.id, private.sos_zone_label(a.service_zone), v_services, a.tools_available, a.vehicle_type, a.vehicle_make, a.vehicle_model, a.vehicle_year,
            false, false, false, false, false, 'pending', false, false, null)
    returning * into h;
  elsif h.verification_status <> 'verified' then
    update public.sos_heroes
       set zone = coalesce(private.sos_zone_label(a.service_zone), zone), services_enabled = v_services,
           tools_available = a.tools_available, vehicle_type = a.vehicle_type, vehicle_make = a.vehicle_make,
           vehicle_model = a.vehicle_model, vehicle_year = a.vehicle_year, updated_at = now()
     where id = h.id returning * into h;
  end if;

  update public.sos_hero_applications
     set status = 'standby', standby_at = coalesce(standby_at, now()), source_user_id = u.id, source_hero_id = h.id, updated_at = now()
   where id = a.id;

  if a.status = 'standby_pending' then
    insert into public.sos_crm_outbox(user_id, event_type, payload)
    values (u.id, 'hero.standby_activated', jsonb_build_object('app','sos','application_id',a.id,'zone',a.service_zone,'services',v_services));
  end if;

  -- Joined after the packet window opened: they get the packet right away.
  if private.sos_packet_window_open(a.market_key) and private.sos_consent_documents_ready() then
    v_packet := private.sos_issue_onboarding_packet(a.id, 'joined_after_window', null);
  end if;

  return jsonb_build_object('activated',true,'status','standby','hero_id',h.id,'user_id',u.id,'dispatch_eligible',false,'packet_id',v_packet);
end $$;

-- Status copy for the in-app timeline.
create or replace function private.sos_hero_application_notification_copy(p_status text)
returns jsonb language plpgsql immutable set search_path to 'pg_catalog','private' as $function$
begin
  return case p_status
    when 'standby' then jsonb_build_object('title','You are an active S.O.S. standby Hero','body','You are on the Atlanta launch roster. Your full onboarding packet (license, insurance, background check, agreements) arrives 14 days before customers go live.')
    when 'waitlisted' then jsonb_build_object('title','You are on the S.O.S. Hero waitlist','body','Your required credentials are in. Operations will review your application next.')
    when 'reviewing' then jsonb_build_object('title','Your Hero application is under review','body','S.O.S. Operations is reviewing your onboarding packet and background check.')
    when 'needs_information' then jsonb_build_object('title','Your Hero application needs information','body','Open your application to see what Operations needs before review can continue.')
    when 'conditionally_approved' then jsonb_build_object('title','You are conditionally approved','body','You cleared application review. Complete final verification, test-mission, and payout gates before patrol.')
    when 'rejected' then jsonb_build_object('title','Hero application review closed','body','Your current S.O.S. Hero application was not approved. Review the operator note for details.')
    else jsonb_build_object('title','Hero application updated','body','Your S.O.S. Hero application status changed to '||replace(p_status,'_',' ')||'.')
  end;
end $function$;

-- 8. Applicant RPCs ------------------------------------------------------------
-- Binding the account IS the activation step (auto-activate).
create or replace function public.sos_hero_bind_application(p_application_id uuid, p_tracking_token text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private','extensions' as $$
declare a public.sos_hero_applications%rowtype; token_hash text; jwt_email text; v_activation jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  token_hash := encode(extensions.digest(coalesce(p_tracking_token,''),'sha256'),'hex');
  select * into a from public.sos_hero_applications where id=p_application_id for update;
  if not found or a.status_token_hash is distinct from token_hash then raise exception 'Application receipt not recognized' using errcode='42501'; end if;
  jwt_email := lower(coalesce(auth.jwt()->>'email',''));
  if jwt_email='' or jwt_email<>lower(a.email) then raise exception 'Sign in with the same email used on the application' using errcode='42501'; end if;
  if a.source_auth_id is not null and a.source_auth_id<>auth.uid() then raise exception 'Application is already bound to another account' using errcode='42501'; end if;
  update public.sos_hero_applications set source_auth_id=auth.uid(), updated_at=now() where id=a.id;
  if a.status in ('standby_pending','standby') then
    v_activation := private.sos_activate_standby_hero(a.id);
  end if;
  return jsonb_build_object('application_id',a.id,'bound',true,
    'status',coalesce(v_activation->>'status',a.status),'activation',v_activation);
end $$;

create or replace function public.sos_hero_resume_application()
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare
  uid uuid := auth.uid();
  em text := lower(coalesce(auth.jwt()->>'email',''));
  a public.sos_hero_applications%rowtype;
  active_statuses text[] := array['standby_pending','standby','documents_required','waitlisted','reviewing','needs_information','conditionally_approved','approved'];
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if em='' then raise exception 'Verified account email required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications where lower(email)=em and status=any(active_statuses)
   order by submitted_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('found',false,'message','No active Hero application was found for this verified email.');
  end if;
  if a.source_auth_id is not null and a.source_auth_id<>uid then
    raise exception 'This application is already secured by another account' using errcode='42501';
  end if;
  if a.source_auth_id is null then
    update public.sos_hero_applications set source_auth_id=uid, updated_at=now() where id=a.id;
  end if;
  if a.status='standby_pending' then
    perform private.sos_activate_standby_hero(a.id);
    select * into a from public.sos_hero_applications where id=a.id;
  end if;
  return jsonb_build_object(
    'found',true,'application_id',a.id,'email',a.email,'status',a.status,'submitted_at',a.submitted_at,'bound',true,
    'next_action', case
      when a.status='standby' then 'You are an active standby Hero. Your full onboarding packet arrives 14 days before launch.'
      when a.status='documents_required' then 'Upload the three required credentials.'
      when a.status='needs_information' then 'Review the application update and provide the requested information.'
      when a.status='waitlisted' then 'Your required credentials are received. S.O.S. operations review is next.'
      when a.status='reviewing' then 'S.O.S. operations is reviewing your application.'
      when a.status='conditionally_approved' then 'Complete final Hero onboarding before activation.'
      when a.status='approved' then 'Continue to Hero activation.'
      else 'Continue your Hero onboarding.' end);
end $$;

create or replace function public.sos_hero_update_standby_profile(p_application_id uuid, p_service_zone text, p_availability text[], p_services text[] default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare a public.sos_hero_applications; v_services text[];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications where id=p_application_id and source_auth_id=auth.uid() for update;
  if not found then raise exception 'Bound Hero application required' using errcode='42501'; end if;
  if a.status in ('rejected','withdrawn') then raise exception 'This application is closed'; end if;
  if p_service_zone is null or p_service_zone not in ('east','south','west','downtown','midtown','buckhead') then raise exception 'Choose your main Atlanta zone'; end if;
  if coalesce(array_length(p_availability,1),0)=0 then raise exception 'Choose when you are usually available'; end if;
  if p_services is not null then
    v_services := private.sos_service_ids(p_services);
    if coalesce(array_length(v_services,1),0)=0 then raise exception 'Choose at least one service'; end if;
  end if;
  update public.sos_hero_applications
     set service_zone=p_service_zone, availability=p_availability,
         services_requested=coalesce((select array_agg(s.name order by s.sort_order) from public.sos_subcategories s where s.id=any(v_services)), services_requested),
         updated_at=now()
   where id=a.id;
  if a.source_hero_id is not null then
    update public.sos_heroes set zone=private.sos_zone_label(p_service_zone),
           services_enabled=coalesce(v_services, services_enabled), updated_at=now()
     where id=a.source_hero_id and verification_status<>'verified';
  end if;
  return jsonb_build_object('application_id',a.id,'service_zone',p_service_zone,'availability',p_availability);
end $$;

create or replace function public.sos_hero_submit_application_document(p_application_id uuid, p_document_type text, p_path text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private','storage' as $$
declare a public.sos_hero_applications%rowtype; required_count int; final_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications where id=p_application_id and source_auth_id=auth.uid() for update;
  if not found then raise exception 'Bound Hero application required' using errcode='42501'; end if;
  if p_document_type not in ('government_id','drivers_license','insurance','vehicle_registration','business_license','certification','vehicle_photo','equipment_photo','headshot','other') then raise exception 'Unsupported document type'; end if;
  if p_path is null or p_path not like 'applications/'||auth.uid()::text||'/'||a.id::text||'/'||p_document_type||'/%' or position('..' in p_path)>0 then raise exception 'Invalid application document path'; end if;
  if not exists(select 1 from storage.objects where bucket_id='marketplace-verification' and name=p_path) then raise exception 'Uploaded credential file not found'; end if;
  insert into public.sos_hero_application_documents(application_id,auth_id,document_type,storage_path) values(a.id,auth.uid(),p_document_type,p_path) on conflict(storage_path) do nothing;
  -- Legacy credential-first applications keep their original flow.
  if a.status in ('documents_required','waitlisted') then
    select count(distinct document_type) into required_count from public.sos_hero_application_documents where application_id=a.id and status<>'rejected' and document_type in ('government_id','drivers_license','insurance');
    final_status := case when required_count=3 then 'waitlisted' else 'documents_required' end;
    update public.sos_hero_applications set status=final_status, credentials_complete_at=case when required_count=3 then coalesce(credentials_complete_at,now()) else null end, updated_at=now() where id=a.id;
    return jsonb_build_object('application_id',a.id,'document_type',p_document_type,'required_uploaded',required_count,'required_total',3,'status',final_status);
  end if;
  return jsonb_build_object('application_id',a.id,'document_type',p_document_type,'packet',private.sos_refresh_packet(a.id),
    'status',(select status from public.sos_hero_applications where id=a.id));
end $$;

create or replace function public.sos_hero_sign_consent(p_application_id uuid, p_consent_type text, p_signed_name text, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private' as $$
declare a public.sos_hero_applications; p public.sos_hero_onboarding_packets; d public.sos_hero_consent_documents; v_name text := trim(coalesce(p_signed_name,''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications where id=p_application_id and source_auth_id=auth.uid();
  if not found then raise exception 'Bound Hero application required' using errcode='42501'; end if;
  select * into p from public.sos_hero_onboarding_packets where application_id=a.id;
  if not found then raise exception 'Your onboarding packet has not been sent yet'; end if;
  if p.status in ('submitted','approved') then raise exception 'This packet is already submitted'; end if;
  d := private.sos_current_consent_document(p_consent_type);
  if d.id is null then raise exception 'This document is not available to sign yet'; end if;
  if char_length(v_name) < 3 then raise exception 'Type your full legal name to sign'; end if;
  if position(lower(a.last_name) in lower(v_name)) = 0 then raise exception 'Sign with your full legal name as it appears on your application'; end if;
  insert into public.sos_hero_consents(application_id, auth_id, consent_type, document_version, signed_name, user_agent)
  values (a.id, auth.uid(), d.consent_type, d.version, left(v_name,160), left(nullif(trim(coalesce(p_user_agent,'')),''),500))
  on conflict (application_id, consent_type, document_version) do nothing;
  return jsonb_build_object('application_id',a.id,'consent_type',d.consent_type,'version',d.version,'signed',true,'packet',private.sos_refresh_packet(a.id));
end $$;

create or replace function public.sos_hero_onboarding_status(p_application_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public','private' as $$
declare a public.sos_hero_applications; m public.sos_market_rollouts; p public.sos_hero_onboarding_packets; v_docs jsonb := null; v_services jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications
   where source_auth_id=auth.uid() and (p_application_id is null or id=p_application_id)
   order by case when status in ('rejected','withdrawn') then 1 else 0 end, submitted_at desc limit 1;
  if not found then return jsonb_build_object('found',false); end if;
  select * into m from public.sos_market_rollouts where market_key=a.market_key;
  select * into p from public.sos_hero_onboarding_packets where application_id=a.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.sort_order),'[]'::jsonb) into v_services
    from public.sos_subcategories s where s.id = any(private.sos_service_ids(a.services_requested));
  if p.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('consent_type',d.consent_type,'version',d.version,'title',d.title,'body',d.body)),'[]'::jsonb) into v_docs
      from unnest(array['background_check_disclosure','background_check_authorization','independent_contractor_agreement']) t(type)
      cross join lateral (select * from private.sos_current_consent_document(t.type)) d where d.id is not null;
  end if;
  return jsonb_build_object(
    'found',true,'application_id',a.id,'status',a.status,'first_name',a.first_name,'last_name',a.last_name,
    'service_zone',a.service_zone,'availability',a.availability,'services',v_services,'standby_at',a.standby_at,
    'hero_id',a.source_hero_id,'dispatch_eligible',false,
    'market',jsonb_build_object('key',a.market_key,'city',coalesce(m.city,'Atlanta'),'go_live_date',m.target_launch_date,
      'packet_lead_days',coalesce(m.packet_lead_days,14),
      'packet_opens_on',case when m.target_launch_date is not null then m.target_launch_date - coalesce(m.packet_lead_days,14) end),
    'packet', case when p.id is null then null else jsonb_build_object(
      'id',p.id,'status',p.status,'sent_at',p.sent_at,'due_date',p.due_date,'submitted_at',p.submitted_at,
      'operator_note',p.operator_note,'background_check_status',p.background_check_status,
      'items',private.sos_packet_items(a.id),'documents',v_docs) end);
end $$;

-- 9. Grants --------------------------------------------------------------------
revoke all on function public.sos_hero_update_standby_profile(uuid,text,text[],text[]) from public, anon;
revoke all on function public.sos_hero_sign_consent(uuid,text,text,text) from public, anon;
revoke all on function public.sos_hero_onboarding_status(uuid) from public, anon;
grant execute on function public.sos_hero_update_standby_profile(uuid,text,text[],text[]) to authenticated;
grant execute on function public.sos_hero_sign_consent(uuid,text,text,text) to authenticated;
grant execute on function public.sos_hero_onboarding_status(uuid) to authenticated;
revoke all on function private.sos_activate_standby_hero(uuid) from public, anon, authenticated;
revoke all on function private.sos_send_onboarding_packets(text,boolean,uuid) from public, anon, authenticated;
revoke all on function private.sos_issue_onboarding_packet(uuid,text,uuid) from public, anon, authenticated;
revoke all on function private.sos_refresh_packet(uuid) from public, anon, authenticated;

-- 10. Daily packet job: 8:00 AM Eastern (13:00 UTC) -------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sos-hero-onboarding-packets') then
    perform cron.unschedule('sos-hero-onboarding-packets');
  end if;
  perform cron.schedule('sos-hero-onboarding-packets', '0 13 * * *', 'select private.sos_send_onboarding_packets();');
end $$;
