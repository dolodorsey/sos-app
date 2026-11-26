-- S.O.S. permission rules (31 policies) call public.sos_current_hero_id() and
-- public.sos_current_user_id(), which delegate to private.* helpers. Since the
-- 2026-08-09 namespace hardening, signed-in users have no USAGE on schema private,
-- so every one of those rules failed with "permission denied for schema private":
-- Heroes could not see offers and customers could not see their own requests.
-- Found by the Nov 26 end-to-end rescue test (Battery Jump, test customer + test Hero).
-- Run the two public wrappers with the owner's rights instead of re-opening the
-- private schema. Each still returns only the caller's own id (from auth.uid()).
ALTER FUNCTION public.sos_current_hero_id() SECURITY DEFINER;
ALTER FUNCTION public.sos_current_user_id() SECURITY DEFINER;
ALTER FUNCTION public.sos_current_hero_id() SET search_path = private, pg_temp;
ALTER FUNCTION public.sos_current_user_id() SET search_path = private, pg_temp;
REVOKE ALL ON FUNCTION public.sos_current_hero_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sos_current_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sos_current_hero_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sos_current_user_id() TO authenticated, service_role;
