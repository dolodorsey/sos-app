import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/components/SOSCustomerCoverageStatusHost.jsx','utf8');
test('coverage badge text is changed only when needed',async()=>{
 assert.match(source,/setText\(badge,available\?'Verified coverage':'Coverage activating'\)/,'Badge must be written through the idempotent setText helper');
 assert.match(source,/setData\(button,'verifiedCoverage',available\?'active':'activating'\)/,'Coverage attribute must be written through the idempotent setData helper');
 const {setText,setData}=await import('../src/lib/domObserver.js');
 let text='',writes=0;const badge={get textContent(){return text},set textContent(v){text=v;writes++}};
 setText(badge,'Verified coverage');setText(badge,'Verified coverage');assert.equal(writes,1);
 setText(badge,'Coverage activating');setText(badge,'Coverage activating');assert.equal(writes,2);
 let dataWrites=0;const store={};const el={dataset:new Proxy(store,{set(t,k,v){t[k]=v;dataWrites++;return true}})};
 setData(el,'verifiedCoverage','active');setData(el,'verifiedCoverage','active');assert.equal(dataWrites,1);
});
test('unavailable service requests remain blocked',()=>{
 assert.ok(source.includes('event.preventDefault()'));
 assert.ok(source.includes('event.stopImmediatePropagation()'));
 assert.ok(source.includes('No mission was created.'));
});
test('coverage and feedback are announced accessibly',()=>{
 assert.match(source,/<aside className=\{statusSlot\?'sos-status-card':styles.banner\} data-sos-coverage-banner="" role="status" aria-live="polite"/);
 assert.match(source,/<div className=\{styles.toast\} role="status" aria-live="polite" aria-atomic="true"/);
});
test('coverage observer is disconnected on cleanup',()=>{
 assert.ok(source.includes('const stop=observeBody(apply)'));
 assert.ok(source.includes('return()=>{stop();'));
 assert.ok(fs.readFileSync('src/lib/domObserver.js','utf8').includes('observer.disconnect()'));
 assert.ok(source.includes("document.removeEventListener('click',block,true)"));
});
