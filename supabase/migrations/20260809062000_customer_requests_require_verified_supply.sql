create or replace function private.sos_customer_request_supply_guard()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_citizen_id uuid;
begin
 if auth.uid() is null then return new; end if;
 select id into v_citizen_id from public.sos_users where auth_id=auth.uid() and role='citizen' and status='active' and coalesce(is_demo,false)=false limit 1;
 if v_citizen_id is null or new.citizen_id is distinct from v_citizen_id then return new; end if;
 if not exists(
   select 1 from public.sos_heroes h
   join public.sos_users u on u.id=h.user_id
   where coalesce(h.is_demo,false)=false and coalesce(u.is_demo,false)=false
     and u.auth_id is not null and u.status='active' and h.verification_status='verified'
     and (
       coalesce(array_length(h.services_enabled,1),0)=0
       or exists(select 1 from unnest(h.services_enabled) service where lower(trim(service))=lower(trim(coalesce(new.requested_service_name,''))))
     )
 ) then
   raise exception 'S.O.S. verified Hero coverage is not active for this service yet. No mission was created.' using errcode='P0001';
 end if;
 return new;
end;$$;
revoke all on function private.sos_customer_request_supply_guard() from public,anon,authenticated;
drop trigger if exists sos_customer_request_requires_verified_supply on public.sos_missions;
create trigger sos_customer_request_requires_verified_supply before insert on public.sos_missions for each row execute function private.sos_customer_request_supply_guard();
