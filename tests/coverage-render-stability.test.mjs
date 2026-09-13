import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/components/SOSCustomerCoverageStatusHost.jsx','utf8');
test('coverage badge text is changed only when needed',()=>{
 const block=source.match(/const label=available\?'Verified coverage':'Coverage activating';[\s\S]*?if\(badge.textContent!==label\)badge.textContent=label;/)?.[0];
 assert.ok(block,'Missing idempotent badge update');
 const apply=new Function('badge','available',block);
 let text='',writes=0;const badge={get textContent(){return text},set textContent(v){text=v;writes++}};
 apply(badge,true);apply(badge,true);assert.equal(writes,1);assert.equal(text,'Verified coverage');
 apply(badge,false);apply(badge,false);assert.equal(writes,2);assert.equal(text,'Coverage activating');
});
test('unavailable service requests remain blocked',()=>{
 assert.ok(source.includes('event.preventDefault()'));
 assert.ok(source.includes('event.stopImmediatePropagation()'));
 assert.ok(source.includes('No mission was created.'));
});
test('coverage and feedback are announced accessibly',()=>{
 assert.match(source,/<aside className=\{styles.banner\} role="status" aria-live="polite"/);
 assert.match(source,/<div className=\{styles.toast\} role="status" aria-live="polite" aria-atomic="true"/);
});
test('coverage observer is disconnected on cleanup',()=>{
 assert.ok(source.includes('observer.disconnect()'));
 assert.ok(source.includes("document.removeEventListener('click',block,true)"));
});
