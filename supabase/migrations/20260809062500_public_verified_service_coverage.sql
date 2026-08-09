create or replace function public.sos_public_service_coverage()
returns table(service_id uuid,service_name text,has_verified_supply boolean)
language sql stable security definer set search_path='pg_catalog','public','private' as $$
 select s.id,s.name,exists(
   select 1 from public.sos_heroes h
   join public.sos_users u on u.id=h.user_id
   where coalesce(h.is_demo,false)=false and coalesce(u.is_demo,false)=false
     and u.auth_id is not null and u.status='active' and h.verification_status='verified'
     and (coalesce(array_length(h.services_enabled,1),0)=0 or exists(select 1 from unnest(h.services_enabled) x where lower(trim(x))=lower(trim(s.name))))
 )
 from public.sos_subcategories s where s.is_active order by s.name
$$;
revoke all on function public.sos_public_service_coverage() from public;
grant execute on function public.sos_public_service_coverage() to anon,authenticated;
