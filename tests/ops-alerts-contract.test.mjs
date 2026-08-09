import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('shared application alerts keep ON CALL and SOS activity explicit',()=>{
 const migration=read('supabase/migrations/20260809063000_marketplace_operator_application_alerts.sql')
 assert.match(migration,/product_key in \('on_call','sos'\)/)
 assert.match(migration,/provider_application_submitted/)
 assert.match(migration,/hero_application_submitted/)
 assert.match(migration,/provider_application_status/)
 assert.match(migration,/hero_application_status/)
})

test('alert read state is per authenticated marketplace operator',()=>{
 const migration=read('supabase/migrations/20260809063000_marketplace_operator_application_alerts.sql')
 assert.match(migration,/marketplace_operator_alert_reads/)
 assert.match(migration,/operator_auth_id uuid not null/)
 assert.match(migration,/where public\.marketplace_operator_check\(\)/)
 assert.match(migration,/auth\.uid\(\) is null or not public\.marketplace_operator_check\(\)/)
})

test('SOS Hero operations mounts shared application activity inbox',()=>{
 const page=read('src/app/ops/heroes/page.jsx')
 const host=read('src/components/SOSOpsAlertsHost.jsx')
 assert.match(page,/SOSOpsAlertsHost/)
 assert.match(host,/marketplace_ops_alert_feed/)
 assert.match(host,/marketplace_ops_mark_alert_read/)
 assert.match(host,/New S\.O\.S\. Hero and ON CALL provider applications/)
 assert.match(host,/never exposes verification documents or credentials/i)
})
