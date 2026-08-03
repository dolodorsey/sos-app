begin;

create or replace function private.sos_can_rate_counterpart(
  p_mission_id uuid,
  p_rated_user uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
  select exists (
    select 1
    from public.sos_missions m
    left join public.sos_heroes h on h.id = m.hero_id
    where m.id = p_mission_id
      and m.status = 'completed'
      and (
        (m.citizen_id = private.sos_current_user_id() and h.user_id = p_rated_user)
        or
        (m.hero_id = private.sos_current_hero_id() and m.citizen_id = p_rated_user)
      )
  )
$$;

revoke all on function private.sos_can_rate_counterpart(uuid,uuid) from public,anon;
grant execute on function private.sos_can_rate_counterpart(uuid,uuid)
to authenticated,service_role,postgres;

drop policy if exists "SOS participants rate completed counterpart" on public.sos_ratings;
create policy "SOS participants rate completed counterpart"
on public.sos_ratings for insert to authenticated
with check (
  rated_by = public.sos_current_user_id()
  and private.sos_can_rate_counterpart(mission_id,rated_user)
);

create or replace function public.sos_update_hero_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hero_id uuid;
begin
  select h.id into v_hero_id
  from public.sos_heroes h
  where h.user_id = new.rated_user
  limit 1;

  if v_hero_id is null then
    return new;
  end if;

  update public.sos_heroes h
  set rating = coalesce((
        select round(avg(r.rating)::numeric,1)
        from public.sos_ratings r
        where r.rated_user = new.rated_user
      ), h.rating),
      total_missions = (
        select count(*)
        from public.sos_missions m
        where m.hero_id = v_hero_id and m.status = 'completed'
      ),
      updated_at = now()
  where h.id = v_hero_id;

  return new;
end;
$$;

revoke all on function public.sos_update_hero_rating() from public,anon,authenticated;
grant execute on function public.sos_update_hero_rating() to service_role,postgres;

commit;
