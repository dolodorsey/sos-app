import json,os,subprocess,tempfile
from pathlib import Path
R=Path(__file__).parent;B=Path('/opt/homebrew/opt/postgresql@17/bin');checks=[]
F=R/'fixtures/verification'
source=json.loads((F/'source.json').read_text())['definition']
proposed=(R.parent/'supabase/migrations/20261102135200_require_complete_sos_verification.sql').read_text()
with tempfile.TemporaryDirectory(prefix='sos-completeness-',dir='/tmp') as tmp:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=tmp,PGPORT='55463',PGDATABASE='postgres')
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
  run('initdb',['-D',tmp+'/data','-A','trust','--no-locale']);run('pg_ctl',['-D',tmp+'/data','-l',tmp+'/log','-o',f"-c listen_addresses='' -k {tmp} -p 55463",'start']);started=True
  sql('create schema private;create table sos_heroes(id uuid primary key,id_verified bool,background_cleared bool,license_verified bool,insurance_verified bool,test_mission_passed bool,verification_status text,updated_at timestamptz);insert into sos_heroes(id) values(\'00000000-0000-0000-0000-000000000001\');')
  v=json.loads((F/'schema.json').read_text());cols=[]
  for c in v['columns']:
   typ={'bool':'boolean','_text':'text[]'}.get(c['type'],c['type']);cols.append(c['name']+' '+typ+(' default '+c['default'] if c['default'] else '')+(' not null' if c['nullable']=='NO' else ''))
  cols+=['constraint '+c['name']+' '+c['definition'] for c in v['constraints']]
  sql('create table sos_hero_verification_checks('+','.join(cols)+');');sql(source)
  evaluate('baseline empty checklist','', 'verified')
  evaluate('baseline payout only',single,'verified')
  evaluate('baseline missing identity',full+"delete from sos_hero_verification_checks where check_type='identity';",'verified')
  evaluate('baseline identity no longer required',full+"update sos_hero_verification_checks set required=false,status='pending' where check_type='identity';",'verified')
  sql("create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function private.is_marketplace_operator(uuid) returns bool language sql as $$select false$$;create table private.marketplace_operators(auth_id uuid,email text,is_active bool);")
  sql(proposed)
  evaluate('guard empty checklist','','pending');evaluate('guard payout only',single,'pending')
  for name in ['identity','background','license','insurance','equipment','vehicle','service_skills','test_mission','payout_account']:
   evaluate('guard missing '+name,full+"delete from sos_hero_verification_checks where check_type='%s';"%name,'pending')
  evaluate('guard disabled required identity',full+"update sos_hero_verification_checks set required=false,status='pending' where check_type='identity';",'pending')
  evaluate('guard all nine passed',full,'verified')
  for status,expected in [('failed','rejected'),('under_review','under_review'),('submitted','documents_submitted'),('pending','pending'),('expired','pending'),('waived','pending')]:
   evaluate('guard existing '+status+' semantics',full+"update sos_hero_verification_checks set status='%s' where check_type='equipment';"%status,expected)
 finally:
  if started:run('pg_ctl',['-D',tmp+'/data','-m','fast','stop'])
result={'passed':len(checks),'checks':checks,'production_writes':0,'cluster_removed':True,'postgres':'17.11','limits':'Fresh recompute source; Oct30 verification table columns/constraints; minimal hero table; no production RLS, auth, complete schema, concurrent writers, expiry semantics or independent business QA. Proposed guard local only.'}
print(json.dumps(result,indent=2))
