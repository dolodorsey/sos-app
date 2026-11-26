import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

// The iPhone/iPad app runs from capacitor://localhost (Capacitor can't serve bundled files over https).
// Every backend function the app calls must answer that origin, or the call is blocked on iOS
// (Nov 26, 2026: Hero sign-up and network status rejected the iOS app; Good Times was rejected by Apple
// for the same class of bug).
const fnDir = new URL('../supabase/functions/', import.meta.url);
const src = execSync('git ls-files src', { cwd: new URL('..', import.meta.url) }).toString().split('\n').filter(Boolean)
  .map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');

const called = readdirSync(fnDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && existsSync(new URL(`${d.name}/index.ts`, fnDir)))
  .map(d => d.name)
  .filter(name => new RegExp(`functions/v1/${name}\\b|['"\`]${name}['"\`]`).test(src));

test('the app calls at least the known backend functions', () => {
  for (const f of ['request-customer-mission', 'submit-sos-hero-application', 'sos-network-readiness']) assert.ok(called.includes(f), f);
});

for (const name of called) {
  test(`${name} accepts the iOS app origin`, () => {
    const code = readFileSync(new URL(`${name}/index.ts`, fnDir), 'utf8');
    const wildcard = /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(code);
    assert.ok(wildcard || code.includes('capacitor://localhost'), `${name} must allow capacitor://localhost`);
  });
}
