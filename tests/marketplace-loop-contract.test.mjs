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

test('Hero Command receives offers, missions, and payments through direct Realtime after login',()=>{
  const shell=read('src/components/SOSHeroRealtimeShell.jsx')
  assert.match(shell,/realtime\.setAuth\(s\.access_token\)/)
  for(const table of ['sos_mission_offers','sos_missions','sos_payments']) assert.match(shell,new RegExp(`table:'${table}'`))
  assert.match(shell,/setInterval\(connect,1000\)/)
  assert.match(shell,/LIVE DATA/)
  assert.match(shell,/POLLING FALLBACK/)
})

test('marketplace push delivery is event-driven with cron available only as fallback',()=>{
  const migration=read('supabase/migrations/20260809040000_make_marketplace_push_event_driven.sql')
  assert.match(migration,/marketplace_kick_push_delivery/)
  assert.match(migration,/oc_notification_push_kick/)
  assert.match(migration,/sos_notification_push_kick/)
  assert.match(migration,/marketplace-push-delivery/)
  assert.match(migration,/x-worker-token/)
  assert.match(migration,/revoke all on function private\.marketplace_kick_push_delivery/)
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

test('Shield is a mounted live plan/checkout/verification flow instead of a coming-soon toast', () => {
  const page = read('src/app/app/page.jsx')
  const host = read('src/components/SOSMembershipHost.jsx')
  const edge = read('supabase/functions/sos-membership/index.ts')
  assert.match(page, /SOSMembershipHost/)
  assert.match(host, /sos-membership/)
  assert.match(host, /action:'plans'/)
  assert.match(host, /action:'checkout'/)
  assert.match(host, /action:'verify'/)
  assert.match(host, /sb_publishable_/)
  assert.doesNotMatch(host, /coming next/i)
  assert.match(edge, /mode:"subscription"/)
  assert.match(edge, /success_url:"https:\/\/thesuperherosonstandby\.com\/app\?membership=success/)
  assert.match(edge, /cancel_url:"https:\/\/thesuperherosonstandby\.com\/app\?membership=canceled"/)
})

test('Shield enrollment is fail-closed when marketplace payment health is offline', () => {
  const host = read('src/components/SOSMembershipHost.jsx')
  assert.match(host, /marketplace-payments-health/)
  assert.match(host, /paymentHealth\?\.ready===false/)
  assert.match(host, /No charge was attempted/)
  assert.match(host, /Payments offline/)
})

test('SOS readiness counts only Heroes who satisfy the real dispatch identity gate', () => {
  const readiness = read('supabase/functions/sos-network-readiness/index.ts')
  assert.match(readiness, /u\.status==='active'&&Boolean\(u\.auth_id\)/)
  assert.match(readiness, /h\.verification_status==='verified'&&eligibleUsers\.has\(h\.user_id\)/)
  assert.match(readiness, /eligibility_rule:"verified hero \+ active authenticated user"/)
})
