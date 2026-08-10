import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('../src/components/SOSSessionRefreshHost.jsx', import.meta.url), 'utf8')

test('invalid S.O.S. refresh tokens clear the stale session instead of retrying forever', () => {
  assert.match(source, /payload\?\.error_code/)
  assert.match(source, /refresh_token_not_found/)
  assert.match(source, /invalid refresh token\|refresh token not found/i)
  assert.match(source, /localStorage\.removeItem\(SESSION_KEY\)/)
  assert.match(source, /sos:session-expired/)
  assert.match(source, /window\.location\.reload\(\)/)

  const invalidBranch = source.slice(source.indexOf('if(invalidRefresh)'), source.indexOf("console.warn('S.O.S. session refresh deferred"))
  assert.doesNotMatch(invalidBranch, /setTimeout\(schedule,MIN_RETRY_MS\)/)
})

test('transient S.O.S. refresh failures still use bounded retry', () => {
  assert.match(source, /MIN_RETRY_MS=30000/)
  assert.match(source, /console\.warn\('S\.O\.S\. session refresh deferred'/)
  assert.match(source, /timer=window\.setTimeout\(schedule,MIN_RETRY_MS\)/)
})
