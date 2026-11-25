import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')

test('Hero services are stored as the service id customers order, so dispatch can match them',()=>{
 const sql=read('supabase/migrations/20261125080000_sos_one_service_vocabulary.sql')
 assert.match(sql,/create or replace function public\.sos_service_key/)
 assert.match(sql,/\('jump_start','jump'\)/)
 assert.match(sql,/before insert or update of services_enabled on public\.sos_heroes/)
 assert.match(sql,/new\.subcategory_id = any\(h\.services_enabled\)/)
})

test('the shared payment guard reads only the fields of the table being updated',()=>{
 const sql=read('supabase/migrations/20261125090000_sos_payment_update_guard_fix.sql')
 assert.match(sql,/if tg_table_name='sos_payments' then[\s\S]*elsif tg_table_name='oc_booking_payments' then/)
 assert.match(sql,/set default 'pending_authorization'/)
})
