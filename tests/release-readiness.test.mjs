import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('health contract identifies the app and authority', () => {
  const health = JSON.parse(read('public/health.json'))
  assert.equal(health.app, 'sos-app')
  assert.equal(health.authority, 'MCP Gateway public.sos_*')
  assert.equal(health.schema_version, 1)
})

test('handoff prevents unsafe dedicated-database cutover', () => {
  const handoff = read('docs/HANDOFF.md')
  assert.match(handoff, /MCP Gateway public\.sos_\*/)
  assert.match(handoff, /No dual write/i)
  assert.match(handoff, /RLS|grants/i)
})
