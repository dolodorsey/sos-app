create table if not exists public.sos_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references public.sos_users(id) on delete cascade,
  mission_id uuid null references public.sos_missions(id) on delete set null,
  category text not null check (category in ('account','vehicle','payment','membership','mission','safety','technical','other')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  subject text not null check (char_length(subject) between 3 and 160),
  description text not null check (char_length(description) between 5 and 3000),
  status text not null default 'open' check (status in ('open','reviewing','waiting_customer','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);

alter table public.sos_support_tickets enable row level security;
revoke all on public.sos_support_tickets from public,anon,authenticated;
grant select on public.sos_support_tickets to authenticated;
drop policy if exists "SOS users read own support tickets" on public.sos_support_tickets;
create policy "SOS users read own support tickets" on public.sos_support_tickets for select to authenticated using (user_id=public.sos_current_user_id());
create index if not exists sos_support_tickets_user_created_idx on public.sos_support_tickets(user_id,created_at desc);
create index if not exists sos_support_tickets_status_idx on public.sos_support_tickets(status,created_at desc);

create or replace function public.sos_upsert_vehicle(
  p_vehicle_id uuid default null,p_make text default null,p_model text default null,p_year integer default null,p_trim text default null,p_color text default null,p_plate text default null,p_vin text default null,p_is_ev boolean default false,p_is_default boolean default false,p_notes text default null
)
returns public.sos_vehicles language plpgsql security definer set search_path='pg_catalog','public'
as $function$
declare v_user uuid:=public.sos_current_user_id(); v_vehicle public.sos_vehicles%rowtype; v_year integer:=extract(year from current_date)::integer;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authenticated S.O.S. customer required' using errcode='42501'; end if;
  if coalesce(length(trim(p_make)),0)<1 or coalesce(length(trim(p_model)),0)<1 then raise exception 'Vehicle make and model are required'; end if;
  if p_year is not null and (p_year<1900 or p_year>v_year+2) then raise exception 'Vehicle year is invalid'; end if;
  if coalesce(p_is_default,false) then update public.sos_vehicles set is_default=false where user_id=v_user and is_default=true and (p_vehicle_id is null or id<>p_vehicle_id); end if;
  if p_vehicle_id is null then
    insert into public.sos_vehicles(user_id,make,model,year,"trim",color,plate,vin,is_ev,is_default,notes)
    values(v_user,left(trim(p_make),80),left(trim(p_model),80),p_year,left(nullif(trim(p_trim),''),80),left(nullif(trim(p_color),''),50),upper(left(nullif(trim(p_plate),''),24)),upper(left(nullif(trim(p_vin),''),32)),coalesce(p_is_ev,false),coalesce(p_is_default,false),left(nullif(trim(p_notes),''),1000)) returning * into v_vehicle;
  else
    update public.sos_vehicles set make=left(trim(p_make),80),model=left(trim(p_model),80),year=p_year,"trim"=left(nullif(trim(p_trim),''),80),color=left(nullif(trim(p_color),''),50),plate=upper(left(nullif(trim(p_plate),''),24)),vin=upper(left(nullif(trim(p_vin),''),32)),is_ev=coalesce(p_is_ev,false),is_default=coalesce(p_is_default,false),notes=left(nullif(trim(p_notes),''),1000)
    where id=p_vehicle_id and user_id=v_user returning * into v_vehicle;
    if not found then raise exception 'Vehicle not found' using errcode='P0002'; end if;
  end if;
  if not exists(select 1 from public.sos_vehicles where user_id=v_user and is_default) then update public.sos_vehicles set is_default=true where id=v_vehicle.id returning * into v_vehicle; end if;
  return v_vehicle;
end;$function$;

create or replace function public.sos_delete_vehicle(p_vehicle_id uuid)
returns boolean language plpgsql security definer set search_path='pg_catalog','public'
as $function$
declare v_user uuid:=public.sos_current_user_id(); v_was_default boolean:=false; v_count integer:=0; v_next uuid;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select is_default into v_was_default from public.sos_vehicles where id=p_vehicle_id and user_id=v_user;
  if not found then raise exception 'Vehicle not found' using errcode='P0002'; end if;
  delete from public.sos_vehicles where id=p_vehicle_id and user_id=v_user; get diagnostics v_count=row_count;
  if v_count=1 and v_was_default then select id into v_next from public.sos_vehicles where user_id=v_user order by created_at limit 1; if v_next is not null then update public.sos_vehicles set is_default=true where id=v_next; end if; end if;
  return v_count=1;
end;$function$;

create or replace function public.sos_set_default_vehicle(p_vehicle_id uuid)
returns public.sos_vehicles language plpgsql security definer set search_path='pg_catalog','public'
as $function$
declare v_user uuid:=public.sos_current_user_id(); v_vehicle public.sos_vehicles%rowtype;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.sos_vehicles where id=p_vehicle_id and user_id=v_user) then raise exception 'Vehicle not found' using errcode='P0002'; end if;
  update public.sos_vehicles set is_default=false where user_id=v_user and is_default;
  update public.sos_vehicles set is_default=true where id=p_vehicle_id and user_id=v_user returning * into v_vehicle;
  return v_vehicle;
end;$function$;

create or replace function public.sos_open_support_ticket(p_category text,p_subject text,p_description text,p_priority text default 'normal',p_mission_id uuid default null)
returns table(ticket_id uuid,ticket_number text,status text) language plpgsql security definer set search_path='pg_catalog','public'
as $function$
declare v_user uuid:=public.sos_current_user_id(); v_number text; v_id uuid;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_category not in ('account','vehicle','payment','membership','mission','safety','technical','other') then raise exception 'Unsupported support category'; end if;
  if p_priority not in ('normal','high','urgent') then raise exception 'Invalid priority'; end if;
  if coalesce(length(trim(p_subject)),0)<3 then raise exception 'Support subject is required'; end if;
  if coalesce(length(trim(p_description)),0)<5 then raise exception 'Describe what you need help with'; end if;
  if p_mission_id is not null and not exists(select 1 from public.sos_missions where id=p_mission_id and citizen_id=v_user) then raise exception 'Mission not found' using errcode='42501'; end if;
  v_number:='SOS-S-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.sos_support_tickets(ticket_number,user_id,mission_id,category,priority,subject,description,status)
  values(v_number,v_user,p_mission_id,p_category,p_priority,left(trim(p_subject),160),left(trim(p_description),3000),'open') returning id into v_id;
  return query select v_id,v_number,'open'::text;
end;$function$;

revoke all on function public.sos_upsert_vehicle(uuid,text,text,integer,text,text,text,text,boolean,boolean,text) from public,anon;
revoke all on function public.sos_delete_vehicle(uuid) from public,anon;
revoke all on function public.sos_set_default_vehicle(uuid) from public,anon;
revoke all on function public.sos_open_support_ticket(text,text,text,text,uuid) from public,anon;
grant execute on function public.sos_upsert_vehicle(uuid,text,text,integer,text,text,text,text,boolean,boolean,text) to authenticated;
grant execute on function public.sos_delete_vehicle(uuid) to authenticated;
grant execute on function public.sos_set_default_vehicle(uuid) to authenticated;
grant execute on function public.sos_open_support_ticket(text,text,text,text,uuid) to authenticated;