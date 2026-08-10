import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('S.O.S. service completion recovery requires proof and captures the full authorized total', () => {
  const worker = read('supabase/functions/marketplace-payout-retry/index.ts');
  assert.match(worker, /sos_proof_of_service/);
  assert.match(worker, /validation_status','passed'/);
  assert.match(worker, /Number\(p\.amount\|\|0\)\+Number\(p\.tax\|\|0\)\+Number\(p\.tip\|\|0\)/);
  assert.match(worker, /sos-capture-\$\{p\.mission_id\}/);
  assert.match(worker, /source:'marketplace_payout_retry'/);
});

test('S.O.S. Hero transfer cannot precede terminal mission state', () => {
  const worker = read('supabase/functions/marketplace-payout-retry/index.ts');
  assert.match(worker, /Mission must be completed before Hero transfer/);
  assert.match(worker, /Cancellation state is not terminal/);
  assert.match(worker, /No-show state is not terminal/);
  assert.match(worker, /stripe_connect_api_version==='v2'/);
  assert.match(worker, /stripe_transfer_status==='active'/);
});
