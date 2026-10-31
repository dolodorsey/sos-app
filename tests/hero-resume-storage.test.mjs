import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(process.env.SOS_SOURCE||new URL('../src/app/hero/apply/page.jsx',import.meta.url),'utf8');
const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const code=part(' const resumeApplication=',' useEffect(()=>{if(receipt)')+part(' const authSession=',' const authenticate=')+part(' const resumeAuthenticate=',' const upload=');
async function run({failure,authOk=true,token=true,found=true,resumeOk=true}={}){
 const s={auth:null,receipt:null,status:null,notice:'',error:'',busy:false,open:true,calls:[],privateLoads:0,writes:[]};
 const ctx={SB:'https://fixture.invalid',SK:'fixture',RECEIPT_KEY:'receipt',password:'fixture-password',resumeEmail:'TEST@example.invalid',resumeMode:'signin',authHeaders:t=>({Authorization:`Bearer ${t}`}),
 setAuth:v=>s.auth=v,setReceipt:v=>s.receipt=v,setStatus:v=>s.status=v,setNotice:v=>s.notice=v,setError:v=>s.error=v,setBusy:v=>s.busy=v,setResumeOpen:v=>s.open=v,
 loadPrivate:async(session,r)=>{assert.equal(session.access_token,'fixture-token');assert.equal(r.application_id,'fixture-id');s.privateLoads++;},
 localStorage:{setItem(k,v){s.writes.push(k);if(k===failure)throw Error('storage unavailable');}},
 fetch:async(url,options)=>{s.calls.push({url,body:options.body,headers:options.headers});if(url.includes('/auth/'))return {ok:authOk,json:async()=>authOk?(token?{access_token:'fixture-token',user:{id:'fixture-user'}}:{}):{error:'Invalid credentials'}};return {ok:resumeOk,json:async()=>resumeOk?{found,application_id:'fixture-id',email:'test@example.invalid',status:'documents_required'}:{message:'Not authorized'}};}};
 await vm.runInNewContext(code+';resumeAuthenticate()',ctx);return s;
}
for(const failure of ['sos_session','receipt'])test(`verified resume survives ${failure} storage failure`,async()=>{const s=await run({failure});assert.equal(s.auth?.access_token,'fixture-token');assert.equal(s.receipt?.application_id,'fixture-id');assert.equal(s.receipt?.tracking_token,undefined);assert.equal(s.receipt?.resumed_by_verified_email,true);assert.equal(s.status.status,'documents_required');assert.equal(s.privateLoads,1);assert.equal(s.open,false);assert.equal(s.busy,false);assert.equal(s.error,'');assert.match(s.notice,/keep this tab open/i);assert.equal(s.calls.length,2);assert.equal(s.calls[1].headers.Authorization,'Bearer fixture-token');assert.equal(s.calls[1].body,'{}');});
test('normal verified resume persists both values',async()=>{const s=await run();assert.equal(s.notice,'');assert.equal(s.privateLoads,1);assert.deepEqual(s.writes,['sos_session','receipt']);});
test('failed authentication cannot call resume or persist identity',async()=>{const s=await run({authOk:false});assert.equal(s.calls.length,1);assert.equal(s.auth,null);assert.equal(s.receipt,null);assert.equal(s.error,'Invalid credentials');assert.equal(s.writes.length,0);});
test('unconfirmed signup response cannot call resume',async()=>{const s=await run({token:false});assert.equal(s.calls.length,1);assert.equal(s.receipt,null);assert.equal(s.privateLoads,0);assert.match(s.notice,/confirm/);});
test('not found creates no receipt',async()=>{const s=await run({found:false});assert.equal(s.receipt,null);assert.equal(s.privateLoads,0);assert.match(s.notice,/No active/);});
test('resume rejection creates no receipt',async()=>{const s=await run({resumeOk:false});assert.equal(s.receipt,null);assert.equal(s.privateLoads,0);assert.equal(s.error,'Not authorized');assert.equal(s.busy,false);});
