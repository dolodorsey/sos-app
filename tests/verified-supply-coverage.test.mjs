import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('authenticated citizen mission is rejected when no real verified Hero covers the requested service',()=>{
 const migration=read('supabase/migrations/20260809062000_customer_requests_require_verified_supply.sql')
 assert.match(migration,/sos_customer_request_supply_guard/)
 assert.match(migration,/role='citizen'/)
 assert.match(migration,/coalesce\(h\.is_demo,false\)=false/)
 assert.match(migration,/u\.auth_id is not null/)
 assert.match(migration,/h\.verification_status='verified'/)
 assert.match(migration,/requested_service_name/)
 assert.match(migration,/verified Hero coverage is not active for this service yet\. No mission was created/)
})

test('SOS customer coverage does not require a Hero to be currently on patrol',()=>{
 const migration=read('supabase/migrations/20260809062000_customer_requests_require_verified_supply.sql')
 assert.doesNotMatch(migration,/h\.on_duty/)
 assert.match(migration,/services_enabled/)
})
