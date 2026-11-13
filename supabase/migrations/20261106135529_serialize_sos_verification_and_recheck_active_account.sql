-- Pending independent review; functions only, no backfill or live invocation.
-- Pending independent review. No existing Hero rows are recomputed by this migration.
CREATE OR REPLACE FUNCTION private.sos_recompute_hero_verification(p_hero_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_identity text; v_background text; v_license text; v_insurance text; v_test text; v_overall text;
begin
 perform 1 from public.sos_heroes where id=p_hero_id for update;
 select max(status) filter(where check_type='identity'),max(status) filter(where check_type='background'),max(status) filter(where check_type='license'),max(status) filter(where check_type='insurance'),max(status) filter(where check_type='test_mission')
 into v_identity,v_background,v_license,v_insurance,v_test from public.sos_hero_verification_checks where hero_id=p_hero_id;
 if exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status='failed') then v_overall:='rejected';
 elsif not exists(
   select 1 from unnest(array['identity','background','license','insurance','equipment','vehicle','service_skills','test_mission','payout_account']) expected(check_type)
   where not exists(select 1 from public.sos_hero_verification_checks v where v.hero_id=p_hero_id and v.check_type=expected.check_type and v.required and v.status='passed')
 ) and not exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status<>'passed') then v_overall:='verified';
 elsif exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status='under_review') then v_overall:='under_review';
 elsif exists(select 1 from public.sos_hero_verification_checks where hero_id=p_hero_id and required and status='submitted') then v_overall:='documents_submitted';
 else v_overall:='pending'; end if;
 update public.sos_heroes set id_verified=coalesce(v_identity='passed',false),background_cleared=coalesce(v_background='passed',false),license_verified=coalesce(v_license='passed',false),insurance_verified=coalesce(v_insurance='passed',false),test_mission_passed=coalesce(v_test='passed',false),verification_status=v_overall,updated_at=now() where id=p_hero_id;
end;$function$;
CREATE OR REPLACE FUNCTION public.sos_ops_review_verification_check(p_hero_id uuid, p_check_type text, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS sos_hero_verification_checks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_row public.sos_hero_verification_checks%rowtype; v_email text;
begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_status not in ('pending','submitted','under_review','passed','failed','expired','waived') then raise exception 'Invalid verification status'; end if;
 perform 1 from public.sos_heroes where id=p_hero_id for update;
 select * into v_row from public.sos_hero_verification_checks where hero_id=p_hero_id and check_type=p_check_type; if not found then raise exception 'Verification check not found' using errcode='P0002'; end if;
 if p_check_type='payout_account' then raise exception 'Payout verification is synchronized from Stripe and cannot be manually approved'; end if;
 if p_status='waived' and v_row.required then raise exception 'Required Hero verification cannot be waived'; end if;
 select email into v_email from private.marketplace_operators where auth_id=auth.uid() and is_active limit 1;
 update public.sos_hero_verification_checks set status=p_status,notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),reviewed_by=v_email,reviewed_at=case when p_status in ('passed','failed','expired','waived') then now() else reviewed_at end,updated_at=now() where hero_id=p_hero_id and check_type=p_check_type returning * into v_row;
 perform private.sos_recompute_hero_verification(p_hero_id);
 return v_row;
end;$function$;

