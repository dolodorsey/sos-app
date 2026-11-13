import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/app/hero/apply/page.jsx',import.meta.url),'utf8');
const submit=source.slice(source.indexOf(' const submit=async'),source.indexOf(' const authSession='));
async function run({failure,body={application_id:'fixture-id',tracking_token:'fixture-token'},ok=true}={}){
 const state={calls:0,writes:[],busy:null,error:'',notice:'',receipt:null,status:null,resumeOpen:false};
 const context={step:3,canNext:[true,true,true,true],form:{email:'fixture@example.invalid'},SB:'https://fixture.invalid',SK:'fixture',RECEIPT_KEY:'receipt',DRAFT_KEY:'draft',
 setBusy:v=>state.busy=v,setError:v=>state.error=v,setNotice:v=>state.notice=v,setReceipt:v=>state.receipt=v,setStatus:v=>state.status=v,setResumeEmail:v=>state.resumeEmail=v,setResumeOpen:v=>state.resumeOpen=v,
 fetch:async()=>{state.calls++;return {ok,json:async()=>body}},localStorage:{setItem(k,v){if(failure==='set')throw new Error('storage unavailable');state.writes.push(['set',k]);},removeItem(k){if(failure==='remove')throw new Error('storage unavailable');state.writes.push(['remove',k]);}}};
 await vm.runInNewContext(submit+';submit({preventDefault(){}})',context);return state;
}
for(const failure of ['set','remove'])test(`confirmed receipt survives ${failure} failure`,async()=>{const s=await run({failure});assert.equal(s.receipt?.application_id,'fixture-id');assert.equal(s.status?.tracking_token,'fixture-token');assert.equal(s.error,'');assert.match(s.notice,/keep this tab open/i);assert.equal(s.busy,false);assert.equal(s.calls,1);});
test('normal receipt persistence preserves status',async()=>{const s=await run();assert.equal(s.receipt.application_id,'fixture-id');assert.equal(s.notice,'');assert.equal(s.writes.length,2);});
test('duplicate keeps verified-email resume path without receipt',async()=>{const s=await run({body:{duplicate:true}});assert.equal(s.receipt,null);assert.equal(s.resumeOpen,true);assert.equal(s.resumeEmail,'fixture@example.invalid');assert.equal(s.writes.length,0);});
test('known rejection never creates or persists receipt',async()=>{const s=await run({ok:false,body:{error:'Consent required'}});assert.equal(s.error,'Consent required');assert.equal(s.receipt,null);assert.equal(s.writes.length,0);assert.equal(s.busy,false);});
