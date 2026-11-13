import json,os,subprocess,tempfile,time
from pathlib import Path
R=Path(__file__).parent;B=Path('/opt/homebrew/opt/postgresql@17/bin');checks=[]
F=R/'fixtures/verification'
source=(F/'review.sql').read_text()
proposed=(R.parent/'supabase/migrations/20261106135529_serialize_sos_verification_and_recheck_active_account.sql').read_text()
with tempfile.TemporaryDirectory(prefix='sos-review-race-',dir='/tmp') as tmp:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=tmp,PGPORT='55465',PGDATABASE='postgres')
 def run(n,args=[],s=None):
  r=subprocess.run([str(B/n),*args],input=s,text=True,capture_output=True,env=env,timeout=30)
  if r.returncode:raise RuntimeError(r.stderr)
  return r.stdout.strip()
 def sql(s):return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s)
 def evaluate(label,setup,expected):
  sql('delete from sos_hero_verification_checks;'+setup)
  before=sql('select coalesce(jsonb_agg(to_jsonb(t) order by check_type),\'[]\') from sos_hero_verification_checks t;')
  sql("select private.sos_recompute_hero_verification('00000000-0000-0000-0000-000000000001');")
  actual=sql('select verification_status from sos_heroes;');assert actual==expected,(label,actual,expected)
  assert sql('select coalesce(jsonb_agg(to_jsonb(t) order by check_type),\'[]\') from sos_hero_verification_checks t;')==before
  checks.append({'case':label,'status':actual,'check_rows_unchanged':True})
 single="insert into sos_hero_verification_checks(hero_id,check_type,status) values('00000000-0000-0000-0000-000000000001','payout_account','passed');"
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
  sql('alter table sos_heroes add on_duty bool default false;create role anon;create role authenticated;create role service_role;')
  sql(proposed)
  live=json.loads((F/'access-20261106.json').read_text())
  def signature(row):
   args=','.join(a.strip().split()[-1] for a in row['args'].split(',') if a.strip())
   return row['schema']+'.'+row['proname']+'('+args+')'
  for row in live:
   sig=signature(row)
   sql('revoke all on function '+sig+' from public,anon,authenticated,service_role;')
   for role,field in [('anon','anon_execute'),('authenticated','authenticated_execute'),('service_role','service_execute')]:
    if row[field]:sql('grant execute on function '+sig+' to '+role+';')
  sql('grant usage on schema public to anon,authenticated,service_role;')
  snapshot="select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'acl',p.proacl::text,'owner',p.proowner::regrole::text,'security_definer',p.prosecdef,'config',p.proconfig) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('sos_initialize_hero_verification','sos_recompute_hero_verification','sos_hero_submit_verification_evidence','sos_hero_verification_status','sos_ops_review_verification_check');"
  before=sql(snapshot);sql(proposed);assert sql(snapshot)==before
  checks.append({'case':'five function ACL/owner/security/search_path snapshots preserved','passed':True})
  for row in live:
   for role,field in [('anon','anon_execute'),('authenticated','authenticated_execute'),('service_role','service_execute')]:
    actual=sql("select has_function_privilege('%s','%s','EXECUTE');"%(role,signature(row)))=='t'
    assert actual==row[field],(role,row['proname'],actual)
    checks.append({'case':role+' '+row['proname'],'execute':actual})
  def denied(role,call,expected):
   q="set role "+role+";DO $qa$ begin begin "+call+";raise exception 'expected denial';exception when sqlstate '42501' then if position('"+expected+"' in sqlerrm)=0 then raise;end if;end;end $qa$;"
   sql(q);checks.append({'case':role+' '+expected+' '+call[:70],'denied':True})
  calls=["perform public.sos_hero_verification_status()","perform public.sos_hero_submit_verification_evidence('equipment','fixture')","perform public.sos_ops_review_verification_check('00000000-0000-0000-0000-000000000001','equipment','passed',null)"]
  for call in calls:denied('anon',call,'permission denied for function')
  for call,expected in zip(calls,['Authentication required','Authentication required','Marketplace operator access required']):denied('authenticated',call,expected)
 finally:
  if started:run('pg_ctl',['-D',tmp+'/data','-m','fast','stop'])
print(json.dumps({'checks':checks,'passed':len(checks),'postgres':'17.11','production_writes':0,'cluster_removed':True,'limits':'Fresh live ACL matrix recreated locally; actual combined migration and role calls, synthetic auth/operator/storage and minimal tables. Not production RLS/full-schema/positive operator authority proof.'},indent=2))
