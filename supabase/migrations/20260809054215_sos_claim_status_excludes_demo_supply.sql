create or replace function public.sos_hero_claim_status()
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','auth' as $$
declare v_auth uuid:=auth.uid(); v_email text; v_profile public.sos_users%rowtype; v_candidate public.sos_recruiting_candidates%rowtype; v_hero public.sos_heroes%rowtype;
begin
  if v_auth is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select email into v_email from auth.users where id=v_auth;
  if lower(coalesce(v_email,'')) like '%@sos-demo.atl' then return jsonb_build_object('state','not_eligible','email',v_email); end if;
  select * into v_profile from public.sos_users where auth_id=v_auth and coalesce(is_demo,false)=false limit 1;
  if found and v_profile.role='hero' then
    select * into v_hero from public.sos_heroes where user_id=v_profile.id and coalesce(is_demo,false)=false limit 1;
    if found then return jsonb_build_object('state','hero','email',v_email,'hero_id',v_hero.id,'verification_status',v_hero.verification_status,'dispatch_eligible',v_hero.verification_status='verified' and v_profile.status='active'); end if;
  end if;
  select c.* into v_candidate
  from public.sos_recruiting_candidates c
  join public.sos_users u on u.id=c.source_user_id
  join public.sos_heroes h on h.id=c.source_hero_id and h.user_id=u.id
  where lower(coalesce(c.email,u.email,''))=lower(coalesce(v_email,''))
    and coalesce(c.is_demo,false)=false and coalesce(u.is_demo,false)=false and coalesce(h.is_demo,false)=false
    and c.pipeline_stage in ('qualified','contacted','screening','training','account_setup','test_mission','approved')
  order by c.priority_score desc,c.created_at limit 1;
  if not found then return jsonb_build_object('state','not_eligible','email',v_email); end if;
  select * into v_hero from public.sos_heroes where id=v_candidate.source_hero_id and coalesce(is_demo,false)=false limit 1;
  return jsonb_build_object('state','eligible','email',v_email,'candidate_id',v_candidate.id,'pipeline_stage',v_candidate.pipeline_stage,'hero_id',v_hero.id,'verification_status',v_hero.verification_status,'dispatch_eligible_after_claim',v_hero.verification_status='verified');
end;$$;
