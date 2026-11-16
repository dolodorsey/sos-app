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
  sql('alter table sos_heroes add on_duty bool default false;')
  auth="set qa.uid='00000000-0000-0000-0000-000000000099';set qa.operator='true';"
  def launch(name,body):
   e=dict(env,PGAPPNAME=name)
   return subprocess.Popen([str(B/'psql'),'-X','-At','-v','ON_ERROR_STOP=1','-c',body],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=e)
  def waitfor(name,event):
   until=time.monotonic()+5
   while time.monotonic()<until:
    if sql("select count(*) from pg_stat_activity where application_name='%s' and %s"%(name,event))=='1':return
    time.sleep(.03)
   raise AssertionError('no observed wait')

  for label,reader in [('initializer after deletion',"select private.sos_initialize_hero_verification('00000000-0000-0000-0000-000000000001');"),('status begun before deletion commits','select public.sos_hero_verification_status();')]:
   sql("update sos_users set auth_id='00000000-0000-0000-0000-000000000099',status='active';delete from sos_hero_verification_checks;"+full)
   # Relevant lock/delete/deactivation sequence from the live anonymization function.
   deletion="begin;select id from sos_users for update;select id from sos_heroes for update;delete from sos_hero_verification_checks;update sos_heroes set on_duty=false,stripe_connect_id=null,verification_status='rejected';update sos_users set auth_id=null,status='deactivated';select pg_sleep(2);commit;"
   a=launch('qa_delete',deletion);waitfor('qa_delete',"wait_event='PgSleep'")
   b=launch('qa_reader',auth+reader);waitfor('qa_reader',"wait_event_type='Lock'")
   out,err=a.communicate(timeout=10);assert a.returncode==0,err
   out,err=b.communicate(timeout=10);assert b.returncode==0,err
   count=int(sql('select count(*) from sos_hero_verification_checks'));assert count==0,count
   assert sql('select status from sos_users')=='deactivated'
   result={'case':label,'recreated_checks':count,'account_status':'deactivated','lock_wait_observed':True}
   if reader.endswith('verification_status();'):
    value=json.loads(out.strip().splitlines()[-1]);result.update(returned_state=value['state']);assert value=={'state':'not_hero'},value
   checks.append(result)
  # Reverse ordering: reader holds the Hero lock before deletion reaches it.
  for label,reader in [('initializer before deletion',"select private.sos_initialize_hero_verification('00000000-0000-0000-0000-000000000001');"),('status before deletion','select public.sos_hero_verification_status();')]:
   sql("update sos_users set auth_id='00000000-0000-0000-0000-000000000099',status='active';delete from sos_hero_verification_checks;")
   a=launch('qa_reader','begin;'+auth+reader+'select pg_sleep(2);commit;');waitfor('qa_reader',"wait_event='PgSleep'")
   b=launch('qa_delete',deletion);waitfor('qa_delete',"wait_event_type='Lock'")
   for proc in [a,b]:
    out,err=proc.communicate(timeout=10);assert proc.returncode==0,err
   assert sql('select count(*) from sos_hero_verification_checks')=='0'
   assert sql('select status from sos_users')=='deactivated'
   checks.append({'case':label,'final_checks':0,'account_status':'deactivated','lock_wait_observed':True,'no_deadlock':True})
  for label,change,expected in [('active','',9),('inactive',"update sos_users set status='deactivated';",0),('no auth',"update sos_users set auth_id=null;",0),('not hero',"update sos_users set role='citizen';",0),('demo user',"update sos_users set is_demo=true;",0),('demo hero',"update sos_heroes set is_demo=true;",0)]:
   sql("delete from sos_hero_verification_checks;update sos_users set status='active',role='hero',is_demo=false,auth_id='00000000-0000-0000-0000-000000000099';update sos_heroes set is_demo=false;"+change+"select private.sos_initialize_hero_verification('00000000-0000-0000-0000-000000000001');")
   assert int(sql('select count(*) from sos_hero_verification_checks'))==expected
   checks.append({'case':label,'checks_created':expected})
 finally:
  if started:run('pg_ctl',['-D',tmp+'/data','-m','fast','stop'])
result={'checks':checks,'production_writes':0,'cluster_removed':True,'postgres':'17.11','limits':'Actual combined repository migration initializer/status reader; extracted relevant anonymization lock/delete/deactivation sequence, not full anonymization function. Minimal parent schema and synthetic auth. Local guard verification only; full anonymization and other concurrent writers remain unverified.'}
print(json.dumps(result,indent=2))
