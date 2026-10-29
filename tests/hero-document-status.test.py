import json,os,subprocess,tempfile,hashlib
from pathlib import Path
ROOT=Path(__file__).parent;BIN=Path(os.environ.get('PGBIN','/opt/homebrew/opt/postgresql@17/bin'));checks=[]
A='00000000-0000-4000-8000-000000000001';B='00000000-0000-4000-8000-000000000002';I='00000000-0000-4000-8000-000000000003'
with tempfile.TemporaryDirectory(prefix='sos-doc-submit-',dir='/tmp') as scratch:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGHOST=scratch,PGPORT='55463',PGDATABASE='postgres')
 def run(name,args=[],data=None):
  r=subprocess.run([str(BIN/name),*args],input=data,env=env,text=True,capture_output=True,timeout=30)
  if r.returncode:raise RuntimeError(r.stderr)
  return r
 def sql(s):return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s).stdout.strip()
 def path(t):return 'applications/'+A+'/'+I+'/'+t+'/fixture.pdf'
 def call(t,p,u=A):return json.loads(sql("select set_config('test.uid','%s',false);select sos_hero_submit_application_document('%s','%s','%s');"%(u,I,t,p)).splitlines()[-1])
 def snapshot():return sql("select jsonb_build_object('apps',(select jsonb_agg(a) from sos_hero_applications a),'docs',(select jsonb_agg(d) from sos_hero_application_documents d));")
 def deny(t,p,msg,u=A):
  before=snapshot()
  try:call(t,p,u);raise AssertionError('accepted invalid registration')
  except RuntimeError as x:assert msg in str(x),str(x)
  assert before==snapshot();checks.append('PASS '+msg+'; no partial writes')
 started=False
 try:
  run('initdb',['-D',scratch+'/data','-A','trust','--no-locale']);run('pg_ctl',['-D',scratch+'/data','-l',scratch+'/log','-o',f"-c listen_addresses='' -k {scratch} -p 55463",'start']);started=True
  sql('''create schema auth;create schema private;create schema storage;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid'),'')::uuid$$;
create table sos_hero_applications(id uuid primary key,source_auth_id uuid,status text,credentials_complete_at timestamptz,updated_at timestamptz);
create table sos_hero_application_documents(application_id uuid,auth_id uuid,document_type text not null,storage_path text unique,status text default 'pending');
create table storage.objects(bucket_id text,name text);
''')
  sql((ROOT/'fixtures/sos-document-submit-before.sql').read_text())
  migration=ROOT.parent/'supabase/migrations/20261029151300_sos_document_response_status.sql'
  sql(migration.read_text())
  try:sql(migration.read_text());raise AssertionError('drift accepted')
  except RuntimeError as x:assert 'definition changed' in str(x)
  checks.append('PASS migration rejects changed definition on repeat')
  sql("insert into sos_hero_applications values('%s','%s','documents_required',null,null);"%(I,A))
  deny('government_id',path('government_id'),'Authentication required','')
  deny('government_id',path('government_id'),'Bound Hero application required',B)
  deny('government_id',path('government_id'),'Uploaded credential file not found')
  for p in [path('government_id').replace(A,B),path('government_id').replace(I,B),path('insurance'),path('government_id')+'/../x']:
   deny('government_id',p,'Invalid application document path')
  deny('unsupported',path('unsupported'),'Unsupported document type')
  for t in ['government_id','drivers_license','insurance']:
   sql("insert into storage.objects values('marketplace-verification','%s');"%path(t))
   d=call(t,path(t))
  assert d['required_uploaded']==3 and d['status']=='waitlisted' and sql('select status from sos_hero_applications')=='waitlisted';checks.append('PASS three distinct required files move eligible application to waitlist')
  call('insurance',path('insurance'));assert sql('select count(*) from sos_hero_application_documents')=='3';checks.append('PASS exact replay does not duplicate document row')
  sql("update sos_hero_application_documents set status='rejected' where document_type='insurance';")
  d=call('insurance',path('insurance'));assert d['required_uploaded']==2 and sql('select status from sos_hero_applications')=='documents_required';checks.append('PASS rejected document replay remains rejected and does not count')
  for current in ['approved','reviewing','needs_information','conditionally_approved','rejected']:
   for complete in [False,True]:
    sql("update sos_hero_applications set status='%s';update sos_hero_application_documents set status='%s' where document_type='insurance';"%(current,'pending' if complete else 'rejected'))
    d=call('government_id',path('government_id'))
    assert d['status']==current and sql('select status from sos_hero_applications')==current
    assert d['required_uploaded']==(3 if complete else 2)
    checks.append('PASS preserved '+current+' returned accurately; complete='+str(complete))

 finally:
  if started:run('pg_ctl',['-D',scratch+'/data','-m','fast','stop'])
out={'checks':checks,'completed':len(checks),'source_sha256':hashlib.sha256(migration.read_bytes()).hexdigest(),'minimal_tables':True,'auth_stub':True,'production_triggers_not_loaded':True,'cluster_removed':True,'production_writes':0}
print(json.dumps(out,indent=2))
