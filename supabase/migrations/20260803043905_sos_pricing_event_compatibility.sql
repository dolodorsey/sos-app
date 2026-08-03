begin;
create or replace function public.sos_confirm_mission_price(p_mission_id uuid,p_final_price numeric,p_operator_auth_id uuid)
returns public.sos_missions language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_mission public.sos_missions%rowtype;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'Server role required' using errcode='42501'; end if;
  if p_operator_auth_id is null then raise exception 'Operator identity required' using errcode='42501'; end if;
  if p_final_price is null or p_final_price<1 or p_final_price>10000 then raise exception 'Final price must be between 1 and 10000'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id for update;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  if v_mission.hero_id is null or v_mission.status not in ('assigned','en_route','on_site','working') then raise exception 'Accepted Hero assignment required'; end if;
  if exists(select 1 from public.sos_payments where mission_id=p_mission_id and payment_status not in ('failed','canceled')) then raise exception 'Price cannot change after payment authorization begins'; end if;
  update public.sos_missions set final_price=round(p_final_price,2),pricing_status='confirmed',updated_at=now() where id=p_mission_id returning * into v_mission;
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor) values(p_mission_id,'price_update',v_mission.status,v_mission.status,jsonb_build_object('final_price',v_mission.final_price,'operator_auth_id',p_operator_auth_id),'admin');
  return v_mission;
end $$;
revoke all on function public.sos_confirm_mission_price(uuid,numeric,uuid) from public,anon,authenticated;
grant execute on function public.sos_confirm_mission_price(uuid,numeric,uuid) to service_role,postgres;
commit;
