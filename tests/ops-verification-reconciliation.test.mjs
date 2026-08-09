import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('operator verification review reconciles critical Hero readiness without touching payout readiness',()=>{
  const migration=read('supabase/migrations/20260809051500_reconcile_sos_hero_verification_after_review.sql')
  assert.match(migration,/private\.sos_recompute_hero_verification/)
  for(const field of ['id_verified','background_cleared','license_verified','insurance_verified','test_mission_passed','verification_status']) assert.match(migration,new RegExp(field))
  for(const check of ['identity','background','license','insurance','test_mission']) assert.match(migration,new RegExp(check))
  assert.match(migration,/v_overall:='verified'/)
  assert.match(migration,/v_overall:='rejected'/)
  assert.doesNotMatch(migration,/stripe_connect_id\s*=/)
  assert.doesNotMatch(migration,/payout_ready/)
  assert.match(migration,/revoke all on function private\.sos_recompute_hero_verification/)
})
