-- Rollback for 20261008030000_sos_prelaunch_marketplace_gate.sql
-- Preferred reopen (keeps audit + QA grants):  update private.sos_prelaunch_state
--   set prelaunch_enabled=false, reason='<why>', changed_by='<who>', changed_at=now() where id;
-- Full removal:
drop trigger if exists sos_prelaunch_guard on public.sos_missions;
drop trigger if exists sos_prelaunch_guard on public.sos_payments;
drop trigger if exists sos_prelaunch_guard on public.sos_subscriptions;
drop trigger if exists sos_prelaunch_guard on public.sos_mission_offers;
drop trigger if exists sos_prelaunch_guard on public.sos_heroes;
drop trigger if exists sos_prelaunch_guard on public.sos_hero_shift_sessions;
drop trigger if exists sos_prelaunch_guard on public.sos_hero_applications;
drop function if exists public.sos_prelaunch_access_status();
drop function if exists public.sos_prelaunch_public_state();
drop function if exists private.sos_prelaunch_guard();
drop function if exists private.sos_prelaunch_allows(uuid);
drop function if exists private.sos_prelaunch_access_role(uuid);
drop function if exists private.sos_prelaunch_enabled();
-- Audit/config tables are kept intentionally; drop manually only if certain:
-- drop table private.sos_prelaunch_denials, private.sos_prelaunch_application_invites, private.sos_prelaunch_access, private.sos_prelaunch_state;
