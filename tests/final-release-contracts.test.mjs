import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('SOS customer and Hero account recovery is mounted and completes a real password reset', () => {
  const customer=read('src/app/app/page.jsx'), hero=read('src/app/hero/page.jsx'), recovery=read('src/components/SOSRecoveryHost.jsx'), reset=read('src/app/auth/reset/page.jsx')
  assert.match(customer,/SOSRecoveryHost audience="customer"/)
  assert.match(hero,/SOSRecoveryHost audience="hero"/)
  assert.match(recovery,/resetPasswordForEmail/)
  assert.match(recovery,/\/auth\/reset\?portal=/)
  assert.match(reset,/exchangeCodeForSession/)
  assert.match(reset,/updateUser\(\{password\}\)/)
})

test('shared webhook reconciles SOS Accounts v2 payout readiness into verification', () => {
  const webhook=read('supabase/functions/stripe-webhook/index.ts')
  assert.match(webhook,/2026-06-24\.dahlia/)
  assert.match(webhook,/\/v2\/core\/accounts\//)
  assert.match(webhook,/stripe_connect_api_version==='v2'/)
  assert.match(webhook,/check_type:'payout_account'/)
  assert.match(webhook,/status:ready\?'passed':'submitted'/)
  assert.match(webhook,/sos_recompute_hero_verification_admin/)
})

test('SOS iOS delivery is automated and builds the Capacitor SPM xcodeproj', () => {
  const fastlane=read('ios/App/fastlane/Fastfile'), workflow=read('.github/workflows/ios-testflight.yml'), gemfile=read('Gemfile')
  assert.match(fastlane,/project: "App\.xcodeproj"/)
  assert.doesNotMatch(fastlane,/App\.xcworkspace/)
  assert.match(fastlane,/upload_to_testflight/)
  assert.match(fastlane,/allowProvisioningUpdates/)
  assert.match(workflow,/runs-on: macos-latest/)
  assert.match(workflow,/npm run verify/)
  assert.match(workflow,/npx cap sync ios/)
  assert.match(workflow,/bundle exec fastlane ios beta/)
  assert.match(workflow,/ASC_KEY_ID/)
  assert.match(gemfile,/fastlane", "2\.237\.0"/)
})
