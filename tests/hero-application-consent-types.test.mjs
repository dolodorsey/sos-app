import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../supabase/functions/submit-sos-hero-application/index.ts',import.meta.url),'utf8');
async function execute(source,payload){
 let handler,reads=0;
 const admin={from(){reads++;return {select(){return this},eq(){return this},in(){return this},async maybeSingle(){return {data:{id:'synthetic-existing',status:'documents_required',candidate_id:'synthetic',khg_bridge_status:'synced'}}}}}};
 const context={Deno:{env:{get:()=> 'local-fixture'},serve:h=>handler=h},createClient:()=>admin,Response,TextEncoder,crypto:globalThis.crypto,console:{error(){}},fetch:()=>{throw Error('Network forbidden')}};
 const code=stripTypeScriptTypes(source.replace(/^import .*;\n/gm,''));
 vm.runInNewContext(code,context);
 const response=await handler(new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
 return {status:response.status,reads};
}
const base={firstName:'Synthetic',lastName:'QA',email:'qa@example.invalid',phone:'0000000000',licenseAttested:true,insuranceAttested:true,backgroundConsent:true,termsAccepted:true};
for(const field of ['licenseAttested','insuranceAttested','backgroundConsent','termsAccepted']){
 for(const value of ['false','true',{},[],1,false,null,0,'',undefined]){
  test(`${field} rejects ${JSON.stringify(value)} before database access`,async()=>{
   const result=await execute(source,{...base,[field]:value});
   assert.equal(result.status,422);assert.equal(result.reads,0);
  });
 }
}
test('all boolean true preserves the existing-application path',async()=>{
 const result=await execute(source,base);assert.equal(result.status,200);assert.equal(result.reads,1);
});
