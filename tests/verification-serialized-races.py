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
  sql(proposed)
  def launch(name,body):
   e=dict(env,PGAPPNAME=name)
   return subprocess.Popen([str(B/'psql'),'-X','-At','-v','ON_ERROR_STOP=1','-c',body],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=e)
  def waitfor(name,event):
   until=time.monotonic()+5
   while time.monotonic()<until:
    if sql("select count(*) from pg_stat_activity where application_name='%s' and %s"%(name,event))=='1':return
    time.sleep(.03)
   raise AssertionError('wait not observed '+name)
  auth="set qa.uid='00000000-0000-0000-0000-000000000099';set qa.operator='true';"
  def call(t,s):return "select public.sos_ops_review_verification_check('00000000-0000-0000-0000-000000000001','%s','%s','concurrent fixture');"%(t,s)
  for label,setup,first,second,expected in [
   ('two final passes serialize to verified',"update sos_hero_verification_checks set status='pending' where check_type in ('identity','equipment');",('identity','passed'),('equipment','passed'),'verified'),
   ('failure plus other pass serialize to rejected','',('identity','failed'),('equipment','passed'),'rejected')]:
   sql('delete from sos_hero_verification_checks;'+full+setup)
   a=launch('qa_first','begin;'+auth+call(*first)+'select pg_sleep(2);commit;')
   waitfor('qa_first',"wait_event='PgSleep'")
   b=launch('qa_second','begin;'+auth+call(*second)+'commit;')
   waitfor('qa_second',"wait_event_type='Lock'")
   for proc in [a,b]:
    out,err=proc.communicate(timeout=10);assert proc.returncode==0,err
   actual=sql('select verification_status from sos_heroes');assert actual==expected,(label,actual)
   states=json.loads(sql('select jsonb_object_agg(check_type,status) from sos_hero_verification_checks;'))
   assert states[first[0]]==first[1] and states[second[0]]==second[1]
   checks.append({'case':label,'actual_overall':actual,'identity':states['identity'],'equipment':states['equipment'],'lock_wait_observed':True})
  evidence="select public.sos_hero_submit_verification_evidence('equipment','sos/00000000-0000-0000-0000-000000000099/00000000-0000-0000-0000-000000000001/equipment/fixture.pdf');"
  init="select private.sos_initialize_hero_verification('00000000-0000-0000-0000-000000000001');"
  recompute_call="select private.sos_recompute_hero_verification('00000000-0000-0000-0000-000000000001');"
  for label,first,second in [('review then evidence',call('equipment','failed'),evidence),('evidence then review',evidence,call('equipment','failed')),('initializer then review',init,call('identity','failed')),('review then initializer',call('identity','failed'),init),('review then recompute',call('identity','failed'),recompute_call)]:
   sql('delete from sos_hero_verification_checks;'+full)
   a=launch('qa_first','begin;'+auth+first+'select pg_sleep(2);commit;')
   waitfor('qa_first',"wait_event='PgSleep'")
   b=launch('qa_second','begin;'+auth+second+'commit;')
   waitfor('qa_second',"wait_event_type='Lock'")
   for proc in [a,b]:
    out,err=proc.communicate(timeout=10);assert proc.returncode==0,err
   expected='documents_submitted' if label=='review then evidence' else 'rejected'
   actual=sql('select verification_status from sos_heroes');assert actual==expected,(label,actual)
   checks.append({'case':label,'actual_overall':actual,'lock_wait_observed':True,'no_deadlock':True})
 finally:
  if started:run('pg_ctl',['-D',tmp+'/data','-m','fast','stop'])
result={'passed':len(checks),'checks':checks,'production_writes':0,'cluster_removed':True,'postgres':'17.11','limits':'Actual pending migration with real overlapping sessions; minimal hero schema, saved verification schema and synthetic authorization. Not production incident proof. Combined repository migration; not deployed. Evidence/user/storage fixtures are synthetic; direct external writers and account deletion not covered.'}
print(json.dumps(result,indent=2))
