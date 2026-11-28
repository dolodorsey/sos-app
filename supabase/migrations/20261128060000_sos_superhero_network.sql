-- S.O.S. THE SUPERHERO NETWORK / THE SIGNAL (Nov 28, 2026; Dolo: "study this and integrate").
-- Source: SOS Full Support Program Master Manual v3.0 + Superhero Network V2 package.
-- Additive only. Nothing here touches dispatch, payments, Hero payouts, customer rewards or outbound sends.
-- Gates kept from the manual:
--   * Enrollment is invite-only (Founding 100 invite code or an existing member's code) until Dolo opens it.
--   * Points are PROPOSED values until Dolo approves the catalog (network_program.points_status).
--   * Points are recognition, not money. No kit, coupon or service credit is issued by this code.
--   * A reviewer can never approve their own submission. The database, not the browser, sets points.
--   * Customer/provider introductions are references, not proof of an install, a sale or an approved provider.

create table if not exists public.sos_network_territories (
  id text primary key,
  label text not null,
  hint text not null default '',
  sort_order int not null default 0,
  captain_slots int not null default 1,
  lead_slots int not null default 4,
  member_target int not null default 20
);

create table if not exists public.sos_network_divisions (
  id text primary key,
  label text not null,
  who text not null,
  primary_output text not null,
  sort_order int not null default 0,
  staff_assigned_only boolean not null default false
);

create table if not exists public.sos_network_ranks (
  id text primary key,
  label text not null,
  min_points int not null,
  max_points int,
  proposed_benefit text not null,
  sort_order int not null
);

create table if not exists public.sos_network_missions (
  id text primary key,
  category text not null check (category in ('social','customer','provider','street','quality')),
  title text not null,
  points int not null check (points between 1 and 5000),
  evidence_rule text not null,
  verification_standard text not null,
  first_five boolean not null default false,
  restricted boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create sequence if not exists public.sos_network_member_seq start 1;

create table if not exists public.sos_network_members (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  member_code text not null unique,
  display_name text not null check (length(btrim(display_name)) between 2 and 80),
  territory_id text not null references public.sos_network_territories(id),
  divisions text[] not null default '{insiders}',
  status text not null default 'registered' check (status in ('registered','onboarded','activated','active','inactive','paused','exited')),
  contact_channel text check (contact_channel in ('text','email','instagram','phone','in_person')),
  consent_at timestamptz not null,
  terms_version text not null,
  conduct_acknowledged_at timestamptz,
  referral_code text not null unique,
  referred_by uuid references public.sos_network_members(id) on delete set null,
  founding_slot_id text unique,
  shirt_size text check (shirt_size in ('XS','S','M','L','XL','2XL','3XL')),
  owner text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sos_network_founding_slots (
  id text primary key,
  cohort text not null,
  wave int not null check (wave between 1 and 4),
  full_name text,
  contact_channel text,
  contact_detail text,
  territory_id text references public.sos_network_territories(id),
  owner text,
  invitation_status text not null default 'not_selected' check (invitation_status in ('not_selected','selected','approved_to_invite','invited','opted_in','declined','no_response')),
  invite_code text unique,
  member_id uuid unique references public.sos_network_members(id) on delete set null,
  next_action text not null default 'Pick a real person and confirm they are okay being invited',
  notes text,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.sos_network_members drop constraint if exists sos_network_members_founding_slot_fk;
alter table public.sos_network_members add constraint sos_network_members_founding_slot_fk foreign key (founding_slot_id) references public.sos_network_founding_slots(id) on delete set null;

create table if not exists public.sos_network_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.sos_network_members(id) on delete cascade,
  mission_id text not null references public.sos_network_missions(id),
  occurrence_key text not null default 'once',
  evidence_link text,
  evidence_note text not null check (length(btrim(evidence_note)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  points_awarded int not null default 0,
  reviewer_auth_id uuid,
  reviewer_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, mission_id, occurrence_key)
);

-- Append-only. Corrections are compensating entries, never edits.
create table if not exists public.sos_network_points_ledger (
  id bigserial primary key,
  member_id uuid not null references public.sos_network_members(id) on delete cascade,
  event_key text not null unique,
  delta int not null check (delta <> 0),
  reason text not null,
  source_submission_id uuid references public.sos_network_submissions(id),
  actor_auth_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.sos_network_referrals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.sos_network_members(id) on delete cascade,
  kind text not null check (kind in ('customer','provider','business')),
  target_reference text not null check (length(btrim(target_reference)) between 3 and 300),
  service_category text,
  consent_confirmed boolean not null check (consent_confirmed),
  dedupe_key text not null,
  stage text not null default 'introduced',
  duplicate_of uuid references public.sos_network_referrals(id),
  owner text,
  outcome_note text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_network_referral_stage_valid check (
    (kind='customer' and stage in ('introduced','registered','activated','first_paid_service','retained','not_converted','duplicate_hold'))
    or (kind='provider' and stage in ('introduced','applied','qualified','approved','dispatch_ready','active','not_converted','duplicate_hold'))
    or (kind='business' and stage in ('introduced','agreed','placed','active','not_converted','duplicate_hold')))
);
create unique index if not exists sos_network_referral_member_dedupe on public.sos_network_referrals(member_id, kind, dedupe_key);

create table if not exists public.sos_network_kit_claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.sos_network_members(id) on delete cascade,
  kit_type text not null check (kit_type in ('supporter','ambassador','street_team','founding_100','business_ally')),
  size text,
  approval_status text not null default 'requested' check (approval_status in ('requested','approved','declined')),
  fulfillment_status text not null default 'not_started' check (fulfillment_status in ('not_started','reserved','packed','picked_up','shipped','returned')),
  pickup_or_shipping text,
  tracking_reference text,
  actual_cost_cents int,
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sos_network_qa_reports (
  id uuid primary key default gen_random_uuid(),
  test_code text not null unique,
  member_id uuid references public.sos_network_members(id) on delete set null,
  authorized_by text not null,
  environment text not null check (environment in ('test_accounts','authorized_real_world')),
  scenario text not null,
  scores jsonb not null default '{}'::jsonb,
  weighted_score numeric(5,2),
  coverage numeric(5,2),
  severity text check (severity in ('P0','P1','P2','P3')),
  issue_reference text,
  status text not null default 'assigned' check (status in ('assigned','reported','triaged','fixed','retested','closed','reopened')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sos_network_audit (
  id bigserial primary key,
  actor_auth_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sos_network_submissions_status_idx on public.sos_network_submissions(status, created_at);
create index if not exists sos_network_ledger_member_idx on public.sos_network_points_ledger(member_id);
create index if not exists sos_network_referrals_stage_idx on public.sos_network_referrals(kind, stage);
create index if not exists sos_network_members_referred_idx on public.sos_network_members(referred_by);

-- Everything is private. Members and operators reach the data only through the functions below.
do $$ declare t text; begin
  foreach t in array array['sos_network_territories','sos_network_divisions','sos_network_ranks','sos_network_missions','sos_network_members','sos_network_founding_slots','sos_network_submissions','sos_network_points_ledger','sos_network_referrals','sos_network_kit_claims','sos_network_qa_reports','sos_network_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.sos_network_member_seq from public, anon, authenticated;

-- ---------- Reference data ----------
insert into public.sos_network_territories(id,label,hint,sort_order) values
 ('downtown','Downtown','Downtown · Castleberry Hill · Old Fourth Ward',1),
 ('midtown','Midtown','Midtown · Atlantic Station · Home Park',2),
 ('buckhead','Buckhead','Buckhead · Brookhaven · Chamblee',3),
 ('eastside','Eastside','Decatur · Kirkwood · Stone Mountain',4),
 ('westside','Westside','West End · Westview · Austell',5),
 ('southside','Southside','East Point · College Park · Riverdale',6),
 ('northside','Northside','Sandy Springs · Dunwoody · Roswell',7),
 ('gwinnett','Gwinnett','Lawrenceville · Duluth · Snellville · Norcross',8)
on conflict (id) do update set label=excluded.label, hint=excluded.hint, sort_order=excluded.sort_order;

insert into public.sos_network_divisions(id,label,who,primary_output,sort_order,staff_assigned_only) values
 ('founding_100','Founding 100','Personally invited supporters','Finish the first five missions; founding feedback',1,true),
 ('insiders','Insiders','Friends, family, general supporters','Share, introduce, test, refer',2,false),
 ('ambassadors','Ambassadors','Trusted brand representatives','Approved content and credited introductions',3,true),
 ('street_team','Street Team','Community promotion','Permission-based material distribution',4,false),
 ('creators','Creators','Video and creative production','Original content with usage permission',5,false),
 ('scouts','Scouts','Provider recruitment','Consent-based qualified introductions',6,false),
 ('test_pilots','Test Pilots','Product testing','Bug reports someone else can repeat',7,false),
 ('secret_agents','Secret Agents','Authorized mystery shopping','Authorized evaluation and evidence',8,true),
 ('business_allies','Business Allies','Local business distribution','Counter displays and employee referrals',9,false),
 ('captains','Captains','Territory leadership','Weekly assignments and escalation',10,true),
 ('internal_team','Internal Team','Employees and contractors','Assigned operational duties',11,true)
on conflict (id) do update set label=excluded.label, who=excluded.who, primary_output=excluded.primary_output, sort_order=excluded.sort_order, staff_assigned_only=excluded.staff_assigned_only;

insert into public.sos_network_ranks(id,label,min_points,max_points,proposed_benefit,sort_order) values
 ('civilian','Civilian',0,99,'Digital access',1),
 ('ally','Ally',100,499,'Stickers and air freshener',2),
 ('sidekick','Sidekick',500,999,'Magnet and merchandise opportunities',3),
 ('hero','Hero',1000,2499,'Merchandise and eligible service credits',4),
 ('superhero','Superhero',2500,4999,'Premium merchandise and activations',5),
 ('legend','Legend',5000,null,'Recognition and leadership opportunities',6)
on conflict (id) do update set label=excluded.label, min_points=excluded.min_points, max_points=excluded.max_points, proposed_benefit=excluded.proposed_benefit, sort_order=excluded.sort_order;

with m(id,category,title,points,first_five,restricted,sort_order) as (values
 ('SOC-001','social','Follow the official S.O.S. accounts',10,true,false,1),
 ('SOC-002','social','Add our Instagram to your bio for seven days',50,true,false,2),
 ('SOC-003','social','Add our website to your bio for seven days',50,false,false,3),
 ('SOC-004','social','Share an official story',10,false,false,4),
 ('SOC-005','social','Publish a feed post',30,false,false,5),
 ('SOC-006','social','Publish an original Reel',75,false,false,6),
 ('SOC-007','social','Add S.O.S. to your story highlights',40,false,false,7),
 ('SOC-008','social','Accept a collaboration post',50,false,false,8),
 ('SOC-009','social','Record a personal endorsement',75,false,false,9),
 ('SOC-010','social','Share the launch commercial',20,true,false,10),
 ('SOC-011','social','Create an original meme',40,false,false,11),
 ('SOC-012','social','Share an educational roadside tip',20,false,false,12),
 ('SOC-013','social','Put S.O.S. on your link-in-bio page',40,false,false,13),
 ('SOC-014','social','Create a real customer experience video',100,false,false,14),
 ('SOC-015','social','Join a coordinated launch campaign',50,false,false,15),
 ('CUS-001','customer','Download and activate the S.O.S. app',25,true,false,16),
 ('CUS-002','customer','Refer a verified new user',25,false,false,17),
 ('CUS-003','customer','Refer a first-time paying customer',150,false,false,18),
 ('CUS-004','customer','Share your personal referral QR code',15,false,false,19),
 ('CUS-005','customer','Introduce a business',75,false,false,20),
 ('CUS-006','customer','Introduce a rideshare driver',30,false,false,21),
 ('CUS-007','customer','Refer a fleet decision-maker',100,false,false,22),
 ('CUS-008','customer','Secure a participating business location',200,false,false,23),
 ('CUS-009','customer','Host an app-download activation',150,false,false,24),
 ('CUS-010','customer','Organize a community presentation',200,false,false,25),
 ('PRO-001','provider','Refer a tow truck operator',75,false,false,26),
 ('PRO-002','provider','Refer a locksmith',75,false,false,27),
 ('PRO-003','provider','Refer a mobile mechanic',50,false,false,28),
 ('PRO-004','provider','Refer a tire service provider',50,false,false,29),
 ('PRO-005','provider','Refer an eligible independent SUPERHERO',50,false,false,30),
 ('PRO-006','provider','Refer a towing company owner',100,false,false,31),
 ('PRO-007','provider','Introduce an automotive service business',100,false,false,32),
 ('PRO-008','provider','Refer a provider who completes onboarding',250,false,false,33),
 ('PRO-009','provider','Organize a provider recruitment activation',200,false,false,34),
 ('PRO-010','provider','Recruit five approved active providers',1000,false,false,35),
 ('STR-001','street','Put an approved sticker on your own vehicle',25,false,false,36),
 ('STR-002','street','Display an S.O.S. vehicle magnet',50,false,false,37),
 ('STR-003','street','Wear official merchandise at an activation',25,false,false,38),
 ('STR-004','street','Hand out 25 promotional cards',50,false,false,39),
 ('STR-005','street','Secure a permitted business counter display',100,false,false,40),
 ('STR-006','street','Attend an official street activation',100,false,false,41),
 ('STR-007','street','Recruit a neighborhood ambassador',75,false,false,42),
 ('STR-008','street','Activate at an automotive event',150,false,false,43),
 ('STR-009','street','Organize a campus activation',200,false,false,44),
 ('STR-010','street','Coordinate a neighborhood street team',250,false,false,45),
 ('QA-001','quality','Test registration and onboarding',50,false,false,46),
 ('QA-002','quality','Test account navigation',25,false,false,47),
 ('QA-003','quality','Submit an app bug someone else can repeat',75,false,false,48),
 ('QA-004','quality','Test the referral features',50,false,false,49),
 ('QA-005','quality','Complete an authorized service simulation',100,false,true,50),
 ('QA-006','quality','Evaluate customer support',75,false,false,51),
 ('QA-007','quality','Test an approved new feature',50,false,false,52),
 ('QA-008','quality','Complete a secret shopper assignment',200,false,true,53),
 ('QA-009','quality','Submit a full experience report',150,false,false,54),
 ('QA-010','quality','Confirm a reported bug is fixed',50,false,false,55))
insert into public.sos_network_missions(id,category,title,points,evidence_rule,verification_standard,first_five,restricted,sort_order)
select id,category,title,points,
 case category when 'social' then 'Public post link or a screenshot with private details covered'
  when 'customer' then 'A real app event or an introduction the person agreed to'
  when 'provider' then 'An introduction the provider agreed to; the provider team confirms each stage'
  when 'street' then 'Permission record, approved location, count, date and supervisor check'
  else 'Assigned test number, expected vs actual result, device, app version, time and steps' end,
 case category when 'social' then 'Check the account is unique and, where it applies, how long it stayed up. Disclose that you support S.O.S. No fake endorsements or paid positive reviews.'
  when 'customer' then 'Count unique accounts, activations and first paid services separately. Self-referrals, duplicates and refunded jobs do not count.'
  when 'provider' then 'Consent, qualification, application, approval and dispatch readiness are confirmed separately. No promises of approval, income or jobs.'
  when 'street' then 'No standing in traffic, no trespassing and nothing placed on a vehicle without the owner''s okay.'
  else 'No live roadside request or payment unless the QA lead authorized it in writing.' end,
 first_five,restricted,sort_order from m
on conflict (id) do update set category=excluded.category, title=excluded.title, points=excluded.points, evidence_rule=excluded.evidence_rule, verification_standard=excluded.verification_standard, first_five=excluded.first_five, restricted=excluded.restricted, sort_order=excluded.sort_order;

-- Founding 100: seven cohorts, four waves of 25. Names stay blank until Dolo or the team picks real people.
insert into public.sos_network_founding_slots(id,cohort,wave)
select 'F100-'||lpad(g::text,3,'0'),
 case when g<=25 then 'Personal network' when g<=45 then 'Influencers / creators' when g<=60 then 'Business owners'
      when g<=70 then 'Athletes / entertainers' when g<=80 then 'DJs / hosts / promoters' when g<=90 then 'Community leaders' else 'Automotive' end,
 ((g-1)/25)+1
from generate_series(1,100) g
on conflict (id) do nothing;

insert into public.sos_system_config(config_key,config_value,description,category,is_active,updated_by)
values ('network_program', jsonb_build_object(
  'enrollment','invite_only',
  'points_status','proposed',
  'rewards_status','not_approved',
  'terms_version','pilot-draft-2026-11-28',
  'outbound','off'),
 'THE SIGNAL / Superhero Network switches. enrollment: invite_only | open | closed. points_status: proposed until Dolo approves the 55-mission catalog. rewards_status stays not_approved until the kit budget and terms are approved. outbound stays off: no invitations are sent by the system.',
 'network',true,'Duet')
on conflict (config_key) do nothing;

-- ---------- Helpers ----------
create or replace function private.sos_network_config() returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce((select config_value from public.sos_system_config where config_key='network_program' and is_active), '{"enrollment":"closed"}'::jsonb)
$$;

create or replace function private.sos_network_member_points(p_member uuid) returns int
language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce(sum(delta),0)::int from public.sos_network_points_ledger where member_id=p_member
$$;

create or replace function private.sos_network_rank(p_points int) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object('id',r.id,'label',r.label,'min_points',r.min_points,'max_points',r.max_points,'proposed_benefit',r.proposed_benefit,
    'next_label',(select n.label from public.sos_network_ranks n where n.sort_order=r.sort_order+1),
    'next_at',(select n.min_points from public.sos_network_ranks n where n.sort_order=r.sort_order+1))
  from public.sos_network_ranks r where p_points>=r.min_points order by r.min_points desc limit 1
$$;

create or replace function private.sos_network_audit_log(p_action text, p_type text, p_id text, p_detail jsonb)
returns void language sql security definer set search_path=pg_catalog,public as $$
  insert into public.sos_network_audit(actor_auth_id,action,target_type,target_id,detail) values (auth.uid(),p_action,p_type,p_id,coalesce(p_detail,'{}'::jsonb))
$$;

create or replace function private.sos_network_require_operator() returns void
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
  if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then
    raise exception 'Only S.O.S. operators can use Network Command' using errcode='42501';
  end if;
end $$;

revoke all on function private.sos_network_config(), private.sos_network_member_points(uuid), private.sos_network_rank(int), private.sos_network_audit_log(text,text,text,jsonb), private.sos_network_require_operator() from public, anon, authenticated;

-- ---------- Member functions ----------
create or replace function public.sos_network_catalog()
returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
  select jsonb_build_object(
    'program', (select jsonb_build_object('enrollment',c->>'enrollment','points_status',c->>'points_status','rewards_status',c->>'rewards_status','terms_version',c->>'terms_version') from (select private.sos_network_config() c) x),
    'territories', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'hint',hint) order by sort_order),'[]') from public.sos_network_territories),
    'divisions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'who',who,'primary_output',primary_output,'staff_assigned_only',staff_assigned_only) order by sort_order),'[]') from public.sos_network_divisions),
    'ranks', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'min_points',min_points,'max_points',max_points,'proposed_benefit',proposed_benefit) order by sort_order),'[]') from public.sos_network_ranks),
    'missions', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'title',title,'points',points,'evidence_rule',evidence_rule,'verification_standard',verification_standard,'first_five',first_five,'restricted',restricted) order by sort_order),'[]') from public.sos_network_missions where is_active)
  )
