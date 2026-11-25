import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('sosatl.com/drive links reach the sign-up page with source tracking', () => {
  const cfg = JSON.parse(read('vercel.json'))
  for (const host of ['sosatl.com', 'www.sosatl.com']) {
    const r = cfg.redirects.filter(x => x.has?.[0]?.value === host)
    for (const src of ['/drive', '/drive/']) assert.ok(r.some(x => x.source === src && x.destination.endsWith('/hero/apply/?src=drive')), `${host}${src}`)
    for (const src of ['/drive/:via(qr|ad|share)', '/drive/:via(qr|ad|share)/']) assert.ok(r.some(x => x.source === src && x.destination.endsWith('?src=drive&via=:via')), `${host}${src}`)
    const di = r.findIndex(x => x.source === '/drive'), ci = r.findIndex(x => x.source.startsWith('/:code'))
    assert.ok(di < ci, 'driver rules come before personal-link rules')
  }
})

test('driver sign-ups ask platform and last trip, and keep every approval gate', () => {
  const page = read('src/app/hero/apply/page.jsx')
  assert.match(page, /q\.get\('src'\)!=='drive'/)
  assert.match(page, /\['qr','ad','share'\]/)
  assert.match(page, /data-driver-questions/)
  assert.match(page, /data-driver-banner/)
  assert.match(page, /\(!isDriver\|\|form\.rsPlatform\)/, 'drivers must pick a platform')
  assert.match(page, /Rideshare driver: \$\{/, 'answers reach the application summary')
  assert.match(page, /identity, license, insurance and background checks/)
})
