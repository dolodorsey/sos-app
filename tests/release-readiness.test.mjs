import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('health contract identifies the app and authority', () => {
  const health = JSON.parse(read('public/health.json'))
  assert.equal(health.app, 'sos-app')
  assert.equal(health.authority, 'Supabase cxdqkjvtpilvouwtbgdy public.sos_*')
  assert.equal(health.service, 'roadside-dispatch-marketplace')
  assert.equal(health.fulfillment_mode, 'operator-offer-and-hero-acceptance')
  assert.equal(health.schema_version, 4)
  assert.equal(health.live_health_endpoint, 'https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/health')
})

test('mission payments require manual capture, verified completion, and idempotent release', () => {
  const checkout = read('supabase/functions/create-mission-checkout/index.ts')
  const operations = read('supabase/functions/manage-mission-payment/index.ts')
  const webhook = read('supabase/functions/stripe-webhook/index.ts')
  const states = read('supabase/migrations/20260803043736_sos_payment_state_constraint.sql')
  assert.match(checkout, /capture_method:'manual'/)
  assert.match(checkout, /pricing_status!==?'confirmed'/)
  assert.match(operations, /mission\.status!==?'completed'/)
  assert.match(operations, /source_transaction:payment\.stripe_charge_id/)
  assert.match(operations, /idempotencyKey:`sos-release-/)
  assert.match(webhook, /constructEventAsync/)
  assert.match(webhook, /code==='23505'/)
  for (const state of ['pending_authorization','authorized_hold','held_for_release','released_to_hero','released_to_customer','partially_refunded','refunded','failed','disputed']) assert.match(states, new RegExp(state))
})

test('handoff prevents unsafe dedicated-database cutover', () => {
  const handoff = read('docs/HANDOFF.md')
  assert.match(handoff, /public\.sos_\*/)
  assert.match(handoff, /No dual write/i)
  assert.match(handoff, /RLS|grants/i)
})

test('Hero and customer portals use the secured mission lifecycle', () => {
  const app = read('src/components/SOSApp.jsx')
  assert.match(app, /sos_accept_mission_offer/)
  assert.match(app, /sos_decline_mission_offer/)
  assert.match(app, /sos_transition_assigned_mission/)
  assert.match(app, /last_gps_at:new Date/)
  assert.match(app, /create-mission-checkout/)
  assert.match(app, /sos_rate_completed_mission/)
  assert.doesNotMatch(app, /buy\.stripe\.com/)
})

test('production Hero claim isolation and FK indexes are reproducible from source', () => {
  const claim = read('supabase/migrations/20260809054215_sos_claim_status_excludes_demo_supply.sql')
  const indexes = read('supabase/migrations/20260809054608_add_sos_fk_indexes.sql')

  assert.match(claim, /sos_hero_claim_status/)
  assert.match(claim, /coalesce\(c\.is_demo,false\)=false/)
  assert.match(claim, /coalesce\(u\.is_demo,false\)=false/)
  assert.match(claim, /coalesce\(h\.is_demo,false\)=false/)
  for (const name of [
    'sos_hero_applications_candidate_id_idx',
    'sos_hero_applications_source_hero_id_idx',
    'sos_hero_applications_source_user_id_idx',
    'sos_mission_messages_sender_user_id_idx',
    'sos_mission_shares_v2_citizen_id_idx',
    'sos_support_tickets_mission_id_idx',
  ]) assert.match(indexes, new RegExp(name))
})
