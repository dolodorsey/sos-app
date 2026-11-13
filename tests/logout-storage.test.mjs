import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const file=new URL('../src/components/SOSHeroMobilityApp.jsx',import.meta.url),expectOld=false;
const source=fs.readFileSync(file,'utf8');const line=source.split('\n').find(x=>x.trimStart().startsWith('const logout=')).trim();
const results=[];
for(const storageFails of [false,true])for(const onDuty of [false,true]){
 const state={session:'old',user:'old',hero:'old',offers:['old'],missions:['old'],payments:['old'],selectedMission:'old',error:''};let calls=0,removals=0;
 const loadSession={current:{access_token:'fixture'}},loadGeneration={current:1};
 const env={loadSession,loadGeneration,heartbeat:{current:null},session:{access_token:'fixture',user:{id:'fixture'}},hero:{on_duty:onDuty},rpc:async()=>{calls++;throw Error('fixture RPC failure')},localStorage:{removeItem:key=>{assert.equal(key,'sos_session');removals++;if(storageFails)throw Error('private storage detail')}},setError:v=>state.error=v};
 for(const key of ['session','user','hero','offers','missions','payments','selectedMission'])env['set'+key[0].toUpperCase()+key.slice(1)]=v=>state[key]=v;
 const logout=vm.runInNewContext(line+'\nlogout',env);let rejected=false;try{await logout()}catch{rejected=true}
 assert.equal(loadSession.current,null);assert.equal(loadGeneration.current,2);assert.equal(calls,onDuty?1:0);assert.equal(removals,1);
 if(expectOld&&storageFails){assert.equal(rejected,true);assert.equal(state.session,'old');results.push({storageFails,onDuty,reproduced:'storage exception prevents session cleanup'});continue}
 assert.equal(rejected,false);for(const k of ['session','user','hero','selectedMission'])assert.equal(state[k],null);for(const k of ['offers','missions','payments'])assert.equal(state[k].length,0);
 if(storageFails){assert.match(state.error,/saved sign-in could not be cleared/);assert.ok(!state.error.includes('private storage detail'))}else assert.equal(state.error,'');
 results.push({storageFails,onDuty,passed:true});
}
console.log(JSON.stringify({results,external_calls:0,scope:'actual extracted logout; mocked storage/RPC/state setters'},null,2));