$$;

create or replace function public.sos_network_join(
  p_display_name text, p_territory text, p_divisions text[], p_invite_code text,
  p_contact_channel text default null, p_consent boolean default false, p_conduct boolean default false, p_shirt_size text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
  v_uid uuid := auth.uid(); v_cfg jsonb := private.sos_network_config(); v_code text := upper(btrim(coalesce(p_invite_code,'')));
  v_slot public.sos_network_founding_slots; v_ref public.sos_network_members; v_member public.sos_network_members;
  v_divs text[]; v_bad text; v_is_test boolean; v_operator boolean;
begin
  if v_uid is null then raise exception 'Sign in to join the network' using errcode='42501'; end if;
  if exists (select 1 from public.sos_network_members where auth_id=v_uid) then raise exception 'You are already a member'; end if;
  if not coalesce(p_consent,false) then raise exception 'Please agree to the member terms to join'; end if;
  if not coalesce(p_conduct,false) then raise exception 'Please confirm the safety and conduct rules to join'; end if;
  if length(btrim(coalesce(p_display_name,''))) not between 2 and 80 then raise exception 'Enter your name (2 to 80 characters)'; end if;
  if not exists (select 1 from public.sos_network_territories where id=p_territory) then raise exception 'Pick your side of town'; end if;
  v_operator := private.is_marketplace_operator(v_uid);
  v_divs := (select array_agg(distinct d) from unnest(coalesce(p_divisions,'{}')||'{insiders}'::text[]) d);
  select d into v_bad from unnest(v_divs) d left join public.sos_network_divisions x on x.id=d where x.id is null or (x.staff_assigned_only and not v_operator) limit 1;
  if v_bad is not null then raise exception 'The % lane is assigned by the S.O.S. team', v_bad; end if;

  if v_cfg->>'enrollment'='closed' then raise exception 'The network is not taking new members right now'; end if;
  if v_code<>'' then
    select * into v_slot from public.sos_network_founding_slots where invite_code=v_code and member_id is null and invitation_status in ('invited','approved_to_invite');
    if v_slot.id is null then
      select * into v_ref from public.sos_network_members where referral_code=v_code and auth_id<>v_uid and status not in ('paused','exited');
      if v_ref.id is null then raise exception 'That invite code is not valid'; end if;
    end if;
  elsif v_cfg->>'enrollment'='invite_only' and not v_operator then
    raise exception 'The network is invite-only right now. Enter the invite code you were given.';
  end if;

  v_is_test := coalesce((select coalesce((raw_app_meta_data->>'test_account')::boolean,false) or coalesce((raw_app_meta_data->>'enterprise_test_account')::boolean,false) from auth.users where id=v_uid), false);

  insert into public.sos_network_members(auth_id,member_code,display_name,territory_id,divisions,contact_channel,consent_at,terms_version,conduct_acknowledged_at,referral_code,referred_by,founding_slot_id,shirt_size,is_test,status)
  values (v_uid, 'SOS-'||lpad(nextval('public.sos_network_member_seq')::text,4,'0'), btrim(p_display_name), p_territory,
    case when v_slot.id is not null then (select array_agg(distinct d) from unnest(v_divs||'{founding_100}'::text[]) d) else v_divs end,
    nullif(p_contact_channel,''), now(), coalesce(v_cfg->>'terms_version','pilot-draft'), now(),
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), v_ref.id, v_slot.id, nullif(p_shirt_size,''), v_is_test, 'onboarded')
  returning * into v_member;

  if v_slot.id is not null then
    update public.sos_network_founding_slots set member_id=v_member.id, invitation_status='opted_in', next_action='Help them finish the first five missions', updated_at=now(), updated_by='member join' where id=v_slot.id;
  end if;
  perform private.sos_network_audit_log('member.joined','member',v_member.id::text, jsonb_build_object('member_code',v_member.member_code,'territory',p_territory,'terms_version',v_member.terms_version,'founding_slot',v_slot.id,'referred_by',v_ref.member_code));
  return jsonb_build_object('member_code',v_member.member_code,'referral_code',v_member.referral_code,'founding_slot',v_slot.id);
