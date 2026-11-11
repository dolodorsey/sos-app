import test from 'node:test';
import assert from 'node:assert/strict';
import { scanRepo, scanText } from '../scripts/check-brand-spelling.mjs';

test('repository uses SUPERHEROS everywhere outside the documented allowlist', () => {
  const violations = scanRepo();
  assert.deepEqual(violations, [], `Found the conventional plural:\n${violations.map((v) => `${v.file}:${v.line} ${v.text}`).join('\n')}`);
});

test('checker catches any casing and honours exact allowlist entries only', () => {
  const allow = [{ file: 'a.md', contains: 'rule: never write Superheroes' }];
  assert.equal(scanText('b.jsx', 'Meet our superheroes', allow).length, 1);
  assert.equal(scanText('b.jsx', 'MEET OUR SUPERHEROES', allow).length, 1);
  assert.equal(scanText('a.md', 'rule: never write Superheroes', allow).length, 0);
  assert.equal(scanText('a.md', 'other line with superheroes', allow).length, 1);
  assert.equal(scanText('b.jsx', 'Meet the SUPERHEROS', allow).length, 0);
});
