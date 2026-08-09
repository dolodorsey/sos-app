create or replace function public.sos_handle_new_user()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public'
as $function$
declare v_candidate public.sos_recruiting_candidates%rowtype; v_target_user uuid;
begin
  if coalesce(new.raw_user_meta_data->>'app','')='on_call' then return new; end if;
  if coalesce(new.raw_user_meta_data->>'app','')='sos_hero_claim' then
    select c.* into v_candidate from public.sos_recruiting_candidates c join public.sos_users u on u.id=c.source_user_id
    where lower(coalesce(c.email,u.email,''))=lower(coalesce(new.email,'')) and c.pipeline_stage in ('qualified','contacted','screening','training','account_setup','test_mission','approved')
    order by c.priority_score desc,c.created_at limit 1 for update;
    if found then
      select u.id into v_target_user from public.sos_users u where u.id=v_candidate.source_user_id and (u.auth_id is null or u.auth_id=new.id) for update;
      if v_target_user is not null then
        update public.sos_users set auth_id=new.id,email=coalesce(new.email,email),role='hero',status='active',updated_at=now() where id=v_target_user;
        update public.sos_recruiting_candidates set pipeline_stage=case when pipeline_stage='approved' then 'approved' else 'account_setup' end,outreach_status='responded',last_outcome='responded',last_attempt_at=now(),updated_at=now() where id=v_candidate.id;
        return new;
      end if;
    end if;
  end if;
  insert into public.sos_users(auth_id,email,role,referral_code) values(new.id,new.email,'citizen',lower(substring(md5(new.id::text) from 1 for 8))) on conflict(auth_id) do update set email=excluded.email,updated_at=now();
  return new;
exception when others then
  raise warning 'sos_handle_new_user profile creation failed for auth user %: % [%]',new.id,sqlerrm,sqlstate;
  return new;
end;$function$;

create or replace function public.sos_hero_claim_status()
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','auth'
as $function$
declare v_auth uuid:=auth.uid(); v_email text; v_profile public.sos_users%rowtype; v_candidate public.sos_recruiting_candidates%rowtype; v_hero public.sos_heroes%rowtype;
begin
  if v_auth is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select email into v_email from auth.users where id=v_auth;
  select * into v_profile from public.sos_users where auth_id=v_auth limit 1;
  if found and v_profile.role='hero' then
    select * into v_hero from public.sos_heroes where user_id=v_profile.id limit 1;
    return jsonb_build_object('state','hero','email',v_email,'hero_id',v_hero.id,'verification_status',v_hero.verification_status,'dispatch_eligible',v_hero.verification_status='verified' and v_profile.status='active');
  end if;
  select c.* into v_candidate from public.sos_recruiting_candidates c join public.sos_users u on u.id=c.source_user_id
  where lower(coalesce(c.email,u.email,''))=lower(coalesce(v_email,'')) and c.pipeline_stage in ('qualified','contacted','screening','training','account_setup','test_mission','approved') order by c.priority_score desc,c.created_at limit 1;
  if not found then return jsonb_build_object('state','not_eligible','email',v_email); end if;
  select * into v_hero from public.sos_heroes where id=v_candidate.source_hero_id limit 1;
  return jsonb_build_object('state','eligible','email',v_email,'candidate_id',v_candidate.id,'pipeline_stage',v_candidate.pipeline_stage,'hero_id',v_hero.id,'verification_status',v_hero.verification_status,'dispatch_eligible_after_claim',v_hero.verification_status='verified');
end;$function$;

create or replace function public.sos_claim_qualified_hero_profile()
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','auth'
as $function$
declare v_auth uuid:=auth.uid(); v_email text; v_current public.sos_users%rowtype; v_candidate public.sos_recruiting_candidates%rowtype; v_target public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_has_activity boolean:=false;
begin
  if v_auth is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select email into v_email from auth.users where id=v_auth; if coalesce(v_email,'')='' then raise exception 'Verified email is required'; end if;
  select c.* into v_candidate from public.sos_recruiting_candidates c join public.sos_users u on u.id=c.source_user_id
  where lower(coalesce(c.email,u.email,''))=lower(v_email) and c.pipeline_stage in ('qualified','contacted','screening','training','account_setup','test_mission','approved') order by c.priority_score desc,c.created_at limit 1 for update of c;
  if not found then raise exception 'No qualified S.O.S. Hero candidate matches this email' using errcode='42501'; end if;
  select * into v_target from public.sos_users where id=v_candidate.source_user_id for update; if v_target.auth_id is not null and v_target.auth_id<>v_auth then raise exception 'This Hero profile is already claimed' using errcode='42501'; end if;
  select * into v_hero from public.sos_heroes where id=v_candidate.source_hero_id and user_id=v_target.id for update; if not found then raise exception 'Hero candidate record is incomplete'; end if;
  select * into v_current from public.sos_users where auth_id=v_auth limit 1 for update;
  if found and v_current.id<>v_target.id then
    select exists(select 1 from public.sos_missions where citizen_id=v_current.id) or exists(select 1 from public.sos_payments where citizen_id=v_current.id) or exists(select 1 from public.sos_subscriptions where user_id=v_current.id) or exists(select 1 from public.sos_vehicles where user_id=v_current.id) or exists(select 1 from public.sos_support_tickets where user_id=v_current.id) or exists(select 1 from public.sos_disputes where opened_by=v_current.id) into v_has_activity;
    if v_has_activity then raise exception 'This authenticated account already has citizen activity. Contact S.O.S. operations to merge it safely.' using errcode='40900'; end if;
    update public.sos_users set auth_id=null,status='deactivated',updated_at=now() where id=v_current.id;
  end if;
  update public.sos_users set auth_id=v_auth,email=v_email,role='hero',status='active',updated_at=now() where id=v_target.id;
  update public.sos_recruiting_candidates set pipeline_stage=case when pipeline_stage='approved' then 'approved' else 'account_setup' end,outreach_status='responded',last_outcome='responded',last_attempt_at=now(),updated_at=now() where id=v_candidate.id;
  return jsonb_build_object('claimed',true,'hero_id',v_hero.id,'verification_status',v_hero.verification_status,'dispatch_eligible',v_hero.verification_status='verified','message',case when v_hero.verification_status='verified' then 'Hero profile claimed. Complete payout setup and go on duty when ready.' else 'Hero profile claimed. Verification is still pending before dispatch can activate.' end);
end;$function$;

revoke all on function public.sos_hero_claim_status() from public,anon;
revoke all on function public.sos_claim_qualified_hero_profile() from public,anon;
grant execute on function public.sos_hero_claim_status() to authenticated;
grant execute on function public.sos_claim_qualified_hero_profile() to authenticated;