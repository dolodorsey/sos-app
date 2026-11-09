import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const proposed=fs.readFileSync(new URL('../src/components/SOSHeroMobilityApp.jsx',import.meta.url),'utf8');
async function run(source,{fail='',on=false,reject=false}={}){
 const line=n=>source.split('\n').find(x=>x.trimStart().startsWith(`const ${n}=`)).trim();
 const state={error:'',notice:'',busy:'',calls:[],hero:{on_duty:on}};
 const c={SB:'https://fixture.invalid',REQUEST_TIMEOUT_MS:1000,headers:()=>({}),AbortController,setTimeout,clearTimeout,Error,useCallback:f=>f,
 session:{access_token:'fixture',user:{id:'fixture'}},hero:{on_duty:on},payout:{payout_ready:true},
 setError:x=>state.error=x,setNotice:x=>state.notice=x,setBusy:x=>state.busy=x,setHero:x=>state.hero=x,
 setUser:()=>{},setOffers:()=>{},setMissions:()=>{},setPayments:()=>{},setPayout:()=>{},locate:async()=>({lat:33,lng:-84}),window:{location:{replace:()=>{}}},
 fetch:async(url)=>{state.calls.push(url);let data=[];let error='';if(url.includes('/rpc/')){data={on_duty:!on};if(reject)error='Hero verification checklist is incomplete'}else if(url.includes('sos_users?'))data=[{id:'u',role:'hero'}];else if(url.includes('sos_heroes?'))data=[{id:'h',on_duty:!on}];else if(url.includes('/functions/'))data={payout_ready:true};if(fail&&url.includes(fail))error='Fixture refresh failed';return {ok:!error,json:async()=>error?{message:error}:data}}
 };
 await vm.runInNewContext(['request','rpc','edge','load','togglePatrol'].map(line).join('\n')+'\ntogglePatrol()',c);return state;
}
const results=[];
let x;
for(const fail of ['sos_users?','sos_heroes?','sos_mission_offers?']){x=await run(proposed,{fail});assert.equal(x.error,'Fixture refresh failed');assert.equal(x.notice,'');assert.equal(x.busy,'');assert.equal(x.calls.filter(v=>v.includes('/rpc/')).length,1);results.push('Proposed suppresses success after '+fail+' failure without retry');}
x=await run(proposed);assert.equal(x.notice,'Your patrol status was updated.');assert.equal(x.hero.on_duty,true);results.push('Successful refresh shows bounded status receipt');
x=await run(proposed,{on:true});assert.equal(x.notice,'You are off patrol.');assert.equal(x.hero.on_duty,false);results.push('Off-duty success preserved');
x=await run(proposed,{reject:true});assert.equal(x.notice,'');assert.equal(x.error,'Hero verification checklist is incomplete');assert.equal(x.calls.length,1);results.push('Checklist denial prevents subsequent reads');
console.log(JSON.stringify({checks:results.length,results,external_network_calls:0},null,2));
