import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('verification bucket is private and owner/operator scoped',()=>{
 const migration=read('supabase/migrations/20260809061000_private_verification_documents.sql')
 assert.match(migration,/marketplace-verification/)
 assert.match(migration,/false,10485760/)
 assert.match(migration,/storage\.foldername\(name\)\)\[2\]=auth\.uid\(\)::text/)
 assert.match(migration,/public\.marketplace_operator_check\(\)/)
})

test('Hero evidence submission rejects Stripe payout evidence and never auto-passes a check',()=>{
 const migration=read('supabase/migrations/20260809061000_private_verification_documents.sql')
 assert.match(migration,/sos_hero_submit_verification_evidence/)
 assert.match(migration,/p_check_type='payout_account'/)
 assert.match(migration,/Payout evidence is synchronized from Stripe/)
 assert.match(migration,/status=case when status='passed' then status else 'submitted' end/)
})

test('Hero readiness uploads private evidence through the authenticated Hero path',()=>{
 const hero=read('src/components/SOSHeroVerificationReadinessHost.jsx')
 assert.match(hero,/marketplace-verification/)
 assert.match(hero,/sos_hero_submit_verification_evidence/)
 assert.match(hero,/sos\/\$\{userId\}\/\$\{state\.hero_id\}/)
 assert.match(hero,/10\*1024\*1024/)
 assert.match(hero,/Upload evidence/)
})

test('Hero operators inspect evidence only through five-minute signed URLs',()=>{
 const ops=read('src/components/SOSHeroVerificationOpsHost.jsx')
 assert.match(ops,/storage\/v1\/object\/sign\/marketplace-verification/)
 assert.match(ops,/expiresIn:300/)
 assert.match(ops,/View file/)
})
