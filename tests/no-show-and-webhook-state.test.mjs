import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('S.O.S. no-show uses canonical quote and atomic DB transition before Stripe',()=>{
  const edge=read('supabase/functions/sos-customer-no-show/index.ts')
  const migration=read('supabase/migrations/20260810084500_make_customer_no_show_db_authoritative.sql')
  assert.match(edge,/sos_customer_cancellation_quote/)
  assert.match(edge,/q\?\.fee_amount/)
  assert.match(edge,/q\?\.hero_compensation/)
  assert.ok(edge.indexOf('sos_hero_customer_no_show_v2')<edge.indexOf('paymentIntents.capture'))
  assert.match(edge,/pending_retry/)
  assert.match(migration,/for update/i)
  assert.match(migration,/v_mission\.status <> 'on_site'/)
  assert.match(migration,/make_interval\(mins=>p_wait_minutes\)/)
  assert.match(migration,/hero_id=v_hero/)
})

test('Stripe webhook keeps S.O.S. payment states monotonic and routes Hero money to retry',()=>{
  const hook=read('supabase/functions/stripe-webhook/index.ts')
  assert.match(hook,/const sosCapturedOrLater=/)
  assert.match(hook,/const sosTerminal=/)
  assert.match(hook,/patch\.payment_status='transfer_pending'/)
  assert.match(hook,/if\(!sosTerminal\(String\(sosPayment\.payment_status\|\|''\)\)\)/)
  assert.match(hook,/if\(!sosCapturedOrLater\(String\(sosPayment\.payment_status\|\|''\)\)\)/)
})
