-- Share links built by the database now use the canonical address
-- superherosonstandby.com (the old thesuperherosonstandby.com forwards to it).
-- Bodies are unchanged except for the domain.

CREATE OR REPLACE FUNCTION public.sos_create_mission_share(p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
 return jsonb_build_object('token',v_token,'expires_at',v_exp,'url','https://superherosonstandby.com/shared-mission.html?token='||v_token);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sos_my_rewards()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user uuid := private.sos_current_citizen(); v_ref text; v_opens int; v_signups int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'sign_in'); end if;
  select referral_code into v_ref from public.sos_users where id = v_user;
  select count(*) into v_opens from public.sos_referral_link_opens where referrer_id = v_user;
  select count(*) into v_signups from public.sos_users where referred_by = v_user and role = 'citizen';
  return jsonb_build_object('ok', true, 'referral_code', v_ref,
    'share_url', 'https://superherosonstandby.com/?ref=' || v_ref,
    'link_opens', v_opens, 'link_opens_goal', 10,
    'share_reward_earned', exists(select 1 from public.sos_customer_credits where citizen_id = v_user and source = 'referral_shares'),
    'signups', v_signups, 'signups_per_reward', 5,
    'credits', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'kind', reward_kind, 'percent_off', percent_off, 'source', source,
        'status', case when status = 'available' and expires_at is not null and expires_at < now() then 'expired' else status end,
        'expires_at', expires_at, 'created_at', created_at) order by (status = 'available') desc, created_at desc)
      from public.sos_customer_credits where citizen_id = v_user), '[]'::jsonb));
end $function$;
