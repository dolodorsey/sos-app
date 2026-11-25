-- S.O.S. — Hero payout choice: direct deposit (Stripe) or mailed check (Nov 25, 2026, Dolo).
-- Tax IDs are never stored in the S.O.S. database:
--   * Direct deposit: Stripe onboarding collects legal name, tax ID and address.
--   * Mailed check: the Hero gives a mailing address here; the W-9 goes to the S.O.S. accountant,
--     and an operator only records that the form was received.
-- Check payouts go to an operator queue (sos_check_payouts) and are paid through business bill pay.

create table if not exists public.sos_hero_payout_profiles (
  hero_id uuid primary key references public.sos_heroes(id) on delete cascade,
  payout_preference text not null default 'direct_deposit' check (payout_preference in ('direct_deposit','mailed_check')),
  mail_name text, mail_line1 text, mail_line2 text, mail_city text, mail_state text, mail_zip text,
  tax_form_status text not null default 'not_needed' check (tax_form_status in ('not_needed','needed','received')),
  tax_form_confirmed_at timestamptz, tax_form_confirmed_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.sos_hero_payout_profiles enable row level security;
revoke all on public.sos_hero_payout_profiles from anon, authenticated;

create table if not exists public.sos_check_payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.sos_payments(id) on delete restrict,
  mission_id uuid not null, hero_id uuid not null references public.sos_heroes(id),
  amount numeric(10,2) not null check (amount > 0), currency text not null default 'usd',
  mail_to jsonb not null,
  status text not null default 'queued' check (status in ('queued','mailed','canceled')),
  check_number text, mailed_at timestamptz, mailed_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.sos_check_payouts enable row level security;
revoke all on public.sos_check_payouts from anon, authenticated;
create index if not exists sos_check_payouts_status_idx on public.sos_check_payouts(status, created_at);

-- Hero: read own payout choice.
create or replace function public.sos_hero_payout_profile()
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public','private'
as $$
declare v_hero uuid:=public.sos_current_hero_id(); p public.sos_hero_payout_profiles%rowtype;
begin
  if auth.uid() is null or v_hero is null then raise exception 'Authenticated Hero required' using errcode='42501'; end if;
  select * into p from public.sos_hero_payout_profiles where hero_id=v_hero;
  return jsonb_build_object(
    'payout_preference', coalesce(p.payout_preference,'direct_deposit'),
    'mail_name',p.mail_name,'mail_line1',p.mail_line1,'mail_line2',p.mail_line2,'mail_city',p.mail_city,'mail_state',p.mail_state,'mail_zip',p.mail_zip,
    'tax_form_status', coalesce(p.tax_form_status,'not_needed'),
    'checks_waiting', (select count(*) from public.sos_check_payouts c where c.hero_id=v_hero and c.status='queued'),
    'checks_mailed', (select count(*) from public.sos_check_payouts c where c.hero_id=v_hero and c.status='mailed'));
end $$;

-- Hero: choose direct deposit or mailed check.
create or replace function public.sos_set_hero_payout_preference(
  p_preference text, p_mail_name text default null, p_mail_line1 text default null, p_mail_line2 text default null,
  p_mail_city text default null, p_mail_state text default null, p_mail_zip text default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$
declare v_hero uuid:=public.sos_current_hero_id(); v_prev public.sos_hero_payout_profiles%rowtype;
begin
  if auth.uid() is null or v_hero is null then raise exception 'Authenticated Hero required' using errcode='42501'; end if;
  if p_preference not in ('direct_deposit','mailed_check') then raise exception 'Choose direct deposit or mailed check'; end if;
  select * into v_prev from public.sos_hero_payout_profiles where hero_id=v_hero;
  if p_preference='mailed_check' then
    if coalesce(length(trim(p_mail_name)),0)<2 or coalesce(length(trim(p_mail_line1)),0)<3 or coalesce(length(trim(p_mail_city)),0)<2
       or upper(trim(coalesce(p_mail_state,''))) !~ '^[A-Z]{2}$' or trim(coalesce(p_mail_zip,'')) !~ '^\d{5}(-\d{4})?$' then
      raise exception 'Enter the name on the check, street, city, two-letter state and ZIP code';
    end if;
  end if;
  insert into public.sos_hero_payout_profiles(hero_id,payout_preference,mail_name,mail_line1,mail_line2,mail_city,mail_state,mail_zip,tax_form_status,updated_at)
  values(v_hero,p_preference,
    case when p_preference='mailed_check' then left(trim(p_mail_name),120) end,
    case when p_preference='mailed_check' then left(trim(p_mail_line1),160) end,
    case when p_preference='mailed_check' then left(nullif(trim(p_mail_line2),''),160) end,
    case when p_preference='mailed_check' then left(trim(p_mail_city),80) end,
    case when p_preference='mailed_check' then upper(trim(p_mail_state)) end,
    case when p_preference='mailed_check' then trim(p_mail_zip) end,
    case when p_preference='mailed_check' then case when v_prev.tax_form_status='received' then 'received' else 'needed' end else 'not_needed' end,
    now())
  on conflict(hero_id) do update set payout_preference=excluded.payout_preference,mail_name=excluded.mail_name,mail_line1=excluded.mail_line1,
    mail_line2=excluded.mail_line2,mail_city=excluded.mail_city,mail_state=excluded.mail_state,mail_zip=excluded.mail_zip,
    tax_form_status=excluded.tax_form_status,updated_at=now();
  -- Payout readiness follows the choice: a check payee is ready once operations confirms the tax form.
  insert into public.sos_hero_verification_checks(hero_id,check_type,required,status,notes,updated_at)
  values(v_hero,'payout_account',true,
    case when p_preference='mailed_check' and v_prev.tax_form_status='received' then 'passed' when p_preference='mailed_check' then 'submitted' else 'pending' end,
    case when p_preference='mailed_check' and v_prev.tax_form_status='received' then 'Mailed check: address on file and tax form received.'
         when p_preference='mailed_check' then 'Mailed check chosen. Send your W-9 tax form to help@superherosonstandby.com; operations confirms it.'
         else 'Direct deposit chosen. Finish Stripe payout setup.' end, now())
  on conflict(hero_id,check_type) do update set status=excluded.status,notes=excluded.notes,
    reviewed_at=case when excluded.status='passed' then now() else null end,updated_at=now();
  perform private.sos_recompute_hero_verification(v_hero);
  return public.sos_hero_payout_profile();
end $$;

-- Operations: record that a check payee's W-9 was received (the form itself is not stored here).
create or replace function public.sos_ops_confirm_hero_tax_form(p_hero_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$
declare p public.sos_hero_payout_profiles%rowtype;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  select * into p from public.sos_hero_payout_profiles where hero_id=p_hero_id for update;
  if not found or p.payout_preference<>'mailed_check' then raise exception 'Hero has not chosen mailed check'; end if;
  update public.sos_hero_payout_profiles set tax_form_status='received',tax_form_confirmed_at=now(),tax_form_confirmed_by=auth.uid(),updated_at=now() where hero_id=p_hero_id;
  insert into public.sos_hero_verification_checks(hero_id,check_type,required,status,notes,reviewed_at,updated_at)
  values(p_hero_id,'payout_account',true,'passed','Mailed check: address on file and tax form received.',now(),now())
  on conflict(hero_id,check_type) do update set status='passed',notes=excluded.notes,reviewed_at=now(),updated_at=now();
  perform private.sos_recompute_hero_verification(p_hero_id);
  return jsonb_build_object('hero_id',p_hero_id,'tax_form_status','received','payout_account','passed');
end $$;

-- Operations: list checks waiting to be mailed.
create or replace function public.sos_ops_check_payout_queue()
returns table(id uuid, hero_name text, amount numeric, mail_to jsonb, mission_id uuid, status text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'pg_catalog','public','private'
as $$
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  return query select c.id, trim(coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')), c.amount, c.mail_to, c.mission_id, c.status, c.created_at
    from public.sos_check_payouts c join public.sos_heroes h on h.id=c.hero_id join public.sos_users u on u.id=h.user_id
    where c.status='queued' order by c.created_at;
end $$;

-- Operations: mark a check as mailed; this releases the payment to the Hero.
create or replace function public.sos_ops_mark_check_mailed(p_check_id uuid, p_check_number text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$
declare c public.sos_check_payouts%rowtype;
begin
  if not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  if coalesce(length(trim(p_check_number)),0)<1 then raise exception 'Check number required'; end if;
  select * into c from public.sos_check_payouts where id=p_check_id for update;
  if not found then raise exception 'Check payout not found' using errcode='P0002'; end if;
  if c.status<>'queued' then raise exception 'Check is already %', c.status; end if;
  update public.sos_check_payouts set status='mailed',check_number=left(trim(p_check_number),40),mailed_at=now(),mailed_by=auth.uid(),updated_at=now() where id=p_check_id;
  update public.sos_payments set payment_status='released',escrow_status='released_to_hero',released_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('payout_method','mailed_check','check_payout_id',p_check_id,'check_number',left(trim(p_check_number),40)),updated_at=now()
   where id=c.payment_id and payment_status='transfer_pending';
  return jsonb_build_object('check_id',p_check_id,'status','mailed');
end $$;

-- Payout worker (service role): queue a check for a captured payment owed to a check payee.
create or replace function public.sos_queue_check_payout(p_payment_id uuid)
returns uuid language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$
declare p public.sos_payments%rowtype; pr public.sos_hero_payout_profiles%rowtype; v_id uuid;
begin
  if auth.role()<>'service_role' and current_user not in ('postgres','service_role','supabase_admin') then raise exception 'Service role required' using errcode='42501'; end if;
  select * into p from public.sos_payments where id=p_payment_id;
  if not found or p.payment_status<>'transfer_pending' or p.hero_id is null or coalesce(p.hero_payout,0)<=0 then return null; end if;
  select * into pr from public.sos_hero_payout_profiles where hero_id=p.hero_id and payout_preference='mailed_check';
  if not found then return null; end if;
  insert into public.sos_check_payouts(payment_id,mission_id,hero_id,amount,currency,mail_to)
  values(p.id,p.mission_id,p.hero_id,p.hero_payout,coalesce(p.currency,'usd'),
    jsonb_build_object('name',pr.mail_name,'line1',pr.mail_line1,'line2',pr.mail_line2,'city',pr.mail_city,'state',pr.mail_state,'zip',pr.mail_zip))
  on conflict(payment_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.sos_check_payouts where payment_id=p.id; end if;
  return v_id;
end $$;

revoke all on function public.sos_hero_payout_profile() from public, anon;
revoke all on function public.sos_set_hero_payout_preference(text,text,text,text,text,text,text) from public, anon;
revoke all on function public.sos_ops_confirm_hero_tax_form(uuid) from public, anon;
revoke all on function public.sos_ops_check_payout_queue() from public, anon;
revoke all on function public.sos_ops_mark_check_mailed(uuid,text) from public, anon;
revoke all on function public.sos_queue_check_payout(uuid) from public, anon, authenticated;
grant execute on function public.sos_hero_payout_profile() to authenticated;
grant execute on function public.sos_set_hero_payout_preference(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.sos_ops_confirm_hero_tax_form(uuid) to authenticated;
grant execute on function public.sos_ops_check_payout_queue() to authenticated;
grant execute on function public.sos_ops_mark_check_mailed(uuid,text) to authenticated;
grant execute on function public.sos_queue_check_payout(uuid) to service_role;

-- Public coverage counts a check payee once operations confirmed the tax form.
create or replace function public.sos_public_service_coverage()
 returns table(service_id text, service_name text, has_verified_supply boolean, verified_supply_count bigint)
 language sql stable security definer set search_path to 'pg_catalog','public','auth'
as $function$
  select s.id, s.name, (count(h.id) > 0), count(h.id)::bigint
  from public.sos_subcategories s
  left join public.sos_heroes h
    on s.id = any(h.services_enabled)
   and coalesce(h.is_demo,false) = false
   and h.verification_status = 'verified'
   and coalesce(h.id_verified,false) and coalesce(h.background_cleared,false)
   and coalesce(h.license_verified,false) and coalesce(h.insurance_verified,false)
   and coalesce(h.test_mission_passed,false)
   and (
     (h.stripe_connect_api_version = 'v2' and h.stripe_transfer_status = 'active')
     or exists(select 1 from public.sos_hero_payout_profiles pp where pp.hero_id=h.id and pp.payout_preference='mailed_check' and pp.tax_form_status='received')
   )
  left join public.sos_users u on u.id = h.user_id and coalesce(u.is_demo,false) = false and u.status = 'active' and u.auth_id is not null
  left join auth.users au on au.id = u.auth_id
   and coalesce((au.raw_app_meta_data->>'test_account')::boolean,false) = false
   and coalesce((au.raw_app_meta_data->>'enterprise_test_account')::boolean,false) = false
  where s.is_active and (h.id is null or (u.id is not null and au.id is not null))
  group by s.id, s.name;
$function$;
