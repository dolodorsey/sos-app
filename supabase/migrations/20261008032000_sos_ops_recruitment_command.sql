-- S.O.S. recruitment command: operator-only supply matrix + early-interest workbench
-- (GitHub issue #103, Phase 3 / §8). All functions require an active marketplace operator
-- (private.is_marketplace_operator(auth.uid())). Demo fixtures and test signups are
-- excluded from every real count and reported separately.
--
-- Buckets (per real candidate, highest stage wins):
--   prospect   – discovered/legacy record, never self-registered (NOT a provider)
--   interested – self-registered early interest (interested / contact_verified)
--   screening  – early interest in screening/invited_to_apply, or candidate pipeline in
--                screening/training/account_setup/test_mission
--   verified   – real (non-demo) sos_heroes with verification_status = 'verified'
--   on_duty    – verified real Heroes currently on duty

create or replace function public.sos_ops_recruitment_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode = '42501';
  end if;

  with
  zones as (select z.id, z.zone_name from public.sos_service_zones z where z.is_active),
  subs as (select s.id, s.name, s.category_id, s.sort_order from public.sos_subcategories s where s.is_active),
  cls as (
    select c.id as candidate_id,
      case
        when e.candidate_id is not null and e.interest_status in ('not_a_fit','withdrawn') then null
        when e.candidate_id is not null and e.interest_status in ('screening','invited_to_apply') then 'screening'
        when c.pipeline_stage in ('screening','training','account_setup','test_mission') then 'screening'
        when e.candidate_id is not null then 'interested'
        when c.pipeline_stage in ('rejected','withdrawn','suppressed') then null
        else 'prospect'
      end as bucket
    from public.sos_recruiting_candidates c
    left join public.sos_provider_early_interest e on e.candidate_id = c.id
    where c.is_demo = false and coalesce(e.is_test, false) = false
  ),
  cap as (
    select i.candidate_id, i.subcategory_id from public.sos_candidate_service_interests i where i.verification_status <> 'declined'
    union
    select c.id, m.subcategory_id
    from public.sos_recruiting_candidates c
    cross join lateral unnest(c.services_enabled) l(label)
    join public.sos_service_label_map m on m.legacy_label = l.label
    where m.subcategory_id is not null
  ),
  cz as (select k.candidate_id, k.zone_id from public.sos_recruiting_candidate_zone_coverage k where k.coverage_status <> 'declined'),
  cand_cells as (
    select cz.zone_id, cap.subcategory_id, cls.bucket, count(distinct cls.candidate_id) as n
    from cls join cap on cap.candidate_id = cls.candidate_id join cz on cz.candidate_id = cls.candidate_id
    where cls.bucket is not null
    group by 1, 2, 3
  ),
  heroes as (
    select h.id, h.on_duty, zn.id as zone_id, m.subcategory_id
    from public.sos_heroes h
    join zones zn on zn.zone_name = h.zone
    cross join lateral unnest(coalesce(h.services_enabled, '{}'::text[])) l(label)
    join public.sos_service_label_map m on m.legacy_label = l.label
    where h.is_demo = false and h.verification_status = 'verified' and m.subcategory_id is not null
  ),
  hero_cells as (
    select zone_id, subcategory_id, count(distinct id) as verified, count(distinct id) filter (where on_duty) as on_duty
    from heroes group by 1, 2
  ),
  matrix as (
    select zn.id as zone_id, sb.id as subcategory_id,
      coalesce(sum(cc.n) filter (where cc.bucket = 'prospect'), 0)::int as prospects,
      coalesce(sum(cc.n) filter (where cc.bucket = 'interested'), 0)::int as interested,
      coalesce(sum(cc.n) filter (where cc.bucket = 'screening'), 0)::int as screening,
      coalesce(max(hc.verified), 0)::int as verified,
      coalesce(max(hc.on_duty), 0)::int as on_duty
    from zones zn cross join subs sb
    left join cand_cells cc on cc.zone_id = zn.id and cc.subcategory_id = sb.id
    left join hero_cells hc on hc.zone_id = zn.id and hc.subcategory_id = sb.id
    group by zn.id, sb.id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'prelaunch', private.sos_prelaunch_enabled(),
    'definitions', jsonb_build_object(
      'prospects', 'Discovered or legacy records that never self-registered. Not providers.',
      'interested', 'Self-registered early interest (unverified, self-reported services and zones).',
      'screening', 'Early interest under screening or invited to the full application, or candidates in screening→test_mission.',
      'verified', 'Real (non-demo) Hero profiles with verification_status = verified.',
      'on_duty', 'Verified real Heroes currently on duty.'),
    'totals', jsonb_build_object(
      'prospects', (select count(*) from cls where bucket = 'prospect'),
      'early_interest', (select count(*) from cls where bucket in ('interested','screening') and candidate_id in (select candidate_id from public.sos_provider_early_interest)),
      'interested', (select count(*) from cls where bucket = 'interested'),
      'contact_verified', (select count(*) from public.sos_provider_early_interest e join public.sos_recruiting_candidates c on c.id = e.candidate_id
                            where not e.is_test and not c.is_demo and e.contact_verified_at is not null and e.interest_status not in ('not_a_fit','withdrawn')),
      'reachable', (select count(*) from public.sos_provider_early_interest e join public.sos_recruiting_candidates c on c.id = e.candidate_id
                     where not e.is_test and not c.is_demo and not c.do_not_contact and e.interest_status not in ('not_a_fit','withdrawn')
                       and ((e.email_opt_in and c.email is not null) or (e.sms_opt_in and c.phone is not null))),
      'screening', (select count(*) from cls where bucket = 'screening'),
      'invited_to_apply', (select count(*) from public.sos_provider_early_interest e where not e.is_test and e.interest_status = 'invited_to_apply'),
      'full_applications', (select count(*) from public.sos_hero_applications a where a.status not in ('rejected','withdrawn')),
      'verified', (select count(*) from public.sos_heroes h where not h.is_demo and h.verification_status = 'verified'),
      'on_duty', (select count(*) from public.sos_heroes h where not h.is_demo and h.verification_status = 'verified' and h.on_duty),
      'excluded_test_signups', (select count(*) from public.sos_provider_early_interest e where e.is_test),
      'excluded_demo_candidates', (select count(*) from public.sos_recruiting_candidates c where c.is_demo),
      'excluded_demo_heroes', (select count(*) from public.sos_heroes h where h.is_demo),
      'receipts_total', (select count(*) from public.sos_provider_interest_receipts r where not r.is_test),
      'covered_cells_verified', (select count(*) from matrix where verified > 0),
      'total_cells', (select count(*) from matrix)),
    'zones', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', zone_name) order by zone_name), '[]') from zones),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name,
                     'subcategories', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.sort_order), '[]') from subs s where s.category_id = c.id))
                     order by c.sort_order), '[]')
                   from public.sos_categories c where c.is_active),
    'matrix', (select coalesce(jsonb_agg(jsonb_build_object('z', zone_id, 's', subcategory_id, 'p', prospects, 'i', interested, 'sc', screening, 'v', verified, 'od', on_duty)), '[]')
               from matrix where prospects + interested + screening + verified + on_duty > 0)
  ) into v;
  return v;
