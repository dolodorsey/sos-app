import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const upgrade = readFileSync(new URL('../src/components/SOSUIUpgradeHost.jsx', import.meta.url), 'utf8')
const responsive = readFileSync(new URL('../src/components/sos-responsive-contract.css', import.meta.url), 'utf8')

test('S.O.S. Home removes injected content before the animation', () => {
  assert.match(upgrade, /sos-home-animation-first/)
  assert.match(upgrade, /querySelectorAll\('\.sos3-home-intro,\.sos3-ad-slot'\).*remove\(\)/)
  assert.doesNotMatch(upgrade, /createElement\('section'\)[\s\S]{0,200}intro/)
  assert.doesNotMatch(upgrade, /SPONSORED · PARTNER PLACEMENT/)
})

test('animation-first mode hides header and readiness content only while Home is mounted', () => {
  assert.match(responsive, /sos-home-animation-first \.sos2-topbar/)
  assert.match(responsive, /sos-home-animation-first \.sosx-readiness/)
  assert.match(upgrade, /classList\.toggle\('sos-home-animation-first',Boolean\(hero\)\)/)
  assert.match(upgrade, /classList\.remove\('sos-home-animation-first'\)/)
})
