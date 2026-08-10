import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('S.O.S. cancellation Edge uses the v2 settlement path',()=>{
  const edge=read('supabase/functions/sos-cancel-mission/index.ts')
  assert.match(edge,/sos_customer_cancellation_quote/)
  assert.match(edge,/sos_cancel_own_mission_v2/)
  assert.doesNotMatch(edge,/rpc\(['"]sos_cancel_own_mission['"]/)
})

test('S.O.S. cancellation is DB-authoritative before Stripe and retryable',()=>{
  const edge=read('supabase/functions/sos-cancel-mission/index.ts')
  const cancel=edge.indexOf('sos_cancel_own_mission_v2'),capture=edge.indexOf('paymentIntents.capture'),cancelIntent=edge.indexOf('paymentIntents.cancel')
  assert.ok(cancel>=0&&capture>cancel,'DB cancellation must precede Stripe capture')
  assert.ok(cancel>=0&&cancelIntent>cancel,'DB cancellation must precede Stripe authorization cancel')
  assert.match(edge,/pending_retry/)
  assert.match(edge,/queued for retry/)
})

test('S.O.S. cancellation RPCs support trusted Edge context without weakening customer ownership',()=>{
  const migration=read('supabase/migrations/20260810081359_fix_marketplace_cancellation_service_context.sql')
  assert.match(migration,/auth\.jwt\(\)->>'role',''\)='service_role'/)
  assert.match(migration,/private\.sos_current_user_id\(\)/)
  assert.match(migration,/where id=p_mission_id and citizen_id=v_user/)
  assert.match(migration,/where id=p_mission_id and citizen_id=uid/)
  assert.doesNotMatch(migration,/current_user\s+(?:in|not\s+in)/i)
})

test('S.O.S. cancellation settlement split preserves original service economics',()=>{
  const migration=read('supabase/migrations/20260810082439_fix_cancellation_settlement_split_constraints.sql')
  assert.match(migration,/settlement_type in \('customer_cancellation','customer_no_show'\)/)
  assert.match(migration,/round\(coalesce\(platform_fee,0\) \+ coalesce\(hero_payout,0\),2\) = round\(coalesce\(cancellation_fee,0\),2\)/)
  assert.match(migration,/round\(coalesce\(platform_fee,0\) \+ coalesce\(hero_payout,0\),2\) = round\(amount \+ coalesce\(tip,0\),2\)/)
})

test('scheduled retry worker uses Vault, v2 Hero readiness, and matching settlement keys',()=>{
  const worker=read('supabase/functions/marketplace-payout-retry/index.ts')
  const schedule=read('supabase/migrations/20260810083127_schedule_marketplace_payout_retry_worker_v2.sql')
  assert.match(worker,/sos_get_runtime_secret/)
  assert.match(worker,/stripe_connect_api_version==='v2'/)
  assert.match(worker,/stripe_transfer_status==='active'/)
  assert.match(worker,/customer_no_show/)
  assert.match(worker,/sos-no-show/)
  assert.match(worker,/sos-cancel-mission/)
  assert.match(worker,/sos-cancel-fee-transfer-\$\{p\.mission_id\}-v1/)
  assert.match(worker,/sos-customer-no-show-transfer-\$\{p\.mission_id\}-v1/)
  assert.doesNotMatch(worker,/retry_worker/)
  assert.match(schedule,/marketplace-payout-retry/)
  assert.match(schedule,/payout_retry_worker_token/)
  assert.match(schedule,/\* \* \* \* \*/)
})

test('legacy S.O.S. cancellation stays retired',()=>{
  const legacy=read('supabase/migrations/20260810081500_retire_legacy_marketplace_paths.sql')
  assert.match(legacy,/revoke execute on function public\.sos_cancel_own_mission\(uuid,text\)/i)
})
