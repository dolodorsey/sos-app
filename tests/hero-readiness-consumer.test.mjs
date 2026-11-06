import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = fs.readFileSync(process.env.READINESS_SOURCE || new URL('../src/components/SOSHeroVerificationReadinessHost.jsx', import.meta.url), 'utf8');
const start = source.indexOf(' useEffect(', source.indexOf(' const ready='));
assert(start >= 0);
const effect = source.slice(start, source.indexOf('\n', start));
function harness() {
 const dataset = {}; let cleanup;
 return {
  render(state) {
   cleanup?.(); cleanup = undefined;
   vm.runInNewContext(effect, {state, ready: Boolean(state?.dispatch_ready), document: {documentElement: {dataset}}, setOpen() {}, useEffect(fn) {cleanup = fn();}});
   return {...dataset};
  },
  unmount() {cleanup?.(); return {...dataset};}
 };
}
for (const [name, previous, state, expected] of [
 ['initial unknown', null, null, 'false'],
 ['pending Hero', null, {state:'hero',dispatch_ready:false}, 'false'],
 ['failed refresh after pending', {state:'hero',dispatch_ready:false}, null, 'false'],
 ['ready Hero', null, {state:'hero',dispatch_ready:true}, 'true'],
 ['failed refresh after ready', {state:'hero',dispatch_ready:true}, null, 'false'],
 ['not Hero after ready', {state:'hero',dispatch_ready:true}, {state:'not_hero'}, 'false'],
]) test(name, () => {
 const h = harness(); h.render(previous); const flags = h.render(state);
 assert.equal(flags.sosHeroDispatchReady, expected);
 assert.equal(flags.sosHeroVerificationUi, state?.state === 'hero' ? '1' : undefined);
});
test('unmount clears both owned flags', () => {
 const h = harness(); h.render({state:'hero',dispatch_ready:false}); assert.deepEqual(h.unmount(), {});
});
test('existing CSS suppression excludes live End Patrol', () => {
 const css = fs.readFileSync(new URL('../src/components/SOSHeroVerificationReadinessHost.module.css', import.meta.url), 'utf8');
 assert(css.includes(".shc-patrol:not(.live)"));
});
