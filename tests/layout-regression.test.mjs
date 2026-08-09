import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('desktop rescue stylesheet is imported after every earlier SOS stylesheet', () => {
  const layout = read('src/app/layout.jsx')
  const rescueIndex = layout.indexOf("import '../components/sos-root-layout-rescue.css'")
  for (const earlier of [
    "import './globals.css'",
    "import '../components/sos-mobility.css'",
    "import '../components/sos-customer-v2.css'",
    "import '../components/sos-elite.css'",
    "import '../components/sos-desktop-final.css'",
    "import '../components/sos-membership.css'",
  ]) assert.ok(rescueIndex > layout.indexOf(earlier), `${earlier} must load before the desktop rescue stylesheet`)
})

test('desktop customer and Hero products break out of the legacy 450px app shell', () => {
  const rescue = read('src/components/sos-root-layout-rescue.css')
  assert.match(rescue, /@media \(min-width: 900px\)/)
  assert.match(rescue, /\.app-shell\.sos-premium[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.sos2-app[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.shc-app,[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.sos2-auth,[\s\S]*?max-width:\s*480px\s*!important/)
})

test('desktop SOS customer and Hero products cannot regress to micro-sized phone typography', () => {
  const rescue = read('src/components/sos-root-layout-rescue.css')
  assert.match(rescue, /\.sos2-service-list strong,[\s\S]*?font-size:\s*14px\s*!important/)
  assert.match(rescue, /\.sos2-service-list p,[\s\S]*?font-size:\s*12px\s*!important/)
  assert.match(rescue, /\.sos2-nav button small[\s\S]*?font-size:\s*10px\s*!important/)
  assert.match(rescue, /\.shc-mission-list strong,[\s\S]*?font-size:\s*13px\s*!important/)
  assert.match(rescue, /\.shc-metrics small,[\s\S]*?font-size:\s*10px\s*!important/)
})

test('fee-review component never reads localStorage during state initialization', () => {
  const review = read('src/components/SOSSettlementReviewHost.jsx')
  assert.doesNotMatch(review, /useState\s*\(\s*\(\s*\)\s*=>\s*localStorage/)
  assert.match(review, /useEffect\(\(\)=>\{let disposed=false;try\{setDismissed\(localStorage/)
})

test('customer and Hero portals mount the real operations layers', () => {
  const customer = read('src/app/app/page.jsx')
  const hero = read('src/app/hero/page.jsx')
  for (const host of ['SOSCustomerOperationsHost','SOSCustomerCancellationHost','SOSSettlementReviewHost','SOSMissionChatHost','SOSPaymentReadinessHost','SOSMembershipHost']) assert.match(customer, new RegExp(host))
  for (const host of ['SOSHeroAlertsHost','SOSHeroIssueHost','SOSHeroNoShowHost','SOSHeroReliabilityHost','SOSMissionChatHost','SOSPaymentReadinessHost']) assert.match(hero, new RegExp(host))
})
