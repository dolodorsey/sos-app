import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Hero application supports verified-email cross-device resume', async () => {
  const page = await readFile(new URL('../src/app/hero/apply/page.jsx', import.meta.url), 'utf8');
  assert.match(page, /sos_hero_resume_application/);
  assert.match(page, /Resume an application/);
  assert.match(page, /same verified email/i);
  assert.doesNotMatch(page, /Continue on the device that holds its private receipt/);
});

test('Hero onboarding remains gated through credentials, review and activation', async () => {
  const page = await readFile(new URL('../src/app/hero/apply/page.jsx', import.meta.url), 'utf8');
  assert.match(page, /Government ID/);
  assert.match(page, /Driver license/);
  assert.match(page, /Insurance/);
  assert.match(page, /Operations review/);
  assert.match(page, /Activation/);
  assert.match(page, /not 911/i);
  assert.match(page, /conditionally_approved','approved/);
});
