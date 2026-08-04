-- Targeted SOS performance fixes from the Supabase advisor.

create index if not exists sos_recruiting_candidates_source_user_idx
  on public.sos_recruiting_candidates(source_user_id);

create index if not exists sos_hero_shift_sessions_zone_idx
  on public.sos_hero_shift_sessions(zone_id);

-- Evaluate auth.uid() once per statement rather than once for every candidate row.
drop policy if exists sos_hero_shift_own_read on public.sos_hero_shift_sessions;
create policy sos_hero_shift_own_read on public.sos_hero_shift_sessions
for select to authenticated
using (
  hero_id in (
    select h.id
    from public.sos_heroes h
    join public.sos_users u on u.id=h.user_id
    where u.auth_id=(select auth.uid())
  )
);