CREATE OR REPLACE FUNCTION public.sos_hero_submit_verification_evidence(p_check_type text, p_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'storage'
AS $function$
declare v_user public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_check public.sos_hero_verification_checks%rowtype; v_prefix text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.sos_users where auth_id=auth.uid() and role='hero' and status='active' and coalesce(is_demo,false)=false limit 1; if not found then raise exception 'Active real Hero account required' using errcode='42501'; end if;
 select * into v_hero from public.sos_heroes where user_id=v_user.id and coalesce(is_demo,false)=false limit 1 for update; if not found then raise exception 'Hero profile not found'; end if;
 if p_check_type='payout_account' then raise exception 'Payout evidence is synchronized from Stripe'; end if;
 select * into v_check from public.sos_hero_verification_checks where hero_id=v_hero.id and check_type=p_check_type; if not found then raise exception 'Verification check not found'; end if;
 v_prefix:='sos/'||auth.uid()::text||'/'||v_hero.id::text||'/'||p_check_type||'/';
 if p_path is null or p_path not like v_prefix||'%' or position('..' in p_path)>0 then raise exception 'Invalid verification evidence path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='marketplace-verification' and name=p_path) then raise exception 'Uploaded verification file not found'; end if;
 update public.sos_hero_verification_checks set evidence_urls=case when p_path=any(evidence_urls) then evidence_urls else array_append(evidence_urls,p_path) end,status=case when status='passed' then status else 'submitted' end,updated_at=now() where hero_id=v_hero.id and check_type=p_check_type;
 perform private.sos_recompute_hero_verification(v_hero.id);
 return jsonb_build_object('hero_id',v_hero.id,'check_type',p_check_type,'status',case when v_check.status='passed' then 'passed' else 'submitted' end,'path',p_path);
end;$function$;

CREATE OR REPLACE FUNCTION private.sos_initialize_hero_verification(p_hero_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_payout text:='pending';
begin
 perform 1 from public.sos_heroes where id=p_hero_id for update;
 if not found then return; end if;
 -- Recheck account eligibility after any wait, without reversing user/Hero lock order.
 if not exists(select 1 from public.sos_heroes h join public.sos_users u on u.id=h.user_id
   where h.id=p_hero_id and coalesce(h.is_demo,false)=false and coalesce(u.is_demo,false)=false
     and u.role='hero' and u.status='active' and u.auth_id is not null) then return; end if;
  if exists(select 1 from public.sos_heroes h join public.sos_users u on u.id=h.user_id where h.id=p_hero_id and (coalesce(h.is_demo,false) or coalesce(u.is_demo,false))) then return; end if;
  select case when stripe_transfer_status='active' then 'passed' when stripe_connect_id is not null then 'submitted' else 'pending' end into v_payout from public.sos_heroes where id=p_hero_id;
  insert into public.sos_hero_verification_checks(hero_id,check_type,required,status) values
    (p_hero_id,'identity',true,'pending'),(p_hero_id,'background',true,'pending'),(p_hero_id,'license',true,'pending'),(p_hero_id,'insurance',true,'pending'),
    (p_hero_id,'equipment',true,'pending'),(p_hero_id,'vehicle',true,'pending'),(p_hero_id,'service_skills',true,'pending'),(p_hero_id,'test_mission',true,'pending'),
    (p_hero_id,'payout_account',true,coalesce(v_payout,'pending'))
  on conflict(hero_id,check_type) do nothing;
end;$function$;

CREATE OR REPLACE FUNCTION public.sos_hero_verification_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_checks jsonb:='[]'::jsonb; v_passed integer:=0; v_required integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.sos_users where auth_id=auth.uid() and role='hero' and status='active' and coalesce(is_demo,false)=false limit 1;
 if not found then return jsonb_build_object('state','not_hero'); end if;
 select * into v_hero from public.sos_heroes where user_id=v_user.id and coalesce(is_demo,false)=false limit 1; if not found then return jsonb_build_object('state','not_hero'); end if;
 perform private.sos_initialize_hero_verification(v_hero.id);
 -- The initializer holds the Hero lock; deletion may have committed while we waited.
 select * into v_user from public.sos_users where id=v_user.id and auth_id=auth.uid()
   and role='hero' and status='active' and coalesce(is_demo,false)=false;
 if not found then return jsonb_build_object('state','not_hero'); end if;
 select * into v_hero from public.sos_heroes where id=v_hero.id;
 select coalesce(jsonb_agg(jsonb_build_object('check_type',v.check_type,'required',v.required,'status',v.status,'notes',v.notes,'reviewed_at',v.reviewed_at,'evidence_urls',v.evidence_urls) order by case v.check_type when 'identity' then 1 when 'background' then 2 when 'license' then 3 when 'insurance' then 4 when 'equipment' then 5 when 'vehicle' then 6 when 'service_skills' then 7 when 'test_mission' then 8 when 'payout_account' then 9 else 10 end),'[]'::jsonb),count(*) filter(where required),count(*) filter(where required and status='passed') into v_checks,v_required,v_passed from public.sos_hero_verification_checks v where v.hero_id=v_hero.id;
 return jsonb_build_object('state','hero','hero_id',v_hero.id,'verification_status',v_hero.verification_status,'on_duty',v_hero.on_duty,'required_checks',v_required,'passed_checks',v_passed,'dispatch_ready',v_hero.verification_status='verified' and v_passed=v_required,'checks',v_checks);
end;$function$;
