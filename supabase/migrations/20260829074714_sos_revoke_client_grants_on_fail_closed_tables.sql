-- Phase 1 least-privilege hardening.
-- These tables are intentionally fail-closed under RLS with no client policies.
-- Remove redundant Data API grants so GRANT and RLS layers both deny direct client access.

revoke all privileges on table public.sos_disputes from anon, authenticated;
revoke all privileges on table public.sos_hero_tiers from anon, authenticated;
revoke all privileges on table public.sos_pricing_rules from anon, authenticated;
revoke all privileges on table public.sos_proof_of_service from anon, authenticated;
revoke all privileges on table public.sos_safety_events from anon, authenticated;
