begin;

-- Safe rollback: disable self-service profile edits rather than restoring
-- user-controlled role/status updates or public Hero coordinates.
revoke update on table public.sos_users from anon, authenticated;

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
  );
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

revoke all on function public.sos_find_nearby_heroes(double precision, double precision, double precision, text)
from public, anon, authenticated;
grant execute on function public.sos_find_nearby_heroes(double precision, double precision, double precision, text)
to postgres, service_role;

commit;
