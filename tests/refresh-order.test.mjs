import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/components/SOSHeroMobilityApp.jsx',import.meta.url),'utf8');
const line=n=>source.split('\n').find(x=>x.trimStart().startsWith(`const ${n}=`)).trim();
const results=[];
async function scenario({oldFail=false,newFail=false,strict=false,usersGate=false,invalidate=false,sessionChange=false}={}){
 let release,enter;const gate=new Promise(r=>release=r),started=new Promise(r=>enter=r);let calls=0,userReads=0;
 const session={access_token:'fixture',user:{id:'fixture'}};const loadSession={current:session},loadGeneration={current:0};
 const state={error:'',hero:null,offers:[],redirects:0};
 const load=vm.runInNewContext(line('load')+'\nload',{loadSession,loadGeneration,useCallback:f=>f,window:{location:{replace:()=>state.redirects++}},request:async path=>{
 calls++;
 if(path.includes('sos_users?')){const old=userReads++===0;if(old&&usersGate){enter();await gate;return [{id:'old',role:'citizen'}]}return [{id:old?'old':'new',role:'hero'}]}
 if(path.includes('sos_heroes?'))return [{id:path.includes('eq.old')?'old':'new',on_duty:!path.includes('eq.old')}];
 if(path.includes('sos_mission_offers?')){const old=path.includes('eq.old');if(old){enter();await gate;if(oldFail)throw Error('old failure')}else if(newFail)throw Error('new failure');return [{id:old?'old':'new'}]}
 return []},edge:async()=>({payout_ready:true}),setUser:()=>{},setHero:v=>state.hero=v,setOffers:v=>state.offers=v,setMissions:()=>{},setPayments:()=>{},setPayout:()=>{},setError:v=>state.error=v});
 const old=load(session,{throwOnError:strict}).then(value=>({value}),e=>({error:e.message}));await started;
 if(invalidate){loadSession.current=null;loadGeneration.current++}else if(sessionChange){loadSession.current={access_token:'new-token',user:{id:'new-user'}};await load(loadSession.current)}else await load(session);
 const snapshot=JSON.stringify(state);const before=calls;if(invalidate||sessionChange){const outcome=await load(session);assert.equal(outcome.status,'superseded');assert.equal(calls,before)}
 release();const outcome=await old;assert.equal(JSON.stringify(state),snapshot);
 if(strict)assert.equal(outcome.error,'Refresh superseded by a newer request.');else assert.equal(outcome.value.status,'superseded');
 if(newFail)assert.equal(state.error,'new failure');if(usersGate)assert.equal(state.redirects,0);
 results.push({options:{oldFail,newFail,strict,usersGate,invalidate,sessionChange},passed:true});
}
for(const options of [{},{oldFail:true},{newFail:true},{strict:true},{usersGate:true},{invalidate:true},{sessionChange:true}])await scenario(options);
// Actual logout invalidates immediately, before its awaited presence RPC.
{
 let release;const gate=new Promise(r=>release=r);const loadSession={current:{access_token:'fixture'}},loadGeneration={current:3};
 const noop=()=>{};const logout=vm.runInNewContext(line('logout')+'\nlogout',{loadSession,loadGeneration,heartbeat:{current:null},session:{access_token:'fixture',user:{id:'fixture'}},hero:{on_duty:true},rpc:()=>gate,localStorage:{removeItem:noop},setSession:noop,setUser:noop,setHero:noop,setOffers:noop,setMissions:noop,setPayments:noop,setSelectedMission:noop});
 const pending=logout();assert.equal(loadSession.current,null);assert.equal(loadGeneration.current,4);release();await pending;results.push({case:'actual logout invalidates before await',passed:true});
}
// Actual boot effect cleanup invalidates in-flight loads.
{
 const effect=source.split('\n').find(x=>x.includes('useEffect(()=>{let active=true;'));let cleanup;
 const loadSession={current:{access_token:'fixture'}},loadGeneration={current:2};
 vm.runInNewContext(effect,{useEffect:f=>cleanup=f(),storedSession:()=>null,loadSession,loadGeneration,heartbeat:{current:null},setBooting:()=>{},load:()=>{},setSession:()=>{}});
 cleanup();assert.equal(loadSession.current,null);assert.equal(loadGeneration.current,3);results.push({case:'actual effect cleanup invalidates',passed:true});
}
console.log(JSON.stringify({checks:results.length,results,external_calls:0,scope:'actual extracted load/logout/effect; mock request/edge/hooks'},null,2));
