import json,os,subprocess,tempfile,time
from pathlib import Path
R=Path(__file__).parent;B=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'));checks=[]
T=R
F=T/'fixtures/verification'
A=T/'fixtures/anonymization'
with tempfile.TemporaryDirectory(prefix='sos-review-race-',dir='/tmp') as tmp:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=tmp,PGPORT='55465',PGDATABASE='postgres')
 def run(n,args=[],s=None):
  r=subprocess.run([str(B/n),*args],input=s,text=True,capture_output=True,env=env,timeout=30)
  if r.returncode:raise RuntimeError(r.stderr)
  return r.stdout.strip()
 def sql(s):return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s)
 full="insert into sos_hero_verification_checks(hero_id,check_type,status) select '00000000-0000-0000-0000-000000000001',unnest(array['identity','background','license','insurance','equipment','vehicle','service_skills','test_mission','payout_account']),'passed';"
 started=False
 try:
  run('initdb',['-D',tmp+'/data','-A','trust','--no-locale']);run('pg_ctl',['-D',tmp+'/data','-l',tmp+'/log','-o',f"-c listen_addresses='' -k {tmp} -p 55465",'start']);started=True
  sql('create schema private;create table sos_heroes(id uuid primary key,id_verified bool,background_cleared bool,license_verified bool,insurance_verified bool,test_mission_passed bool,verification_status text,updated_at timestamptz);insert into sos_heroes(id) values(\'00000000-0000-0000-0000-000000000001\');')
  v=json.loads((F/'schema.json').read_text());cols=[]
  for c in v['columns']:
   typ={'bool':'boolean','_text':'text[]'}.get(c['type'],c['type']);cols.append(c['name']+' '+typ+(' default '+c['default'] if c['default'] else '')+(' not null' if c['nullable']=='NO' else ''))
  cols+=['constraint '+c['name']+' '+c['definition'] for c in v['constraints']]
  sql('create table sos_hero_verification_checks('+','.join(cols)+');')
  recompute=json.loads((F/'source.json').read_text())['definition'];sql(recompute)
  sql("create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;create function private.is_marketplace_operator(uuid) returns bool language sql as $$select current_setting('qa.operator',true)='true'$$;create table private.marketplace_operators(auth_id uuid,email text,is_active bool);insert into private.marketplace_operators values('00000000-0000-0000-0000-000000000099','fixture@example.invalid',true);")
  sql("alter table sos_heroes add user_id uuid,add is_demo bool default false,add stripe_transfer_status text,add stripe_connect_id text;create table sos_users(id uuid primary key,auth_id uuid,role text,status text,is_demo bool);insert into sos_users values('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000099','hero','active',false);update sos_heroes set user_id='00000000-0000-0000-0000-000000000010';create schema storage;create table storage.objects(bucket_id text,name text);insert into storage.objects values('marketplace-verification','sos/00000000-0000-0000-0000-000000000099/00000000-0000-0000-0000-000000000001/equipment/fixture.pdf');")
  sql('alter table sos_heroes add on_duty bool default false;')
  # Expand fixture to every live column referenced by the complete routine.
  columns=json.loads((A/'columns.json').read_text())
  tables=sorted({x['table_name'] for x in columns})
  for table in tables:
   exists=sql("select to_regclass('public.%s') is not null"%table)=='t'
   if not exists:sql('create table '+table+'('+','.join('"'+c['column_name']+'" '+c['type'] for c in columns if c['table_name']==table)+');')
   else:
    known=sql("select attname from pg_attribute where attrelid='public.%s'::regclass and attnum>0 and not attisdropped"%table).splitlines()
    for c in columns:
     if c['table_name']==table and c['column_name'] not in known:sql('alter table '+table+' add column "'+c['column_name']+'" '+c['type']+';')
  sql((A/'source.sql').read_text())
  constraints=json.loads((A/'constraints.json').read_text())
  support=[c for c in constraints if c['table_name']=='sos_support_tickets']
  sql('alter table sos_missions add primary key(id);')
  for c in support:
   sql('alter table sos_support_tickets add constraint '+c['name']+' '+c['definition']+';')
  for col in ['category','created_at','description','id','priority','status','subject','ticket_number','updated_at','user_id']:
   sql('alter table sos_support_tickets alter column '+col+' set not null;')
  sql("update sos_users set email='qa@example.invalid';insert into sos_support_tickets(id,user_id,ticket_number,category,priority,status,subject,description,created_at,updated_at) values('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-000000000010','QA-ONLY','account','normal','open','Fixture subject','Fixture private description',now(),now());"+full)
  snapshot="select jsonb_build_object('users',(select jsonb_agg(to_jsonb(x)) from sos_users x),'heroes',(select jsonb_agg(to_jsonb(x)) from sos_heroes x),'checks',(select jsonb_agg(to_jsonb(x) order by check_type) from sos_hero_verification_checks x),'tickets',(select jsonb_agg(to_jsonb(x)) from sos_support_tickets x));"
  for c in json.loads((A/'dependent-constraints.json').read_text()):
   sql('alter table '+c['table_name']+' add constraint '+c['name']+' '+c['definition']+';')
  for c in json.loads((A/'dependent-columns.json').read_text()):
   if c['is_nullable']=='NO':sql('alter table '+c['table_name']+' alter column '+c['column_name']+' set not null;')
  uid='00000000-0000-0000-0000-000000000010';other='00000000-0000-0000-0000-000000000020';hero='00000000-0000-0000-0000-000000000001'
  sql("insert into sos_users(id,role,status) values('%s','citizen','active');"%other)
  for n,u in [(100,uid),(200,other)]:
   mid='00000000-0000-0000-0000-%012d'%n
   hid=hero if u==uid else '00000000-0000-0000-0000-000000000002'
   if u==other:sql("insert into sos_heroes(id,user_id) values('%s','%s');"%(hid,u))
   sql("insert into sos_missions(id,citizen_id,hero_id,status) values('%s','%s','%s','completed');"%(mid,u,hid))
   sql("insert into sos_disputes(id,mission_id,opened_by,reason,status,description,evidence_urls) values('%s','%s','%s','other','open','Private description',array['private']);"%(mid,mid,u))
   sql("insert into sos_mission_events(id,mission_id,event_type,payload,lat,lng) values('%s','%s','message','{\"private\":true}',1,2);"%(mid,mid))
   sql("insert into sos_proof_of_service(id,mission_id,hero_id,submitted_items,notes,media_urls,lat,lng) values('%s','%s','%s','{\"private\":true}','Private',array['private'],1,2);"%(mid,mid,hid))
   sql("insert into sos_ratings(id,mission_id,rated_by,rated_user,rating,review_text,tags,is_public) values('%s','%s','%s','%s',5,'Private',array['private'],true);"%(mid,mid,u,u))
   sql("insert into sos_safety_events(id,mission_id,triggered_by,event_type,notes,lat,lng) values('%s','%s','%s','panic','Private',1,2);"%(mid,mid,u))
  tables=['sos_disputes','sos_mission_events','sos_proof_of_service','sos_ratings','sos_safety_events']
  unrelated={t:sql("select to_jsonb(t) from %s t where id='00000000-0000-0000-0000-000000000200'"%t) for t in tables}
  before=sql(snapshot)
  try:
   sql("select public.sos_anonymize_account('00000000-0000-0000-0000-000000000099');")
   raise AssertionError('Expected live description check failure')
  except RuntimeError as e:
   assert 'sos_support_tickets_description_check' in str(e),str(e)
  assert before==sql(snapshot)
  checks.append({'case':'live routine fails support description constraint','reproduced':True,'four_table_snapshot_unchanged':True})
  sql((T.parent/'supabase/migrations/20261105214300_fix_sos_support_anonymization.sql').read_text())
  definition=sql("select pg_get_functiondef('public.sos_anonymize_account(uuid)'::regprocedure)")
  try:
   sql((T.parent/'supabase/migrations/20261105214300_fix_sos_support_anonymization.sql').read_text())
   raise AssertionError('Expected changed-source rejection')
  except RuntimeError as e:
   assert 'source changed; review before applying' in str(e),str(e)
  assert definition==sql("select pg_get_functiondef('public.sos_anonymize_account(uuid)'::regprocedure)")
  checks.append({'case':'changed-source replay rejected without modifying function','passed':True})
  value=json.loads(sql("select public.sos_anonymize_account('00000000-0000-0000-0000-000000000099');"))
  assert value['profile_anonymized'] and value['support_cases_scrubbed']==1 and value['verification_rows_deleted']==9,value
  checks.append({'case':'proposed routine scrubs ticket and deactivates profile','passed':True})
  assert sql("select description='Account deleted.' and subject='Deleted account support record' and status='closed' and resolved_at is not null from sos_support_tickets")=='t'
  checks.append({'case':'neutral nonpersonal description passes actual constraint','passed':True})
  assert sql('select count(*) from sos_hero_verification_checks')=='0'
  assert sql("select status='deactivated' and auth_id is null and email is null from sos_users where id='00000000-0000-0000-0000-000000000010'")=='t'
  checks.append({'case':'verification deletion and account anonymization complete','passed':True})
  predicates={
   'sos_disputes':"description is null and evidence_urls is null and resolution is not null",
   'sos_mission_events':"payload='{}'::jsonb and lat is null and lng is null",
   'sos_proof_of_service':"submitted_items='{}'::jsonb and notes is null and media_urls is null and lat is null and lng is null",
   'sos_ratings':"review_text is null and tags is null and is_public=false",
   'sos_safety_events':"notes is null and lat is null and lng is null and contacts_notified is null"}
  for t,predicate in predicates.items():
   assert sql("select %s from %s where id='00000000-0000-0000-0000-000000000100'"%(predicate,t))=='t',t
   assert unrelated[t]==sql("select to_jsonb(t) from %s t where id='00000000-0000-0000-0000-000000000200'"%t),t
   checks.append({'case':t+' targeted scrub and unrelated row unchanged','passed':True})
  before=sql(snapshot)
  value=json.loads(sql("select public.sos_anonymize_account('00000000-0000-0000-0000-000000000099');"))
  assert value['found']==False and before==sql(snapshot)
  checks.append({'case':'repeat anonymization no-op','passed':True})
 finally:
  if started:run('pg_ctl',['-D',tmp+'/data','-m','fast','stop'])
result={'checks':checks,'production_writes':0,'cluster_removed':True,'postgres':'17.11','limits':'Complete anonymization routine plus pending support repair; actual support and five dependent table constraints/NOT NULLs with target and unrelated rows. Other tables mostly empty/simplified; triggers/RLS/HTTP and complete production schema not covered.'}
print(json.dumps(result,indent=2))
