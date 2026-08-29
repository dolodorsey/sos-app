import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const hook=fs.readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts',import.meta.url),'utf8')

test('S.O.S. terminal state guards include partial refunds',()=>{
  assert.match(hook,/const sosCapturedOrLater=.*partially_refunded/)
  assert.match(hook,/const sosTerminal=.*partially_refunded/)
})

test('S.O.S. financial webhooks can reconcile without mission metadata',()=>{
  assert.match(hook,/eq\('stripe_payment_intent_id',eventIntentId\)/)
  assert.match(hook,/eq\('stripe_charge_id',eventChargeId\)/)
  assert.match(hook,/update\(patch\)\.eq\('id',sosPayment\.id\)/)
})

test('S.O.S. refund webhook preserves partial refunds and disputed state',()=>{
  assert.match(hook,/const fullyRefunded=chargeAmountCents>0&&refundedCents>=chargeAmountCents/)
  assert.match(hook,/patch\.payment_status=fullyRefunded\?'refunded':'partially_refunded'/)
  assert.match(hook,/patch\.escrow_status=fullyRefunded\?'released_to_customer':'partially_refunded'/)
  assert.match(hook,/String\(sosPayment\.payment_status\|\|''\)!=='disputed'/)
  assert.match(hook,/patch\.stripe_refund_id=String\(latestRefund\.id\)/)
})

test('S.O.S. dispute webhook persists provider identifiers',()=>{
  assert.match(hook,/event\.type==='charge\.dispute\.created'/)
  assert.match(hook,/patch\.stripe_dispute_id=object\.id/)
  assert.match(hook,/if\(eventChargeId\)patch\.stripe_charge_id=eventChargeId/)
  assert.match(hook,/if\(eventIntentId\)patch\.stripe_payment_intent_id=eventIntentId/)
})
