-- S.O.S. promo codes + referral rewards.
--   Promo code ATL SUPERHERO (stored ATLSUPERHERO; spaces are ignored when typed): one free service, redeem and use by Dec 31 2026 (Atlanta time).
--   Referral: 10 different people open your link  -> 50% off one service (once).
--             every 5 friends who sign up with your link -> 1 complimentary service.
-- Customers hold rewards as credits. One credit applies per job, automatically at
-- checkout. S.O.S. funds the discount; the Hero is always paid in full.

create table if not exists public.sos_promo_codes(
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9]{3,24}$'),
  reward_kind text not null check (reward_kind in ('free_service','percent_off')),
  percent_off int check (percent_off between 1 and 100),
  description text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  credit_expires_at timestamptz,
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  redemptions int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((reward_kind = 'percent_off') = (percent_off is not null))
);

create table if not exists public.sos_customer_credits(
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.sos_users(id) on delete cascade,
  reward_kind text not null check (reward_kind in ('free_service','percent_off')),
  percent_off int check (percent_off between 1 and 100),
  source text not null check (source in ('promo_code','referral_shares','referral_signups')),
  promo_code text references public.sos_promo_codes(code),
  milestone int,
  label text not null,
  status text not null default 'available' check (status in ('available','reserved','used','expired','void')),
  expires_at timestamptz,
  mission_id uuid references public.sos_missions(id) on delete set null,
  reserved_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reward_kind = 'percent_off') = (percent_off is not null))
);
create unique index if not exists sos_credit_one_per_promo on public.sos_customer_credits(citizen_id, promo_code) where source = 'promo_code';
create unique index if not exists sos_credit_one_share_reward on public.sos_customer_credits(citizen_id) where source = 'referral_shares';
create unique index if not exists sos_credit_one_per_milestone on public.sos_customer_credits(citizen_id, milestone) where source = 'referral_signups';
create unique index if not exists sos_credit_one_per_mission on public.sos_customer_credits(mission_id) where status in ('reserved','used');
create index if not exists sos_credit_citizen on public.sos_customer_credits(citizen_id, status);

create table if not exists public.sos_referral_link_opens(
  referrer_id uuid not null references public.sos_users(id) on delete cascade,
  visitor_hash text not null,
  created_at timestamptz not null default now(),
  primary key (referrer_id, visitor_hash)
);

alter table public.sos_payments add column if not exists promo_discount numeric not null default 0 check (promo_discount >= 0);
alter table public.sos_payments add column if not exists promo_credit_id uuid references public.sos_customer_credits(id);

alter table public.sos_promo_codes enable row level security;
alter table public.sos_customer_credits enable row level security;
alter table public.sos_referral_link_opens enable row level security;
revoke all on public.sos_promo_codes, public.sos_customer_credits, public.sos_referral_link_opens from anon, authenticated;

insert into public.sos_promo_codes(code, reward_kind, description, starts_at, ends_at, credit_expires_at)
values ('ATLSUPERHERO', 'free_service', '1 free service',
        now(), timestamptz '2026-12-31 23:59:59 America/New_York', timestamptz '2026-12-31 23:59:59 America/New_York')
on conflict (code) do nothing;

-- The signed-in, active S.O.S. customer making the call.
create or replace function private.sos_current_citizen() returns uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select id from public.sos_users where auth_id = auth.uid() and status = 'active' limit 1
$$;

-- Redeem a promo code into the customer's rewards.
create or replace function public.sos_redeem_promo_code(p_code text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_user uuid := private.sos_current_citizen(); v_code public.sos_promo_codes%rowtype; v_code_text text := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g')); v_credit public.sos_customer_credits%rowtype;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'sign_in', 'message', 'Sign in to use a promo code.'); end if;
  select * into v_code from public.sos_promo_codes where code = v_code_text for update;
  if not found or not v_code.is_active then return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'That code isn''t valid. Check the spelling and try again.'); end if;
  if now() < v_code.starts_at then return jsonb_build_object('ok', false, 'reason', 'not_started', 'message', 'That code isn''t active yet.'); end if;
  if now() > v_code.ends_at then return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'That code has expired.'); end if;
  if v_code.max_redemptions is not null and v_code.redemptions >= v_code.max_redemptions then return jsonb_build_object('ok', false, 'reason', 'used_up', 'message', 'That code has been fully claimed.'); end if;
  insert into public.sos_customer_credits(citizen_id, reward_kind, percent_off, source, promo_code, label, expires_at)
  values (v_user, v_code.reward_kind, v_code.percent_off, 'promo_code', v_code.code, v_code.description, v_code.credit_expires_at)
  on conflict do nothing returning * into v_credit;
  if v_credit.id is null then return jsonb_build_object('ok', false, 'reason', 'already_redeemed', 'message', 'You already added this code.'); end if;
  update public.sos_promo_codes set redemptions = redemptions + 1 where code = v_code.code;
  return jsonb_build_object('ok', true, 'message', v_code.description || ' added. It applies automatically at checkout.', 'credit_id', v_credit.id);
