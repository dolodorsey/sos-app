-- S.O.S.-only CRM privilege hardening.
--
-- The CRM onboarding bridge is written by the protected auth.users trigger and
-- processed by trusted server-side workers. Browser roles do not need direct
-- access to either control-plane table. Keep service_role/owner privileges
-- untouched and preserve all existing rows.

alter table public.sos_crm_links enable row level security;
alter table public.sos_crm_outbox enable row level security;

revoke all privileges on table public.sos_crm_links from anon, authenticated;
revoke all privileges on table public.sos_crm_outbox from anon, authenticated;

comment on table public.sos_crm_links is
  'S.O.S. internal CRM identity bridge. Direct anon/authenticated access is intentionally revoked; writes occur through trusted S.O.S. server/trigger paths.';

comment on table public.sos_crm_outbox is
  'S.O.S. internal CRM delivery outbox. Direct anon/authenticated access is intentionally revoked; processing occurs through trusted S.O.S. server workers.';