end $$;

create or replace function public.sos_network_me()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v_m public.sos_network_members; v_points int;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select * into v_m from public.sos_network_members where auth_id=auth.uid();
  if v_m.id is null then return jsonb_build_object('member',null); end if;
  v_points := private.sos_network_member_points(v_m.id);
  return jsonb_build_object(
    'member', jsonb_build_object('member_code',v_m.member_code,'display_name',v_m.display_name,'territory',(select label from public.sos_network_territories where id=v_m.territory_id),
       'territory_id',v_m.territory_id,'divisions',v_m.divisions,'status',v_m.status,'referral_code',v_m.referral_code,'founding_slot',v_m.founding_slot_id,'joined_at',v_m.created_at,
       'referred_by',(select member_code from public.sos_network_members where id=v_m.referred_by)),
    'points', v_points,
    'pending_points', (select coalesce(sum(m.points),0) from public.sos_network_submissions s join public.sos_network_missions m on m.id=s.mission_id where s.member_id=v_m.id and s.status='pending'),
    'rank', private.sos_network_rank(v_points),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'mission_id',s.mission_id,'title',m.title,'status',s.status,'points_awarded',s.points_awarded,'reviewer_note',s.reviewer_note,'created_at',s.created_at,'decided_at',s.decided_at) order by s.created_at desc),'[]')
                    from public.sos_network_submissions s join public.sos_network_missions m on m.id=s.mission_id where s.member_id=v_m.id),
    'referrals', (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'target_reference',r.target_reference,'stage',r.stage,'created_at',r.created_at) order by r.created_at desc),'[]') from public.sos_network_referrals r where r.member_id=v_m.id),
    'invited_members', (select count(*) from public.sos_network_members x where x.referred_by=v_m.id)
  );
