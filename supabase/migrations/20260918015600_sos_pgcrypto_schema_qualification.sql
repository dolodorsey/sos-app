create or replace function public.sos_hero_bind_application(p_application_id uuid, p_tracking_token text)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $fn$
declare a public.sos_hero_applications%rowtype; token_hash text; jwt_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  token_hash:=encode(extensions.digest(coalesce(p_tracking_token,''),'sha256'),'hex');
  select * into a from public.sos_hero_applications where id=p_application_id for update;
  if not found or a.status_token_hash is distinct from token_hash then raise exception 'Application receipt not recognized' using errcode='42501'; end if;
  jwt_email:=lower(coalesce(auth.jwt()->>'email',''));
  if jwt_email='' or jwt_email<>lower(a.email) then raise exception 'Sign in with the same email used on the application' using errcode='42501'; end if;
  if a.source_auth_id is not null and a.source_auth_id<>auth.uid() then raise exception 'Application is already bound to another account' using errcode='42501'; end if;
  update public.sos_hero_applications set source_auth_id=auth.uid(),updated_at=now() where id=a.id;
  return jsonb_build_object('application_id',a.id,'bound',true,'status',a.status);
end;
$fn$;

create or replace function public.sos_create_mission_share(p_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $fn$
declare v_user uuid:=public.sos_current_user_id(); v_m public.sos_missions%rowtype; v_token text; v_hash text; v_exp timestamptz;
begin
  if (select auth.uid()) is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_m from public.sos_missions where id=p_mission_id and citizen_id=v_user;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_m.status not in ('matching','assigned','en_route','on_site','working') then raise exception 'Live tracking can only be shared for an active mission'; end if;
  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  v_exp:=least(now()+interval '12 hours',coalesce(v_m.scheduled_at,now())+interval '8 hours');
  insert into public.sos_mission_shares_v2(mission_id,citizen_id,token_hash,expires_at)
  values(v_m.id,v_user,v_hash,v_exp);
  return jsonb_build_object('token',v_token,'expires_at',v_exp,'url','https://thesuperherosonstandby.com/shared-mission.html?token='||v_token);
end;
$fn$;
