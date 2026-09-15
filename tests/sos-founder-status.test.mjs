import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('S.O.S. founder status is operator-only and S.O.S.-isolated',()=>{
  const source=read('supabase/functions/sos-founder-status/index.ts')
  assert.match(source,/marketplace_operator_check/)
  assert.match(source,/authentication_required/)
  assert.match(source,/operator_access_required/)
  assert.match(source,/visibility: "operator_only"/)
  assert.match(source,/sos_provider_activation_funnel_scorecard/)
  assert.match(source,/sos_recruiting_pipeline_health/)
  assert.match(source,/sos_crm_outbox/)
  assert.match(source,/sos_provider_applications/)
  assert.match(source,/sos_heroes/)
  assert.match(source,/sos_missions/)
  assert.match(source,/sos_recruiting_outreach_events/)
  assert.doesNotMatch(source,/oc_/)
  assert.doesNotMatch(source,/luxe_/)
})

test('S.O.S. founder status identifies execution stagnation, not configured inventory',()=>{
  const source=read('supabase/functions/sos-founder-status/index.ts')
  assert.match(source,/prospects_exist_but_zero_contacted/)
  assert.match(source,/qualified_candidates_but_zero_outreach_execution/)
  assert.match(source,/stale_crm_backlog_over_4h/)
  assert.match(source,/crm_backlog_zero_attempts/)
  assert.match(source,/zero_provider_applications/)
  assert.match(source,/zero_verified_hero_supply/)
  assert.match(source,/zero_lifetime_missions/)
})
