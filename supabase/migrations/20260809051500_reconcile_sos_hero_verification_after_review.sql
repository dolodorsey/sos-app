create or replace function private.sos_recompute_hero_verification(p_hero_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_identity text; v_background text; v_license text; v_insurance text; v_test text; v_overall text;
begin
  select max(status) filter(where check_type='identity'),
         max(status) filter(where check_type='background'),
         max(status) filter(where check_type='license'),
         max(status) filter(where check_type='insurance'),
         max(status) filter(where check_type='test_mission')
    into v_identity,v_background,v_license,v_insurance,v_test
  from public.sos_hero_verification_checks where hero_id=p_hero_id;

  if 'failed'=any(array[v_identity,v_background,v_license,v_insurance,v_test]) then
    v_overall:='rejected';
  elsif v_identity in ('passed','waived') and v_background in ('passed','waived') and v_license in ('passed','waived') and v_insurance in ('passed','waived') and v_test in ('passed','waived') then
    v_overall:='verified';
  elsif 'under_review'=any(array[v_identity,v_background,v_license,v_insurance,v_test]) then
    v_overall:='under_review';
  elsif 'submitted'=any(array[v_identity,v_background,v_license,v_insurance,v_test]) then
    v_overall:='documents_submitted';
  else
    v_overall:='pending';
  end if;

  update public.sos_heroes
  set id_verified=coalesce(v_identity in ('passed','waived'),false),
      background_cleared=coalesce(v_background in ('passed','waived'),false),
      license_verified=coalesce(v_license in ('passed','waived'),false),
      insurance_verified=coalesce(v_insurance in ('passed','waived'),false),
      test_mission_passed=coalesce(v_test in ('passed','waived'),false),
      verification_status=v_overall
  where id=p_hero_id;
end;$$;

create or replace function public.sos_ops_review_verification_check(p_hero_id uuid,p_check_type text,p_status text,p_notes text default null)
returns public.sos_hero_verification_checks
language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$declare v_row public.sos_hero_verification_checks%rowtype; v_email text; begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
  if p_status not in ('pending','submitted','under_review','passed','failed','waived','expired') then raise exception 'Invalid verification status'; end if;
  select email into v_email from private.marketplace_operators where auth_id=auth.uid() and is_active limit 1;
  update public.sos_hero_verification_checks
  set status=p_status,notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),reviewed_by=v_email,reviewed_at=case when p_status in ('passed','failed','waived') then now() else reviewed_at end,updated_at=now()
  where hero_id=p_hero_id and check_type=p_check_type
  returning * into v_row;
  if not found then raise exception 'Verification check not found' using errcode='P0002'; end if;
  if p_check_type in ('identity','background','license','insurance','test_mission') then perform private.sos_recompute_hero_verification(p_hero_id); end if;
  return v_row;
end;$$;

revoke all on function private.sos_recompute_hero_verification(uuid) from public,anon,authenticated;

do $$
declare r record;
begin
  for r in select id from public.sos_heroes loop
    perform private.sos_recompute_hero_verification(r.id);
  end loop;
end$$;
