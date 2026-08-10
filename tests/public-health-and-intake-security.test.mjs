import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('S.O.S. public health exposes readiness booleans, not business-volume telemetry',()=>{
  const health=read('supabase/functions/sos-health/index.ts')
  assert.match(health,/catalog:\{ready:catalogReady\}/)
  assert.match(health,/verified_supply:Boolean\(/)
  assert.match(health,/live_supply:Boolean\(/)
  assert.match(health,/payments:\{ready:paymentsReady/)
  assert.doesNotMatch(health,/credential_sources/)
  assert.doesNotMatch(health,/active_services:/)
  assert.doesNotMatch(health,/active_zones:/)
  assert.doesNotMatch(health,/pending_payments:/)
  assert.doesNotMatch(health,/subscriptions:/)
  assert.doesNotMatch(health,/delivery_rows:/)
  assert.doesNotMatch(health,/active_cases:/)
})

test('S.O.S. public Hero intake is size-limited and rate-limited before new writes',()=>{
  const edge=read('supabase/functions/submit-sos-hero-application/index.ts')
  assert.match(edge,/MAX_BODY_BYTES=32768/)
  assert.match(edge,/Application request must be valid JSON/)
  assert.match(edge,/marketplace_consume_intake_rate_limit/)
  assert.match(edge,/p_app:'sos_hero'/)
  assert.match(edge,/p_limit:8/)
  assert.match(edge,/p_window_minutes:60/)
  assert.match(edge,/Too many new applications from this network/)
  assert.ok(edge.indexOf(".in('status',['submitted','reviewing','approved'])")<edge.indexOf('marketplace_consume_intake_rate_limit'),'duplicate check must occur before consuming rate limit')
})

test('legacy S.O.S. provider intake stays retired',()=>{
  const legacy=read('supabase/functions/submit-provider-application/index.ts')
  assert.match(legacy,/status:410/)
  assert.match(legacy,/legacy provider intake is retired/i)
  assert.match(legacy,/\/hero\/apply/)
})

test('serialized intake limiter is service-role only and race-safe',()=>{
  const migration=read('supabase/migrations/20260810093000_serialize_marketplace_public_intake_rate_limit.sql')
  assert.match(migration,/service_role/)
  assert.match(migration,/pg_advisory_xact_lock/)
  assert.match(migration,/hashtextextended/)
})
