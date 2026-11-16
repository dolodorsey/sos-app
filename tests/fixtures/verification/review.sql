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
 if p_check_type in ('identity','background','license','insurance','test_mission') then perform private.sos_recompute_hero_verification(p_hero_id); end if;
 return v_row;
end;$function$
