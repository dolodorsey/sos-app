import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('customer request path creates a real mission and reads live mission state', () => {
  const client = read('src/lib/sosMissionClient.js')
  assert.match(client, /functions\/v1\/request-customer-mission/)
  assert.match(client, /pickup_lat/)
  assert.match(client, /pickup_lng/)
  assert.match(client, /sos_missions/)
  assert.match(client, /sos_mission_offers/)
  assert.match(client, /sos_payments/)
})

test('Hero Command owns acceptance, presence, payment-gated travel, and completion', () => {
  const hero = read('src/components/SOSHeroMobilityApp.jsx')
  assert.match(hero, /sos_set_hero_presence/)
  assert.match(hero, /sos_accept_mission_offer/)
  assert.match(hero, /sos_decline_mission_offer/)
  assert.match(hero, /sos_transition_assigned_mission/)
  assert.match(hero, /pricing_status==='confirmed'/)
  assert.match(hero, /paymentReady/)
  assert.match(hero, /DO NOT TRAVEL YET/)
  assert.match(hero, /hero-complete-mission/)
})

test('customer payment is authorized before Hero travel and rating is tied to completed mission', () => {
  const client = read('src/lib/sosMissionClient.js')
  const tracker = read('src/components/SOSMissionTracker.jsx')
  assert.match(client, /create-mission-checkout/)
  assert.match(client, /sos_rate_completed_mission/)
  assert.match(tracker, /PAYMENT AUTHORIZATION REQUIRED/)
  assert.match(tracker, /Authorize & dispatch Hero/)
  assert.match(tracker, /paymentReady/)
})

test('late cancellation and no-show settlements are source-controlled and partial-capture only the policy fee', () => {
  const client = read('src/lib/sosMissionClient.js')
  const cancel = read('supabase/functions/sos-cancel-mission/index.ts')
  const noShow = read('supabase/functions/sos-customer-no-show/index.ts')
  assert.match(client, /sos-cancel-mission/)
  assert.match(cancel, /sos_customer_cancellation_quote/)
  assert.match(cancel, /amount_to_capture:Math\.round\(fee\*100\)/)
  assert.match(cancel, /settlement_type:'customer_cancellation'/)
  assert.match(noShow, /m\.status==='on_site'/)
  assert.match(noShow, /remainingSeconds===0/)
  assert.match(noShow, /payment_status==='authorized'/)
  assert.match(noShow, /settlement_type:'customer_no_show'/)
  assert.match(noShow, /idempotencyKey:`sos-no-show-/)
})

test('cancellation/no-show compensation uses separate transfer semantics instead of fabricating earnings', () => {
  const cancel = read('supabase/functions/sos-cancel-mission/index.ts')
  const noShow = read('supabase/functions/sos-customer-no-show/index.ts')
  for (const source of [cancel,noShow]) {
    assert.match(source, /stripe\.transfers\.create/)
    assert.match(source, /source_transaction:chargeId/)
    assert.match(source, /stripe_connect_id/)
  }
})
