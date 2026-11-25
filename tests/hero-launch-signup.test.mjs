import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('Hero sign-up: side of town, top-5 launch services, Tow/Lockout proof', () => {
  const page = read('src/app/hero/apply/page.jsx')
  const launch = read('src/lib/sosLaunch.js')
  assert.match(launch, /TRADE_PROOF_SERVICES = \['tow', 'lockout'\]/)
  for (const z of ['east', 'south', 'west', 'downtown', 'midtown', 'buckhead']) assert.match(launch, new RegExp(`id: '${z}'`))
  assert.match(page, /Side of town you'll cover/)
  assert.match(page, /HERO_LAUNCH_SERVICES\.map/)
  assert.match(page, /Proof required/)
  assert.match(page, /Open to all/)
  assert.match(page, /Other services you can provide/)
  assert.match(page, /form\.launch\.length>0/, 'must pick at least one launch service')
  assert.match(page, /form\.zones\.length/, 'side of town required')
  assert.match(page, /REQUIRED FOR TOW \/ LOCKOUT/)
})

test('Hero sign-up collects business + schedule and a narrow background-check consent', () => {
  const page = read('src/app/hero/apply/page.jsx')
  assert.match(page, /BUSINESS & SCHEDULE/)
  assert.match(page, /Do you already run a business/)
  assert.match(page, /Days you want to work/)
  assert.match(page, /Times you want to work/)
  assert.match(page, /sex-offender registry status and convictions for sex offenses, domestic violence, or crimes against children/)
  assert.match(page, /separate written disclosure/)
})

test('edge function stores new intake fields once the migration is live, and still works before it', () => {
  const fn = read('supabase/functions/submit-sos-hero-application/index.ts')
  const mig = read('supabase/migrations/20261120090000_sos_hero_application_zones_and_launch_services.sql')
  assert.match(fn, /service_zones:zones/)
  assert.match(fn, /intake_profile/)
  assert.match(fn, /PGRST204/)
  assert.match(mig, /add column if not exists service_zones/)
  assert.match(mig, /add column if not exists intake_profile jsonb/)
  assert.match(mig, /'selfie'/)
})
