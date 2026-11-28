-- Staging candidate only. Do not apply to the live SOS database.
begin;
create table public.sos_network_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 2 and 80),
 territory text not null check (territory in ('Downtown','Midtown','Buckhead','Eastside','Westside','Southside','Northside','Gwinnett')),
 referral_code uuid unique not null default gen_random_uuid(),
 invited_with uuid,
 referred_by uuid references public.sos_network_members(user_id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.sos_network_mission_catalog (
 id text primary key, category text not null, title text not null,
 points integer not null check (points between 1 and 1000),
 active boolean not null default true
);
create table public.sos_network_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.sos_network_members(user_id) on delete cascade,
 mission_id text not null references public.sos_network_mission_catalog(id),
 evidence text not null check (length(trim(evidence)) between 10 and 2000),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 awarded_points integer not null default 0,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,mission_id)
);
create table public.sos_network_referrals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.sos_network_members(user_id) on delete cascade,
 kind text not null check (kind in ('customer','provider','business')),
 reference text not null check (length(trim(reference)) between 3 and 300),
 status text not null default 'submitted' check (status in ('submitted','verified','rejected')),
 created_at timestamptz not null default now(),
 unique(user_id,kind,reference)
);
create table public.sos_network_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.sos_network_members enable row level security;
alter table public.sos_network_mission_catalog enable row level security;
alter table public.sos_network_submissions enable row level security;
alter table public.sos_network_referrals enable row level security;
alter table public.sos_network_admins enable row level security;
revoke all on public.sos_network_members,public.sos_network_mission_catalog,public.sos_network_submissions,public.sos_network_referrals,public.sos_network_admins from public,anon,authenticated;
grant select on public.sos_network_members,public.sos_network_mission_catalog,public.sos_network_submissions,public.sos_network_referrals,public.sos_network_admins to authenticated;
grant insert (user_id,display_name,territory,invited_with) on public.sos_network_members to authenticated;
grant insert (user_id,mission_id,evidence) on public.sos_network_submissions to authenticated;
grant insert (user_id,kind,reference) on public.sos_network_referrals to authenticated;
grant update(status) on public.sos_network_submissions,public.sos_network_referrals to authenticated;
create policy network_admin_self on public.sos_network_admins for select to authenticated using (user_id=(select auth.uid()));
create policy network_member_read on public.sos_network_members for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid())));
create policy network_member_create on public.sos_network_members for insert to authenticated with check (user_id=(select auth.uid()) and (referred_by is null or referred_by<>user_id));
create policy network_catalog_read on public.sos_network_mission_catalog for select to authenticated using (active);
create policy network_submission_read on public.sos_network_submissions for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid())));
create policy network_submission_create on public.sos_network_submissions for insert to authenticated with check (user_id=(select auth.uid()) and status='pending' and awarded_points=0 and exists(select 1 from public.sos_network_mission_catalog m where m.id=mission_id and m.active));
create policy network_submission_review on public.sos_network_submissions for update to authenticated using (status='pending' and user_id<>(select auth.uid()) and exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid()))) with check (status in ('approved','rejected') and user_id<>(select auth.uid()) and exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid())));
create policy network_referral_read on public.sos_network_referrals for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid())));
create policy network_referral_create on public.sos_network_referrals for insert to authenticated with check (user_id=(select auth.uid()) and status='submitted');
create policy network_referral_review on public.sos_network_referrals for update to authenticated using (status='submitted' and user_id<>(select auth.uid()) and exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid()))) with check (status in ('verified','rejected') and user_id<>(select auth.uid()) and exists(select 1 from public.sos_network_admins a where a.user_id=(select auth.uid())));
create function public.sos_network_set_review_points() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if old.status <> 'pending' or new.status not in ('approved','rejected') then raise exception 'Invalid review transition'; end if;
 new.awarded_points := case when new.status='approved' then (select points from public.sos_network_mission_catalog where id=new.mission_id and active) else 0 end;
 if new.awarded_points is null then raise exception 'Mission inactive'; end if;
 new.reviewed_at := now(); return new;
