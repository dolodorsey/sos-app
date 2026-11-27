import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('SOS recovery is mounted once and retains both current and legacy reset handlers', () => {
  const customer=read('src/app/app/page.jsx'), hero=read('src/app/hero/page.jsx'), recovery=read('src/components/SOSPasswordRecoveryHost.jsx'), reset=read('src/app/auth/reset/page.jsx')
  assert.doesNotMatch(customer,/SOSRecoveryHost/)
  assert.doesNotMatch(hero,/SOSRecoveryHost/)
  assert.match(read('src/app/layout.jsx'),/SOSPasswordRecoveryHost/)
  assert.match(recovery,/createPortal\(<button type="button"/)
  assert.match(reset,/exchangeCodeForSession/)
  assert.match(reset,/updateUser\(\{password\}\)/)
})

test('signed Stripe Accounts v2 webhook reconciles SOS payout readiness into verification', () => {
  const webhook=read('supabase/functions/stripe-v2-account-webhook/index.ts')
  const legacy=read('supabase/functions/stripe-webhook/index.ts')
  assert.match(webhook,/2026-06-24\.dahlia/)
  assert.match(webhook,/\/v2\/core\/accounts\//)
  assert.match(webhook,/STRIPE_V2_ACCOUNT_WEBHOOK_SECRET/)
  assert.match(webhook,/check_type:'payout_account'/)
  assert.match(webhook,/status:ready\?'passed':'submitted'/)
  assert.match(webhook,/sos_recompute_hero_verification_admin/)
  assert.match(legacy,/stripe_connect_api_version==='v2'/)
  assert.match(legacy,/ignored_legacy_account_snapshot:true/)
})

test('SOS iOS delivery uses Supabase-backed App Store distribution signing and TestFlight', () => {
  const fastlane=read('ios/App/fastlane/Fastfile'), workflow=read('.github/workflows/ios-testflight.yml'), gemfile=read('Gemfile')
  assert.match(fastlane,/project: "App\.xcodeproj"/)
  assert.doesNotMatch(fastlane,/App\.xcworkspace/)
  assert.match(fastlane,/upload_to_testflight/)
  assert.match(fastlane,/IOS_PROFILE_NAME/)
  assert.match(fastlane,/CODE_SIGN_STYLE=Manual/)
  assert.match(fastlane,/provisioningProfiles/)
  assert.doesNotMatch(fastlane,/allowProvisioningUpdates/)
  assert.match(workflow,/runs-on: xcode-27/, "App Store Connect requires the iOS 27 SDK (ITMS-90725)")
  assert.match(workflow,/show-sdk-version/, "build fails fast if the SDK is older than 27")
  assert.match(workflow,/id-token: write/)
  assert.match(workflow,/github-apple-release-credentials/)
  assert.match(workflow,/provisioning_profile_content_base64/)
  assert.match(workflow,/npm run verify/)
  assert.match(workflow,/npx cap sync ios/)
  assert.match(workflow,/bundle exec fastlane ios beta/)
  assert.match(gemfile,/fastlane", "2\.237\.0"/)
})

test('SOS App Store status can be checked on demand without a build', () => {
  const workflow=read('.github/workflows/ios-testflight.yml')
  assert.match(workflow,/status_only:\n\s+description:[^\n]*\n\s+type: boolean\n\s+default: false/)
  assert.match(workflow,/if: github\.event_name != 'schedule' && !\(github\.event_name == 'workflow_dispatch' && \(inputs\.status_only \|\| inputs\.review_demo != 'no'\)\)/)
  assert.match(workflow,/\n  store-status:\n/, 'store-status job runs on every trigger, including status-only dispatch')
  assert.match(workflow,/cron: '23 \*\/6 \* \* \*'/)
})
