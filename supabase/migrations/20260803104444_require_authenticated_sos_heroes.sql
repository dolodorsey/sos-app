update public.sos_heroes h
set on_duty=false, updated_at=now()
where h.on_duty=true
  and not exists (
    select 1 from public.sos_users u
    where u.id=h.user_id and u.auth_id is not null and u.status='active'
  );

create or replace function public.sos_find_nearby_heroes(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision default 15,
  p_subcategory text default null
)
returns table(
  hero_id uuid,user_id uuid,first_name text,last_name text,rating numeric,level text,
  distance_miles double precision,eta_minutes integer,lat double precision,lng double precision
)
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if p_lat is null or p_lat < -90 or p_lat > 90 then raise exception 'Invalid latitude'; end if;
  if p_lng is null or p_lng < -180 or p_lng > 180 then raise exception 'Invalid longitude'; end if;
  if p_radius_miles is null or p_radius_miles<=0 or p_radius_miles>50 then
    raise exception 'Radius must be greater than 0 and no more than 50 miles';
  end if;
  return query
  select h.id,h.user_id,u.first_name,u.last_name,h.rating,h.level,
    round((public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))/1609.34)::numeric,1)::double precision,
    ceil((public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))/1609.34)*3)::integer,
    h.last_lat,h.last_lng
  from public.sos_heroes h
  join public.sos_users u on h.user_id=u.id
  where h.on_duty=true
    and h.verification_status='verified'
    and u.status='active'
    and u.auth_id is not null
    and h.last_lat is not null and h.last_lng is not null
    and h.last_gps_at>=now()-interval '15 minutes'
    and public.st_distancesphere(public.st_makepoint(h.last_lng,h.last_lat),public.st_makepoint(p_lng,p_lat))<=p_radius_miles*1609.34
    and (p_subcategory is null or p_subcategory=any(h.services_enabled))
  order by distance_miles asc
  limit 10;
end;
$$;

revoke all on function public.sos_find_nearby_heroes(double precision,double precision,double precision,text) from public,anon,authenticated;
grant execute on function public.sos_find_nearby_heroes(double precision,double precision,double precision,text) to service_role,postgres;
