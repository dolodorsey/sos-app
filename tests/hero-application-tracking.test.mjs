import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Hero application stores only the private receipt hash',()=>{
 const migration=read('supabase/migrations/20260809061500_private_application_tracking_receipts.sql')
 const edge=read('supabase/functions/submit-sos-hero-application/index.ts')
 assert.match(migration,/status_token_hash/)
 assert.match(migration,/Raw token is never stored/)
 assert.match(edge,/crypto\.subtle\.digest\('SHA-256'/)
 assert.match(edge,/status_token_hash:hash/)
 assert.match(edge,/tracking_token:token/)
 assert.doesNotMatch(edge,/status_token_hash:token/)
})

test('Hero application status needs application ID plus receipt token, not email lookup',()=>{
 const edge=read('supabase/functions/submit-sos-hero-application/index.ts')
 assert.match(edge,/b\?\.action==='status'/)
 assert.match(edge,/application_id/)
 assert.match(edge,/tracking_token/)
 assert.match(edge,/\.eq\('id',applicationId\)\.eq\('status_token_hash',hash\)/)
 const statusBranch=edge.slice(edge.indexOf("if(b?.action==='status')"),edge.indexOf('const email='))
 assert.doesNotMatch(statusBranch,/\.eq\('email'/)
})

test('duplicate Hero application does not leak another tracking token',()=>{
 const edge=read('supabase/functions/submit-sos-hero-application/index.ts')
 const start=edge.indexOf('if(existing)')
 const end=edge.indexOf('const source=',start)
 assert.notEqual(start,-1)
 assert.notEqual(end,-1)
 const duplicate=edge.slice(start,end)
 assert.match(duplicate,/duplicate:true/)
 assert.doesNotMatch(duplicate,/tracking_token/)
})

test('Hero application UI persists receipt, polls, and shows approved claim action',()=>{
 const ui=read('src/app/hero/apply/page.jsx')
 assert.match(ui,/sos_hero_application_receipt/)
 assert.match(ui,/localStorage\.setItem\(RECEIPT_KEY/)
 assert.match(ui,/action:'status'/)
 assert.match(ui,/setInterval\(\(\)=>refreshStatus\(receipt\),30000\)/)
 assert.match(ui,/Claim approved Hero profile/)
 assert.match(ui,/href="\/hero\/claim"/)
})
