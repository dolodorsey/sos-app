import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

const migration=()=>read('supabase/migrations/20260830194521_sos_enforce_contact_compliance_at_outreach_execution.sql')

test('automated provider outreach is fail-closed behind explicit consent',()=>{
  const sql=migration()
  assert.match(sql,/sos_recruiting_automation_allowed/)
  assert.match(sql,/automation_allowed=true/)
  assert.match(sql,/explicit_consent_at is not null/)
  assert.match(sql,/do_not_contact,false\)=false/)
  assert.match(sql,/sos_claim_recruiting_outreach[\s\S]*private\.sos_recruiting_automation_allowed\(c\.id\)/)
  assert.match(sql,/p_outreach_status in \('queued','in_progress'\)[\s\S]*Automated outreach is blocked/)
  assert.match(sql,/revoke all on function public\.sos_claim_recruiting_outreach\(text\) from public, anon, authenticated/)
  assert.match(sql,/grant execute on function public\.sos_claim_recruiting_outreach\(text\) to service_role/)
})

test('manual provider contact requires an active channel-specific compliance review',()=>{
  const sql=migration()
  assert.match(sql,/sos_ops_record_manual_provider_contact/)
  assert.match(sql,/p_channel not in \('manual_call','manual_email','manual_form'\)/)
  assert.match(sql,/cc\.review_status='manual_contact_reviewed'/)
  assert.match(sql,/cc\.expires_at is null or cc\.expires_at > v_now/)
  assert.match(sql,/p_channel = any\(coalesce\(v_allowed,'\{\}'::text\[\]\)\)/)
  assert.match(sql,/Provider is marked do-not-contact/)
  assert.match(sql,/mode','manual_operator'/)
  assert.match(sql,/p_outcome='do_not_contact' then true/)
  assert.match(sql,/Marketplace operator access required/)
})
