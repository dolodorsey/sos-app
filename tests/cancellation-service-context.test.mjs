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

test('S.O.S. cancellation RPCs support trusted Edge context without weakening customer ownership',()=>{
  const migration=read('supabase/migrations/20260810081359_fix_marketplace_cancellation_service_context.sql')
  assert.match(migration,/auth\.jwt\(\)->>'role',''\)='service_role'/)
  assert.match(migration,/private\.sos_current_user_id\(\)/)
  assert.match(migration,/where id=p_mission_id and citizen_id=v_user/)
  assert.match(migration,/where id=p_mission_id and citizen_id=uid/)
  assert.doesNotMatch(migration,/current_user\s+(?:in|not\s+in)/i)
})
