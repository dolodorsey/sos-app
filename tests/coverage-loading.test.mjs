import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/components/SOSCustomerCoverageStatusHost.jsx','utf8');
const loadSource=source.split('  const load=')[1].split('  load();const t=')[0];
function harness(fetch){
 const state={rows:null,loaded:false,checking:false};let timeout;
 const factory=new Function('fetch','setRows','setLoaded','setChecking','setTimeout','clearTimeout','AbortController',`let alive=true,controller=null;const COVERAGE_URL='https://coverage.example';const load=${loadSource} return {load,dispose:()=>{alive=false;controller?.abort()}}`);
 const loader=factory(fetch,r=>state.rows=r,v=>state.loaded=v,v=>state.checking=v,fn=>{timeout=fn;return 1},()=>{},AbortController);
 return {state,...loader,timeout:()=>timeout()};
}
test('coverage loads verified response and finishes checking',async()=>{
 const services=[{service_name:'Towing',has_verified_supply:true}];
 const h=harness(async()=>({ok:true,json:async()=>({sos:{services}})}));
 await h.load();assert.deepEqual(h.state,{rows:services,loaded:true,checking:false});
});
test('malformed coverage closes requests and a retry can recover',async()=>{
 let count=0;const h=harness(async()=>({ok:true,json:async()=>++count===1?{}:{sos:{services:[{has_verified_supply:true}]}}}));
 await h.load();assert.deepEqual(h.state.rows,[]);assert.equal(h.state.loaded,true);
 await h.load();assert.equal(h.state.rows[0].has_verified_supply,true);
});
test('hung coverage is aborted and returns a retryable unavailable state',async()=>{
 const h=harness((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))));
 const pending=h.load();assert.equal(h.state.checking,true);h.timeout();await pending;
 assert.deepEqual(h.state,{rows:[],loaded:true,checking:false});
});
test('unmounted requests do not overwrite the current screen',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));const pending=h.load();h.dispose();
 resolve({ok:true,json:async()=>({sos:{services:[]}})});await pending;assert.equal(h.state.loaded,false);
});
