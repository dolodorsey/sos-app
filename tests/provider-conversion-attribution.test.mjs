import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const sql=()=>read('supabase/migrations/20260831075000_sos_provider_conversion_attribution.sql')
const submit=()=>read('supabase/functions/submit-sos-hero-application/index.ts')

test('manual contact outcomes normalize into the constrained recruiting lifecycle',()=>{
  const migration=sql()
  assert.match(migration,/v_last_outcome text/)
  assert.match(migration,/connected_interested','connected_follow_up','application_started','not_interested'\) then 'responded'/)
  assert.match(migration,/p_outcome='do_not_contact' then 'opted_out'/)
  assert.match(migration,/last_outcome=v_last_outcome/)
  assert.doesNotMatch(migration,/last_outcome=p_outcome/)
})

test('application attribution only links a uniquely matched, positively contacted real prospect',()=>{
  const migration=sql()
  assert.match(migration,/sos_link_hero_application_candidate/)
  assert.match(migration,/coalesce\(auth\.role\(\),''\) <> 'service_role'/)
  assert.match(migration,/coalesce\(c\.is_demo,false\)=false/)
  assert.match(migration,/c\.pipeline_stage='contacted'/)
  assert.match(migration,/c\.outreach_status='responded'/)
  assert.match(migration,/e\.outcome in \('connected_interested','connected_follow_up','application_started'\)/)
  assert.match(migration,/v_top_count <> 1/)
  assert.match(migration,/ambiguous_contact_match/)
  assert.match(migration,/update public\.sos_hero_applications[\s\S]*candidate_id=v_candidate_id/)
  assert.match(migration,/pipeline_stage='screening'/)
  assert.match(migration,/revoke all on function public\.sos_link_hero_application_candidate\(uuid\) from public, anon, authenticated/)
  assert.match(migration,/grant execute on function public\.sos_link_hero_application_candidate\(uuid\) to service_role/)
})

test('canonical Hero intake attempts attribution without making attribution a submission blocker',()=>{
  const edge=submit()
  assert.match(edge,/const linkRecruitingCandidate=/)
  assert.match(edge,/admin\.rpc\('sos_link_hero_application_candidate'/)
  assert.match(edge,/console\.error\('sos-hero-application-attribution'/)
  assert.match(edge,/const attribution=await linkRecruitingCandidate\(admin,data\.id\)/)
  assert.match(edge,/source_attributed:attribution\?\.linked===true/)
})

test('conditional approval reuses an attributed recruiting candidate instead of duplicating it',()=>{
  const migration=sql()
  assert.match(migration,/if a\.candidate_id is not null then[\s\S]*where id=a\.candidate_id and coalesce\(is_demo,false\)=false/)
  assert.match(migration,/Existing recruiting attribution preserved/)
  assert.match(migration,/source_user_id=u\.id,[\s\S]*source_hero_id=h\.id/)
})
