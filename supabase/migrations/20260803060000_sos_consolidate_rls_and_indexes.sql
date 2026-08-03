begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role, postgres;

create or replace function private.sos_current_user_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select u.id
  from public.sos_users u
  where u.auth_id = (select auth.uid())
  limit 1
$$;

create or replace function private.sos_current_hero_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select h.id
  from public.sos_heroes h
  join public.sos_users u on u.id = h.user_id
  where u.auth_id = (select auth.uid())
  limit 1
$$;

revoke all on function private.sos_current_user_id() from public, anon;
revoke all on function private.sos_current_hero_id() from public, anon;
grant execute on function private.sos_current_user_id() to authenticated, service_role, postgres;
grant execute on function private.sos_current_hero_id() to authenticated, service_role, postgres;

create or replace function public.sos_current_user_id()
returns uuid
language sql
stable
security invoker
set search_path to 'private', 'pg_temp'
as $$ select private.sos_current_user_id() $$;

create or replace function public.sos_current_hero_id()
returns uuid
language sql
stable
security invoker
set search_path to 'private', 'pg_temp'
as $$ select private.sos_current_hero_id() $$;

revoke all on function public.sos_current_user_id() from public, anon;
revoke all on function public.sos_current_hero_id() from public, anon;
grant execute on function public.sos_current_user_id() to authenticated, service_role, postgres;
grant execute on function public.sos_current_hero_id() to authenticated, service_role, postgres;

-- One explicit profile policy per operation. Service role bypasses RLS natively.
drop policy if exists "Service role full access users" on public.sos_users;
drop policy if exists "Authenticated read own sos_user" on public.sos_users;
drop policy if exists "Users read own profile" on public.sos_users;
drop policy if exists "Users update own profile" on public.sos_users;
create policy "SOS users read own profile"
on public.sos_users for select to authenticated
using ((select auth.uid()) = auth_id);
create policy "SOS users update own profile"
on public.sos_users for update to authenticated
using ((select auth.uid()) = auth_id)
with check ((select auth.uid()) = auth_id);
revoke all on public.sos_users from anon, authenticated;
grant select on public.sos_users to authenticated;
grant update (first_name,last_name,phone,avatar_url,city,state,updated_at)
on public.sos_users to authenticated;

-- Customers and assigned Heroes share one participant read policy.
drop policy if exists "SOS customers read own missions" on public.sos_missions;
drop policy if exists "SOS heroes read assigned missions" on public.sos_missions;
create policy "SOS mission participants read missions"
on public.sos_missions for select to authenticated
using (
  citizen_id = public.sos_current_user_id()
  or hero_id = public.sos_current_hero_id()
);

drop policy if exists "SOS customers read own payments" on public.sos_payments;
drop policy if exists "SOS heroes read own payments" on public.sos_payments;
create policy "SOS payment participants read payments"
on public.sos_payments for select to authenticated
using (
  citizen_id = public.sos_current_user_id()
  or hero_id = public.sos_current_hero_id()
);

-- Notifications are server-created; customers may only read and mark them read.
drop policy if exists "Users see own notifications" on public.sos_notifications;
drop policy if exists "Users update own notifications" on public.sos_notifications;
create policy "SOS users read own notifications"
on public.sos_notifications for select to authenticated
using (user_id = public.sos_current_user_id());
create policy "SOS users mark own notifications read"
on public.sos_notifications for update to authenticated
using (user_id = public.sos_current_user_id())
with check (user_id = public.sos_current_user_id());
revoke all on public.sos_notifications from anon, authenticated;
grant select on public.sos_notifications to authenticated;
grant update (read,read_at) on public.sos_notifications to authenticated;

-- Subscription state is payment-provider/server owned.
drop policy if exists "Users see own subscriptions" on public.sos_subscriptions;
create policy "SOS users read own subscriptions"
on public.sos_subscriptions for select to authenticated
using (user_id = public.sos_current_user_id());
revoke all on public.sos_subscriptions from anon, authenticated;
grant select on public.sos_subscriptions to authenticated;

-- Vehicle records remain customer-managed but cannot be moved to another user.
drop policy if exists "Users manage own vehicles" on public.sos_vehicles;
create policy "SOS users manage own vehicles"
on public.sos_vehicles for all to authenticated
using (user_id = public.sos_current_user_id())
with check (user_id = public.sos_current_user_id());
revoke all on public.sos_vehicles from anon, authenticated;
grant select,delete on public.sos_vehicles to authenticated;
grant insert (user_id,make,model,year,trim,color,plate,vin,is_ev,is_default,notes)
on public.sos_vehicles to authenticated;
grant update (make,model,year,trim,color,plate,vin,is_ev,is_default,notes)
on public.sos_vehicles to authenticated;
alter table public.sos_vehicles drop constraint if exists sos_vehicles_year_check;
alter table public.sos_vehicles add constraint sos_vehicles_year_check
check (year is null or year between 1900 and extract(year from current_date)::integer + 2);
alter table public.sos_vehicles drop constraint if exists sos_vehicles_text_lengths;
alter table public.sos_vehicles add constraint sos_vehicles_text_lengths check (
  char_length(make) <= 80 and char_length(model) <= 80
  and (trim is null or char_length(trim) <= 80)
  and (color is null or char_length(color) <= 50)
  and (plate is null or char_length(plate) <= 24)
  and (vin is null or char_length(vin) <= 32)
  and (notes is null or char_length(notes) <= 1000)
);

