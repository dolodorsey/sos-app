create or replace function private.sos_initialize_hero_verification(p_hero_id uuid)
returns void language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_payout text:='pending';
begin
  if exists(select 1 from public.sos_heroes h join public.sos_users u on u.id=h.user_id where h.id=p_hero_id and (coalesce(h.is_demo,false) or coalesce(u.is_demo,false))) then return; end if;
  select case when stripe_transfer_status='active' then 'passed' when stripe_connect_id is not null then 'submitted' else 'pending' end into v_payout from public.sos_heroes where id=p_hero_id;
  insert into public.sos_hero_verification_checks(hero_id,check_type,required,status) values
    (p_hero_id,'identity',true,'pending'),(p_hero_id,'background',true,'pending'),(p_hero_id,'license',true,'pending'),(p_hero_id,'insurance',true,'pending'),
    (p_hero_id,'equipment',true,'pending'),(p_hero_id,'vehicle',true,'pending'),(p_hero_id,'service_skills',true,'pending'),(p_hero_id,'test_mission',true,'pending'),
    (p_hero_id,'payout_account',true,coalesce(v_payout,'pending'))
  on conflict(hero_id,check_type) do nothing;
end;$$;
revoke all on function private.sos_initialize_hero_verification(uuid) from public,anon,authenticated;

create or replace function public.sos_initialize_approved_hero_verification_trigger()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$begin if new.status='approved' and new.source_hero_id is not null then perform private.sos_initialize_hero_verification(new.source_hero_id); end if; return new; end;$$;
revoke all on function public.sos_initialize_approved_hero_verification_trigger() from public,anon,authenticated;
drop trigger if exists sos_approved_hero_verification_init on public.sos_hero_applications;
create trigger sos_approved_hero_verification_init after insert or update of status,source_hero_id on public.sos_hero_applications for each row execute function public.sos_initialize_approved_hero_verification_trigger();

do $$ declare r record; begin for r in select a.source_hero_id hero_id from public.sos_hero_applications a join public.sos_heroes h on h.id=a.source_hero_id join public.sos_users u on u.id=h.user_id where a.status='approved' and a.source_hero_id is not null and coalesce(h.is_demo,false)=false and coalesce(u.is_demo,false)=false loop perform private.sos_initialize_hero_verification(r.hero_id); end loop; end $$;

create or replace function public.sos_ops_verification_queue()
returns table(application_id uuid,hero_id uuid,candidate_id uuid,first_name text,last_name text,email text,verification_status text,auth_linked boolean,check_type text,required boolean,status text,evidence_urls text[],notes text,reviewed_at timestamptz)
language sql security definer set search_path='pg_catalog','public','private' as $$
 select a.id,h.id,a.candidate_id,a.first_name,a.last_name,a.email,h.verification_status,(u.auth_id is not null),v.check_type,v.required,v.status,v.evidence_urls,v.notes,v.reviewed_at
 from public.sos_hero_applications a join public.sos_heroes h on h.id=a.source_hero_id and coalesce(h.is_demo,false)=false join public.sos_users u on u.id=h.user_id and coalesce(u.is_demo,false)=false join public.sos_hero_verification_checks v on v.hero_id=h.id
 where private.is_marketplace_operator(auth.uid()) and a.status='approved'
 order by a.reviewed_at desc nulls last,a.submitted_at,v.check_type
$$;
revoke all on function public.sos_ops_verification_queue() from public,anon; grant execute on function public.sos_ops_verification_queue() to authenticated;

create or replace function public.sos_ops_review_verification_check(p_hero_id uuid,p_check_type text,p_status text,p_notes text default null)
returns public.sos_hero_verification_checks language plpgsql security definer set search_path='pg_catalog','public','private' as $$
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
end;$$;
revoke all on function public.sos_ops_review_verification_check(uuid,text,text,text) from public,anon; grant execute on function public.sos_ops_review_verification_check(uuid,text,text,text) to authenticated;