end $$;

create or replace function public.sos_network_submit_mission(p_mission_id text, p_evidence_note text, p_evidence_link text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_m public.sos_network_members; v_mission public.sos_network_missions; v_id uuid; v_link text := nullif(btrim(coalesce(p_evidence_link,'')),'');
begin
  select * into v_m from public.sos_network_members where auth_id=auth.uid();
  if v_m.id is null then raise exception 'Join the network first' using errcode='42501'; end if;
  if v_m.status in ('paused','exited') then raise exception 'Your membership is paused'; end if;
  select * into v_mission from public.sos_network_missions where id=p_mission_id and is_active;
  if v_mission.id is null then raise exception 'That mission is not available'; end if;
  if v_mission.restricted then raise exception 'This mission is assigned by the QA lead only'; end if;
  if length(btrim(coalesce(p_evidence_note,''))) not between 10 and 2000 then raise exception 'Describe what you did in at least 10 characters'; end if;
  if v_link is not null and v_link !~* '^https://[^\s]+$' then raise exception 'Proof links must start with https://'; end if;
  if exists (select 1 from public.sos_network_submissions where member_id=v_m.id and mission_id=p_mission_id and occurrence_key='once') then
    raise exception 'You already submitted this mission. Each mission counts once during the pilot.';
  end if;
  insert into public.sos_network_submissions(member_id,mission_id,evidence_note,evidence_link) values (v_m.id,p_mission_id,btrim(p_evidence_note),v_link) returning id into v_id;
  perform private.sos_network_audit_log('mission.submitted','submission',v_id::text, jsonb_build_object('mission_id',p_mission_id,'member_code',v_m.member_code));
  return jsonb_build_object('submission_id',v_id,'status','pending');
end $$;

create or replace function public.sos_network_add_referral(p_kind text, p_target_reference text, p_consent boolean, p_service_category text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_m public.sos_network_members; v_key text; v_dup uuid; v_id uuid; v_stage text := 'introduced';
begin
  select * into v_m from public.sos_network_members where auth_id=auth.uid();
  if v_m.id is null then raise exception 'Join the network first' using errcode='42501'; end if;
  if p_kind not in ('customer','provider','business') then raise exception 'Pick customer, provider or business'; end if;
  if not coalesce(p_consent,false) then raise exception 'Only add people who said it is okay to be introduced'; end if;
  if length(btrim(coalesce(p_target_reference,''))) not between 3 and 300 then raise exception 'Add a name and how to reach them (3 to 300 characters)'; end if;
  v_key := regexp_replace(lower(btrim(p_target_reference)),'[^a-z0-9@]+','','g');
  if exists (select 1 from public.sos_network_referrals where member_id=v_m.id and kind=p_kind and dedupe_key=v_key) then raise exception 'You already added this introduction'; end if;
  select id into v_dup from public.sos_network_referrals where kind=p_kind and dedupe_key=v_key and member_id<>v_m.id and duplicate_of is null order by created_at limit 1;
  if v_dup is not null then v_stage := 'duplicate_hold'; end if;
  insert into public.sos_network_referrals(member_id,kind,target_reference,service_category,consent_confirmed,dedupe_key,stage,duplicate_of)
  values (v_m.id,p_kind,btrim(p_target_reference),nullif(p_service_category,''),true,v_key,v_stage,v_dup) returning id into v_id;
  perform private.sos_network_audit_log('referral.added','referral',v_id::text, jsonb_build_object('kind',p_kind,'duplicate',v_dup is not null,'member_code',v_m.member_code));
  return jsonb_build_object('referral_id',v_id,'stage',v_stage);
end $$;

-- ---------- Operator (Network Command) functions ----------
create or replace function public.sos_ops_network_overview()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
  perform private.sos_network_require_operator();
  return jsonb_build_object(
    'program', private.sos_network_config(),
    'counts', jsonb_build_object(
      'members', (select count(*) from public.sos_network_members where not is_test),
      'test_members', (select count(*) from public.sos_network_members where is_test),
      'active_7_days', (select count(distinct s.member_id) from public.sos_network_submissions s join public.sos_network_members m on m.id=s.member_id where not m.is_test and s.status='approved' and s.decided_at>now()-interval '7 days'),
      'pending_reviews', (select count(*) from public.sos_network_submissions where status='pending'),
      'approved_missions', (select count(*) from public.sos_network_submissions where status='approved'),
      'points_awarded', (select coalesce(sum(delta),0) from public.sos_network_points_ledger),
      'founding_selected', (select count(*) from public.sos_network_founding_slots where invitation_status<>'not_selected'),
      'founding_invited', (select count(*) from public.sos_network_founding_slots where invitation_status in ('invited','opted_in')),
      'founding_joined', (select count(*) from public.sos_network_founding_slots where member_id is not null),
      'customer_intros', (select count(*) from public.sos_network_referrals where kind='customer'),
      'provider_intros', (select count(*) from public.sos_network_referrals where kind='provider'),
      'business_intros', (select count(*) from public.sos_network_referrals where kind='business'),
      'duplicate_holds', (select count(*) from public.sos_network_referrals where stage='duplicate_hold'),
      'kit_requests', (select count(*) from public.sos_network_kit_claims where approval_status='requested'),
      'qa_open', (select count(*) from public.sos_network_qa_reports where status not in ('closed'))),
    'territories', (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'label',t.label,'hint',t.hint,'member_target',t.member_target,
        'members',(select count(*) from public.sos_network_members m where m.territory_id=t.id and not m.is_test),
        'founding',(select count(*) from public.sos_network_founding_slots f where f.territory_id=t.id and f.invitation_status<>'not_selected')) order by t.sort_order),'[]') from public.sos_network_territories t),
    'pending', (select coalesce(jsonb_agg(x order by x->>'created_at'),'[]') from (
        select jsonb_build_object('id',s.id,'created_at',s.created_at,'mission_id',s.mission_id,'mission',mi.title,'category',mi.category,'points',mi.points,'evidence_rule',mi.evidence_rule,
          'evidence_note',s.evidence_note,'evidence_link',s.evidence_link,'member_code',m.member_code,'member_name',m.display_name,'territory',t.label,'is_test',m.is_test,
          'own_submission', m.auth_id=auth.uid()) x
        from public.sos_network_submissions s join public.sos_network_members m on m.id=s.member_id join public.sos_network_missions mi on mi.id=s.mission_id join public.sos_network_territories t on t.id=m.territory_id
        where s.status='pending' limit 300) q),
    'recent_decisions', (select coalesce(jsonb_agg(x order by x->>'decided_at' desc),'[]') from (
        select jsonb_build_object('id',s.id,'decided_at',s.decided_at,'mission',mi.title,'member_code',m.member_code,'member_name',m.display_name,'status',s.status,'points_awarded',s.points_awarded,'reviewer_note',s.reviewer_note) x
        from public.sos_network_submissions s join public.sos_network_members m on m.id=s.member_id join public.sos_network_missions mi on mi.id=s.mission_id
        where s.status<>'pending' order by s.decided_at desc limit 40) q),
    'referrals', (select coalesce(jsonb_agg(x order by x->>'created_at' desc),'[]') from (
        select jsonb_build_object('id',r.id,'kind',r.kind,'target_reference',r.target_reference,'service_category',r.service_category,'stage',r.stage,'owner',r.owner,'outcome_note',r.outcome_note,
          'created_at',r.created_at,'member_code',m.member_code,'member_name',m.display_name,'duplicate', r.duplicate_of is not null) x
        from public.sos_network_referrals r join public.sos_network_members m on m.id=r.member_id order by r.created_at desc limit 300) q),
    'members', (select coalesce(jsonb_agg(x order by (x->>'points')::int desc),'[]') from (
        select jsonb_build_object('member_code',m.member_code,'display_name',m.display_name,'territory',t.label,'divisions',m.divisions,'status',m.status,'is_test',m.is_test,
          'founding_slot',m.founding_slot_id,'points',private.sos_network_member_points(m.id),'rank',private.sos_network_rank(private.sos_network_member_points(m.id))->>'label',
          'joined_at',m.created_at,'referred_by',(select r.member_code from public.sos_network_members r where r.id=m.referred_by)) x
        from public.sos_network_members m join public.sos_network_territories t on t.id=m.territory_id) q),
    'founding_slots', (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'cohort',f.cohort,'wave',f.wave,'full_name',f.full_name,'contact_channel',f.contact_channel,'contact_detail',f.contact_detail,
          'territory_id',f.territory_id,'owner',f.owner,'invitation_status',f.invitation_status,'invite_code',f.invite_code,'next_action',f.next_action,'notes',f.notes,
          'member_code',(select m.member_code from public.sos_network_members m where m.id=f.member_id)) order by f.id),'[]') from public.sos_network_founding_slots f)
  );
