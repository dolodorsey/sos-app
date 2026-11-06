-- Pending independent review. No existing Hero rows are recomputed by this migration.
CREATE OR REPLACE FUNCTION private.sos_recompute_hero_verification(p_hero_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_identity text; v_background text; v_license text; v_insurance text; v_test text; v_overall text;
begin
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
 select * into v_row from public.sos_hero_verification_checks where hero_id=p_hero_id and check_type=p_check_type; if not found then raise exception 'Verification check not found' using errcode='P0002'; end if;
 if p_check_type='payout_account' then raise exception 'Payout verification is synchronized from Stripe and cannot be manually approved'; end if;
 if p_status='waived' and v_row.required then raise exception 'Required Hero verification cannot be waived'; end if;
 select email into v_email from private.marketplace_operators where auth_id=auth.uid() and is_active limit 1;
 update public.sos_hero_verification_checks set status=p_status,notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),reviewed_by=v_email,reviewed_at=case when p_status in ('passed','failed','expired','waived') then now() else reviewed_at end,updated_at=now() where hero_id=p_hero_id and check_type=p_check_type returning * into v_row;
 perform private.sos_recompute_hero_verification(p_hero_id);
 return v_row;
end;$function$;
