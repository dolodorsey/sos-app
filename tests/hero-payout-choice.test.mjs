import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261125100000_sos_hero_payout_choice.sql')
const ui=read('src/components/SOSHeroVerificationReadinessHost.jsx')
const worker=read('supabase/functions/marketplace-payout-retry/index.ts')
const payouts=read('supabase/functions/hero-payouts/index.ts')

test('Heroes choose direct deposit or mailed check, and no tax ID is stored by S.O.S.',()=>{
 assert.match(sql,/payout_preference in \('direct_deposit','mailed_check'\)/)
 assert.doesNotMatch(sql,/\b(ssn|tax_id|tin)\b\s+text/i)
 assert.match(ui,/Direct deposit/)
 assert.match(ui,/Mailed check/)
 assert.match(ui,/never stores your Social Security or tax ID number/)
})

test('a check payee is payout-ready only after operations confirms the tax form',()=>{
 assert.match(sql,/sos_ops_confirm_hero_tax_form/)
 assert.match(sql,/is_marketplace_operator\(auth\.uid\(\)\)/)
 assert.match(sql,/tax_form_status='received'/)
})

test('check payouts go to an operator queue, never to Stripe, and release only when mailed',()=>{
 assert.match(worker,/payout_preference==='mailed_check'[\s\S]*sos_queue_check_payout[\s\S]*continue/)
 assert.ok(worker.indexOf('sos_queue_check_payout')<worker.indexOf('destination:hero.stripe_connect_id'))
 assert.match(sql,/on conflict\(payment_id\) do nothing/)
 assert.match(sql,/sos_ops_mark_check_mailed[\s\S]*Check number required[\s\S]*payment_status='released'/)
})

test('a payout status read does not reset a check payee back to pending',()=>{
 assert.match(payouts,/payout_preference==='mailed_check'&&String\(peek\.action\|\|'status'\)==='status'/)
})
