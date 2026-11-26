import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('site code uses superherosonstandby.com, never the old "the" address', () => {
  // The founder's rule (Nov 24, 2026): the address is superherosonstandby.com, never "the...".
  // Backend CORS allowlists may still accept the old host so old links keep working;
  // the site itself must never link to or canonicalize the old host.
  const hits = execSync('git grep -n "thesuperherosonstandby" -- src vercel.json || true', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(line => !line.includes('the old thesuperherosonstandby.com'));
  assert.deepEqual(hits, []);
});
