import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const legacy=fs.readFileSync(new URL('../supabase/migrations/20260803_customer_request_auto_dispatch.sql',import.meta.url),'utf8')
const latest=fs.readFileSync(new URL('../supabase/migrations/20260819024800_sos_quality_first_dispatch.sql',import.meta.url),'utf8')

test('latest SOS migration replaces the legacy proximity-first dispatch function',()=>{
  assert.match(legacy,/sos_find_nearby_heroes/)
  assert.match(latest,/create or replace function public\.sos_auto_dispatch_customer_mission/)
  assert.match(latest,/sos_rank_nearby_heroes/)
  assert.doesNotMatch(latest,/sos_find_nearby_heroes/)
})

test('canonical dispatch can only offer verified live quality-ranked heroes',()=>{
  for(const guard of [
    "verification_status='verified'",
    'license_verified=true',
    'insurance_verified=true',
    'background_cleared=true',
    'id_verified=true',
    'test_mission_passed=true',
    'on_duty=true',
    "last_gps_at>=now()-interval '15 minutes'",
  ]) assert.ok(latest.includes(guard),guard)
  assert.match(latest,/order by 9 desc,5 asc/)
  assert.match(latest,/\*0\.05/)
})
