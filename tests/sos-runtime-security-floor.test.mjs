import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('S.O.S. runtime is pinned at the current remediated Next.js security floor', () => {
  assert.equal(packageJson.dependencies.next, '16.3.8');
  assert.equal(packageJson.overrides?.sharp, '0.35.4');
  assert.equal(packageLock.packages?.['']?.dependencies?.next, '16.3.8');
  assert.equal(packageLock.packages?.['node_modules/next']?.version, '16.3.8');
  assert.equal(packageLock.packages?.['node_modules/sharp']?.version, '0.35.4');
  assert.doesNotMatch(packageJson.dependencies.next, /canary|alpha|beta|rc/i);
});
