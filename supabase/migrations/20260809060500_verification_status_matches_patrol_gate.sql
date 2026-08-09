create or replace function private.sos_recompute_hero_verification(p_hero_id uuid)
returns void language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_identity text; v_background text; v_license text; v_insurance text; v_test text; v_overall text;
begin
 select max(status) filter(where check_type='identity'),max(status) filter(where check_type='background'),max(status) filter(where check_type='license'),max(status) filter(where check_type='insurance'),max(status) filter(where check_type='test_mission') into v_identity,v_background,v_license,v_insurance,v_test from public.sos_hero_verification_checks where hero_id=p_hero_id;
 if exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status='failed') then v_overall:='rejected';
 elsif not exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status<>'passed') then v_overall:='verified';
 elsif exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status='under_review') then v_overall:='under_review';
 elsif exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status='submitted') then v_overall:='documents_submitted';
 else v_overall:='pending'; end if;
 update public.sos_heroes set id_verified=coalesce(v_identity='passed',false),background_cleared=coalesce(v_background='passed',false),license_verified=coalesce(v_license='passed',false),insurance_verified=coalesce(v_insurance='passed',false),test_mission_passed=coalesce(v_test='passed',false),verification_status=v_overall,updated_at=now() where id=p_hero_id;
end;$$;

create or replace function public.sos_hero_verification_status()
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare v_user public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_checks jsonb:='[]'::jsonb; v_passed integer:=0; v_required integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.sos_users where auth_id=auth.uid() and role='hero' and status='active' and coalesce(is_demo,false)=false limit 1;
 if not found then return jsonb_build_object('state','not_hero'); end if;
 select * into v_hero from public.sos_heroes where user_id=v_user.id and coalesce(is_demo,false)=false limit 1; if not found then return jsonb_build_object('state','not_hero'); end if;
 perform private.sos_initialize_hero_verification(v_hero.id);
 select coalesce(jsonb_agg(jsonb_build_object('check_type',v.check_type,'required',v.required,'status',v.status,'notes',v.notes,'reviewed_at',v.reviewed_at) order by case v.check_type when 'identity' then 1 when 'background' then 2 when 'license' then 3 when 'insurance' then 4 when 'equipment' then 5 when 'vehicle' then 6 when 'service_skills' then 7 when 'test_mission' then 8 when 'payout_account' then 9 else 10 end),'[]'::jsonb),count(*) filter(where required),count(*) filter(where required and status='passed') into v_checks,v_required,v_passed from public.sos_hero_verification_checks v where v.hero_id=v_hero.id;
 return jsonb_build_object('state','hero','hero_id',v_hero.id,'verification_status',v_hero.verification_status,'on_duty',v_hero.on_duty,'required_checks',v_required,'passed_checks',v_passed,'dispatch_ready',v_hero.verification_status='verified' and v_passed=v_required,'checks',v_checks);
end;$$;
revoke all on function public.sos_hero_verification_status() from public,anon; grant execute on function public.sos_hero_verification_status() to authenticated;

create or replace function public.sos_recompute_hero_verification_admin(p_hero_id uuid)
returns void language plpgsql security definer set search_path='pg_catalog','public','private' as $$begin if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if; perform private.sos_recompute_hero_verification(p_hero_id); end;$$;
revoke all on function public.sos_recompute_hero_verification_admin(uuid) from public,anon,authenticated; grant execute on function public.sos_recompute_hero_verification_admin(uuid) to service_role;
