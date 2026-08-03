begin;

alter table public.sos_users
  add column if not exists deleted_at timestamp with time zone;

create or replace function public.sos_anonymize_account(p_auth_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id uuid;
  v_hero_id uuid;
  v_email text;
  v_mission_count integer := 0;
  v_deleted_personal_rows integer := 0;
  v_updated_rows integer := 0;
begin
  select id,email into v_user_id,v_email
  from public.sos_users
  where auth_id=p_auth_id
  for update;

  if v_user_id is null then
    return jsonb_build_object('ok',true,'found',false,'auth_id',p_auth_id);
  end if;

  select id into v_hero_id from public.sos_heroes where user_id=v_user_id for update;

  update public.sos_missions
  set status=case
        when status in ('completed','canceled_by_citizen','canceled_by_hero','canceled_by_system','disputed') then status
        else 'canceled_by_system'
      end,
      canceled_at=case
        when status in ('completed','canceled_by_citizen','canceled_by_hero','canceled_by_system','disputed') then canceled_at
        else coalesce(canceled_at,now())
      end,
      cancel_reason=case
        when status in ('completed','canceled_by_citizen','canceled_by_hero','canceled_by_system','disputed') then cancel_reason
        else 'account_deleted'
      end,
      pickup_lat=null,pickup_lng=null,pickup_address=null,
      dropoff_lat=null,dropoff_lng=null,dropoff_address=null,
      citizen_notes=null,citizen_photos=null,
      intake_payload='{}'::jsonb,
      updated_at=now()
  where citizen_id=v_user_id or (v_hero_id is not null and hero_id=v_hero_id);
  get diagnostics v_mission_count=row_count;

  update public.sos_mission_events e
  set lat=null,lng=null,payload='{}'::jsonb
  where exists(
    select 1 from public.sos_missions m
    where m.id=e.mission_id
      and (m.citizen_id=v_user_id or (v_hero_id is not null and m.hero_id=v_hero_id))
  );

  update public.sos_proof_of_service p
  set submitted_items='{}'::jsonb,media_urls=null,notes=null,lat=null,lng=null
  where (v_hero_id is not null and p.hero_id=v_hero_id)
     or exists(select 1 from public.sos_missions m where m.id=p.mission_id and m.citizen_id=v_user_id);

  update public.sos_disputes d
  set description=null,evidence_urls=null,
      resolution=case when d.status='open' then coalesce(d.resolution,'Account holder deleted their profile; preserve financial review only.') else d.resolution end,
      updated_at=now()
  where d.opened_by=v_user_id or d.resolved_by=v_user_id
     or exists(select 1 from public.sos_missions m where m.id=d.mission_id and (m.citizen_id=v_user_id or (v_hero_id is not null and m.hero_id=v_hero_id)));

  update public.sos_safety_events s
  set lat=null,lng=null,notes=null,contacts_notified=null
  where s.triggered_by=v_user_id or s.resolved_by=v_user_id
     or exists(select 1 from public.sos_missions m where m.id=s.mission_id and (m.citizen_id=v_user_id or (v_hero_id is not null and m.hero_id=v_hero_id)));

  update public.sos_ratings
  set review_text=null,tags=null,is_public=false
  where rated_by=v_user_id or rated_user=v_user_id;

  delete from public.sos_trip_shares where shared_by=v_user_id;
  get diagnostics v_deleted_personal_rows=row_count;
  delete from public.sos_notifications where user_id=v_user_id;
  delete from public.sos_push_tokens where user_id=v_user_id;
  delete from public.sos_vehicles where user_id=v_user_id;
  delete from public.sos_fleet_members where user_id=v_user_id;
  delete from public.sos_provider_applications where v_email is not null and lower(email)=lower(v_email);
  delete from public.sos_waitlist where v_email is not null and lower(email)=lower(v_email);
  delete from public.bookings where customer_id=p_auth_id;

  update public.sos_subscriptions
  set status='canceled',stripe_subscription_id=null,stripe_price_id=null,
      canceled_at=coalesce(canceled_at,now()),updated_at=now()
  where user_id=v_user_id;

  update public.sos_fleet_accounts
  set company_name='Deleted account',stripe_subscription_id=null,status='inactive'
  where owner_id=v_user_id;

  if v_hero_id is not null then
    delete from public.sos_fleet_vehicles where hero_id=v_hero_id;
    update public.sos_heroes
    set on_duty=false,zone=null,last_lat=null,last_lng=null,last_gps_at=null,
        services_enabled='{}'::text[],tools_available='{}'::text[],
        vehicle_type=null,vehicle_make=null,vehicle_model=null,vehicle_year=null,vehicle_plate=null,
        stripe_connect_id=null,badges='{}'::text[],verification_status='rejected',updated_at=now()
    where id=v_hero_id;
  end if;

  update public.sos_users
  set auth_id=null,first_name=null,last_name=null,phone=null,email=null,avatar_url=null,
      status='deactivated',stripe_customer_id=null,referral_code='deleted_'||replace(id::text,'-',''),
      referred_by=null,city=null,state=null,deleted_at=now(),updated_at=now()
  where id=v_user_id;
  get diagnostics v_updated_rows=row_count;

  return jsonb_build_object(
    'ok',true,'found',true,'sos_user_id',v_user_id,'hero_id',v_hero_id,
    'missions_anonymized',v_mission_count,
    'personal_records_deleted',v_deleted_personal_rows,
    'profile_anonymized',v_updated_rows=1
  );
end;
$$;

revoke all on function public.sos_anonymize_account(uuid) from public,anon,authenticated;
grant execute on function public.sos_anonymize_account(uuid) to service_role,postgres;
comment on function public.sos_anonymize_account(uuid) is
'Server-only S.O.S. account erasure: removes personal data, deactivates active work, and retains anonymized transaction/audit tombstones required for financial and safety integrity.';

commit;
