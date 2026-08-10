import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260810040000_scrub_support_cases_on_account_deletion.sql',import.meta.url),'utf8')

test('S.O.S. account deletion scrubs support case personal content',()=>{
 assert.match(migration,/update public\.sos_support_tickets/)
 assert.match(migration,/subject='Deleted account support record'/)
 assert.match(migration,/description=''/)
 assert.match(migration,/status='closed'/)
 assert.match(migration,/support_cases_scrubbed/)
})

test('S.O.S. support scrub remains part of the same server-side anonymization transaction',()=>{
 assert.match(migration,/create or replace function public\.sos_anonymize_account/)
 assert.match(migration,/where user_id=v_user_id/)
 assert.match(migration,/profile_anonymized/)
})
