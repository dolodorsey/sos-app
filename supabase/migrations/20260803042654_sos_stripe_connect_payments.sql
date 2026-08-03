begin;

alter table public.sos_payments
  add column if not exists currency text not null default 'usd',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_dispute_id text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists authorized_at timestamptz,
  add column if not exists authorization_expires_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.sos_payments drop constraint if exists sos_payments_payment_status_check;
alter table public.sos_payments add constraint sos_payments_payment_status_check
check (payment_status in ('pending','requires_action','authorized','captured','transfer_pending','released','canceled','partially_refunded','refunded','failed','disputed'));
alter table public.sos_payments drop constraint if exists sos_payments_amounts_nonnegative;
alter table public.sos_payments add constraint sos_payments_amounts_nonnegative check (
  amount > 0 and coalesce(platform_fee,0) >= 0 and coalesce(hero_payout,0) >= 0
  and coalesce(tip,0) >= 0 and coalesce(refund_amount,0) >= 0
  and coalesce(platform_fee,0) + coalesce(hero_payout,0) <= amount + coalesce(tip,0)
  and coalesce(refund_amount,0) <= amount + coalesce(tip,0)
);

create unique index if not exists sos_payments_mission_uidx on public.sos_payments(mission_id);
create unique index if not exists sos_payments_intent_uidx on public.sos_payments(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists sos_payments_checkout_uidx on public.sos_payments(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists sos_payments_transfer_uidx on public.sos_payments(stripe_transfer_id) where stripe_transfer_id is not null;
create index if not exists sos_payments_hero_status_idx on public.sos_payments(hero_id,payment_status,created_at desc);

create table if not exists public.sos_stripe_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  object_id text,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);
alter table public.sos_stripe_events enable row level security;
revoke all on public.sos_stripe_events from public,anon,authenticated;
grant all on public.sos_stripe_events to service_role,postgres;

create or replace function public.sos_prepare_mission_payment(
  p_mission_id uuid,
  p_payment_intent_id text,
  p_checkout_session_id text,
  p_amount numeric,
  p_platform_fee numeric,
  p_hero_payout numeric,
  p_currency text default 'usd'
) returns public.sos_payments
language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_mission public.sos_missions%rowtype; v_payment public.sos_payments%rowtype;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'Server role required' using errcode='42501'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is null or v_mission.status not in ('assigned','en_route','on_site','working') then raise exception 'Mission must have an accepted Hero'; end if;
  if v_mission.pricing_status <> 'confirmed' or v_mission.final_price is null or v_mission.final_price <= 0 then raise exception 'Final mission price is not confirmed'; end if;
  if round(v_mission.final_price,2) <> round(p_amount,2) then raise exception 'Payment amount does not match final mission price'; end if;
  insert into public.sos_payments(mission_id,citizen_id,hero_id,amount,platform_fee,hero_payout,currency,stripe_payment_intent_id,stripe_checkout_session_id,payment_status,escrow_status,updated_at)
  values(v_mission.id,v_mission.citizen_id,v_mission.hero_id,p_amount,p_platform_fee,p_hero_payout,lower(p_currency),p_payment_intent_id,p_checkout_session_id,'pending','pending_authorization',now())
  on conflict(mission_id) do update set stripe_payment_intent_id=excluded.stripe_payment_intent_id,stripe_checkout_session_id=excluded.stripe_checkout_session_id,amount=excluded.amount,platform_fee=excluded.platform_fee,hero_payout=excluded.hero_payout,currency=excluded.currency,updated_at=now()
  where public.sos_payments.payment_status in ('pending','requires_action','failed','canceled')
  returning * into v_payment;
  if v_payment.id is null then raise exception 'Mission already has an active payment'; end if;
  return v_payment;
end $$;
revoke all on function public.sos_prepare_mission_payment(uuid,text,text,numeric,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.sos_prepare_mission_payment(uuid,text,text,numeric,numeric,numeric,text) to service_role,postgres;

commit;
