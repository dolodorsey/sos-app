import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const sql=()=>read('supabase/migrations/20260831115000_sos_hero_application_activation_sla.sql')

test('canonical Hero application default matches the live state machine',()=>{
  const migration=sql()
  assert.match(migration,/alter column status set default 'documents_required'/i)
  assert.doesNotMatch(migration,/alter column status set default 'submitted'/i)
})

test('Hero application status transitions have a durable stage clock',()=>{
  const migration=sql()
  assert.match(migration,/add column if not exists status_entered_at timestamptz/i)
  assert.match(migration,/sos_track_hero_application_status_entered_at/)
  assert.match(migration,/new\.status is distinct from old\.status/)
  assert.match(migration,/new\.status_entered_at := now\(\)/)
})

test('application command queue covers credential progress and every active state SLA',()=>{
  const migration=sql()
  assert.match(migration,/sos_hero_application_activation_command_queue/)
  assert.match(migration,/required_uploaded_count/)
  assert.match(migration,/required_accepted_count/)
  for(const status of ['documents_required','waitlisted','reviewing','needs_information','conditionally_approved','approved']) assert.match(migration,new RegExp(`when '${status}'`))
  assert.match(migration,/next_required_action/)
  assert.match(migration,/is_overdue/)
})

test('application command surfaces remain fail closed except for authorized operators',()=>{
  const migration=sql()
  assert.match(migration,/revoke all on public\.sos_hero_application_activation_command_queue from public, anon, authenticated, service_role/)
  assert.match(migration,/grant select on public\.sos_hero_application_activation_command_queue to service_role/)
  assert.match(migration,/sos_ops_hero_application_activation_queue/)
  assert.match(migration,/not private\.is_marketplace_operator\(auth\.uid\(\)\)/)
  assert.match(migration,/grant execute on function public\.sos_ops_hero_application_activation_queue\(integer\) to authenticated/)
})

test('stalled Hero applications generate deduplicated operator SLA alerts on a 15 minute worker',()=>{
  const migration=sql()
  assert.match(migration,/private\.sos_hero_application_alert_state/)
  assert.match(migration,/private\.sos_sync_hero_application_sla_alerts/)
  assert.match(migration,/hero_application_sla/)
  assert.match(migration,/on conflict\(application_id,application_status\)/)
  assert.match(migration,/sos-hero-application-sla-alerts/)
  assert.match(migration,/'\*\/15 \* \* \* \*'/)
})
