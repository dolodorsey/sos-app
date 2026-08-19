import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql=fs.readFileSync(new URL('../supabase/migrations/20260819024800_sos_quality_first_dispatch.sql',import.meta.url),'utf8')

test('SOS dispatch hard-gates verification, safety, eligibility and live availability',()=>{
  for(const guard of ['verification_status=\'verified\'','license_verified=true','insurance_verified=true','background_cleared=true','id_verified=true','test_mission_passed=true','on_duty=true','last_gps_at>=now()-interval \'15 minutes\'','p_subcategory=any(h.services_enabled)']) assert.ok(sql.includes(guard),guard)
})

test('SOS proximity contributes only five percent after quality signals',()=>{
  assert.match(sql,/completion_rate,100\)\)\)\*0\.20/)
  assert.match(sql,/on_time_rate,100\)\)\)\*0\.15/)
  assert.match(sql,/c\.freshness\*0\.20/)
  assert.match(sql,/dist\/p_radius_miles\).*\*0\.05/s)
  assert.match(sql,/sos_rank_nearby_heroes/)
  assert.doesNotMatch(sql,/dist\/p_radius_miles\).*\*0\.45/s)
})