-- A rating can only be created once by a completed mission participant for
-- the counterpart on that same mission.
drop policy if exists "Users create ratings" on public.sos_ratings;
drop policy if exists "Public read ratings" on public.sos_ratings;
create policy "SOS public reads published ratings"
on public.sos_ratings for select to anon,authenticated
using (is_public = true);
create policy "SOS participants rate completed counterpart"
on public.sos_ratings for insert to authenticated
with check (
  rated_by = public.sos_current_user_id()
  and exists (
    select 1
    from public.sos_missions m
    left join public.sos_heroes h on h.id = m.hero_id
    where m.id = mission_id
      and m.status = 'completed'
      and (
        (m.citizen_id = public.sos_current_user_id() and h.user_id = rated_user)
        or
        (m.hero_id = public.sos_current_hero_id() and m.citizen_id = rated_user)
      )
  )
);
revoke all on public.sos_ratings from anon, authenticated;
grant select on public.sos_ratings to anon,authenticated;
grant insert (mission_id,rated_by,rated_user,rating,review_text,tags,is_public)
on public.sos_ratings to authenticated;
create unique index if not exists sos_ratings_mission_rater_uidx
on public.sos_ratings(mission_id,rated_by);
alter table public.sos_ratings drop constraint if exists sos_ratings_content_length;
alter table public.sos_ratings add constraint sos_ratings_content_length check (
  (review_text is null or char_length(review_text) <= 1500)
  and (tags is null or coalesce(array_length(tags,1),0) <= 12)
  and (tags is null or char_length(array_to_string(tags,',')) <= 600)
);

-- Refresh remaining ownership policies with a stable identity lookup.
drop policy if exists "sos_push_own" on public.sos_push_tokens;
create policy "SOS users manage own push tokens"
on public.sos_push_tokens for all to authenticated
using (user_id = public.sos_current_user_id())
with check (user_id = public.sos_current_user_id());

drop policy if exists "sos_fleet_acct_owner_read" on public.sos_fleet_accounts;
create policy "SOS fleet owners read own accounts"
on public.sos_fleet_accounts for select to authenticated
using (owner_id = public.sos_current_user_id());

drop policy if exists "sos_fleet_member_read" on public.sos_fleet_members;
create policy "SOS fleet members read own membership"
on public.sos_fleet_members for select to authenticated
using (user_id = public.sos_current_user_id());

drop policy if exists "sos_fleetveh_hero_read" on public.sos_fleet_vehicles;
create policy "SOS Heroes read own fleet vehicles"
on public.sos_fleet_vehicles for select to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "sos_avail_hero_read" on public.sos_hero_availability;
create policy "SOS Heroes read own availability"
on public.sos_hero_availability for select to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "sos_certs_hero_read" on public.sos_hero_certifications;
create policy "SOS Heroes read own certifications"
on public.sos_hero_certifications for select to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "sos_earnings_hero_read" on public.sos_hero_earnings;
create policy "SOS Heroes read own earnings"
on public.sos_hero_earnings for select to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "sos_equip_hero_read" on public.sos_hero_equipment;
create policy "SOS Heroes read own equipment"
on public.sos_hero_equipment for select to authenticated
using (hero_id = public.sos_current_hero_id());

drop policy if exists "sos_trip_shares_own_read" on public.sos_trip_shares;
create policy "SOS users read own trip shares"
on public.sos_trip_shares for select to authenticated
using (shared_by = public.sos_current_user_id());

-- The waitlist is not used by the current product; close the unrestricted
-- browser write surface instead of preserving a spam endpoint.
drop policy if exists "Anyone can join waitlist" on public.sos_waitlist;
drop policy if exists "Service role full access waitlist" on public.sos_waitlist;
revoke all on public.sos_waitlist from public,anon,authenticated;
grant all on public.sos_waitlist to service_role,postgres;

-- Cover all SOS foreign keys identified by the database advisor.
create index if not exists sos_disputes_opened_by_idx on public.sos_disputes(opened_by);
create index if not exists sos_disputes_resolved_by_idx on public.sos_disputes(resolved_by) where resolved_by is not null;
create index if not exists sos_fleet_accounts_owner_idx on public.sos_fleet_accounts(owner_id);
create index if not exists sos_fleet_members_fleet_idx on public.sos_fleet_members(fleet_id);
create index if not exists sos_fleet_members_user_idx on public.sos_fleet_members(user_id);
create index if not exists sos_hero_earnings_mission_idx on public.sos_hero_earnings(mission_id);
create index if not exists sos_missions_subcategory_idx on public.sos_missions(subcategory_id) where subcategory_id is not null;
create index if not exists sos_missions_vehicle_idx on public.sos_missions(vehicle_id) where vehicle_id is not null;
create index if not exists sos_pricing_rules_category_idx on public.sos_pricing_rules(category_id) where category_id is not null;
create index if not exists sos_pricing_rules_subcategory_idx on public.sos_pricing_rules(subcategory_id) where subcategory_id is not null;
create index if not exists sos_proof_of_service_hero_idx on public.sos_proof_of_service(hero_id);
create index if not exists sos_ratings_rated_by_idx on public.sos_ratings(rated_by);
create index if not exists sos_safety_events_resolved_by_idx on public.sos_safety_events(resolved_by) where resolved_by is not null;
create index if not exists sos_safety_events_triggered_by_idx on public.sos_safety_events(triggered_by);
create index if not exists sos_trip_shares_shared_by_idx on public.sos_trip_shares(shared_by);
create index if not exists sos_users_referred_by_idx on public.sos_users(referred_by) where referred_by is not null;

commit;
