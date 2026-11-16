import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const errorMessage='Payout account could not be verified. Your saved connection has been retained. Try again later.';
function harness(kind,responses){
 const source=readFileSync(new URL(`../src/components/${kind==='mobility'?'SOSHeroMobilityApp':'SOSHeroVerificationReadinessHost'}.jsx`,import.meta.url),'utf8');
 const line=prefix=>{const matches=source.split('\n').map(s=>s.trim()).filter(s=>s.startsWith(prefix));assert.equal(matches.length,1,prefix);return matches[0]};
 const state={busy:[],errors:[],payouts:[],notices:[],navigation:[],requests:[],loads:0};
 const context={SB:'https://fixture.invalid',SK:'fixture-public',REQUEST_TIMEOUT_MS:10000,AbortController,setTimeout,clearTimeout,
  session:{access_token:'fixture-session'},localStorage:{getItem:()=>JSON.stringify({access_token:'fixture-session'})},
  setBusy:x=>state.busy.push(x),setError:x=>state.errors.push(x),setPayout:x=>state.payouts.push(x),setNotice:x=>state.notices.push(x),load:async()=>state.loads++,window:{location:{assign:x=>state.navigation.push(x)}},
  fetch:async(url,options)=>{state.requests.push({url,options});assert.ok(responses.length,'unexpected automatic request');const next=responses.shift();if(next instanceof Error)throw next;return {ok:next.status<400,json:async()=>next.body}}
 };
 const helpers=kind==='mobility'?[line('const headers='),line('const request='),line('const edge=')]:[line('const headers='),line('const session=')];
 if(kind!=='mobility')delete context.session;
 vm.createContext(context);vm.runInContext(helpers.join('\n')+'\n'+line('const onboard=')+'\nglobalThis.run=onboard;',context);
 return {state,run:context.run};
}
let passed=0;
for(const kind of ['mobility','readiness']){
 const failure={status:503,body:{verification_unavailable:true,error:errorMessage}};
 const h=harness(kind,[failure,{status:200,body:{onboarding_url:'https://fixture.invalid/onboarding'}}]);
 await h.run();assert.equal(h.state.errors.at(-1),errorMessage);assert.equal(h.state.requests.length,1);assert.equal(h.state.busy.at(-1),kind==='mobility'?'':false);assert.equal(h.state.payouts.length,0);assert.equal(h.state.notices.length,0);assert.equal(h.state.navigation.length,0);assert.equal(h.state.loads,0);
 assert.equal(h.state.requests[0].options.headers.Authorization,'Bearer fixture-session');assert.equal(h.state.requests[0].options.method,'POST');assert.deepEqual(JSON.parse(h.state.requests[0].options.body),{action:'onboard'});passed++;
 await h.run();assert.equal(h.state.requests.length,2);assert.equal(h.state.errors.at(-1),'');assert.deepEqual(h.state.navigation,['https://fixture.invalid/onboarding']);passed++;
 const network=harness(kind,[new Error('fixture network unavailable')]);await network.run();assert.equal(network.state.errors.at(-1),'fixture network unavailable');assert.equal(network.state.busy.at(-1),kind==='mobility'?'':false);assert.equal(network.state.requests.length,1);assert.equal(network.state.notices.length+network.state.navigation.length+network.state.payouts.length+network.state.loads,0);passed++;
 const empty=harness(kind,[{status:503,body:{}}]);await empty.run();assert.equal(empty.state.errors.at(-1),kind==='mobility'?'Request failed':'Payout setup unavailable');assert.equal(empty.state.busy.at(-1),kind==='mobility'?'':false);assert.equal(empty.state.loads+empty.state.navigation.length+empty.state.payouts.length,0);passed++;
}
console.log(JSON.stringify({passed,external_requests:0,scope:'Actual extracted caller/helper functions; mocked fetch and state setters; no React rendering or production invocation.'}));
