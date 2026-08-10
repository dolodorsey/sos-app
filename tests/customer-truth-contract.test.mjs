import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const host = read('src/components/SOSCustomerTruthHost.jsx')
const page = read('src/app/app/page.jsx')

test('S.O.S. customer truth host is mounted on the production customer route', () => {
  assert.match(page, /SOSCustomerTruthHost/)
  assert.match(page, /<SOSCustomerTruthHost\/>/)
})

test('customer map never displays a hardcoded city before location consent', () => {
  assert.doesNotMatch(host, /DEFAULT_CENTER/)
  assert.match(host, /frame\.src='about:blank'/)
  assert.match(host, /frame\.style\.visibility='hidden'/)
  assert.match(host, /dataset\.sosMapState='awaiting-location'/)
  assert.match(host, /navigator\.geolocation\.getCurrentPosition/)
  assert.match(host, /mapUrl\(position\.coords\.latitude,position\.coords\.longitude\)/)
  assert.match(host, /dataset\.sosMapState='customer-location'/)
})

test('availability language remains conservative until verified Hero coverage is known', () => {
  assert.match(host, /coverageCount>0\?'Get help now':'Browse roadside help'/)
  assert.match(host, /roadside services in the catalog\. Verified Hero coverage is shown service-by-service/)
  assert.match(host, /Checking verified Hero coverage/)
  assert.match(host, /Verified Hero coverage not active yet/)
  assert.match(host, /dataset\.verifiedCoverage==='active'/)
})
