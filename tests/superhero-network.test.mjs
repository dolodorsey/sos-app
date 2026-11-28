import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261128060000_sos_superhero_network.sql')
const portal=read('src/components/SOSNetworkPortal.jsx')
const command=read('src/components/SOSNetworkCommand.jsx')
const lib=read('src/lib/sosNetwork.js')

test('network tables are private; members reach them only through signed-in functions',()=>{
 assert.match(sql,/revoke all on public\.%I from public, anon, authenticated/)
 assert.match(sql,/enable row level security/)
 assert.match(sql,/revoke all on function public\.sos_network_catalog\(\)[\s\S]*from public, anon;/)
 assert.doesNotMatch(sql,/grant (select|insert|update|delete)[^;]*sos_network_/i)
})

test('the pilot stays invite-only with proposed points, unapproved rewards and no outbound sends',()=>{
 assert.match(sql,/'enrollment','invite_only'/)
 assert.match(sql,/'points_status','proposed'/)
 assert.match(sql,/'rewards_status','not_approved'/)
 assert.match(sql,/'outbound','off'/)
 assert.doesNotMatch(sql,/net\.http_post|send_message|twilio|resend/i)
})

test('the database sets points and nobody can approve their own work',()=>{
 assert.match(sql,/You cannot review your own submission/)
 assert.match(sql,/You cannot adjust your own points/)
 assert.match(sql,/You cannot move your own introduction/)
 assert.match(sql,/event_key text not null unique/)
 assert.match(sql,/unique \(member_id, mission_id, occurrence_key\)/)
 assert.doesNotMatch(portal,/points_awarded\s*:/)
 assert.doesNotMatch(lib,/sos_network_points_ledger/)
})

test('all 55 missions, 8 sides of town, 11 lanes, 6 ranks and 100 founding spots are seeded',()=>{
 const ids=sql.match(/\('(SOC|CUS|PRO|STR|QA)-\d{3}'/g)||[]
 assert.equal(new Set(ids).size,55)
 for(const t of ['downtown','midtown','buckhead','eastside','westside','southside','northside','gwinnett'])assert.match(sql,new RegExp(`\\('${t}','`))
 assert.equal((sql.match(/\('(founding_100|insiders|ambassadors|street_team|creators|scouts|test_pilots|secret_agents|business_allies|captains|internal_team)','/g)||[]).length,11)
 assert.match(sql,/generate_series\(1,100\)/)
 assert.match(sql,/\('legend','Legend',5000,null/)
})

test('introductions need consent and duplicates are held, never double-credited',()=>{
 assert.match(sql,/consent_confirmed boolean not null check \(consent_confirmed\)/)
 assert.match(sql,/duplicate_hold/)
 assert.match(portal,/They told me it’s okay for S\.O\.S\. to reach out/)
})

test('member and operator screens spell things out and keep the brand spelling',()=>{
 assert.match(portal,/ALL SUPERHEROS DONT WEAR CAPES!/)
 assert.match(portal,/Points are recognition, not money/)
 assert.match(command,/WAITING ON DOLO · S\.O\.S\./)
 assert.match(command,/This is your own submission\. Another reviewer has to decide it\./)
 assert.doesNotMatch(portal+command,new RegExp('SUPERHERO'+'ES'))
})
