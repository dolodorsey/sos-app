import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// The sos-app repository is public, so its workflow logs are public too.
// The App Store release step must never print the App Review demo sign-in or contact details.
test('App Store release log hides demo sign-in and review contact details', () => {
  const py = `
import importlib.util, sys, types
src = open('scripts/asc-release.py').read()
start = src.index('import re as _re'); end = src.index('def say(')
ns = {}
exec(src[start:end], ns)
r = ns['redact']
full = '{"contactPhone": "4045550100", "contactEmail": "a@b.com", "demoAccountName": "x@y.com", "demoAccountPassword": "Secret123!", "notes": "keep me"}'
cut = '{"notes": "n", "demoAccountPassword": "Secr'
print(r(full)); print(r(cut))
`;
  const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
  for (const secret of ['4045550100', 'a@b.com', 'x@y.com', 'Secret123!', 'Secr']) assert.ok(!out.includes(secret), `leaked ${secret}`);
  assert.match(out, /keep me/);
  assert.match(out, /"demoAccountPassword": "\[hidden\]"/);
});
