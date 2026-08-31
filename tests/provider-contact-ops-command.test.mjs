import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const command=()=>read('src/components/SOSOperationsCommand.jsx')

test('operations command loads the protected provider contact compliance queue',()=>{
  const src=command()
  assert.match(src,/sos_ops_provider_contact_compliance_queue/)
  assert.match(src,/Contact Compliance/)
  assert.match(src,/manual_contact_ready/)
  assert.match(src,/allowed_manual_channels/)
  assert.match(src,/automation_allowed/)
})

test('operators can record only completed manual contact outcomes through the guarded RPC',()=>{
  const src=command()
  assert.match(src,/sos_ops_record_manual_provider_contact/)
  assert.match(src,/manual_call/)
  assert.match(src,/manual_email/)
  assert.match(src,/manual_form/)
  assert.match(src,/application_started/)
  assert.match(src,/do_not_contact/)
  assert.match(src,/Record completed manual contact/)
  assert.match(src,/does not send an email, place a call, or start an automated sequence/)
})

test('manual-contact interface keeps automated channels visibly separate',()=>{
  const src=command()
  assert.match(src,/Automation remains separate/)
  assert.match(src,/Approved manual business contact does not authorize SMS, autodial, prerecorded voice, or automated email/)
  assert.doesNotMatch(src,/start automated outreach/i)
  assert.doesNotMatch(src,/send automated email/i)
})