end $$;

-- Everything the Rewards screen shows.
create or replace function public.sos_my_rewards() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public, private as $$
declare v_user uuid := private.sos_current_citizen(); v_ref text; v_opens int; v_signups int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'sign_in'); end if;
  select referral_code into v_ref from public.sos_users where id = v_user;
  select count(*) into v_opens from public.sos_referral_link_opens where referrer_id = v_user;
  select count(*) into v_signups from public.sos_users where referred_by = v_user and role = 'citizen';
  return jsonb_build_object('ok', true, 'referral_code', v_ref,
    'share_url', 'https://thesuperherosonstandby.com/?ref=' || v_ref,
    'link_opens', v_opens, 'link_opens_goal', 10,
    'share_reward_earned', exists(select 1 from public.sos_customer_credits where citizen_id = v_user and source = 'referral_shares'),
    'signups', v_signups, 'signups_per_reward', 5,
    'credits', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'kind', reward_kind, 'percent_off', percent_off, 'source', source,
        'status', case when status = 'available' and expires_at is not null and expires_at < now() then 'expired' else status end,
        'expires_at', expires_at, 'created_at', created_at) order by (status = 'available') desc, created_at desc)
      from public.sos_customer_credits where citizen_id = v_user), '[]'::jsonb));
end $$;

