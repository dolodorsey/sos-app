insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('marketplace-verification','marketplace-verification',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types,updated_at=now();

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='marketplace verification own upload') then
  create policy "marketplace verification own upload" on storage.objects for insert to authenticated
  with check(bucket_id='marketplace-verification' and (storage.foldername(name))[2]=auth.uid()::text and (storage.foldername(name))[1] in ('on_call','sos'));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='marketplace verification own or operator read') then
  create policy "marketplace verification own or operator read" on storage.objects for select to authenticated
  using(bucket_id='marketplace-verification' and ((storage.foldername(name))[2]=auth.uid()::text or public.marketplace_operator_check()));
 end if;
end $$;

create or replace function public.sos_hero_submit_verification_evidence(p_check_type text,p_path text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','storage' as $$
declare v_user public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_check public.sos_hero_verification_checks%rowtype; v_prefix text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.sos_users where auth_id=auth.uid() and role='hero' and status='active' and coalesce(is_demo,false)=false limit 1; if not found then raise exception 'Active real Hero account required' using errcode='42501'; end if;
 select * into v_hero from public.sos_heroes where user_id=v_user.id and coalesce(is_demo,false)=false limit 1; if not found then raise exception 'Hero profile not found'; end if;
 if p_check_type='payout_account' then raise exception 'Payout evidence is synchronized from Stripe'; end if;
 select * into v_check from public.sos_hero_verification_checks where hero_id=v_hero.id and check_type=p_check_type; if not found then raise exception 'Verification check not found'; end if;
 v_prefix:='sos/'||auth.uid()::text||'/'||v_hero.id::text||'/'||p_check_type||'/';
 if p_path is null or p_path not like v_prefix||'%' or position('..' in p_path)>0 then raise exception 'Invalid verification evidence path'; end if;
 if not exists(select 1 from storage.objects where bucket_id='marketplace-verification' and name=p_path) then raise exception 'Uploaded verification file not found'; end if;
 update public.sos_hero_verification_checks set evidence_urls=case when p_path=any(evidence_urls) then evidence_urls else array_append(evidence_urls,p_path) end,status=case when status='passed' then status else 'submitted' end,updated_at=now() where hero_id=v_hero.id and check_type=p_check_type;
 perform private.sos_recompute_hero_verification(v_hero.id);
 return jsonb_build_object('hero_id',v_hero.id,'check_type',p_check_type,'status',case when v_check.status='passed' then 'passed' else 'submitted' end,'path',p_path);
end;$$;
revoke all on function public.sos_hero_submit_verification_evidence(text,text) from public,anon; grant execute on function public.sos_hero_submit_verification_evidence(text,text) to authenticated;

create or replace function public.sos_hero_verification_status()
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare v_user public.sos_users%rowtype; v_hero public.sos_heroes%rowtype; v_checks jsonb:='[]'::jsonb; v_passed integer:=0; v_required integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.sos_users where auth_id=auth.uid() and role='hero' and status='active' and coalesce(is_demo,false)=false limit 1;
 if not found then return jsonb_build_object('state','not_hero'); end if;
 select * into v_hero from public.sos_heroes where user_id=v_user.id and coalesce(is_demo,false)=false limit 1; if not found then return jsonb_build_object('state','not_hero'); end if;
 perform private.sos_initialize_hero_verification(v_hero.id);
 select coalesce(jsonb_agg(jsonb_build_object('check_type',v.check_type,'required',v.required,'status',v.status,'notes',v.notes,'reviewed_at',v.reviewed_at,'evidence_urls',v.evidence_urls) order by case v.check_type when 'identity' then 1 when 'background' then 2 when 'license' then 3 when 'insurance' then 4 when 'equipment' then 5 when 'vehicle' then 6 when 'service_skills' then 7 when 'test_mission' then 8 when 'payout_account' then 9 else 10 end),'[]'::jsonb),count(*) filter(where required),count(*) filter(where required and status='passed') into v_checks,v_required,v_passed from public.sos_hero_verification_checks v where v.hero_id=v_hero.id;
 return jsonb_build_object('state','hero','hero_id',v_hero.id,'verification_status',v_hero.verification_status,'on_duty',v_hero.on_duty,'required_checks',v_required,'passed_checks',v_passed,'dispatch_ready',v_hero.verification_status='verified' and v_passed=v_required,'checks',v_checks);
end;$$;
