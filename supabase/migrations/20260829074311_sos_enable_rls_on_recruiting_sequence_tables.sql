-- Phase 1 defense-in-depth: every S.O.S. table in the exposed public schema has RLS enabled.
-- These recruiting configuration tables are service_role-only today, so this does not expand client access.

alter table public.sos_recruiting_sequences enable row level security;
alter table public.sos_recruiting_sequence_steps enable row level security;
