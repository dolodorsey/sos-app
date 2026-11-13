import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';import {createHash} from 'node:crypto';
const after=fs.readFileSync(new URL('../supabase/functions/hero-payouts/index.ts',import.meta.url),'utf8');
function fixture(source,{http=503,network=false,connected=true,unauthorized=false}={}){
 let handler;const writes=[],requests=[],rpcs=[];
 const client={auth:{getUser:async()=>({data:{user:unauthorized?null:{id:'auth-fixture',email:'fixture@example.invalid'}},error:null})},rpc:async(name)=>{rpcs.push(name);return {error:null}},from(table){return {select(){return {eq(){return {single:async()=>({data:table==='sos_users'?{id:'user-fixture',role:'hero',status:'active',email:'fixture@example.invalid'}:{id:'hero-fixture',stripe_connect_id:connected?'acct_fixture':null},error:null})}}}},update(patch){return {eq:async(field,value)=>{writes.push({table,patch,field,value});return {error:null}}}},upsert:async(patch)=>{writes.push({table,patch});return {error:null}}}}};
 const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',STRIPE_SECRET_KEY:'fixture-stripe'};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'')),{Deno:{env:{get:n=>env[n]},serve:f=>handler=f},createClient:()=>client,Response,console:{error(){}},fetch:async(url,init)=>{requests.push({url,method:init.method,body:init.body?JSON.parse(init.body):null});if(network)throw new Error('fixture network outage');return Response.json(http===200?{id:'acct_fixture',livemode:false,configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'}}}}},requirements:{currently_due:[]}}:{error:{message:'fixture upstream failure'}},{status:http})}});
 return {writes,requests,rpcs,async send(input={action:'status'}){const r=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:typeof input==='string'?input:JSON.stringify(input)}));return {status:r.status,body:await r.json()}}};
}


let checks=0;
for(const connected of [true,false])for(const input of [{action:'unsupported'},{action:''},{action:false},{action:0},{action:null},{action:[]},{action:{}},null,[],true,'{']){const f=fixture(after,{http:200,connected});const r=await f.send(input);assert.equal(r.status,400);assert.equal(f.writes.length,0);assert.equal(f.requests.length,0);assert.equal(f.rpcs.length,0);checks++;}
for(const input of [{},{action:'status'},{action:'onboard'}]){const f=fixture(after,{http:200});assert.equal((await f.send(input)).status,200);checks++;}
console.log(JSON.stringify({checks,external_requests:0,production_mutations:0,limits:'Actual handler with mocked auth/database/Stripe; no browser or production proof.'}));