end $$;

create or replace function public.sos_ops_network_review_submission(p_submission_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_s public.sos_network_submissions; v_member public.sos_network_members; v_points int;
begin
  perform private.sos_network_require_operator();
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_s from public.sos_network_submissions where id=p_submission_id for update;
  if v_s.id is null then raise exception 'Submission not found'; end if;
  if v_s.status<>'pending' then raise exception 'This submission was already decided'; end if;
  select * into v_member from public.sos_network_members where id=v_s.member_id;
  if v_member.auth_id=auth.uid() then raise exception 'You cannot review your own submission. Another reviewer has to decide it.' using errcode='42501'; end if;
  if p_decision='rejected' and length(btrim(coalesce(p_note,'')))<3 then raise exception 'Add a short reason when rejecting'; end if;
  v_points := case when p_decision='approved' then (select points from public.sos_network_missions where id=v_s.mission_id) else 0 end;
  update public.sos_network_submissions set status=p_decision, points_awarded=v_points, reviewer_auth_id=auth.uid(), reviewer_note=nullif(btrim(coalesce(p_note,'')),''), decided_at=now() where id=v_s.id;
  if v_points>0 then
    insert into public.sos_network_points_ledger(member_id,event_key,delta,reason,source_submission_id,actor_auth_id)
    values (v_s.member_id,'submission:'||v_s.id,v_points,'Mission '||v_s.mission_id||' approved',v_s.id,auth.uid())
    on conflict (event_key) do nothing;
    update public.sos_network_members set status = case when status in ('registered','onboarded','inactive') then 'activated' else status end, updated_at=now() where id=v_s.member_id;
  end if;
  perform private.sos_network_audit_log('mission.reviewed','submission',v_s.id::text, jsonb_build_object('decision',p_decision,'points',v_points,'member_code',v_member.member_code));
  return jsonb_build_object('status',p_decision,'points_awarded',v_points);
end $$;

create or replace function public.sos_ops_network_adjust_points(p_member_code text, p_delta int, p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_m public.sos_network_members; v_key text := 'adjust:'||gen_random_uuid();
begin
  perform private.sos_network_require_operator();
  select * into v_m from public.sos_network_members where member_code=upper(btrim(p_member_code));
  if v_m.id is null then raise exception 'Member not found'; end if;
  if v_m.auth_id=auth.uid() then raise exception 'You cannot adjust your own points' using errcode='42501'; end if;
  if coalesce(p_delta,0)=0 or abs(p_delta)>5000 then raise exception 'Adjustment must be between -5000 and 5000 and not zero'; end if;
  if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Give a reason for the correction'; end if;
  insert into public.sos_network_points_ledger(member_id,event_key,delta,reason,actor_auth_id) values (v_m.id,v_key,p_delta,'Correction: '||btrim(p_reason),auth.uid());
  perform private.sos_network_audit_log('points.adjusted','member',v_m.id::text, jsonb_build_object('delta',p_delta,'reason',p_reason,'member_code',v_m.member_code));
  return jsonb_build_object('points',private.sos_network_member_points(v_m.id));
end $$;

create or replace function public.sos_ops_network_update_referral(p_referral_id uuid, p_stage text, p_owner text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_r public.sos_network_referrals;
begin
  perform private.sos_network_require_operator();
  select * into v_r from public.sos_network_referrals where id=p_referral_id for update;
  if v_r.id is null then raise exception 'Introduction not found'; end if;
  if exists (select 1 from public.sos_network_members m where m.id=v_r.member_id and m.auth_id=auth.uid()) then raise exception 'You cannot move your own introduction' using errcode='42501'; end if;
  update public.sos_network_referrals set stage=p_stage, owner=coalesce(nullif(btrim(coalesce(p_owner,'')),''),owner), outcome_note=coalesce(nullif(btrim(coalesce(p_note,'')),''),outcome_note),
    verified_at=case when p_stage not in ('introduced','duplicate_hold','not_converted') then coalesce(verified_at,now()) else verified_at end, updated_at=now()
  where id=v_r.id;
  perform private.sos_network_audit_log('referral.stage','referral',v_r.id::text, jsonb_build_object('from',v_r.stage,'to',p_stage,'kind',v_r.kind));
  return jsonb_build_object('stage',p_stage);
end $$;

create or replace function public.sos_ops_network_update_slot(p_slot_id text, p_full_name text, p_contact_channel text, p_contact_detail text, p_territory text, p_owner text, p_status text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_f public.sos_network_founding_slots; v_status text := coalesce(nullif(p_status,''),'not_selected'); v_code text; v_next text;
begin
  perform private.sos_network_require_operator();
  select * into v_f from public.sos_network_founding_slots where id=p_slot_id for update;
  if v_f.id is null then raise exception 'Slot not found'; end if;
  if v_status not in ('not_selected','selected','approved_to_invite','invited','opted_in','declined','no_response') then raise exception 'Unknown status'; end if;
  if v_status='opted_in' and v_f.member_id is null then raise exception 'A slot becomes opted in only when the person joins with their invite code'; end if;
  if v_status in ('selected','approved_to_invite','invited') and length(btrim(coalesce(p_full_name,'')))<2 then raise exception 'Add the person''s real name first'; end if;
  if p_territory is not null and p_territory<>'' and not exists (select 1 from public.sos_network_territories where id=p_territory) then raise exception 'Unknown side of town'; end if;
  v_code := v_f.invite_code;
  if v_status in ('approved_to_invite','invited') and v_code is null then v_code := 'F100'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)); end if;
  v_next := case v_status when 'not_selected' then 'Pick a real person and confirm they are okay being invited'
    when 'selected' then 'Dolo approves the invitation message, then mark approved to invite'
    when 'approved_to_invite' then 'Send the invite yourself (text or in person) with their invite code, then mark invited'
    when 'invited' then 'One follow-up at most; they join at superherosonstandby.com/network with their code'
    when 'declined' then 'No more follow-ups'
    when 'no_response' then 'No more follow-ups unless they reach out'
    else v_f.next_action end;
  update public.sos_network_founding_slots set full_name=nullif(btrim(coalesce(p_full_name,'')),''), contact_channel=nullif(p_contact_channel,''), contact_detail=nullif(btrim(coalesce(p_contact_detail,'')),''),
    territory_id=nullif(p_territory,''), owner=nullif(btrim(coalesce(p_owner,'')),''), invitation_status=v_status, invite_code=v_code, next_action=v_next,
    notes=coalesce(nullif(btrim(coalesce(p_notes,'')),''),notes), updated_at=now(), updated_by=coalesce((select email from auth.users where id=auth.uid()),'operator')
  where id=v_f.id;
  perform private.sos_network_audit_log('founding.slot','slot',v_f.id, jsonb_build_object('from',v_f.invitation_status,'to',v_status));
  return jsonb_build_object('status',v_status,'invite_code',v_code,'next_action',v_next);
end $$;

revoke all on function public.sos_network_catalog(), public.sos_network_join(text,text,text[],text,text,boolean,boolean,text), public.sos_network_me(),
  public.sos_network_submit_mission(text,text,text), public.sos_network_add_referral(text,text,boolean,text),
  public.sos_ops_network_overview(), public.sos_ops_network_review_submission(uuid,text,text), public.sos_ops_network_adjust_points(text,int,text),
  public.sos_ops_network_update_referral(uuid,text,text,text), public.sos_ops_network_update_slot(text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.sos_network_catalog(), public.sos_network_join(text,text,text[],text,text,boolean,boolean,text), public.sos_network_me(),
  public.sos_network_submit_mission(text,text,text), public.sos_network_add_referral(text,text,boolean,text),
  public.sos_ops_network_overview(), public.sos_ops_network_review_submission(uuid,text,text), public.sos_ops_network_adjust_points(text,int,text),
  public.sos_ops_network_update_referral(uuid,text,text,text), public.sos_ops_network_update_slot(text,text,text,text,text,text,text,text) to authenticated;

-- Friendly stage check for Network Command (applied live as sos_superhero_network_polish).
create or replace function public.sos_ops_network_update_referral(p_referral_id uuid, p_stage text, p_owner text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_r public.sos_network_referrals; v_allowed text[];
begin
  perform private.sos_network_require_operator();
  select * into v_r from public.sos_network_referrals where id=p_referral_id for update;
  if v_r.id is null then raise exception 'Introduction not found'; end if;
  if exists (select 1 from public.sos_network_members m where m.id=v_r.member_id and m.auth_id=auth.uid()) then raise exception 'You cannot move your own introduction' using errcode='42501'; end if;
  v_allowed := case v_r.kind when 'customer' then array['introduced','registered','activated','first_paid_service','retained','not_converted','duplicate_hold']
    when 'provider' then array['introduced','applied','qualified','approved','dispatch_ready','active','not_converted','duplicate_hold']
    else array['introduced','agreed','placed','active','not_converted','duplicate_hold'] end;
  if not (p_stage = any(v_allowed)) then raise exception 'A % introduction cannot move to that stage', v_r.kind; end if;
  update public.sos_network_referrals set stage=p_stage, owner=coalesce(nullif(btrim(coalesce(p_owner,'')),''),owner), outcome_note=coalesce(nullif(btrim(coalesce(p_note,'')),''),outcome_note),
    verified_at=case when p_stage not in ('introduced','duplicate_hold','not_converted') then coalesce(verified_at,now()) else verified_at end, updated_at=now()
  where id=v_r.id;
  perform private.sos_network_audit_log('referral.stage','referral',v_r.id::text, jsonb_build_object('from',v_r.stage,'to',p_stage,'kind',v_r.kind));
  return jsonb_build_object('stage',p_stage);
end $$;
revoke all on function public.sos_ops_network_update_referral(uuid,text,text,text) from public, anon;
grant execute on function public.sos_ops_network_update_referral(uuid,text,text,text) to authenticated;
do $$ begin if not exists (select 1 from public.sos_network_members) then perform setval('public.sos_network_member_seq',1,false); end if; end $$;
