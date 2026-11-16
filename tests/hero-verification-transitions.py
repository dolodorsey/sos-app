import json,os,subprocess,tempfile
from pathlib import Path
R=Path(__file__).parent;B=Path('/opt/homebrew/opt/postgresql@17/bin');checks=[]
F=R/'fixtures/verification'
source=(F/'review.sql').read_text()
proposed=(R.parent/'supabase/migrations/20261102135200_require_complete_sos_verification.sql').read_text()
with tempfile.TemporaryDirectory(prefix='sos-transitions-',dir='/tmp') as tmp:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=tmp,PGPORT='55464',PGDATABASE='postgres')
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
  run('initdb',['-D',tmp+'/data','-A','trust','--no-locale']);run('pg_ctl',['-D',tmp+'/data','-l',tmp+'/log','-o',f"-c listen_addresses='' -k {tmp} -p 55464",'start']);started=True
  sql('create schema private;create table sos_heroes(id uuid primary key,id_verified bool,background_cleared bool,license_verified bool,insurance_verified bool,test_mission_passed bool,verification_status text,updated_at timestamptz);insert into sos_heroes(id) values(\'00000000-0000-0000-0000-000000000001\');')
  v=json.loads((F/'schema.json').read_text());cols=[]
  for c in v['columns']:
   typ={'bool':'boolean','_text':'text[]'}.get(c['type'],c['type']);cols.append(c['name']+' '+typ+(' default '+c['default'] if c['default'] else '')+(' not null' if c['nullable']=='NO' else ''))
  cols+=['constraint '+c['name']+' '+c['definition'] for c in v['constraints']]
  sql('create table sos_hero_verification_checks('+','.join(cols)+');')
  recompute=json.loads((F/'source.json').read_text())['definition'];sql(recompute)
  sql("create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;create function private.is_marketplace_operator(uuid) returns bool language sql as $$select current_setting('qa.operator',true)='true'$$;create table private.marketplace_operators(auth_id uuid,email text,is_active bool);insert into private.marketplace_operators values('00000000-0000-0000-0000-000000000099','fixture@example.invalid',true);")
  def review(typ,status,allowed=True):
   q="set qa.uid='00000000-0000-0000-0000-000000000099';set qa.operator='%s';select public.sos_ops_review_verification_check('00000000-0000-0000-0000-000000000001','%s','%s','fixture review');"%('true' if allowed else 'false',typ,status)
   return sql(q)
  def seed(typ,status):
   sql('delete from sos_hero_verification_checks;'+full+"update sos_hero_verification_checks set status='%s' where check_type='%s';select private.sos_recompute_hero_verification('00000000-0000-0000-0000-000000000001');"%(status,typ))
  sql(source)
  for typ in ['equipment','vehicle','service_skills']:
   seed(typ,'passed');review(typ,'failed');assert sql('select verification_status from sos_heroes')=='verified';checks.append({'case':'baseline '+typ+' failed remains verified'})
   seed(typ,'pending');review(typ,'passed');assert sql('select verification_status from sos_heroes')=='pending';checks.append({'case':'baseline '+typ+' final pass remains pending'})
  sql(proposed)
  for typ in ['equipment','vehicle','service_skills','identity','background','license','insurance','test_mission']:
   for oldstatus,newstatus,expected in [('passed','failed','rejected'),('pending','passed','verified'),('passed','expired','pending')]:
    seed(typ,oldstatus);review(typ,newstatus);assert sql('select verification_status from sos_heroes')==expected
    assert sql("select status||':'||reviewed_by from sos_hero_verification_checks where check_type='%s'"%typ)==newstatus+':fixture@example.invalid'
    checks.append({'case':'guard '+typ+' '+newstatus,'status':expected})
  for typ,status,allowed in [('payout_account','passed',True),('identity','waived',True),('identity','passed',False)]:
   seed('identity','pending');before=sql("select jsonb_agg(to_jsonb(t) order by check_type) from sos_hero_verification_checks t;")
   try:review(typ,status,allowed);raise AssertionError('unexpected acceptance')
   except RuntimeError:pass
   assert before==sql("select jsonb_agg(to_jsonb(t) order by check_type) from sos_hero_verification_checks t;")
   checks.append({'case':'preserved rejection '+typ+' '+status+' operator='+str(allowed)})
 finally:
  if started:run('pg_ctl',['-D',tmp+'/data','-m','fast','stop'])
result={'passed':len(checks),'checks':checks,'production_writes':0,'cluster_removed':True,'postgres':'17.11','limits':'Actual operator review and recompute; synthetic auth/operator authority; minimal hero and Oct30 verification schema; no production RLS/concurrency or real approvals; local proposal only.'}
print(json.dumps(result,indent=2))
