create schema if not exists private;
create table if not exists private.marketplace_operators(
  auth_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into private.marketplace_operators(auth_id,email,display_name)
select id,lower(email),'Marketplace Owner' from auth.users where lower(email)='thedoctordorsey@gmail.com'
on conflict(auth_id) do update set email=excluded.email,is_active=true,updated_at=now();
create or replace function private.is_marketplace_operator(p_auth_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path to 'pg_catalog','private'
as $$select exists(select 1 from private.marketplace_operators o where o.auth_id=p_auth_id and o.is_active);$$;

create or replace function public.sos_ops_snapshot()
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$declare v_result jsonb; begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 select jsonb_build_object(
  'counts',jsonb_build_object(
   'candidates',(select count(*) from public.sos_recruiting_candidates),
   'qualified',(select count(*) from public.sos_recruiting_candidates where pipeline_stage='qualified'),
   'claimed',(select count(*) from public.sos_recruiting_candidates where pipeline_stage='account_setup'),
   'verification_pending',(select count(*) from public.sos_hero_verification_checks where status in ('pending','submitted','under_review')),
   'tickets_open',(select count(*) from public.sos_support_tickets where status in ('open','reviewing','waiting_customer'))
  ),
  'candidates',coalesce((select jsonb_agg(to_jsonb(x) order by x.priority_score desc,x.created_at) from (
   select c.id,c.source_hero_id,c.source_user_id,c.first_name,c.last_name,c.email,c.phone,c.target_zone,c.services_enabled,c.tools_available,c.vehicle_type,c.source_rating,c.source_review_count,c.priority_score,c.pipeline_stage,c.outreach_status,c.next_action_at,c.notes,c.created_at,c.updated_at,h.verification_status,h.on_duty,h.stripe_connect_id,(u.auth_id is not null) auth_linked,(select jsonb_object_agg(vc.check_type,vc.status) from public.sos_hero_verification_checks vc where vc.hero_id=c.source_hero_id) checks
   from public.sos_recruiting_candidates c join public.sos_heroes h on h.id=c.source_hero_id join public.sos_users u on u.id=c.source_user_id
  ) x),'[]'::jsonb),
  'tickets',coalesce((select jsonb_agg(to_jsonb(t) order by case t.priority when 'urgent' then 0 when 'high' then 1 else 2 end,t.created_at) from (
   select s.id,s.ticket_number,s.user_id,s.mission_id,s.category,s.priority,s.subject,s.description,s.status,s.created_at,s.updated_at,s.resolved_at,u.email,u.first_name,u.last_name from public.sos_support_tickets s join public.sos_users u on u.id=s.user_id where s.status<>'closed'
  ) t),'[]'::jsonb)
 ) into v_result;
 return v_result;
end;$$;

create or replace function public.sos_ops_update_candidate(p_candidate_id uuid,p_pipeline_stage text,p_outreach_status text,p_notes text default null,p_next_action_at timestamptz default null)
returns public.sos_recruiting_candidates language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$declare v_row public.sos_recruiting_candidates%rowtype; begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_pipeline_stage not in ('prospect','qualified','contacted','screening','training','account_setup','test_mission','approved','rejected','withdrawn') then raise exception 'Invalid pipeline stage'; end if;
 if p_outreach_status not in ('not_queued','queued','in_progress','sent','responded','failed','paused') then raise exception 'Invalid outreach status'; end if;
 update public.sos_recruiting_candidates set pipeline_stage=p_pipeline_stage,outreach_status=p_outreach_status,notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),next_action_at=p_next_action_at,updated_at=now() where id=p_candidate_id returning * into v_row;
 if not found then raise exception 'Candidate not found' using errcode='P0002'; end if; return v_row;
end;$$;

create or replace function public.sos_ops_review_verification_check(p_hero_id uuid,p_check_type text,p_status text,p_notes text default null)
returns public.sos_hero_verification_checks language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$declare v_row public.sos_hero_verification_checks%rowtype; v_email text; begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_status not in ('pending','submitted','under_review','passed','failed','waived','expired') then raise exception 'Invalid verification status'; end if;
 select email into v_email from private.marketplace_operators where auth_id=auth.uid() and is_active limit 1;
 update public.sos_hero_verification_checks set status=p_status,notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),reviewed_by=v_email,reviewed_at=case when p_status in ('passed','failed','waived') then now() else reviewed_at end,updated_at=now() where hero_id=p_hero_id and check_type=p_check_type returning * into v_row;
 if not found then raise exception 'Verification check not found' using errcode='P0002'; end if; return v_row;
end;$$;

create or replace function public.sos_ops_update_support_ticket(p_ticket_id uuid,p_status text)
returns public.sos_support_tickets language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $$declare v_row public.sos_support_tickets%rowtype; begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_status not in ('open','reviewing','waiting_customer','resolved','closed') then raise exception 'Invalid support status'; end if;
 update public.sos_support_tickets set status=p_status,resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,updated_at=now() where id=p_ticket_id returning * into v_row;
 if not found then raise exception 'Support ticket not found' using errcode='P0002'; end if; return v_row;
end;$$;

revoke all on private.marketplace_operators from public,anon,authenticated;
revoke all on function private.is_marketplace_operator(uuid) from public,anon,authenticated;
grant execute on function public.sos_ops_snapshot() to authenticated;
grant execute on function public.sos_ops_update_candidate(uuid,text,text,text,timestamptz) to authenticated;
grant execute on function public.sos_ops_review_verification_check(uuid,text,text,text) to authenticated;
grant execute on function public.sos_ops_update_support_ticket(uuid,text) to authenticated;
revoke execute on function public.sos_ops_snapshot() from public,anon;
revoke execute on function public.sos_ops_update_candidate(uuid,text,text,text,timestamptz) from public,anon;
revoke execute on function public.sos_ops_review_verification_check(uuid,text,text,text) from public,anon;
revoke execute on function public.sos_ops_update_support_ticket(uuid,text) from public,anon;
