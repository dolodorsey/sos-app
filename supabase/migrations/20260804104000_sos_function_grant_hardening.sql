-- Tighten execution grants without changing the functions' validated business logic.

-- Server-only dispatch and stale-presence maintenance.
revoke all on function public.sos_auto_dispatch_customer_mission(
  uuid,uuid,integer,double precision,integer
) from public,anon,authenticated;
grant execute on function public.sos_auto_dispatch_customer_mission(
  uuid,uuid,integer,double precision,integer
) to service_role;

revoke all on function public.sos_expire_stale_presence(integer)
  from public,anon,authenticated;
grant execute on function public.sos_expire_stale_presence(integer)
  to service_role;

-- Signed-in citizen mission intake.
revoke all on function public.sos_request_customer_mission(
  text,double precision,double precision,text,text,text
) from public,anon,authenticated;
grant execute on function public.sos_request_customer_mission(
  text,double precision,double precision,text,text,text
) to authenticated,service_role;

-- Signed-in, verified Hero presence updates.
revoke all on function public.sos_set_hero_presence(
  boolean,double precision,double precision,uuid,text
) from public,anon,authenticated;
grant execute on function public.sos_set_hero_presence(
  boolean,double precision,double precision,uuid,text
) to authenticated,service_role;
