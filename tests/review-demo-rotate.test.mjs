import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fn = readFileSync(new URL('../ops/gateway-functions/sos-review-demo-rotate/index.ts', import.meta.url), 'utf8')
const wf = readFileSync(new URL('../.github/workflows/ios-testflight.yml', import.meta.url), 'utf8')

test('demo-password rotation never returns or logs a password', () => {
  const replies = [...fn.matchAll(/json\(\{[^\n]*\}/g)].map(m => m[0])
  assert.ok(replies.length >= 4)
  for (const r of replies) assert.doesNotMatch(r, /\bpw\b|oldPassword|demo\.password|password:/, r)
  assert.doesNotMatch(fn, /console\.(log|info|warn|error)\([^)]*\b(pw|oldPassword)\b/)
})

test('rotation refuses while Apple is reviewing, and puts everything back on failure', () => {
  assert.match(fn, /state==='IN_REVIEW'\)\)return fail\('apple_in_review'/)
  assert.match(fn, /if\(!u\.ok\)\{await revertApple\(done\)/)
  assert.match(fn, /if\(!s2\.ok\)\{await setPassword\(s1\.token,oldPassword\);await revertApple\(done\)/)
  assert.match(fn, /if\(error\)\{await setPassword\(s2\.token,oldPassword\);await revertApple\(done\)/)
  assert.match(fn, /payload\.workflow_ref!==WORKFLOW_REF/)
})

test('workflow review-demo job prints only whitelisted status fields and skips the build', () => {
  const job = wf.slice(wf.indexOf('\n  review-demo:'))
  assert.match(job, /safe=\{k:d\.get\(k\) for k in \('ok','dry_run','stage','detail'/)
  assert.doesNotMatch(job, /cat "\$RUNNER_TEMP\/r\.json"|print\(d\)|json\.dumps\(d/)
  assert.match(wf, /inputs\.status_only \|\| inputs\.review_demo != 'no'/)
})
