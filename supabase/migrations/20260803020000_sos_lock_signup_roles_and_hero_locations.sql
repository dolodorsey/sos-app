begin;

create or replace function public.sos_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.sos_users (auth_id, email, role, referral_code)
  values (
    new.id,
    new.email,
    'citizen',
    lower(substring(md5(new.id::text) from 1 for 8))
  )
  on conflict (auth_id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
exception when others then
  raise warning 'sos_handle_new_user profile creation failed for auth user %: % [%]', new.id, sqlerrm, sqlstate;
  return new;
end;
$$;

revoke all on function public.sos_handle_new_user()
from public, anon, authenticated;
grant execute on function public.sos_handle_new_user()
to postgres, service_role, supabase_auth_admin;

comment on function public.sos_handle_new_user() is
'Creates a citizen profile for new S.O.S. auth users. It ignores user-editable role metadata and does not alter email confirmation.';

revoke all on function public.sos_find_nearby_heroes(double precision, double precision, double precision, text)
from public, anon, authenticated;
grant execute on function public.sos_find_nearby_heroes(double precision, double precision, double precision, text)
to postgres, service_role;

comment on function public.sos_find_nearby_heroes(double precision, double precision, double precision, text) is
'Server-only dispatch candidate lookup. Exact Hero coordinates must never be exposed to anonymous or ordinary authenticated clients.';

revoke update on table public.sos_users from anon, authenticated;
grant update (first_name, last_name, phone, avatar_url, city, state, updated_at)
on public.sos_users to authenticated;

commit;
