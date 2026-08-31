import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

for (const route of ['src/app/apply/page.jsx','src/app/become-a-hero/page.jsx']) {
  test(`${route} permanently redirects into the secure Hero application`,()=>{
    const src=read(route)
    assert.match(src,/permanentRedirect\(['"]\/hero\/apply['"]\)/)
    assert.doesNotMatch(src,/submit-provider-application/)
    assert.doesNotMatch(src,/sos-provider-application/)
    assert.doesNotMatch(src,/dzlmtvodpyhetvektfuo/)
  })
}

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