end;
$$;
revoke all on function public.sos_ops_recruitment_dashboard() from public, anon;
grant execute on function public.sos_ops_recruitment_dashboard() to authenticated;

create or replace function public.sos_ops_early_interest_queue(p_include_test boolean default false, p_limit integer default 300)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(row_to_json(q)::jsonb order by q.last_registered_at desc), '[]')
    from (
      select e.candidate_id, c.first_name, c.last_name, c.company_name, e.provider_type, c.email, c.phone,
        c.city, c.state_code, c.zip_code, c.candidate_source, c.pipeline_stage, c.do_not_contact,
        (c.candidate_source <> 'early_interest_web') as matched_existing_record,
        e.interest_status, e.status_entered_at, e.first_registered_at, e.last_registered_at, e.submission_count,
        e.email_opt_in, e.sms_opt_in, e.contact_verified_at, e.contact_verification_evidence,
        e.assigned_owner, e.muse_outreach_tag, e.is_test,
        (select r.receipt_number from public.sos_provider_interest_receipts r where r.id = e.latest_receipt_id) as latest_receipt_number,
        (select r.attribution from public.sos_provider_interest_receipts r where r.id = e.latest_receipt_id) as latest_attribution,
        (select r.service_radius_miles from public.sos_provider_interest_receipts r where r.id = e.latest_receipt_id) as service_radius_miles,
        (select r.years_experience from public.sos_provider_interest_receipts r where r.id = e.latest_receipt_id) as years_experience,
        (select r.equipment_notes from public.sos_provider_interest_receipts r where r.id = e.latest_receipt_id) as equipment_notes,
        (select r.availability from public.sos_provider_interest_receipts r where r.id = e.latest_receipt_id) as availability,
        (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'category_id', s.category_id, 'status', i.verification_status) order by s.category_id, s.sort_order), '[]')
           from public.sos_candidate_service_interests i join public.sos_subcategories s on s.id = i.subcategory_id where i.candidate_id = e.candidate_id) as services,
        (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'name', z.zone_name, 'status', k.coverage_status, 'verified', k.verified_at is not null) order by z.zone_name), '[]')
           from public.sos_recruiting_candidate_zone_coverage k join public.sos_service_zones z on z.id = k.zone_id where k.candidate_id = e.candidate_id) as zones
      from public.sos_provider_early_interest e
      join public.sos_recruiting_candidates c on c.id = e.candidate_id
      where (p_include_test or not e.is_test)
      order by e.last_registered_at desc
      limit greatest(1, least(coalesce(p_limit, 300), 1000))
    ) q
  );
