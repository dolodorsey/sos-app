import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('S.O.S. final price confirmation recalculates tax', () => {
  const heroPrice = read('supabase/functions/hero-confirm-price/index.ts');
  const migration = read('supabase/migrations/20260810103000_fix_sos_final_price_tax_and_payment_restart.sql');
  assert.match(heroPrice, /tax_rate_percent/);
  assert.match(heroPrice, /tax_amount:taxAmount/);
  assert.match(migration, /tax_amount=round\(round\(p_final_price,2\)/);
});

test('S.O.S. Checkout authorizes service plus tax and derives payout split in Postgres', () => {
  const checkout = read('supabase/functions/create-mission-checkout/index.ts');
  assert.match(checkout, /chargeCents=Math\.round\(\(serviceAmount\+taxAmount\+tipAmount\)\*100\)/);
  assert.match(checkout, /stripe_connect_api_version/);
  assert.match(checkout, /stripe_transfer_status/);
  assert.match(checkout, /p_platform_fee:null/);
  assert.match(checkout, /p_hero_payout:null/);
  assert.match(checkout, /checkout\.sessions\.expire/);
  assert.doesNotMatch(checkout, /amount\*\.20/);
});

test('S.O.S. completion and operations capture/refund include tax', () => {
  for (const path of ['supabase/functions/hero-complete-mission/index.ts','supabase/functions/manage-mission-payment/index.ts']) {
    const source = read(path);
    assert.match(source, /Number\(payment\.tax\|\|0\)/);
    assert.match(source, /captureCents/);
    assert.match(source, /stripe_connect_api_version/);
    assert.match(source, /stripe_transfer_status/);
  }
  const ops = read('supabase/functions/manage-mission-payment/index.ts');
  assert.match(ops, /totalPaid=Number\(payment\.amount\|\|0\)\+Number\(payment\.tax\|\|0\)\+Number\(payment\.tip\|\|0\)/);
});

test('S.O.S. restarted Checkout clears terminal payment state safely', () => {
  const migration = read('supabase/migrations/20260810103000_fix_sos_final_price_tax_and_payment_restart.sql');
  assert.match(migration, /payment_status='pending'/);
  assert.match(migration, /escrow_status='pending_authorization'/);
  assert.match(migration, /stripe_transfer_id=null/);
  assert.match(migration, /refund_amount=0/);
});
