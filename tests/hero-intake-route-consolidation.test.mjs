import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

// Pre-launch (issue #103): public recruiting routes lead to early-interest registration,
// never to the full credentialed application or a retired intake.
test('src/app/apply/page.jsx permanently redirects to provider early registration',()=>{
  const src=read('src/app/apply/page.jsx')
  assert.match(src,/permanentRedirect\(['"]\/become-a-hero\/['"]\)/)
  assert.doesNotMatch(src,/submit-provider-application/)
  assert.doesNotMatch(src,/dzlmtvodpyhetvektfuo/)
})

test('src/app/become-a-hero/page.jsx is the early-interest registration, not the full application',()=>{
  const src=read('src/app/become-a-hero/page.jsx')
  assert.match(src,/SOSProviderEarlyRegistration/)
  assert.doesNotMatch(src,/hero\/apply/)
  assert.doesNotMatch(src,/submit-provider-application/)
  assert.doesNotMatch(src,/sos-provider-application/)
  assert.doesNotMatch(src,/dzlmtvodpyhetvektfuo/)
})

test('the retired provider edge function remains fail-closed',()=>{
  const src=read('supabase/functions/submit-provider-application/index.ts')
  assert.match(src,/status:\s*410/)
  assert.match(src,/Legacy provider intake is retired|legacy provider intake is retired/i)
  assert.match(src,/\/hero\/apply/)
})

test('the canonical Hero application targets only the isolated S.O.S. backend',()=>{
  const src=read('src/app/hero/apply/page.jsx')
  assert.match(src,/cxdqkjvtpilvouwtbgdy\.supabase\.co/)
  assert.match(src,/submit-sos-hero-application/)
  assert.doesNotMatch(src,/dzlmtvodpyhetvektfuo/)
})