end;
$$;
revoke all on function public.sos_ops_early_interest_queue(boolean, integer) from public, anon;
grant execute on function public.sos_ops_early_interest_queue(boolean, integer) to authenticated;

-- Operator actions with audit. Stage advances require recorded evidence; no external sends.
create or replace function public.sos_ops_update_early_interest(
  p_candidate_id uuid,
  p_interest_status text default null,
  p_assigned_owner text default null,
  p_muse_outreach_tag text default null,
  p_note text default null,
  p_contact_evidence text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.sos_provider_early_interest%rowtype;
  c public.sos_recruiting_candidates%rowtype;
  v_actor text;
  v_status text := nullif(btrim(coalesce(p_interest_status,'')), '');
  v_tag text := nullif(btrim(coalesce(p_muse_outreach_tag,'')), '');
  v_owner text := nullif(btrim(coalesce(p_assigned_owner,'')), '');
  v_evidence text := nullif(btrim(coalesce(p_contact_evidence,'')), '');
  v_note text := nullif(left(btrim(coalesce(p_note,'')), 2000), '');
  v_invited boolean := false;
begin
  if not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode = '42501';
  end if;
  select coalesce(o.email, o.auth_id::text) into v_actor from private.marketplace_operators o where o.auth_id = auth.uid();
  select * into e from public.sos_provider_early_interest where candidate_id = p_candidate_id for update;
  if not found then raise exception 'Early-interest record not found'; end if;
  select * into c from public.sos_recruiting_candidates where id = p_candidate_id;

  if v_status is not null and v_status <> e.interest_status then
    if v_status not in ('interested','contact_verified','screening','invited_to_apply','not_a_fit','withdrawn') then
      raise exception 'Invalid early-interest status';
    end if;
    if v_status = 'contact_verified' then
      if v_evidence is null or char_length(v_evidence) < 10 then
        raise exception 'Record how the contact was verified (at least 10 characters) before marking it verified';
      end if;
    end if;
    if v_status = 'screening' and e.contact_verified_at is null then
      raise exception 'Verify the contact (contact_verified) before moving to screening';
    end if;
    if v_status = 'invited_to_apply' then
      if e.interest_status <> 'screening' then raise exception 'Only screened providers can be invited to the full application'; end if;
      if c.email is null then raise exception 'An email address is required to issue a full-application invitation'; end if;
      if c.do_not_contact then raise exception 'Candidate is suppressed (do not contact)'; end if;
      if e.is_test then raise exception 'Test signups cannot be invited'; end if;
      insert into private.sos_prelaunch_application_invites(email_normalized, invited_by, note)
        values (lower(btrim(c.email)), coalesce(v_actor, 'operator'), 'Early interest candidate ' || p_candidate_id::text)
        on conflict (email_normalized) do update set invited_by = excluded.invited_by, expires_at = null;
      v_invited := true;
    end if;
    update public.sos_provider_early_interest set
      interest_status = v_status,
      status_entered_at = now(),
      contact_verified_at = case when v_status = 'contact_verified' then now() else contact_verified_at end,
      contact_verification_evidence = case when v_status = 'contact_verified' then v_evidence else contact_verification_evidence end,
      updated_at = now()
    where candidate_id = p_candidate_id;
    insert into public.sos_provider_early_interest_events(candidate_id, event_type, actor, from_status, to_status, detail)
      values (p_candidate_id, 'status_changed', coalesce(v_actor, 'operator'), e.interest_status, v_status,
              jsonb_build_object('note', v_note, 'evidence', v_evidence, 'full_application_invite_issued', v_invited));
  end if;

  if p_assigned_owner is not null and v_owner is distinct from e.assigned_owner then
    update public.sos_provider_early_interest set assigned_owner = v_owner, updated_at = now() where candidate_id = p_candidate_id;
    update public.sos_recruiting_candidates set assigned_owner = v_owner, updated_at = now() where id = p_candidate_id;
    insert into public.sos_provider_early_interest_events(candidate_id, event_type, actor, detail)
      values (p_candidate_id, 'owner_assigned', coalesce(v_actor, 'operator'), jsonb_build_object('from', e.assigned_owner, 'to', v_owner));
  end if;

  if v_tag is not null and v_tag <> e.muse_outreach_tag then
    if v_tag not in ('none','tagged_for_muse_review') then raise exception 'Invalid Muse tag'; end if;
    if v_tag = 'tagged_for_muse_review' then
      if e.is_test then raise exception 'Test signups cannot be tagged for outreach'; end if;
      if c.do_not_contact then raise exception 'Candidate is suppressed (do not contact)'; end if;
      if not ((e.email_opt_in and c.email is not null) or (e.sms_opt_in and c.phone is not null)) then
        raise exception 'No channel-specific opt-in on record; cannot tag for Muse outreach review';
      end if;
    end if;
    update public.sos_provider_early_interest set muse_outreach_tag = v_tag, updated_at = now() where candidate_id = p_candidate_id;
    insert into public.sos_provider_early_interest_events(candidate_id, event_type, actor, detail)
      values (p_candidate_id, 'muse_tag_changed', coalesce(v_actor, 'operator'),
              jsonb_build_object('from', e.muse_outreach_tag, 'to', v_tag, 'note', 'Tag only. No message was sent. Muse owns approved sends.'));
  end if;

  if v_note is not null and (v_status is null or v_status = e.interest_status) then
    insert into public.sos_provider_early_interest_events(candidate_id, event_type, actor, detail)
      values (p_candidate_id, 'note_added', coalesce(v_actor, 'operator'), jsonb_build_object('note', v_note));
  end if;

  select * into e from public.sos_provider_early_interest where candidate_id = p_candidate_id;
  return jsonb_build_object('candidate_id', p_candidate_id, 'interest_status', e.interest_status, 'assigned_owner', e.assigned_owner,
    'muse_outreach_tag', e.muse_outreach_tag, 'contact_verified_at', e.contact_verified_at, 'full_application_invite_issued', v_invited);
end;
$$;
revoke all on function public.sos_ops_update_early_interest(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.sos_ops_update_early_interest(uuid, text, text, text, text, text) to authenticated;

create or replace function public.sos_ops_early_interest_events(p_candidate_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('event_type', ev.event_type, 'actor', ev.actor, 'from', ev.from_status, 'to', ev.to_status,
            'detail', ev.detail, 'at', ev.created_at) order by ev.created_at desc), '[]')
          from public.sos_provider_early_interest_events ev where ev.candidate_id = p_candidate_id);
