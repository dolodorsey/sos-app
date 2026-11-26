import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const sql=fs.readFileSync(new URL('../supabase/migrations/20261125110000_sos_test_accounts_stay_separate.sql',import.meta.url),'utf8')

test('test Heroes only serve test customers and real Heroes only serve real customers',()=>{
 assert.match(sql,/create or replace function private\.sos_test_match/)
 assert.match(sql,/sos_auto_dispatch_customer_mission/)
 assert.match(sql,/sos_dispatch_mission_offers/)
 assert.match(sql,/sos_dispatch_one_mission/)
 assert.match(sql,/Test Heroes only serve test customers, and real Heroes only serve real customers/)
 assert.match(sql,/private\.sos_is_test_auth\(u\.auth_id\) = v_test/)
})

test('public coverage lists every service and never counts a test Hero',()=>{
 assert.match(sql,/not private\.sos_is_test_auth\(u\.auth_id\)/)
 assert.doesNotMatch(sql.slice(sql.indexOf('-- Public coverage')),/h\.id is null or/)
})
