-- Keep S.O.S. final pricing, tax, and restarted Checkout ledger state consistent.
create or replace function public.sos_confirm_mission_price(p_mission_id uuid, p_final_price numeric, p_operator_auth_id uuid)
returns public.sos_missions
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_mission public.sos_missions%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server role required' using errcode='42501'; end if;
  if p_operator_auth_id is null then raise exception 'Operator identity required' using errcode='42501'; end if;
  if p_final_price is null or p_final_price<1 or p_final_price>10000 then raise exception 'Final price must be between 1 and 10000'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is null or v_mission.status not in ('assigned','en_route','on_site','working') then raise exception 'Accepted Hero assignment required'; end if;
  if exists(select 1 from public.sos_payments where mission_id=p_mission_id and payment_status not in ('failed','canceled')) then raise exception 'Price cannot change after payment authorization begins'; end if;
  update public.sos_missions set
    final_price=round(p_final_price,2),
    tax_amount=round(round(p_final_price,2) * coalesce(tax_rate_percent,0) / 100.0,2),
    pricing_status='confirmed',updated_at=now()
  where id=p_mission_id returning * into v_mission;
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'price_update',v_mission.status,v_mission.status,jsonb_build_object('final_price',v_mission.final_price,'tax_amount',v_mission.tax_amount,'tax_rate_percent',v_mission.tax_rate_percent,'operator_auth_id',p_operator_auth_id),'admin');
  return v_mission;
end $function$;
revoke execute on function public.sos_confirm_mission_price(uuid,numeric,uuid) from public, anon, authenticated;
grant execute on function public.sos_confirm_mission_price(uuid,numeric,uuid) to service_role;

create or replace function public.sos_prepare_mission_payment(p_mission_id uuid, p_payment_intent_id text, p_checkout_session_id text, p_amount numeric, p_platform_fee numeric default null, p_hero_payout numeric default null, p_currency text default 'usd')
returns public.sos_payments
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_mission public.sos_missions%rowtype;
  v_payment public.sos_payments%rowtype;
  v_fee_pct numeric;
  v_fee numeric;
  v_payout numeric;
  v_tip numeric;
  v_tax numeric;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server role required' using errcode='42501'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is null or v_mission.status not in ('assigned','en_route','on_site','working') then raise exception 'Mission must have an accepted Hero'; end if;
  if v_mission.pricing_status <> 'confirmed' or v_mission.final_price is null or v_mission.final_price <= 0 then raise exception 'Final mission price is not confirmed'; end if;
  if round(v_mission.final_price,2) <> round(p_amount,2) then raise exception 'Payment amount does not match final mission price'; end if;

  v_fee_pct := private.sos_platform_fee_percent(v_mission.category_id, v_mission.subcategory_id);
  v_tip := round(coalesce(v_mission.tip_amount,0),2);
  v_tax := round(coalesce(v_mission.tax_amount,0),2);
  v_fee := round(p_amount * v_fee_pct / 100.0,2);
  v_payout := round(p_amount - v_fee + v_tip,2);
  if p_platform_fee is not null and round(p_platform_fee,2) <> v_fee then raise exception 'Caller-supplied platform fee disagrees with configured rate'; end if;
  if p_hero_payout is not null and round(p_hero_payout,2) <> v_payout then raise exception 'Caller-supplied hero payout disagrees with derived payout'; end if;

  insert into public.sos_payments(mission_id,citizen_id,hero_id,amount,platform_fee,hero_payout,tip,tax,currency,stripe_payment_intent_id,stripe_checkout_session_id,payment_status,escrow_status,updated_at)
  values(v_mission.id,v_mission.citizen_id,v_mission.hero_id,p_amount,v_fee,v_payout,v_tip,v_tax,lower(p_currency),nullif(p_payment_intent_id,''),p_checkout_session_id,'pending','pending_authorization',now())
  on conflict(mission_id) do update set
    citizen_id=excluded.citizen_id,hero_id=excluded.hero_id,
    stripe_payment_intent_id=excluded.stripe_payment_intent_id,
    stripe_checkout_session_id=excluded.stripe_checkout_session_id,
    amount=excluded.amount,platform_fee=excluded.platform_fee,hero_payout=excluded.hero_payout,
    tip=excluded.tip,tax=excluded.tax,currency=excluded.currency,
    payment_status='pending',escrow_status='pending_authorization',settlement_type='service',cancellation_fee=0,
    refund_amount=0,stripe_transfer_id=null,stripe_refund_id=null,stripe_charge_id=null,stripe_dispute_id=null,
    authorized_at=null,authorization_expires_at=null,captured_at=null,released_at=null,refunded_at=null,failed_at=null,disputed_at=null,
    original_platform_fee=null,original_hero_payout=null,updated_at=now()
  where public.sos_payments.payment_status in ('pending','requires_action','failed','canceled')
  returning * into v_payment;
  if v_payment.id is null then raise exception 'Mission already has an active payment'; end if;
  return v_payment;
end $function$;
revoke execute on function public.sos_prepare_mission_payment(uuid,text,text,numeric,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.sos_prepare_mission_payment(uuid,text,text,numeric,numeric,numeric,text) to service_role;
