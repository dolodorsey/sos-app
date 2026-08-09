import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('approved real Heroes receive all nine required verification checks and demo supply is excluded',()=>{
 const migration=read('supabase/migrations/20260809060000_real_hero_verification_pipeline.sql')
 for(const check of ['identity','background','license','insurance','equipment','vehicle','service_skills','test_mission','payout_account']) assert.match(migration,new RegExp(`'${check}'`))
 assert.match(migration,/coalesce\(h\.is_demo,false\)/)
 assert.match(migration,/coalesce\(u\.is_demo,false\)/)
 assert.match(migration,/sos_approved_hero_verification_init/)
})

test('required Hero checks cannot be waived and Stripe exclusively owns payout approval',()=>{
 const migration=read('supabase/migrations/20260809060000_real_hero_verification_pipeline.sql')
 assert.match(migration,/p_check_type='payout_account'/)
 assert.match(migration,/Payout verification is synchronized from Stripe and cannot be manually approved/)
 assert.match(migration,/p_status='waived' and v_row\.required/)
 assert.match(migration,/Required Hero verification cannot be waived/)
})

test('overall verified status exactly matches the all-required-passed patrol contract',()=>{
 const migration=read('supabase/migrations/20260809060500_verification_status_matches_patrol_gate.sql')
 assert.match(migration,/not exists\(select 1 from public\.sos_hero_verification_checks where hero_id=p_hero_id and required and status<>'passed'\)/)
 assert.match(migration,/v_overall:='verified'/)
 assert.match(migration,/dispatch_ready/)
 assert.match(migration,/v_passed=v_required/)
})

test('Stripe payout runtime synchronizes payout_account rather than trusting an operator toggle',()=>{
 const edge=read('supabase/functions/hero-payouts/index.ts')
 assert.match(edge,/check_type:'payout_account'/)
 assert.match(edge,/reviewed_by:'stripe'/)
 assert.match(edge,/ready\?'passed':'submitted'/)
 assert.match(edge,/Stripe transfers active/)
 assert.match(edge,/sos_recompute_hero_verification_admin/)
})

test('operator and Hero surfaces both consume the authoritative verification APIs',()=>{
 const opsPage=read('src/app/ops/heroes/page.jsx')
 const ops=read('src/components/SOSHeroVerificationOpsHost.jsx')
 const heroPage=read('src/app/hero/page.jsx')
 const hero=read('src/components/SOSHeroVerificationReadinessHost.jsx')
 assert.match(opsPage,/SOSHeroVerificationOpsHost/)
 assert.match(ops,/sos_ops_verification_queue/)
 assert.match(ops,/sos_ops_review_verification_check/)
 assert.match(ops,/STRIPE-MANAGED/)
 assert.match(heroPage,/SOSHeroVerificationReadinessHost/)
 assert.match(hero,/sos_hero_verification_status/)
 assert.match(hero,/Complete 9\/9 before patrol/)
 assert.match(hero,/hero-payouts/)
})

test('demo Hero claim status cannot surface quarantined supply as eligible',()=>{
 const claim=read('supabase/migrations/20260809055000_claim_status_excludes_demo_supply.sql')
 assert.match(claim,/@sos-demo\.atl/)
 assert.match(claim,/coalesce\(c\.is_demo,false\)=false/)
 assert.match(claim,/coalesce\(u\.is_demo,false\)=false/)
 assert.match(claim,/coalesce\(h\.is_demo,false\)=false/)
})
