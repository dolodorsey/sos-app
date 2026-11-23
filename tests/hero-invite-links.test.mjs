import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('personal sign-up links: pre-fill, server autosave, resume, and completion', () => {
  const page = read('src/app/hero/apply/page.jsx')
  assert.match(page, /q\.get\('i'\)/, 'reads the ?i= link code')
  assert.match(page, /sos_hero_invite_open/)
  assert.match(page, /sos_hero_invite_save/)
  assert.match(page, /sos_hero_invite_complete/)
  assert.match(page, /SAVED TO YOUR LINK/)
  assert.match(page, /open the same link to pick up where you left off/)
  assert.match(page, /lastInviteSave\.current/, 'does not re-save an unchanged form')
})

test('invite migration keeps the gates: drafts only, service-role link minting, token-proven completion', () => {
  const mig = read('supabase/migrations/20261123020000_sos_hero_invite_links.sql')
  assert.match(mig, /enable row level security/)
  assert.match(mig, /revoke all on public\.sos_hero_invites from anon, authenticated/)
  assert.match(mig, /revoke all on function public\.sos_ops_hero_invite_for_candidate\(uuid, text\) from public, anon, authenticated/)
  assert.match(mig, /status_token_hash = encode\(extensions\.digest\(p_tracking_token, 'sha256'\), 'hex'\)/)
  assert.match(mig, /pg_column_size\(p_draft\) > 16384/)
  assert.doesNotMatch(mig, /set status = 'approved'|verification_status/, 'links never approve or verify anyone')
})

test('sosatl.com short links forward to the sign-up page', () => {
  const cfg = JSON.parse(read('vercel.json'))
  const r = cfg.redirects.find(x => x.source.startsWith('/:code'))
  assert.equal(r.destination, 'https://thesuperherosonstandby.com/hero/apply/?i=:code')
  assert.match(r.has[0].value, /sosatl/)
})

test('selfie is an allowed document type at the table level', () => {
  const mig = read('supabase/migrations/20261123010000_sos_hero_selfie_document_type.sql')
  assert.match(mig, /'drivers_license','selfie'/)
})