end $$;
revoke all on function public.sos_network_set_review_points() from public,anon,authenticated;
create trigger sos_network_review_points before update on public.sos_network_submissions for each row execute function public.sos_network_set_review_points();
create schema if not exists private;
create function private.sos_network_attach_inviter() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Invalid member identity'; end if;
 new.referred_by := null;
 if new.invited_with is not null then
  select user_id into new.referred_by from public.sos_network_members where referral_code=new.invited_with and user_id<>new.user_id;
  if new.referred_by is null then raise exception 'Invalid invitation code'; end if;
 end if;
 new.invited_with := null;
 return new;
end $;
revoke all on function private.sos_network_attach_inviter() from public,anon,authenticated;
create trigger sos_network_attach_inviter before insert on public.sos_network_members for each row execute function private.sos_network_attach_inviter();
create index sos_network_submission_mission_idx on public.sos_network_submissions(mission_id);
create index sos_network_member_referred_idx on public.sos_network_members(referred_by);
insert into public.sos_network_mission_catalog(id,category,title,points) values
('SOC-001','Social','Follow official accounts',10),
('SOC-002','Social','Add Instagram to bio',50),
('SOC-003','Social','Add website to bio',50),
('SOC-004','Social','Share an official story',10),
('SOC-005','Social','Publish a feed post',30),
('SOC-006','Social','Publish an original Reel',75),
('SOC-007','Social','Add story highlights',40),
('SOC-008','Social','Accept a collaboration post',50),
('SOC-009','Social','Record a personal endorsement',75),
('SOC-010','Social','Share a commercial',20),
('SOC-011','Social','Create an original meme',40),
('SOC-012','Social','Share an educational roadside tip',20),
('SOC-013','Social','Include S.O.S. in link-in-bio',40),
('SOC-014','Social','Create an authentic customer experience video',100),
('SOC-015','Social','Participate in a coordinated campaign',50),
('CUS-001','Customer','Download and activate app',25),
('CUS-002','Customer','Refer a verified new user',25),
('CUS-003','Customer','Refer a first-time paying customer',150),
('CUS-004','Customer','Share personal referral QR',15),
('CUS-005','Customer','Introduce a business',75),
('CUS-006','Customer','Introduce a rideshare driver',30),
('CUS-007','Customer','Refer a fleet decision-maker',100),
('CUS-008','Customer','Secure business location',200),
('CUS-009','Customer','Host app-download activation',150),
('CUS-010','Customer','Organize community presentation',200),
('PRO-001','Provider','Refer tow operator',75),
('PRO-002','Provider','Refer locksmith',75),
('PRO-003','Provider','Refer mobile mechanic',50),
('PRO-004','Provider','Refer tire service provider',50),
('PRO-005','Provider','Refer eligible independent Superhero',50),
('PRO-006','Provider','Refer towing company owner',100),
('PRO-007','Provider','Introduce automotive business',100),
('PRO-008','Provider','Refer provider completing onboarding',250),
('PRO-009','Provider','Organize provider recruitment activation',200),
('PRO-010','Provider','Recruit five approved active providers',1000),
('STR-001','Street','Place approved vehicle sticker',25),
('STR-002','Street','Display vehicle magnet',50),
('STR-003','Street','Wear official merchandise',25),
('STR-004','Street','Distribute 25 cards',50),
('STR-005','Street','Secure business display permission',100),
('STR-006','Street','Attend street activation',100),
('STR-007','Street','Recruit neighborhood ambassador',75),
('STR-008','Street','Activate at automotive event',150),
('STR-009','Street','Organize campus activation',200),
('STR-010','Street','Coordinate neighborhood team',250),
('QA-001','Quality','Test registration',50),
('QA-002','Quality','Test account navigation',25),
('QA-003','Quality','Submit reproducible bug',75),
('QA-004','Quality','Test referral functionality',50),
('QA-005','Quality','Complete authorized service simulation',100),
('QA-006','Quality','Evaluate customer support',75),
('QA-007','Quality','Test approved feature',50),
('QA-008','Quality','Complete secret shopper assignment',200),
('QA-009','Quality','Submit experience report',150),
('QA-010','Quality','Verify bug fix',50);
commit;