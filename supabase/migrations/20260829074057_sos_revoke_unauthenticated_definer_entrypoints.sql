-- Phase 1 institutional hardening: authenticated-only S.O.S. RPCs must not inherit PUBLIC/anon EXECUTE.
-- Authenticated and service_role grants remain intact; ownership/operator checks stay enforced in each function.

revoke execute on function public.sos_hero_application_document_status(uuid) from public, anon;
revoke execute on function public.sos_hero_application_notifications(uuid) from public, anon;
revoke execute on function public.sos_hero_bind_application(uuid, text) from public, anon;
revoke execute on function public.sos_hero_submit_application_document(uuid, text, text) from public, anon;
revoke execute on function public.sos_ops_hero_application_documents(uuid) from public, anon;
revoke execute on function public.sos_ops_review_hero_application_document(uuid, text, text) from public, anon;

-- Pin the helper search_path to remove mutable-search-path risk.
alter function private.sos_hero_application_notification_copy(text)
  set search_path to pg_catalog, private;