-- Someone opened a customer's share link. Counted once per network, so one
-- person refreshing doesn't count ten times.
create or replace function public.sos_referral_link_open(p_ref text, p_visitor text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare v_referrer uuid; v_ip text; v_key text; v_count int;
begin
  if coalesce(p_ref, '') !~ '^[a-z0-9]{6,12}$' or length(coalesce(p_visitor, '')) not between 8 and 64 then return jsonb_build_object('ok', false); end if;
  select id into v_referrer from public.sos_users where referral_code = p_ref and status = 'active' and role = 'citizen';
  if v_referrer is null then return jsonb_build_object('ok', false); end if;
  if v_referrer = private.sos_current_citizen() then return jsonb_build_object('ok', true, 'self', true); end if;
  begin v_ip := nullif(split_part(coalesce(current_setting('request.headers', true)::json->>'cf-connecting-ip', current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
  exception when others then v_ip := null; end;
  v_key := encode(extensions.digest(coalesce(v_ip, 'visitor:' || p_visitor) || '|' || p_ref, 'sha256'), 'hex');
  insert into public.sos_referral_link_opens(referrer_id, visitor_hash) values (v_referrer, v_key) on conflict do nothing;
  select count(*) into v_count from public.sos_referral_link_opens where referrer_id = v_referrer;
  if v_count >= 10 then
    insert into public.sos_customer_credits(citizen_id, reward_kind, percent_off, source, label)
    values (v_referrer, 'percent_off', 50, 'referral_shares', '50% off a service — thanks for sharing S.O.S.') on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- New customer signed up from a share link: remember who referred them.
create or replace function private.sos_attach_referrer() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_ref text;
begin
  if new.referred_by is null and new.auth_id is not null and new.role = 'citizen' then
    select lower(nullif(raw_user_meta_data->>'ref', '')) into v_ref from auth.users where id = new.auth_id;
    if v_ref ~ '^[a-z0-9]{6,12}$' then
      select id into new.referred_by from public.sos_users where referral_code = v_ref and role = 'citizen' and status = 'active' and id <> new.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sos_attach_referrer on public.sos_users;
create trigger sos_attach_referrer before insert on public.sos_users for each row execute function private.sos_attach_referrer();

-- Every 5 friends who sign up earns the referrer 1 complimentary service.
create or replace function private.sos_grant_signup_rewards() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_count int; m int;
begin
  if new.referred_by is null or new.role <> 'citizen' then return new; end if;
  if tg_op = 'UPDATE' and old.referred_by is not distinct from new.referred_by then return new; end if;
  select count(*) into v_count from public.sos_users where referred_by = new.referred_by and role = 'citizen';
  m := 5;
  while m <= v_count loop
    insert into public.sos_customer_credits(citizen_id, reward_kind, source, milestone, label)
    values (new.referred_by, 'free_service', 'referral_signups', m, '1 complimentary service — ' || m || ' friends joined S.O.S.') on conflict do nothing;
    m := m + 5;
  end loop;
  return new;
end $$;
drop trigger if exists sos_grant_signup_rewards on public.sos_users;
create trigger sos_grant_signup_rewards after insert or update of referred_by on public.sos_users for each row execute function private.sos_grant_signup_rewards();

-- Checkout: hold the customer's best credit for this job and work out the discount.
-- Free service first, then the biggest percent off, then whichever expires soonest.
create or replace function public.sos_reserve_mission_credit(p_mission_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_m public.sos_missions%rowtype; v_c public.sos_customer_credits%rowtype; v_discount numeric;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then raise exception 'Server role required' using errcode = '42501'; end if;
  select * into v_m from public.sos_missions where id = p_mission_id;
  if not found or v_m.final_price is null or v_m.final_price <= 0 then return jsonb_build_object('discount', 0); end if;
  select * into v_c from public.sos_customer_credits where mission_id = p_mission_id and status in ('reserved','used') limit 1;
  if not found then
    select * into v_c from public.sos_customer_credits
    where citizen_id = v_m.citizen_id and status = 'available' and (expires_at is null or expires_at > now())
    order by (reward_kind = 'free_service') desc, percent_off desc nulls last, expires_at asc nulls last, created_at
    limit 1 for update skip locked;
    if not found then return jsonb_build_object('discount', 0); end if;
    update public.sos_customer_credits set status = 'reserved', mission_id = p_mission_id, reserved_at = now() where id = v_c.id returning * into v_c;
  end if;
  v_discount := case when v_c.reward_kind = 'free_service' then round(v_m.final_price, 2) else round(v_m.final_price * v_c.percent_off / 100.0, 2) end;
  return jsonb_build_object('discount', least(v_discount, round(v_m.final_price, 2)), 'credit_id', v_c.id, 'label', v_c.label);
end $$;

create or replace function public.sos_release_mission_credit(p_mission_id uuid) returns void
language sql security definer set search_path = pg_catalog, public as $$
  update public.sos_customer_credits
     set status = case when expires_at is not null and expires_at < now() then 'expired' else 'available' end,
         mission_id = null, reserved_at = null
   where mission_id = p_mission_id and status = 'reserved'
     and coalesce(auth.jwt()->>'role', '') = 'service_role';
$$;

-- Keep credits in step with the payment: used once money moves, returned if the
-- payment fails or is cancelled.
create or replace function private.sos_sync_credit_with_payment() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.promo_credit_id is null or new.payment_status is not distinct from old.payment_status then return new; end if;
  if new.payment_status in ('captured','transfer_pending','released') then
    update public.sos_customer_credits set status = 'used', used_at = coalesce(used_at, now()) where id = new.promo_credit_id and status in ('reserved','used');
  elsif new.payment_status in ('canceled','failed','refunded') then
    update public.sos_customer_credits set status = case when expires_at is not null and expires_at < now() then 'expired' else 'available' end, mission_id = null, reserved_at = null
     where id = new.promo_credit_id and status = 'reserved';
  end if;
  return new;
end $$;
drop trigger if exists sos_sync_credit_with_payment on public.sos_payments;
create trigger sos_sync_credit_with_payment after update of payment_status on public.sos_payments for each row execute function private.sos_sync_credit_with_payment();

-- A cancelled job gives its held credit back.
create or replace function private.sos_release_credit_on_cancel() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.status like 'canceled%' and old.status is distinct from new.status then
    update public.sos_customer_credits set status = case when expires_at is not null and expires_at < now() then 'expired' else 'available' end, mission_id = null, reserved_at = null
     where mission_id = new.id and status = 'reserved';
  end if;
  return new;
end $$;
drop trigger if exists sos_release_credit_on_cancel on public.sos_missions;
create trigger sos_release_credit_on_cancel after update of status on public.sos_missions for each row execute function private.sos_release_credit_on_cancel();

revoke all on function public.sos_redeem_promo_code(text), public.sos_my_rewards(), public.sos_referral_link_open(text, text), public.sos_reserve_mission_credit(uuid), public.sos_release_mission_credit(uuid) from public;
grant execute on function public.sos_redeem_promo_code(text), public.sos_my_rewards() to authenticated;
grant execute on function public.sos_referral_link_open(text, text) to anon, authenticated;
grant execute on function public.sos_reserve_mission_credit(uuid), public.sos_release_mission_credit(uuid) to service_role;
revoke all on function private.sos_current_citizen(), private.sos_attach_referrer(), private.sos_grant_signup_rewards(), private.sos_sync_credit_with_payment(), private.sos_release_credit_on_cancel() from public, anon, authenticated;
