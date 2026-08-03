import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('health contract identifies the app and authority', () => {
  const health = JSON.parse(read('public/health.json'))
  assert.equal(health.app, 'sos-app')
  assert.equal(health.authority, 'Supabase cxdqkjvtpilvouwtbgdy public.sos_*')
  assert.equal(health.schema_version, 3)
})

test('mission payments require manual capture, verified completion, and idempotent release', () => {
  const checkout = read('supabase/functions/create-mission-checkout/index.ts')
  const operations = read('supabase/functions/manage-mission-payment/index.ts')
  const webhook = read('supabase/functions/stripe-webhook/index.ts')
  assert.match(checkout, /capture_method:'manual'/)
  assert.match(checkout, /pricing_status!==?'confirmed'/)
  assert.match(operations, /mission\.status!==?'completed'/)
  assert.match(operations, /source_transaction:payment\.stripe_charge_id/)
  assert.match(operations, /idempotencyKey:`sos-release-/)
  assert.match(webhook, /constructEventAsync/)
  assert.match(webhook, /code==='23505'/)
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