end;
$$;
revoke all on function public.sos_ops_early_interest_events(uuid) from public, anon;
grant execute on function public.sos_ops_early_interest_events(uuid) to authenticated;

-- Privacy erasure for a self-registered provider (deletion request). Redacts PII in
-- receipts and the candidate record, suppresses all contact, keeps non-identifying
-- receipt numbers/timestamps for audit integrity.
create or replace function public.sos_ops_erase_provider_interest(p_candidate_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text; v_n integer;
begin
  if not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Marketplace operator access required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 5 then raise exception 'Record the erasure request reason'; end if;
  if not exists (select 1 from public.sos_provider_early_interest where candidate_id = p_candidate_id) then
    raise exception 'Early-interest record not found';
  end if;
  select coalesce(o.email, o.auth_id::text) into v_actor from private.marketplace_operators o where o.auth_id = auth.uid();
  perform set_config('sos.receipt_privacy_erasure', 'on', true);
  update public.sos_provider_interest_receipts set full_name = '[erased]', company_name = null, email_normalized = null, phone_normalized = null,
    equipment_notes = null, ip_hash = null, user_agent = null, attribution = '{}'::jsonb, erased_at = now()
  where candidate_id = p_candidate_id;
  get diagnostics v_n = row_count;
  perform set_config('sos.receipt_privacy_erasure', 'off', true);
  update public.sos_recruiting_candidates set first_name = '[erased]', last_name = null, email = null, phone = null, company_name = null,
    website = null, notes = 'Erased on request.', do_not_contact = true, pipeline_stage = 'suppressed', outreach_status = 'suppressed',
    dedupe_key = null, updated_at = now()
  where id = p_candidate_id;
  update public.sos_provider_early_interest set interest_status = 'withdrawn', email_opt_in = false, email_opt_in_at = null, sms_opt_in = false,
    sms_opt_in_at = null, contact_verification_evidence = null, muse_outreach_tag = 'none', status_entered_at = now(), updated_at = now()
  where candidate_id = p_candidate_id;
  insert into public.sos_provider_early_interest_events(candidate_id, event_type, actor, to_status, detail)
    values (p_candidate_id, 'privacy_erasure', coalesce(v_actor, 'operator'), 'withdrawn', jsonb_build_object('reason', left(p_reason, 500), 'receipts_redacted', v_n));
  return jsonb_build_object('candidate_id', p_candidate_id, 'receipts_redacted', v_n, 'suppressed', true);
end;
$$;
revoke all on function public.sos_ops_erase_provider_interest(uuid, text) from public, anon;
grant execute on function public.sos_ops_erase_provider_interest(uuid, text) to authenticated;
