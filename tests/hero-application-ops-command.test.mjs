import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const page=()=>read('src/app/ops/heroes/page.jsx')

test('Hero Operations consumes the protected application activation RPC',()=>{
  const source=page()
  assert.match(source,/\/rest\/v1\/rpc\/sos_ops_hero_application_activation_queue/)
  assert.match(source,/p_limit:500/)
  assert.doesNotMatch(source,/\/rest\/v1\/sos_hero_application_activation_command_queue/)
  assert.doesNotMatch(source,/\.from\(['"]sos_hero_application_activation_command_queue['"]\)/)
})

test('Hero Operations surfaces application SLA, credential, binding, and attribution state',()=>{
  const source=page()
  for(const field of ['is_overdue','priority_rank','stage_age_hours','stage_sla_hours','required_uploaded_count','required_accepted_count','uploaded_document_count','accepted_document_count','account_bound','source_attributed','next_required_action']) assert.match(source,new RegExp(field))
  assert.match(source,/DOCUMENTS REQUIRED/)
  assert.match(source,/SLA OVERDUE/)
  assert.match(source,/ACCOUNT BINDING NEEDED/)
  assert.match(source,/RECRUITING ATTRIBUTED/)
})

test('pre-review activation visibility is additive and keeps credential review controls intact',()=>{
  const source=page()
  assert.match(source,/sos_ops_hero_applications/)
  assert.match(source,/sos_ops_hero_application_documents/)
  assert.match(source,/sos_ops_review_hero_application_document/)
  assert.match(source,/sos_ops_review_hero_application/)
  assert.match(source,/Review credentials/)
  assert.match(source,/Approve for claim/)
})

test('Hero Operations makes the pre-volume empty state explicit instead of inventing supply',()=>{
  const source=page()
  assert.match(source,/No active Hero applications yet\./)
  assert.match(source,/first legitimate applicant will appear here immediately/i)
})
